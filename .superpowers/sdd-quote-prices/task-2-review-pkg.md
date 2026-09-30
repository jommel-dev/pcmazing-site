BASE: 405c904
HEAD: e07f67c855a044416e48d318dfabaea94d63a81b


## Commits

e07f67c Add local price lists admin API and CSV replace.

## Stat

 backend/src/admin/admin.module.ts                  |   4 +
 .../local-price-lists/dto/local-price-item.dto.ts  |  50 +++
 .../local-price-lists/dto/local-price-store.dto.ts |  24 ++
 .../local-price-lists.controller.ts                | 125 ++++++
 .../local-price-lists/local-price-lists.service.ts | 421 +++++++++++++++++++++
 5 files changed, 624 insertions(+)

## Diff

diff --git a/backend/src/admin/admin.module.ts b/backend/src/admin/admin.module.ts
index 96632e0..fdef9a4 100644
--- a/backend/src/admin/admin.module.ts
+++ b/backend/src/admin/admin.module.ts
@@ -40,32 +40,35 @@ import { CurrencyExchangeService } from './marketing/currency-exchange.service';
 import { PayrollController } from './payroll/payroll.controller';
 import { PayrollModule } from './payroll/payroll.module';
 import { ProjectsController } from './projects/projects.controller';
 import { ProjectsModule } from './projects/projects.module';
 import { CompanyExpensesController } from './company-expenses/company-expenses.controller';
 import { CompanyExpensesService } from './company-expenses/company-expenses.service';
 import { PartsPriceSearchController } from './parts-price-search/parts-price-search.controller';
 import { PartsPriceSearchService } from './parts-price-search/parts-price-search.service';
