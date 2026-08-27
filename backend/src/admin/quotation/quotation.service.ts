import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  buildPagination,
  buildPaginationMeta,
  tableExists,
} from '../common/admin-table.util';
import { CreateQuotationDto } from './dto/create-quotation.dto';

export type QuotationSource = 'pcmazing' | 'legacy';
export type QuotationStatus = 'draft' | 'finalized' | 'expired' | 'converted';
export type QuotationDiscountType = 'none' | 'senior' | 'pwd';

export interface QuotationListItem {
  id: number;
  source: QuotationSource;
  quoteNo: string | null;
  quoteDate: string | null;
  customerName: string | null;
  totalAmount: number | null;
  status: string | null;
  expiresAt: string | null;
  convertedSalesId: number | null;
  createdAt: string | null;
}

export interface QuotationItem {
  id: number;
  materialId: number | null;
  materialName: string | null;
  productId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  sellPrice: number | null;
  discountType: QuotationDiscountType;
  discountPrice: number | null;
  totalSetQty: number | null;
  lineTotal: number;
  remarks: string | null;
  metadata: Record<string, unknown> | null;
}

export interface QuotationDetail extends QuotationListItem {
  customerAddress: string | null;
  customerContactPerson: string | null;
  customerContactNumber: string | null;
  customerEmail: string | null;
  validityDays: number | null;
  remarks: string | null;
  customDiscount: number;
  subtotal: number;
  discountTotal: number;
  items: QuotationItem[];
}

type NormalizedQuoteItem = {
  materialId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountType: QuotationDiscountType;
  lineTotal: number;
};

@Injectable()
export class QuotationService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(pageRaw?: string, limitRaw?: string, search?: string, status?: string) {
    const ownedExists = await tableExists(this.databaseService, 'pcmazing_quotations');
    const legacyExists = await tableExists(this.databaseService, 'tblquotation');

    if (!ownedExists && !legacyExists) {
      throw new ServiceUnavailableException(
        'Quotation tables are not available. Apply migration 064_quotations.sql.',
      );
    }

    const { page, limit, offset } = buildPagination(pageRaw, limitRaw);
    const unions: string[] = [];

    if (ownedExists) {
      unions.push(`
        SELECT
          'pcmazing'::text AS source,
          q.id,
          q.quote_no,
          q.quote_date::text,
          q.customer_name,
          q.total_amount::text,
          ${this.derivedStatusSql('q.status', 'q.expires_at')} AS status,
          q.expires_at::text,
          q.converted_sales_id,
          q.created_at::text
        FROM pcmazing_quotations q
        WHERE q.deleted_at IS NULL
      `);
    }

    if (legacyExists) {
      unions.push(`
        SELECT
          'legacy'::text AS source,
          q.id,
          q.quote_no,
          q.quote_date::text,
          q.customer_name,
          q.total_amount::text,
          ${this.derivedStatusSql('q.status', 'q.expires_at')} AS status,
          q.expires_at::text,
          q.converted_sales_id,
          q.created_at::text
        FROM tblquotation q
        WHERE COALESCE(q.is_deleted, FALSE) = FALSE
      `);
    }

    const params: unknown[] = [];
    const conditions: string[] = [];

