import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import {
  buildPagination,
  buildPaginationMeta,
  tableExists,
} from '../common/admin-table.util';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

export interface PurchaseVendorOption {
  id: string;
  name: string;
}

export interface PurchaseListItem {
  id: number;
  poNumber: string | null;
  vendorName: string | null;
  totalAmount: number | null;
  status: string | null;
  poType: string | null;
  createdAt: string | null;
}

export interface PurchaseLineItem {
  id: number;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
}

export interface PurchaseDetail extends PurchaseListItem {
  vendorId: string | null;
  branchId: number | null;
  items: PurchaseLineItem[];
}

@Injectable()
export class PurchaseService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(pageRaw?: string, limitRaw?: string, search?: string, status?: string) {
    if (!(await tableExists(this.databaseService, 'tblpurchase_orders'))) {
      throw new ServiceUnavailableException('Purchase orders are not available in this database.');
    }

    const hasVendors = await tableExists(this.databaseService, 'tblvendors');
    const { page, limit, offset } = buildPagination(pageRaw, limitRaw);
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (status?.trim()) {
      params.push(status.trim().toLowerCase());
      conditions.push(
        `LOWER(COALESCE(to_jsonb(po)->>'status', 'pending')) = $${params.length}`,
      );
    }

    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      const searchIndex = params.length;
      conditions.push(`(
        COALESCE(to_jsonb(po)->>'po_number', to_jsonb(po)->>'poNumber', '') ILIKE $${searchIndex}
        OR COALESCE(to_jsonb(po)->>'status', '') ILIKE $${searchIndex}
        ${hasVendors ? `OR COALESCE(to_jsonb(v)->>'name', to_jsonb(v)->>'vendor_name', '') ILIKE $${searchIndex}` : ''}
      )`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const vendorJoin = hasVendors
      ? `LEFT JOIN tblvendors v ON v.id::text = COALESCE(to_jsonb(po)->>'vendor_id', to_jsonb(po)->>'vendorId', '')`
      : '';

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM tblpurchase_orders po
       ${vendorJoin}
       ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const listParams = [...params, limit, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const vendorSelect = hasVendors
      ? `COALESCE(to_jsonb(v)->>'name', to_jsonb(v)->>'vendor_name', '') AS vendor_name`
      : `'' AS vendor_name`;

    const result = await this.databaseService.query<{
      id: number;
      po_number: string | null;
      vendor_name: string | null;
      total_amount: string | null;
      status: string | null;
      po_type: string | null;
      created_at: string | null;
    }>(
      `SELECT
        po.id,
        COALESCE(to_jsonb(po)->>'po_number', to_jsonb(po)->>'poNumber', '') AS po_number,
        ${vendorSelect},
        COALESCE(to_jsonb(po)->>'total_amount', to_jsonb(po)->>'totalAmount', '0') AS total_amount,
        COALESCE(to_jsonb(po)->>'status', 'pending') AS status,
        COALESCE(po.po_type, to_jsonb(po)->>'poType', to_jsonb(po)->>'po_type', 'ACU') AS po_type,
        COALESCE(to_jsonb(po)->>'created_at', to_jsonb(po)->>'createdAt', null) AS created_at
       FROM tblpurchase_orders po
       ${vendorJoin}
       ${whereClause}
       ORDER BY po.id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      listParams,
    );

    return {
      items: result.rows.map((row) => this.mapListRow(row)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(id: number): Promise<PurchaseDetail> {
    if (!(await tableExists(this.databaseService, 'tblpurchase_orders'))) {
      throw new ServiceUnavailableException('Purchase orders are not available in this database.');
    }

    const hasVendors = await tableExists(this.databaseService, 'tblvendors');
    const vendorJoin = hasVendors
      ? `LEFT JOIN tblvendors v ON v.id::text = COALESCE(to_jsonb(po)->>'vendor_id', to_jsonb(po)->>'vendorId', '')`
      : '';
    const vendorSelect = hasVendors
      ? `COALESCE(to_jsonb(v)->>'name', to_jsonb(v)->>'vendor_name', '') AS vendor_name`
      : `'' AS vendor_name`;

    const headerResult = await this.databaseService.query<{
      id: number;
      po_number: string | null;
      vendor_id: string | null;
      vendor_name: string | null;
      total_amount: string | null;
      status: string | null;
      po_type: string | null;
      branch_id: string | null;
      created_at: string | null;
    }>(
      `SELECT
        po.id,
        COALESCE(to_jsonb(po)->>'po_number', to_jsonb(po)->>'poNumber', '') AS po_number,
        COALESCE(to_jsonb(po)->>'vendor_id', to_jsonb(po)->>'vendorId', '') AS vendor_id,
        ${vendorSelect},
        COALESCE(to_jsonb(po)->>'total_amount', to_jsonb(po)->>'totalAmount', '0') AS total_amount,
        COALESCE(to_jsonb(po)->>'status', 'pending') AS status,
        COALESCE(po.po_type, to_jsonb(po)->>'poType', to_jsonb(po)->>'po_type', 'ACU') AS po_type,
        COALESCE(to_jsonb(po)->>'branchId', to_jsonb(po)->>'branch_id', null) AS branch_id,
        COALESCE(to_jsonb(po)->>'created_at', to_jsonb(po)->>'createdAt', null) AS created_at
       FROM tblpurchase_orders po
       ${vendorJoin}
       WHERE po.id = $1
       LIMIT 1`,
      [id],
    );

    const header = headerResult.rows[0];
    if (!header) {
      throw new NotFoundException(`Purchase order ${id} was not found.`);
    }

    const items = await this.loadLineItems(id, header.po_type);

    return {
      ...this.mapListRow(header),
      vendorId: header.vendor_id || null,
      branchId: header.branch_id !== null ? Number(header.branch_id) : null,
      items,
    };
  }

  async listVendors(): Promise<PurchaseVendorOption[]> {
    if (!(await tableExists(this.databaseService, 'tblvendors'))) {
      return [];
    }

    const result = await this.databaseService.query<{ id: string; name: string }>(
      `SELECT
        v.id::text AS id,
        COALESCE(v.name, to_jsonb(v)->>'vendor_name', to_jsonb(v)->>'vendorName', 'Vendor') AS name
       FROM tblvendors v
       ORDER BY name ASC`,
    );

    return result.rows;
  }

  async create(dto: CreatePurchaseDto, userId?: number): Promise<PurchaseDetail> {
    if (!(await tableExists(this.databaseService, 'tblpurchase_orders'))) {
      throw new ServiceUnavailableException('Purchase orders are not available in this database.');
    }

    if (!(await tableExists(this.databaseService, 'tbltransaction_material_items'))) {
      throw new ServiceUnavailableException('Purchase line items are not available in this database.');
    }

    const vendorId = dto.vendorId?.trim();
    const vendorName = dto.vendorName?.trim();
    if (!vendorId && !vendorName) {
      throw new BadRequestException('Vendor is required.');
    }

    const poType = this.normalizePoType(dto.poType);
    const status = (dto.status?.trim().toLowerCase() || 'for_approval').toLowerCase();
    const totalAmount = this.computeTotal(dto.items);

    const purchaseId = await this.databaseService.withTransaction(async (client) => {
      const resolvedVendorId = await this.resolveVendorId(client, vendorId, vendorName);

      for (const item of dto.items) {
        await this.assertMaterialExists(client, item.materialId);
      }

      const purchaseColumns = await this.getTableColumns(client, 'tblpurchase_orders');
      const purchaseRecord = this.buildPurchaseRecord(purchaseColumns, {
        vendorId: resolvedVendorId,
        totalAmount,
        status,
        poType,
        userId,
        branchId: dto.branchId,
        remarks: dto.remarks?.trim() || null,
      });

      const purchaseInsert = await this.runInsert(client, 'tblpurchase_orders', purchaseRecord);
      const newPurchaseId = Number(purchaseInsert.rows[0]?.id);

      if (!Number.isFinite(newPurchaseId)) {
        throw new BadRequestException('Failed to create purchase order.');
      }

      const itemColumns = await this.getTableColumns(client, 'tbltransaction_material_items');

      for (const item of dto.items) {
        const discountPrice = item.discountPrice ?? 0;
        const itemRecord = this.buildMaterialItemRecord(itemColumns, {
          materialId: item.materialId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPrice,
          purchaseId: newPurchaseId,
        });

        await this.runInsert(client, 'tbltransaction_material_items', itemRecord);
      }

      if (dto.payments?.length) {
        await this.insertPayments(client, newPurchaseId, dto.payments, totalAmount);
      }

      return newPurchaseId;
    });

    return this.getById(purchaseId);
  }

  private normalizePoType(value?: string): string {
    const normalized = (value ?? 'ACM').trim().toUpperCase();
    if (['ACM', 'MATERIAL', 'ACP', 'ACU'].includes(normalized)) {
      return normalized === 'MATERIAL' ? 'ACM' : normalized;
    }
    return 'ACM';
  }

  private computeTotal(items: CreatePurchaseDto['items']): number {
    return items.reduce((sum, item) => {
      const price = item.discountPrice && item.discountPrice > 0 ? item.discountPrice : item.unitPrice;
      return sum + price * item.quantity;
    }, 0);
  }

  private async resolveVendorId(
    client: PoolClient,
    vendorId?: string,
    vendorName?: string,
  ): Promise<string> {
    if (!(await tableExists(this.databaseService, 'tblvendors'))) {
      throw new BadRequestException('Vendor records are not available.');
    }

    const columns = await this.getTableColumns(client, 'tblvendors');
    const nameColumn = this.pickColumn(columns, ['name', 'vendor_name']);

    if (vendorId) {
      const existing = await client.query<{ id: string }>(
        `SELECT id::text AS id FROM tblvendors WHERE id = $1 LIMIT 1`,
        [vendorId],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        return existing.rows[0].id;
      }
    }

    const normalizedName = vendorName?.trim();
    if (!normalizedName) {
      throw new BadRequestException('Selected vendor was not found.');
    }

    const matched = await client.query<{ id: string }>(
      `SELECT id::text AS id
       FROM tblvendors
       WHERE LOWER(TRIM(COALESCE(name, ''))) = LOWER(TRIM($1))
       LIMIT 1`,
      [normalizedName],
    );

    if (matched.rowCount && matched.rowCount > 0) {
      return matched.rows[0].id;
    }

    if (!nameColumn) {
      throw new BadRequestException('Unable to create a new vendor record.');
    }

    const inserted = await this.runInsert(client, 'tblvendors', {
      [nameColumn]: normalizedName,
    });

    const newId = inserted.rows[0]?.id;
    if (newId) {
      return String(newId);
    }

    return randomUUID();
  }

  private async insertPayments(
    client: PoolClient,
    purchaseId: number,
    payments: CreatePurchaseDto['payments'],
    orderTotal: number,
  ): Promise<void> {
    if (!payments?.length || !(await tableExists(this.databaseService, 'tblpo_payments'))) {
      return;
    }

    const paymentColumns = await this.getTableColumns(client, 'tblpo_payments');
    const poIdColumn = this.pickColumn(paymentColumns, [
      'po_id',
      'poId',
      'purchase_id',
      'purchaseId',
    ]);
    const methodColumn = this.pickColumn(paymentColumns, ['method']);
    const amountColumn = this.pickColumn(paymentColumns, ['amount', 'payment_amount', 'paymentAmount']);
    const paymentDateColumn = this.pickColumn(paymentColumns, ['payment_date', 'paymentDate']);
    const statusColumn = this.pickColumn(paymentColumns, ['status']);

    if (!poIdColumn || !methodColumn) {
      return;
    }

    for (const payment of payments) {
      const record: Record<string, unknown> = {
        [poIdColumn]: purchaseId,
        [methodColumn]: payment.method,
      };

      const amount = payment.amount ?? 0;
      if (amountColumn) {
        record[amountColumn] = amount;
      }

      if (paymentDateColumn && payment.paymentDate) {
        record[paymentDateColumn] = payment.paymentDate;
      }

      if (statusColumn) {
        record[statusColumn] =
          payment.status?.trim().toLowerCase() ||
          (amount >= orderTotal && orderTotal > 0 ? 'paid' : amount > 0 ? 'partial' : 'unpaid');
      }

      await this.runInsert(client, 'tblpo_payments', record);
    }
  }

  private async assertVendorExists(client: PoolClient, vendorId: string): Promise<void> {
    if (!(await tableExists(this.databaseService, 'tblvendors'))) {
      throw new BadRequestException('Vendor records are not available.');
    }

    const result = await client.query<{ id: string }>(
      `SELECT id::text AS id FROM tblvendors WHERE id = $1 LIMIT 1`,
      [vendorId],
    );

    if (result.rowCount === 0) {
      throw new BadRequestException('Selected vendor was not found.');
    }
  }

  private async assertMaterialExists(client: PoolClient, materialId: number): Promise<void> {
    const result = await client.query<{ id: number }>(
      `SELECT id FROM tblmaterials WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [materialId],
    );

    if (result.rowCount === 0) {
      throw new BadRequestException(`Material ${materialId} was not found.`);
    }
  }

  private buildPurchaseRecord(
    columns: Set<string>,
    input: {
      vendorId: string;
      totalAmount: number;
      status: string;
      poType: string;
      userId?: number;
      branchId?: number;
      remarks?: string | null;
    },
  ): Record<string, unknown> {
    const record: Record<string, unknown> = {};
    const vendorColumn = this.pickColumn(columns, ['vendor_id', 'vendorId']);
    const totalColumn = this.pickColumn(columns, ['total_amount', 'totalAmount']);
    const statusColumn = this.pickColumn(columns, ['status']);
    const poTypeColumn = this.pickColumn(columns, ['po_type', 'poType']);
    const createdByColumn = this.pickColumn(columns, ['created_by', 'createdBy']);
    const branchColumn = this.pickColumn(columns, ['branchId', 'branch_id']);
    const remarksColumn = this.pickColumn(columns, ['remarks', 'notes', 'note']);

    if (!vendorColumn || !totalColumn || !statusColumn) {
      throw new ServiceUnavailableException('Purchase order fields are not configured.');
    }

    record[vendorColumn] = input.vendorId;
    record[totalColumn] = input.totalAmount;
    record[statusColumn] = input.status;

    if (poTypeColumn) {
      record[poTypeColumn] = input.poType;
    }

    if (createdByColumn && input.userId) {
      record[createdByColumn] = input.userId;
    }

    if (branchColumn && input.branchId) {
      record[branchColumn] = input.branchId;
    }

    if (remarksColumn && input.remarks) {
      record[remarksColumn] = input.remarks;
    }

    return record;
  }

  private buildMaterialItemRecord(
    columns: Set<string>,
    input: {
      materialId: number;
      quantity: number;
      unitPrice: number;
      discountPrice: number;
      purchaseId: number;
    },
  ): Record<string, unknown> {
    const record: Record<string, unknown> = {};
    const transTypeColumn = this.pickColumn(columns, ['trans_type', 'transType']);
    const materialColumn = this.pickColumn(columns, ['material_id', 'materialId']);
    const quantityColumn = this.pickColumn(columns, ['quantity', 'total_set_qty', 'totalSetQty']);
    const unitPriceColumn = this.pickColumn(columns, ['unit_price', 'unitPrice']);
    const discountColumn = this.pickColumn(columns, ['discount_price', 'discountPrice']);
    const purchaseColumn = this.pickColumn(columns, ['purchase_id', 'purchaseId']);

    if (!transTypeColumn || !materialColumn || !quantityColumn || !unitPriceColumn || !purchaseColumn) {
      throw new ServiceUnavailableException('Purchase line item fields are not configured.');
    }

    record[transTypeColumn] = 'purchase';
    record[materialColumn] = input.materialId;
    record[quantityColumn] = input.quantity;
    record[unitPriceColumn] = input.unitPrice;
    record[purchaseColumn] = input.purchaseId;

    if (discountColumn) {
      record[discountColumn] = input.discountPrice;
    }

    return record;
  }

  private async getTableColumns(client: PoolClient, tableName: string): Promise<Set<string>> {
    const result = await client.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1`,
      [tableName],
    );

    return new Set(result.rows.map((row) => row.column_name));
  }

  private pickColumn(columns: Set<string>, candidates: string[]): string | null {
    for (const candidate of candidates) {
      if (columns.has(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private runInsert(client: PoolClient, tableName: string, record: Record<string, unknown>) {
    const entries = Object.entries(record).filter(([, value]) => value !== undefined);
    const columns = entries.map(([key]) => `"${key}"`).join(', ');
    const placeholders = entries.map((_, index) => `$${index + 1}`).join(', ');
    const values = entries.map(([, value]) => value);

    return client.query<{ id: number }>(
      `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) RETURNING id`,
      values,
    );
  }

  private async loadLineItems(purchaseId: number, poType: string | null): Promise<PurchaseLineItem[]> {
    const normalizedType = (poType ?? 'ACU').toUpperCase();
    const tableCandidates =
      normalizedType === 'ACP'
        ? ['tbltransaction_parts_items']
        : normalizedType === 'ACM' || normalizedType === 'MATERIAL'
          ? ['tbltransaction_material_items']
          : ['tbltransaction_product_items', 'tbltransaction_material_items', 'tbltransaction_parts_items'];

    for (const tableName of tableCandidates) {
      if (!(await tableExists(this.databaseService, tableName))) {
        continue;
      }

      if (tableName === 'tbltransaction_material_items') {
        const itemsResult = await this.databaseService.query<{
          id: number;
          material_name: string | null;
          material_code: string | null;
          quantity: string | null;
          unit_price: string | null;
          discount_price: string | null;
        }>(
          `SELECT
            tpi.id,
            m.material_name,
            m.material_code,
            COALESCE(tpi.quantity, 0)::text AS quantity,
            tpi.unit_price::text,
            COALESCE(tpi.discount_price, 0)::text AS discount_price
           FROM tbltransaction_material_items tpi
           LEFT JOIN tblmaterials m ON m.id = tpi.material_id
           WHERE tpi.purchase_id = $1
             AND LOWER(COALESCE(tpi.trans_type, 'purchase')) = 'purchase'
           ORDER BY tpi.id ASC`,
          [purchaseId],
        );

        if (itemsResult.rows.length > 0) {
          return itemsResult.rows.map((row) => {
            const quantity = row.quantity !== null ? Number(row.quantity) : null;
            const unitPrice = row.unit_price !== null ? Number(row.unit_price) : null;
            const discountPrice = row.discount_price !== null ? Number(row.discount_price) : null;
            const price = discountPrice && discountPrice > 0 ? discountPrice : unitPrice;

            return {
              id: row.id,
              description: row.material_name || row.material_code || `Material #${row.id}`,
              quantity,
              unitPrice,
              lineTotal: price !== null && quantity !== null ? price * quantity : null,
            };
          });
        }

        continue;
      }

      const itemsResult = await this.databaseService.query<Record<string, unknown>>(
        `SELECT to_jsonb(tpi) AS row
         FROM ${tableName} tpi
         WHERE COALESCE(
           to_jsonb(tpi)->>'purchaseId',
           to_jsonb(tpi)->>'purchase_id',
           to_jsonb(tpi)->>'po_id'
         ) = $1
         AND LOWER(COALESCE(to_jsonb(tpi)->>'transType', to_jsonb(tpi)->>'trans_type', 'purchase')) = 'purchase'
         ORDER BY tpi.id ASC`,
        [String(purchaseId)],
      );

      if (itemsResult.rows.length > 0) {
        return itemsResult.rows.map((entry, index) => this.mapLineItem(entry['row'], index));
      }
    }

    return [];
  }

  private mapLineItem(raw: unknown, index: number): PurchaseLineItem {
    const row = (raw ?? {}) as Record<string, unknown>;
    const description =
      this.pickString(row, ['materialName', 'material_name', 'partsName', 'parts_name', 'productName', 'product_name']) ||
      this.pickString(row, ['materialCode', 'material_code', 'partsCode', 'parts_code']) ||
      `Line item ${index + 1}`;

    const quantity = this.pickNumber(row, ['totalSetQty', 'total_set_qty', 'quantity', 'qty']);
    const unitPrice = this.pickNumber(row, ['unitPrice', 'unit_price', 'sellPrice', 'sell_price']);
    const lineTotal = this.pickNumber(row, ['lineTotal', 'line_total', 'totalAmount', 'total_amount']);

    return {
      id: this.pickNumber(row, ['id']) ?? index + 1,
      description,
      quantity,
      unitPrice,
      lineTotal,
    };
  }

  private mapListRow(row: {
    id: number;
    po_number: string | null;
    vendor_name: string | null;
    total_amount: string | null;
    status: string | null;
    po_type: string | null;
    created_at: string | null;
  }): PurchaseListItem {
    return {
      id: row.id,
      poNumber: row.po_number || null,
      vendorName: row.vendor_name || null,
      totalAmount: row.total_amount !== null ? Number(row.total_amount) : null,
      status: row.status,
      poType: row.po_type,
      createdAt: row.created_at,
    };
  }

  private pickString(row: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  private pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
    for (const key of keys) {
      const value = row[key];
      if (value === null || value === undefined || value === '') {
        continue;
      }
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return null;
  }
}