+import { LocalPriceListsController } from './local-price-lists/local-price-lists.controller';
+import { LocalPriceListsService } from './local-price-lists/local-price-lists.service';
 
 @Module({
   imports: [DatabaseModule, AuthModule, PayrollModule, ProjectsModule],
   controllers: [
     DashboardController,
     ContactInquiriesController,
     CustomerReviewsController,
     DemoRequestsController,
     InventoryController,
     InventoryServicesController,
     SalesOrdersController,
     ServiceTypesController,
     PurchaseController,
     QuotationController,
     PublicQuotationsController,
     PartsPriceSearchController,
+    LocalPriceListsController,
     UsersController,
     PayrollController,
     MarketingTeamsController,
     ClientProspectsController,
     ProjectsController,
     EmployeeWorkspaceController,
     PrintingSettingsController,
     PrintingTemplatesController,
@@ -78,16 +81,17 @@ import { PartsPriceSearchService } from './parts-price-search/parts-price-search
     DemoRequestsService,
     InventoryService,
     InventoryServicesService,
     SalesOrdersService,
     ServiceTypesService,
     PurchaseService,
     QuotationService,
     PartsPriceSearchService,
+    LocalPriceListsService,
     RbacService,
     RolesGuard,
     UsersService,
     MarketingTeamsService,
     ClientProspectsService,
     CurrencyExchangeService,
     EmployeeWorkspaceService,
     PrintingSettingsService,
diff --git a/backend/src/admin/local-price-lists/dto/local-price-item.dto.ts b/backend/src/admin/local-price-lists/dto/local-price-item.dto.ts
new file mode 100644
index 0000000..0feaca4
--- /dev/null
+++ b/backend/src/admin/local-price-lists/dto/local-price-item.dto.ts
@@ -0,0 +1,50 @@
+import { Type } from 'class-transformer';
+import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
+
+export class CreateLocalPriceItemDto {
+  @IsString()
+  @MinLength(1)
+  @MaxLength(500)
+  title!: string;
+
+  @Type(() => Number)
+  @IsNumber({ maxDecimalPlaces: 2 })
+  @Min(0)
+  @Max(999999999.99)
+  pricePhp!: number;
+
+  @IsOptional()
+  @IsString()
+  @MaxLength(120)
+  sku?: string | null;
+
+  @IsOptional()
+  @IsString()
+  @MaxLength(2000)
+  notes?: string | null;
+}
+
+export class UpdateLocalPriceItemDto {
+  @IsOptional()
+  @IsString()
+  @MinLength(1)
+  @MaxLength(500)
+  title?: string;
+
+  @IsOptional()
+  @Type(() => Number)
+  @IsNumber({ maxDecimalPlaces: 2 })
+  @Min(0)
+  @Max(999999999.99)
+  pricePhp?: number;
+
+  @IsOptional()
+  @IsString()
+  @MaxLength(120)
+  sku?: string | null;
+
+  @IsOptional()
+  @IsString()
+  @MaxLength(2000)
+  notes?: string | null;
+}
diff --git a/backend/src/admin/local-price-lists/dto/local-price-store.dto.ts b/backend/src/admin/local-price-lists/dto/local-price-store.dto.ts
new file mode 100644
index 0000000..bdb8d03
--- /dev/null
+++ b/backend/src/admin/local-price-lists/dto/local-price-store.dto.ts
@@ -0,0 +1,24 @@
+import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
+
+export class CreateLocalPriceStoreDto {
+  @IsString()
+  @MinLength(1)
+  @MaxLength(200)
+  name!: string;
+
+  @IsOptional()
+  @IsBoolean()
+  active?: boolean;
+}
+
+export class UpdateLocalPriceStoreDto {
+  @IsOptional()
+  @IsString()
+  @MinLength(1)
+  @MaxLength(200)
+  name?: string;
+
+  @IsOptional()
+  @IsBoolean()
+  active?: boolean;
+}
diff --git a/backend/src/admin/local-price-lists/local-price-lists.controller.ts b/backend/src/admin/local-price-lists/local-price-lists.controller.ts
new file mode 100644
index 0000000..db23615
--- /dev/null
+++ b/backend/src/admin/local-price-lists/local-price-lists.controller.ts
@@ -0,0 +1,125 @@
+import {
+  Body,
+  Controller,
+  Delete,
+  Get,
+  Param,
+  ParseIntPipe,
+  Patch,
+  Post,
+  Res,
+  UploadedFile,
+  UseGuards,
+  UseInterceptors,
+} from '@nestjs/common';
+import { FileInterceptor } from '@nestjs/platform-express';
+import { memoryStorage } from 'multer';
+import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
+import { CreateLocalPriceItemDto, UpdateLocalPriceItemDto } from './dto/local-price-item.dto';
+import { CreateLocalPriceStoreDto, UpdateLocalPriceStoreDto } from './dto/local-price-store.dto';
+import { LocalPriceListsService } from './local-price-lists.service';
+
+@Controller('admin/local-price-stores')
+@UseGuards(JwtAuthGuard)
+export class LocalPriceListsController {
+  constructor(private readonly localPriceListsService: LocalPriceListsService) {}
+
+  @Get()
+  listStores() {
+    return this.localPriceListsService.listStores().then((data) => ({
+      success: true,
+      data,
+    }));
+  }
+
+  @Post()
+  createStore(@Body() dto: CreateLocalPriceStoreDto) {
+    return this.localPriceListsService.createStore(dto).then((data) => ({
+      success: true,
+      message: 'Local price store created.',
+      data,
+    }));
+  }
+
+  @Patch(':id')
+  updateStore(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLocalPriceStoreDto) {
+    return this.localPriceListsService.updateStore(id, dto).then((data) => ({
+      success: true,
+      message: 'Local price store updated.',
+      data,
+    }));
+  }
+
+  @Get(':id/items')
+  listItems(@Param('id', ParseIntPipe) id: number) {
+    return this.localPriceListsService.listItems(id).then((data) => ({
+      success: true,
+      data,
+    }));
+  }
+
+  @Get(':id/items/import/template')
+  getImportTemplate(
+    @Param('id', ParseIntPipe) _id: number,
+    @Res({ passthrough: true }) response: import('express').Response,
+  ) {
+    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
+    response.setHeader(
+      'Content-Disposition',
+      'attachment; filename="local-price-list-import-template.csv"',
+    );
+    return this.localPriceListsService.getImportTemplate();
+  }
+
+  @Post(':id/items/import')
+  @UseInterceptors(
+    FileInterceptor('file', {
+      storage: memoryStorage(),
+      limits: { fileSize: 5 * 1024 * 1024 },
+    }),
+  )
+  importItems(
+    @Param('id', ParseIntPipe) id: number,
+    @UploadedFile() file: Express.Multer.File,
+  ) {
+    const content = file?.buffer?.toString('utf8') ?? '';
+    return this.localPriceListsService.replaceItemsFromCsv(id, content).then((data) => ({
+      success: true,
+      message: `${data.imported} item(s) imported (store list replaced).`,
+      data,
+    }));
+  }
+
+  @Post(':id/items')
+  createItem(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateLocalPriceItemDto) {
+    return this.localPriceListsService.createItem(id, dto).then((data) => ({
+      success: true,
+      message: 'Local price item created.',
+      data,
+    }));
+  }
+
+  @Patch(':id/items/:itemId')
+  updateItem(
+    @Param('id', ParseIntPipe) id: number,
+    @Param('itemId', ParseIntPipe) itemId: number,
+    @Body() dto: UpdateLocalPriceItemDto,
+  ) {
+    return this.localPriceListsService.updateItem(id, itemId, dto).then((data) => ({
+      success: true,
+      message: 'Local price item updated.',
+      data,
+    }));
+  }
+
+  @Delete(':id/items/:itemId')
+  deleteItem(
+    @Param('id', ParseIntPipe) id: number,
+    @Param('itemId', ParseIntPipe) itemId: number,
+  ) {
+    return this.localPriceListsService.deleteItem(id, itemId).then(() => ({
+      success: true,
+      message: 'Local price item deleted.',
+    }));
+  }
+}
diff --git a/backend/src/admin/local-price-lists/local-price-lists.service.ts b/backend/src/admin/local-price-lists/local-price-lists.service.ts
new file mode 100644
index 0000000..8a64ecb
--- /dev/null
+++ b/backend/src/admin/local-price-lists/local-price-lists.service.ts
@@ -0,0 +1,421 @@
+import {
+  BadRequestException,
+  Injectable,
+  NotFoundException,
+  ServiceUnavailableException,
+} from '@nestjs/common';
+import { DatabaseService } from '../../database/database.service';
+import { tableExists } from '../common/admin-table.util';
+import {
+  LOCAL_PRICE_LIST_TEMPLATE_CSV,
+  parseLocalPriceListCsv,
+} from './local-price-list-csv.util';
+import { CreateLocalPriceItemDto, UpdateLocalPriceItemDto } from './dto/local-price-item.dto';
+import { CreateLocalPriceStoreDto, UpdateLocalPriceStoreDto } from './dto/local-price-store.dto';
+
+export type LocalPriceStore = {
+  id: number;
+  name: string;
+  active: boolean;
+  createdAt: string | null;
+  updatedAt: string | null;
+};
+
+export type LocalPriceItem = {
+  id: number;
+  storeId: number;
+  title: string;
+  sku: string | null;
+  pricePhp: number;
+  notes: string | null;
+  createdAt: string | null;
+  updatedAt: string | null;
+};
+
+export type LocalPriceSearchHit = {
+  sourceId: string;
+  sourceLabel: string;
+  title: string;
+  pricePhp: number;
+  currency: 'PHP';
+  url: string;
+  sku?: string | null;
+};
+
+@Injectable()
+export class LocalPriceListsService {
+  constructor(private readonly databaseService: DatabaseService) {}
+
+  private async ensureTables(): Promise<void> {
+    const [storesOk, itemsOk] = await Promise.all([
+      tableExists(this.databaseService, 'pcmazing_local_price_stores'),
+      tableExists(this.databaseService, 'pcmazing_local_price_items'),
+    ]);
+    if (!storesOk || !itemsOk) {
+      throw new ServiceUnavailableException(
+        'Local price list tables are not available. Apply migration 072_local_price_lists_and_quotation_topup.sql.',
+      );
+    }
+  }
+
+  async listStores(): Promise<LocalPriceStore[]> {
+    await this.ensureTables();
+    const result = await this.databaseService.query<{
+      id: number | string;
+      name: string;
+      active: boolean;
+      created_at: string | null;
+      updated_at: string | null;
+    }>(
+      `SELECT id, name, active, created_at::text, updated_at::text
+       FROM pcmazing_local_price_stores
+       ORDER BY name ASC, id ASC`,
+    );
+    return result.rows.map((row) => this.mapStore(row));
+  }
+
+  async createStore(dto: CreateLocalPriceStoreDto): Promise<LocalPriceStore> {
+    await this.ensureTables();
+    const name = dto.name.trim();
+    if (!name) {
+      throw new BadRequestException('Store name is required.');
+    }
+
+    const insert = await this.databaseService.query<{ id: number | string }>(
+      `INSERT INTO pcmazing_local_price_stores (name, active)
+       VALUES ($1, $2)
+       RETURNING id`,
+      [name, dto.active ?? true],
+    );
+
+    return this.getStore(Number(insert.rows[0].id));
+  }
+
+  async updateStore(id: number, dto: UpdateLocalPriceStoreDto): Promise<LocalPriceStore> {
+    await this.ensureTables();
+    await this.assertStore(id);
+
+    if (dto.name !== undefined) {
+      const name = dto.name.trim();
+      if (!name) {
+        throw new BadRequestException('Store name is required.');
+      }
+    }
+
+    if (dto.name === undefined && dto.active === undefined) {
+      throw new BadRequestException('Provide name and/or active to update.');
+    }
+
+    await this.databaseService.query(
+      `UPDATE pcmazing_local_price_stores
+       SET name = COALESCE($1, name),
+           active = COALESCE($2, active),
+           updated_at = NOW()
+       WHERE id = $3`,
+      [dto.name?.trim() || null, dto.active ?? null, id],
+    );
+
+    return this.getStore(id);
+  }
+
+  async listItems(storeId: number): Promise<LocalPriceItem[]> {
+    await this.ensureTables();
+    await this.assertStore(storeId);
+
+    const result = await this.databaseService.query<{
+      id: number | string;
+      store_id: number | string;
+      title: string;
+      sku: string | null;
+      price_php: string;
+      notes: string | null;
+      created_at: string | null;
+      updated_at: string | null;
+    }>(
+      `SELECT id, store_id, title, sku, price_php::text, notes, created_at::text, updated_at::text
+       FROM pcmazing_local_price_items
+       WHERE store_id = $1
+       ORDER BY title ASC, id ASC`,
+      [storeId],
+    );
+
+    return result.rows.map((row) => this.mapItem(row));
+  }
+
+  async createItem(storeId: number, dto: CreateLocalPriceItemDto): Promise<LocalPriceItem> {
+    await this.ensureTables();
+    await this.assertStore(storeId);
+
+    const title = dto.title.trim();
+    if (!title) {
+      throw new BadRequestException('Item title is required.');
+    }
+
+    const sku = this.normalizeOptionalText(dto.sku);
+    const notes = this.normalizeOptionalText(dto.notes);
+
+    try {
+      const insert = await this.databaseService.query<{ id: number | string }>(
+        `INSERT INTO pcmazing_local_price_items (store_id, title, sku, price_php, notes)
+         VALUES ($1, $2, $3, $4, $5)
+         RETURNING id`,
+        [storeId, title, sku, dto.pricePhp, notes],
+      );
+      return this.getItem(storeId, Number(insert.rows[0].id));
+    } catch (error) {
+      this.rethrowUniqueSku(error);
+      throw error;
+    }
+  }
+
+  async updateItem(
+    storeId: number,
+    itemId: number,
+    dto: UpdateLocalPriceItemDto,
+  ): Promise<LocalPriceItem> {
+    await this.ensureTables();
+    await this.assertStore(storeId);
+    await this.getItem(storeId, itemId);
+
+    if (
+      dto.title === undefined &&
+      dto.pricePhp === undefined &&
+      dto.sku === undefined &&
+      dto.notes === undefined
+    ) {
+      throw new BadRequestException('Provide at least one field to update.');
+    }
+
+    if (dto.title !== undefined && !dto.title.trim()) {
+      throw new BadRequestException('Item title is required.');
+    }
+
+    try {
+      await this.databaseService.query(
+        `UPDATE pcmazing_local_price_items
+         SET title = COALESCE($1, title),
+             price_php = COALESCE($2, price_php),
+             sku = CASE WHEN $3::boolean THEN $4 ELSE sku END,
+             notes = CASE WHEN $5::boolean THEN $6 ELSE notes END,
+             updated_at = NOW()
+         WHERE id = $7 AND store_id = $8`,
+        [
+          dto.title?.trim() || null,
+          dto.pricePhp ?? null,
+          dto.sku !== undefined,
+          dto.sku !== undefined ? this.normalizeOptionalText(dto.sku) : null,
+          dto.notes !== undefined,
+          dto.notes !== undefined ? this.normalizeOptionalText(dto.notes) : null,
+          itemId,
+          storeId,
+        ],
+      );
+    } catch (error) {
+      this.rethrowUniqueSku(error);
+      throw error;
+    }
+
+    return this.getItem(storeId, itemId);
+  }
+
+  async deleteItem(storeId: number, itemId: number): Promise<void> {
+    await this.ensureTables();
+    await this.assertStore(storeId);
+    await this.getItem(storeId, itemId);
+
+    await this.databaseService.query(
+      `DELETE FROM pcmazing_local_price_items WHERE id = $1 AND store_id = $2`,
+      [itemId, storeId],
+    );
+  }
+
+  getImportTemplate(): string {
+    return LOCAL_PRICE_LIST_TEMPLATE_CSV;
+  }
+
+  async replaceItemsFromCsv(storeId: number, csvText: string): Promise<{ imported: number }> {
+    await this.ensureTables();
+    await this.assertStore(storeId);
+
+    let rows;
+    try {
+      rows = parseLocalPriceListCsv(csvText);
+    } catch (error) {
+      const message = error instanceof Error ? error.message : 'Invalid CSV';
+      throw new BadRequestException(message);
+    }
+
+    try {
+      await this.databaseService.withTransaction(async (client) => {
+        await client.query(`DELETE FROM pcmazing_local_price_items WHERE store_id = $1`, [storeId]);
+
+        for (const row of rows) {
+          await client.query(
+            `INSERT INTO pcmazing_local_price_items (store_id, title, sku, price_php, notes)
+             VALUES ($1, $2, $3, $4, $5)`,
+            [storeId, row.title, row.sku, row.pricePhp, row.notes],
+          );
+        }
+      });
+    } catch (error) {
+      this.rethrowUniqueSku(error);
+      throw error;
+    }
+
+    return { imported: rows.length };
+  }
+
+  async searchActiveItems(query: string, limit: number): Promise<LocalPriceSearchHit[]> {
+    await this.ensureTables();
+
+    const trimmed = query.trim();
+    if (!trimmed) {
+      return [];
+    }
+
+    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
+    const pattern = `%${trimmed}%`;
+
+    const result = await this.databaseService.query<{
+      store_id: number | string;
+      store_name: string;
+      title: string;
+      sku: string | null;
+      price_php: string;
+    }>(
+      `SELECT
+         s.id AS store_id,
+         s.name AS store_name,
+         i.title,
+         i.sku,
+         i.price_php::text
+       FROM pcmazing_local_price_items i
+       INNER JOIN pcmazing_local_price_stores s ON s.id = i.store_id
+       WHERE s.active = TRUE
+         AND (
+           i.title ILIKE $1
+           OR (i.sku IS NOT NULL AND i.sku ILIKE $1)
+         )
+       ORDER BY i.price_php ASC, i.title ASC, i.id ASC
+       LIMIT $2`,
+      [pattern, safeLimit],
+    );
+
+    return result.rows.map((row) => ({
+      sourceId: `local:${Number(row.store_id)}`,
+      sourceLabel: row.store_name,
+      title: row.title,
+      pricePhp: Number(row.price_php),
+      currency: 'PHP' as const,
+      url: '',
+      sku: row.sku,
+    }));
+  }
+
+  private async assertStore(storeId: number): Promise<LocalPriceStore> {
+    return this.getStore(storeId);
+  }
+
+  private async getStore(id: number): Promise<LocalPriceStore> {
+    const result = await this.databaseService.query<{
+      id: number | string;
+      name: string;
+      active: boolean;
+      created_at: string | null;
+      updated_at: string | null;
+    }>(
+      `SELECT id, name, active, created_at::text, updated_at::text
+       FROM pcmazing_local_price_stores
+       WHERE id = $1
+       LIMIT 1`,
+      [id],
+    );
+
+    const row = result.rows[0];
+    if (!row) {
+      throw new NotFoundException(`Local price store ${id} was not found.`);
+    }
+    return this.mapStore(row);
+  }
+
+  private async getItem(storeId: number, itemId: number): Promise<LocalPriceItem> {
+    const result = await this.databaseService.query<{
+      id: number | string;
+      store_id: number | string;
+      title: string;
+      sku: string | null;
+      price_php: string;
+      notes: string | null;
+      created_at: string | null;
+      updated_at: string | null;
+    }>(
+      `SELECT id, store_id, title, sku, price_php::text, notes, created_at::text, updated_at::text
+       FROM pcmazing_local_price_items
+       WHERE id = $1 AND store_id = $2
+       LIMIT 1`,
+      [itemId, storeId],
+    );
+
+    const row = result.rows[0];
+    if (!row) {
+      throw new NotFoundException(`Local price item ${itemId} was not found for store ${storeId}.`);
+    }
+    return this.mapItem(row);
+  }
+
+  private mapStore(row: {
+    id: number | string;
+    name: string;
+    active: boolean;
+    created_at: string | null;
+    updated_at: string | null;
+  }): LocalPriceStore {
+    return {
+      id: Number(row.id),
+      name: row.name,
+      active: Boolean(row.active),
+      createdAt: row.created_at,
+      updatedAt: row.updated_at,
+    };
+  }
+
+  private mapItem(row: {
+    id: number | string;
+    store_id: number | string;
+    title: string;
+    sku: string | null;
+    price_php: string;
+    notes: string | null;
+    created_at: string | null;
+    updated_at: string | null;
+  }): LocalPriceItem {
+    return {
+      id: Number(row.id),
+      storeId: Number(row.store_id),
+      title: row.title,
+      sku: row.sku,
+      pricePhp: Number(row.price_php),
+      notes: row.notes,
+      createdAt: row.created_at,
+      updatedAt: row.updated_at,
+    };
+  }
+
+  private normalizeOptionalText(value?: string | null): string | null {
+    if (value == null) {
+      return null;
+    }
+    const trimmed = value.trim();
+    return trimmed ? trimmed : null;
+  }
+
+  private rethrowUniqueSku(error: unknown): void {
+    const code =
+      error && typeof error === 'object' && 'code' in error
+        ? String((error as { code?: unknown }).code)
+        : '';
+    if (code === '23505') {
+      throw new BadRequestException('SKU must be unique within a store.');
+    }
+  }
+}