    if (status?.trim()) {
      params.push(status.trim().toLowerCase());
      conditions.push(`LOWER(COALESCE(quotes.status, '')) = $${params.length}`);
    }

    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(COALESCE(quotes.quote_no, '') ILIKE $${params.length}
          OR COALESCE(quotes.customer_name, '') ILIKE $${params.length}
          OR COALESCE(quotes.status, '') ILIKE $${params.length})`,
      );
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const fromClause = `FROM (${unions.join(' UNION ALL ')}) quotes`;

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count ${fromClause} ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const listParams = [...params, limit, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const result = await this.databaseService.query<{
      source: QuotationSource;
      id: number;
      quote_no: string | null;
      quote_date: string | null;
      customer_name: string | null;
      total_amount: string | null;
      status: string | null;
      expires_at: string | null;
      converted_sales_id: number | null;
      created_at: string | null;
    }>(
      `SELECT
        quotes.source,
        quotes.id,
        quotes.quote_no,
        quotes.quote_date,
        quotes.customer_name,
        quotes.total_amount,
        quotes.status,
        quotes.expires_at,
        quotes.converted_sales_id,
        quotes.created_at
       ${fromClause}
       ${whereClause}
       ORDER BY quotes.created_at DESC NULLS LAST, quotes.id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      listParams,
    );

    return {
      items: result.rows.map((row) => this.mapListRow(row)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(id: number, sourceRaw?: string): Promise<QuotationDetail> {
    const source = this.normalizeSource(sourceRaw);

    if (source !== 'legacy') {
      const owned = await this.getOwnedById(id);
      if (owned) {
        return owned;
      }
      if (source === 'pcmazing') {
        throw new NotFoundException(`Quotation ${id} was not found.`);
      }
    }

    const legacy = await this.getLegacyById(id);
    if (legacy) {
      return legacy;
    }

    throw new NotFoundException(`Quotation ${id} was not found.`);
  }

  async create(dto: CreateQuotationDto, createdBy?: number): Promise<QuotationDetail> {
    if (!(await tableExists(this.databaseService, 'pcmazing_quotations'))) {
      throw new ServiceUnavailableException(
        'Quotations table is not available. Apply migration 064_quotations.sql.',
      );
    }

    const payload = await this.normalizeHeader(dto);
    const items = await this.normalizeItems(dto.items ?? []);
    const totals = this.calculateTotals(items, dto.customDiscount ?? 0);

    const newId = await this.databaseService.withTransaction(async (client) => {
      const insertResult = await client.query<{ id: number }>(
        `INSERT INTO pcmazing_quotations (
          quote_date,
          customer_name,
          customer_address,
          customer_contact_number,
          customer_email,
          remarks,
          custom_discount,
          subtotal,
          discount_total,
          total_amount,
          status,
          validity_days,
          expires_at,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id`,
        [
          payload.quoteDate.toISOString(),
          payload.customerName,
          payload.customerAddress,
          payload.customerPhone,
          payload.customerEmail,
          payload.remarks,
          totals.customDiscount,
          totals.subtotal,
          totals.discountTotal,
          totals.totalAmount,
          payload.status,
          payload.validityDays,
          payload.expiresAt.toISOString(),
          createdBy ?? null,
        ],
      );

      const quotationId = insertResult.rows[0]?.id;
      if (!quotationId) {
        throw new ServiceUnavailableException('Unable to create quotation.');
      }

      await client.query(
        `UPDATE pcmazing_quotations
         SET quote_no = $1
         WHERE id = $2`,
        [this.buildQuoteNo(quotationId), quotationId],
      );

      await this.insertItems(client, quotationId, items);
      return quotationId;
    });

    return this.getById(newId, 'pcmazing');
  }

  async updateDraft(id: number, dto: CreateQuotationDto): Promise<QuotationDetail> {
    const existing = await this.getOwnedById(id);
    if (!existing) {
      throw new NotFoundException(`Quotation ${id} was not found.`);
    }
    if (existing.status !== 'draft') {
      throw new BadRequestException('Only draft quotations can be edited.');
    }

    const payload = await this.normalizeHeader(dto);
    const items = await this.normalizeItems(dto.items ?? []);
    const totals = this.calculateTotals(items, dto.customDiscount ?? 0);

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE pcmazing_quotations
         SET quote_date = $1,
             customer_name = $2,
             customer_address = $3,
             customer_contact_number = $4,
             customer_email = $5,
             remarks = $6,
             custom_discount = $7,
             subtotal = $8,
             discount_total = $9,
             total_amount = $10,
             status = $11,
             validity_days = $12,
             expires_at = $13,
             updated_at = NOW()
         WHERE id = $14 AND deleted_at IS NULL`,
        [
          payload.quoteDate.toISOString(),
          payload.customerName,
          payload.customerAddress,
          payload.customerPhone,
          payload.customerEmail,
          payload.remarks,
          totals.customDiscount,
          totals.subtotal,
          totals.discountTotal,
          totals.totalAmount,
          payload.status,
          payload.validityDays,
          payload.expiresAt.toISOString(),
          id,
        ],
      );

      await client.query(
        `UPDATE pcmazing_quotation_items
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE quotation_id = $1 AND deleted_at IS NULL`,
        [id],
      );

      await this.insertItems(client, id, items);
    });

    return this.getById(id, 'pcmazing');
  }

  private async getOwnedById(id: number): Promise<QuotationDetail | null> {
    if (!(await tableExists(this.databaseService, 'pcmazing_quotations'))) {
      return null;
    }

    const headerResult = await this.databaseService.query<{
      id: number;
      quote_no: string | null;
      quote_date: string | null;
      customer_name: string | null;
      customer_address: string | null;
      customer_contact_number: string | null;
      customer_email: string | null;
      total_amount: string | null;
      custom_discount: string | null;
      subtotal: string | null;
      discount_total: string | null;
      status: string | null;
      validity_days: number | null;
      expires_at: string | null;
      converted_sales_id: number | null;
      remarks: string | null;
      created_at: string | null;
    }>(
      `SELECT
        id,
        quote_no,
        quote_date::text,
        customer_name,
        customer_address,
        customer_contact_number,
        customer_email,
        total_amount::text,
        custom_discount::text,
        subtotal::text,
        discount_total::text,
        ${this.derivedStatusSql('status', 'expires_at')} AS status,
        validity_days,
        expires_at::text,
        converted_sales_id,
        remarks,
        created_at::text
       FROM pcmazing_quotations
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );

    const header = headerResult.rows[0];
    if (!header) {
      return null;
    }

    const itemsResult = await this.databaseService.query<{
      id: number;
      material_id: number | null;
      material_name: string | null;
      description: string;
      quantity: string;
      unit_price: string;
      discount_type: string | null;
      line_total: string;
    }>(
      `SELECT
        i.id,
        i.material_id,
        m.material_name,
        i.description,
        i.quantity::text,
        i.unit_price::text,
        i.discount_type,
        i.line_total::text
       FROM pcmazing_quotation_items i
       LEFT JOIN tblmaterials m ON m.id = i.material_id
       WHERE i.quotation_id = $1 AND i.deleted_at IS NULL
       ORDER BY i.id ASC`,
      [id],
    );

    const items: QuotationItem[] = itemsResult.rows.map((row) => {
      const quantity = Number(row.quantity ?? 0);
      const unitPrice = Number(row.unit_price ?? 0);
      const lineTotal = Number(row.line_total ?? 0);
      return {
        id: row.id,
        materialId: row.material_id,
        materialName: row.material_name,
        productId: null,
        description: row.description,
        quantity,
        unitPrice,
        sellPrice: unitPrice,
        discountType: this.normalizeDiscountType(row.discount_type),
        discountPrice: null,
        totalSetQty: quantity,
        lineTotal,
        remarks: row.description,
        metadata: { description: row.description },
      };
    });

    return {
      ...this.mapListRow({
        source: 'pcmazing',
        id: header.id,
        quote_no: header.quote_no,
        quote_date: header.quote_date,
        customer_name: header.customer_name,
        total_amount: header.total_amount,
        status: header.status,
        expires_at: header.expires_at,
        converted_sales_id: header.converted_sales_id,
        created_at: header.created_at,
      }),
      customerAddress: header.customer_address,
      customerContactPerson: null,
      customerContactNumber: header.customer_contact_number,
      customerEmail: header.customer_email,
      validityDays: header.validity_days,
      remarks: header.remarks,
      customDiscount: Number(header.custom_discount ?? 0),
      subtotal: Number(header.subtotal ?? 0),
      discountTotal: Number(header.discount_total ?? 0),
      items,
    };
  }

  private async getLegacyById(id: number): Promise<QuotationDetail | null> {
    if (!(await tableExists(this.databaseService, 'tblquotation'))) {
      return null;
    }

    const headerResult = await this.databaseService.query<{
      id: number;
      quote_no: string | null;
      quote_date: string | null;
      customer_name: string | null;
      customer_address: string | null;
      customer_contact_person: string | null;
      customer_contact_number: string | null;
      customer_email: string | null;
      total_amount: string | null;
      status: string | null;
      validity_days: number | null;
      expires_at: string | null;
      converted_sales_id: number | null;
      remarks: string | null;
      created_at: string | null;
    }>(
      `SELECT
        id,
        quote_no,
        quote_date::text,
        customer_name,
        customer_address,
        customer_contact_person,
        customer_contact_number,
        customer_email,
        total_amount::text,
        ${this.derivedStatusSql('status', 'expires_at')} AS status,
        validity_days,
        expires_at::text,
        converted_sales_id,
        remarks,
        created_at::text
       FROM tblquotation
       WHERE id = $1 AND COALESCE(is_deleted, FALSE) = FALSE
       LIMIT 1`,
      [id],
    );

    const header = headerResult.rows[0];
    if (!header) {
      return null;
    }

    let items: QuotationItem[] = [];

    if (await tableExists(this.databaseService, 'tblquotation_items')) {
      const itemsResult = await this.databaseService.query<Record<string, unknown>>(
        `SELECT
          id,
          material_id,
          product_id,
          unit_price::text AS unit_price,
          sell_price::text AS sell_price,
          discount_price::text AS discount_price,
          total_set_qty,
          line_total::text AS line_total,
          remarks
         FROM tblquotation_items
         WHERE quotation_id = $1
         ORDER BY id ASC`,
        [id],
      );

      items = itemsResult.rows.map((row) => {
        const remarks = String(row['remarks'] ?? '');
        const metadata = this.parseItemMetadata(remarks);
        const description =
          metadata && typeof metadata['description'] === 'string'
            ? metadata['description']
            : remarks || 'Line item';
        const quantity = Number(row['total_set_qty'] ?? 0);
        const unitPrice =
          row['sell_price'] !== null && row['sell_price'] !== undefined
            ? Number(row['sell_price'])
            : Number(row['unit_price'] ?? 0);
        const lineTotal =
          row['line_total'] !== null && row['line_total'] !== undefined
            ? Number(row['line_total'])
            : quantity * unitPrice;

        return {
          id: Number(row['id']),
          materialId: row['material_id'] != null ? Number(row['material_id']) : null,
          materialName: null,
          productId: row['product_id'] != null ? Number(row['product_id']) : null,
          description,
          quantity,
          unitPrice,
          sellPrice: row['sell_price'] !== null ? Number(row['sell_price']) : null,
          discountType: 'none' as const,
          discountPrice: row['discount_price'] !== null ? Number(row['discount_price']) : null,
          totalSetQty: row['total_set_qty'] != null ? Number(row['total_set_qty']) : null,
          lineTotal,
          remarks: remarks || null,
          metadata,
        };
      });
    }

    const totalAmount = header.total_amount !== null ? Number(header.total_amount) : 0;

    return {
      ...this.mapListRow({
        source: 'legacy',
        id: header.id,
        quote_no: header.quote_no,
        quote_date: header.quote_date,
        customer_name: header.customer_name,
        total_amount: header.total_amount,
        status: header.status,
        expires_at: header.expires_at,
        converted_sales_id: header.converted_sales_id,
        created_at: header.created_at,
      }),
      customerAddress: header.customer_address,
      customerContactPerson: header.customer_contact_person,
      customerContactNumber: header.customer_contact_number,
      customerEmail: header.customer_email,
      validityDays: header.validity_days,
      remarks: header.remarks,
      customDiscount: 0,
      subtotal: totalAmount,
      discountTotal: 0,
      items,
    };
  }

  private async normalizeHeader(dto: CreateQuotationDto) {
    const customerName = dto.customerName?.trim();
    if (!customerName) {
      throw new BadRequestException('Customer name is required.');
    }

    const quoteDate = dto.quoteDate ? new Date(dto.quoteDate) : new Date();
    if (Number.isNaN(quoteDate.getTime())) {
      throw new BadRequestException('Quote date is invalid.');
    }

    const validityDays = Math.min(365, Math.max(1, Number(dto.validityDays) || 7));
    const expiresAt = new Date(quoteDate.getTime() + validityDays * 24 * 60 * 60 * 1000);
    const status = dto.status === 'finalized' ? 'finalized' : 'draft';

    return {
      customerName,
      customerPhone: dto.customerPhone?.trim() || null,
      customerEmail: dto.customerEmail?.trim() || null,
      customerAddress: dto.customerAddress?.trim() || null,
      remarks: dto.remarks?.trim() || null,
      quoteDate,
      validityDays,
      expiresAt,
      status,
    };
  }

  private async normalizeItems(items: CreateQuotationDto['items']): Promise<NormalizedQuoteItem[]> {
    if (!items.length) {
      throw new BadRequestException('Add at least one item to the quotation.');
    }

    const materialIds = [
      ...new Set(
        items
          .map((item) => Number(item.materialId))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];

    const materialMap = new Map<number, { materialName: string; sellPrice: number }>();

    if (materialIds.length) {
      if (!(await tableExists(this.databaseService, 'tblmaterials'))) {
        throw new ServiceUnavailableException('Inventory materials table is not available.');
      }

      const materialsResult = await this.databaseService.query<{
        id: number;
        material_name: string;
        sell_price: string | null;
        unit_price: string | null;
      }>(
        `SELECT id, material_name, sell_price::text, unit_price::text
         FROM tblmaterials
         WHERE id = ANY($1::bigint[]) AND deleted_at IS NULL`,
        [materialIds],
      );

      for (const row of materialsResult.rows) {
        materialMap.set(Number(row.id), {
          materialName: row.material_name,
          sellPrice: Number(row.sell_price ?? row.unit_price ?? 0),
        });
      }
    }

    return items.map((item, index) => {
      const materialId = Number(item.materialId);
      const hasMaterial = Number.isFinite(materialId) && materialId > 0;
      const customDescription = item.description?.trim() || '';

      if (!hasMaterial && !customDescription) {
        throw new BadRequestException(
          `Row ${index + 1} needs an inventory item or a custom description.`,
        );
      }

      let description = customDescription;
      let unitPrice =
        item.unitPrice !== undefined && item.unitPrice !== null ? Number(item.unitPrice) : 0;

      if (hasMaterial) {
        const material = materialMap.get(materialId);
        if (!material) {
          throw new BadRequestException(`Material ${materialId} was not found.`);
        }
        description = customDescription || material.materialName;
        if (item.unitPrice === undefined || item.unitPrice === null) {
          unitPrice = material.sellPrice;
        }
      }

      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(`Row ${index + 1} quantity must be greater than 0.`);
      }

      const discountType = this.normalizeDiscountType(item.discountType);
      const gross = quantity * unitPrice;
      const lineTotal = Math.max(0, gross - this.computeLineDiscount(gross, discountType));

      return {
        materialId: hasMaterial ? materialId : null,
        description,
        quantity,
        unitPrice,
        discountType,
        lineTotal,
      };
    });
  }

  private async insertItems(
    client: { query: DatabaseService['query'] },
    quotationId: number,
    items: NormalizedQuoteItem[],
  ): Promise<void> {
    for (const item of items) {
      await client.query(
        `INSERT INTO pcmazing_quotation_items (
           quotation_id,
           material_id,
           description,
           quantity,
           unit_price,
           discount_type,
           line_total
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          quotationId,
          item.materialId,
          item.description,
          item.quantity,
          item.unitPrice,
          item.discountType,
          item.lineTotal,
        ],
      );
    }
  }

  private calculateTotals(items: NormalizedQuoteItem[], customDiscount: number) {
    let subtotal = 0;
    let lineDiscountTotal = 0;

    for (const item of items) {
      const gross = item.quantity * item.unitPrice;
      subtotal += gross;
      lineDiscountTotal += this.computeLineDiscount(gross, item.discountType);
    }

    const normalizedCustomDiscount = Math.max(0, Number(customDiscount) || 0);
    const discountTotal = lineDiscountTotal + normalizedCustomDiscount;
    const totalAmount = Math.max(0, subtotal - discountTotal);

    return {
      subtotal,
      discountTotal,
      customDiscount: normalizedCustomDiscount,
      totalAmount,
    };
  }

  private computeLineDiscount(amount: number, discountType: QuotationDiscountType): number {
    if (discountType === 'senior' || discountType === 'pwd') {
      return amount * 0.2;
    }
    return 0;
  }

  private normalizeDiscountType(value?: string | null): QuotationDiscountType {
    const normalized = String(value ?? 'none').trim().toLowerCase();
    if (normalized === 'senior' || normalized === 'pwd') {
      return normalized;
    }
    return 'none';
  }

  private normalizeSource(value?: string): QuotationSource | undefined {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'legacy' || normalized === 'pcmazing') {
      return normalized;
    }
    return undefined;
  }

  private buildQuoteNo(id: number): string {
    return `QT-${String(id).padStart(6, '0')}`;
  }

  private derivedStatusSql(statusColumn: string, expiresColumn: string): string {
    return `CASE
      WHEN LOWER(COALESCE(${statusColumn}, '')) = 'finalized'
           AND ${expiresColumn} IS NOT NULL
           AND ${expiresColumn} < NOW()
        THEN 'expired'
      ELSE LOWER(COALESCE(${statusColumn}, ''))
    END`;
  }

  private mapListRow(row: {
    source?: QuotationSource | string | null;
    id: number;
    quote_no: string | null;
    quote_date: string | null;
    customer_name: string | null;
    total_amount: string | null;
    status: string | null;
    expires_at: string | null;
    converted_sales_id: number | null;
    created_at: string | null;
  }): QuotationListItem {
    return {
      id: row.id,
      source: row.source === 'legacy' ? 'legacy' : 'pcmazing',
      quoteNo: row.quote_no,
      quoteDate: row.quote_date,
      customerName: row.customer_name,
      totalAmount: row.total_amount !== null ? Number(row.total_amount) : null,
      status: row.status,
      expiresAt: row.expires_at,
      convertedSalesId: row.converted_sales_id,
      createdAt: row.created_at,
    };
  }

  private parseItemMetadata(remarks: string): Record<string, unknown> | null {
    if (!remarks.trim()) {
      return null;
    }

    try {
      return JSON.parse(remarks) as Record<string, unknown>;
    } catch {
      return { description: remarks };
    }
  }
}
