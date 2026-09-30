import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';
import { PartsPriceSearchService } from '../parts-price-search/parts-price-search.service';
import {
  LOCAL_PRICE_LIST_TEMPLATE_CSV,
  parseLocalPriceListCsv,
} from './local-price-list-csv.util';
import { CreateLocalPriceItemDto, UpdateLocalPriceItemDto } from './dto/local-price-item.dto';
import { CreateLocalPriceStoreDto, UpdateLocalPriceStoreDto } from './dto/local-price-store.dto';

export type LocalPriceStore = {
  id: number;
  name: string;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type LocalPriceItem = {
  id: number;
  storeId: number;
  title: string;
  sku: string | null;
  pricePhp: number;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type LocalPriceSearchHit = {
  sourceId: string;
  sourceLabel: string;
  title: string;
  pricePhp: number;
  currency: 'PHP';
  url: string;
  sku?: string | null;
};

@Injectable()
export class LocalPriceListsService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => PartsPriceSearchService))
    private readonly partsPriceSearch: PartsPriceSearchService,
  ) {}

  private async ensureTables(): Promise<void> {
    const [storesOk, itemsOk] = await Promise.all([
      tableExists(this.databaseService, 'pcmazing_local_price_stores'),
      tableExists(this.databaseService, 'pcmazing_local_price_items'),
    ]);
    if (!storesOk || !itemsOk) {
      throw new ServiceUnavailableException(
        'Local price list tables are not available. Apply migration 072_local_price_lists_and_quotation_topup.sql.',
      );
    }
  }

  async listStores(): Promise<LocalPriceStore[]> {
    await this.ensureTables();
    const result = await this.databaseService.query<{
      id: number | string;
      name: string;
      active: boolean;
      created_at: string | null;
      updated_at: string | null;
    }>(
      `SELECT id, name, active, created_at::text, updated_at::text
       FROM pcmazing_local_price_stores
       ORDER BY name ASC, id ASC`,
    );
    return result.rows.map((row) => this.mapStore(row));
  }

  async createStore(dto: CreateLocalPriceStoreDto): Promise<LocalPriceStore> {
    await this.ensureTables();
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Store name is required.');
    }

    const insert = await this.databaseService.query<{ id: number | string }>(
      `INSERT INTO pcmazing_local_price_stores (name, active)
       VALUES ($1, $2)
       RETURNING id`,
      [name, dto.active ?? true],
    );

    this.partsPriceSearch.clearCache();
    return this.getStore(Number(insert.rows[0].id));
  }

  async updateStore(id: number, dto: UpdateLocalPriceStoreDto): Promise<LocalPriceStore> {
    await this.ensureTables();
    await this.assertStore(id);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Store name is required.');
      }
    }

    if (dto.name === undefined && dto.active === undefined) {
      throw new BadRequestException('Provide name and/or active to update.');
    }

    await this.databaseService.query(
      `UPDATE pcmazing_local_price_stores
       SET name = COALESCE($1, name),
           active = COALESCE($2, active),
           updated_at = NOW()
       WHERE id = $3`,
      [dto.name?.trim() || null, dto.active ?? null, id],
    );

    this.partsPriceSearch.clearCache();
    return this.getStore(id);
  }

  async listItems(storeId: number): Promise<LocalPriceItem[]> {
    await this.ensureTables();
    await this.assertStore(storeId);

    const result = await this.databaseService.query<{
      id: number | string;
      store_id: number | string;
      title: string;
      sku: string | null;
      price_php: string;
      notes: string | null;
      created_at: string | null;
      updated_at: string | null;
    }>(
      `SELECT id, store_id, title, sku, price_php::text, notes, created_at::text, updated_at::text
       FROM pcmazing_local_price_items
       WHERE store_id = $1
       ORDER BY title ASC, id ASC`,
      [storeId],
    );

    return result.rows.map((row) => this.mapItem(row));
  }

  async createItem(storeId: number, dto: CreateLocalPriceItemDto): Promise<LocalPriceItem> {
    await this.ensureTables();
    await this.assertStore(storeId);

    const title = dto.title.trim();
    if (!title) {
      throw new BadRequestException('Item title is required.');
    }

    const sku = this.normalizeOptionalText(dto.sku);
    const notes = this.normalizeOptionalText(dto.notes);

    try {
      const insert = await this.databaseService.query<{ id: number | string }>(
        `INSERT INTO pcmazing_local_price_items (store_id, title, sku, price_php, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [storeId, title, sku, dto.pricePhp, notes],
      );
      this.partsPriceSearch.clearCache();
      return this.getItem(storeId, Number(insert.rows[0].id));
    } catch (error) {
      this.rethrowUniqueSku(error);
      throw error;
    }
  }

  async updateItem(
    storeId: number,
    itemId: number,
    dto: UpdateLocalPriceItemDto,
  ): Promise<LocalPriceItem> {
    await this.ensureTables();
    await this.assertStore(storeId);
    await this.getItem(storeId, itemId);

    if (
      dto.title === undefined &&
      dto.pricePhp === undefined &&
      dto.sku === undefined &&
      dto.notes === undefined
    ) {
      throw new BadRequestException('Provide at least one field to update.');
    }

    if (dto.title !== undefined && !dto.title.trim()) {
      throw new BadRequestException('Item title is required.');
    }

    try {
      await this.databaseService.query(
        `UPDATE pcmazing_local_price_items
         SET title = COALESCE($1, title),
             price_php = COALESCE($2, price_php),
             sku = CASE WHEN $3::boolean THEN $4 ELSE sku END,
             notes = CASE WHEN $5::boolean THEN $6 ELSE notes END,
             updated_at = NOW()
         WHERE id = $7 AND store_id = $8`,
        [
          dto.title?.trim() || null,
          dto.pricePhp ?? null,
          dto.sku !== undefined,
          dto.sku !== undefined ? this.normalizeOptionalText(dto.sku) : null,
          dto.notes !== undefined,
          dto.notes !== undefined ? this.normalizeOptionalText(dto.notes) : null,
          itemId,
          storeId,
        ],
      );
    } catch (error) {
      this.rethrowUniqueSku(error);
      throw error;
    }

    this.partsPriceSearch.clearCache();
    return this.getItem(storeId, itemId);
  }

  async deleteItem(storeId: number, itemId: number): Promise<void> {
    await this.ensureTables();
    await this.assertStore(storeId);
    await this.getItem(storeId, itemId);

    await this.databaseService.query(
      `DELETE FROM pcmazing_local_price_items WHERE id = $1 AND store_id = $2`,
      [itemId, storeId],
    );
    this.partsPriceSearch.clearCache();
  }

  getImportTemplate(): string {
    return LOCAL_PRICE_LIST_TEMPLATE_CSV;
  }

  async replaceItemsFromCsv(storeId: number, csvText: string): Promise<{ imported: number }> {
    await this.ensureTables();
    await this.assertStore(storeId);

    let rows;
    try {
      rows = parseLocalPriceListCsv(csvText);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid CSV';
      throw new BadRequestException(message);
    }

    try {
      await this.databaseService.withTransaction(async (client) => {
        await client.query(`DELETE FROM pcmazing_local_price_items WHERE store_id = $1`, [storeId]);

        for (const row of rows) {
          await client.query(
            `INSERT INTO pcmazing_local_price_items (store_id, title, sku, price_php, notes)
             VALUES ($1, $2, $3, $4, $5)`,
            [storeId, row.title, row.sku, row.pricePhp, row.notes],
          );
        }
      });
    } catch (error) {
      this.rethrowUniqueSku(error);
      throw error;
    }

    this.partsPriceSearch.clearCache();
    return { imported: rows.length };
  }

  async searchActiveItems(query: string, limit: number): Promise<LocalPriceSearchHit[]> {
    await this.ensureTables();

    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const pattern = `%${trimmed}%`;

    const result = await this.databaseService.query<{
      store_id: number | string;
      store_name: string;
      title: string;
      sku: string | null;
      price_php: string;
    }>(
      `SELECT
         s.id AS store_id,
         s.name AS store_name,
         i.title,
         i.sku,
         i.price_php::text
       FROM pcmazing_local_price_items i
       INNER JOIN pcmazing_local_price_stores s ON s.id = i.store_id
       WHERE s.active = TRUE
         AND (
           i.title ILIKE $1
           OR (i.sku IS NOT NULL AND i.sku ILIKE $1)
         )
       ORDER BY i.price_php ASC, i.title ASC, i.id ASC
       LIMIT $2`,
      [pattern, safeLimit],
    );

    return result.rows.map((row) => ({
      sourceId: `local:${Number(row.store_id)}`,
      sourceLabel: row.store_name,
      title: row.title,
      pricePhp: Number(row.price_php),
      currency: 'PHP' as const,
      url: '',
      sku: row.sku,
    }));
  }

  private async assertStore(storeId: number): Promise<LocalPriceStore> {
    return this.getStore(storeId);
  }

  private async getStore(id: number): Promise<LocalPriceStore> {
    const result = await this.databaseService.query<{
      id: number | string;
      name: string;
      active: boolean;
      created_at: string | null;
      updated_at: string | null;
    }>(
      `SELECT id, name, active, created_at::text, updated_at::text
       FROM pcmazing_local_price_stores
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Local price store ${id} was not found.`);
    }
    return this.mapStore(row);
  }

  private async getItem(storeId: number, itemId: number): Promise<LocalPriceItem> {
    const result = await this.databaseService.query<{
      id: number | string;
      store_id: number | string;
      title: string;
      sku: string | null;
      price_php: string;
      notes: string | null;
      created_at: string | null;
      updated_at: string | null;
    }>(
      `SELECT id, store_id, title, sku, price_php::text, notes, created_at::text, updated_at::text
       FROM pcmazing_local_price_items
       WHERE id = $1 AND store_id = $2
       LIMIT 1`,
      [itemId, storeId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Local price item ${itemId} was not found for store ${storeId}.`);
    }
    return this.mapItem(row);
  }

  private mapStore(row: {
    id: number | string;
    name: string;
    active: boolean;
    created_at: string | null;
    updated_at: string | null;
  }): LocalPriceStore {
    return {
      id: Number(row.id),
      name: row.name,
      active: Boolean(row.active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapItem(row: {
    id: number | string;
    store_id: number | string;
    title: string;
    sku: string | null;
    price_php: string;
    notes: string | null;
    created_at: string | null;
    updated_at: string | null;
  }): LocalPriceItem {
    return {
      id: Number(row.id),
      storeId: Number(row.store_id),
      title: row.title,
      sku: row.sku,
      pricePhp: Number(row.price_php),
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value == null) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private rethrowUniqueSku(error: unknown): void {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';
    if (code === '23505') {
      throw new BadRequestException('SKU must be unique within a store.');
    }
  }
}
