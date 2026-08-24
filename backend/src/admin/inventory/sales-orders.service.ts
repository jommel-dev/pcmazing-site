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
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';

export interface SalesOrderListItem {
  id: number;
  referenceNo: string | null;
  customerName: string;
  customerPhone: string | null;
  notes: string | null;
  customDiscount: number;
  subtotal: number;
  discountTotal: number;
  totalAmount: number;
  isVoid: boolean;
  voidedAt: string | null;
  saleDate: string | null;
  itemCount: number;
  itemsSummary: string[];
  updatedAt: string | null;
}

export interface SalesOrderItem {
  id: number;
  materialId: number;
  materialName: string | null;
  materialCode: string | null;
  description: string | null;
  quantity: number;
  unitPrice: number;
  discountType: 'none' | 'senior' | 'pwd';
}

export interface SalesOrderDetail extends SalesOrderListItem {
  items: SalesOrderItem[];
}

export interface SalesOrderSummary {
  totalSales: number;
  totalDiscount: number;
  itemCount: number;
  orderCount: number;
}

@Injectable()
export class SalesOrdersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(
    pageRaw?: string,
    limitRaw?: string,
    search?: string,
    voidFilter?: string,
    sortByRaw?: string,
    sortDirRaw?: string,
    startDateRaw?: string,
    endDateRaw?: string,
  ) {
    if (!(await tableExists(this.databaseService, 'pcmazing_sales_orders'))) {
      throw new ServiceUnavailableException(
        'Sales orders table is not available. Apply migration 047_sales_orders.sql.',
      );
    }

    const { page, limit, offset } = buildPagination(pageRaw, limitRaw);
    const params: unknown[] = [];
    const conditions = ['o.deleted_at IS NULL'];

    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(o.customer_name ILIKE $${params.length}
          OR COALESCE(o.customer_phone, '') ILIKE $${params.length}
          OR COALESCE(o.reference_no, '') ILIKE $${params.length}
          OR COALESCE(o.notes, '') ILIKE $${params.length})`,
      );
    }

    if (voidFilter === 'void') {
      conditions.push('o.is_void = TRUE');
    } else if (voidFilter === 'active') {
      conditions.push('o.is_void = FALSE');
    }

    const startDate = this.parseDateBound(startDateRaw, false);
    const endDate = this.parseDateBound(endDateRaw, true);
    if (startDate) {
      params.push(startDate);
      conditions.push(`COALESCE(o.sale_date, o.created_at) >= $${params.length}::timestamptz`);
    }
    if (endDate) {
      params.push(endDate);
      conditions.push(`COALESCE(o.sale_date, o.created_at) <= $${params.length}::timestamptz`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const orderBy = this.buildListOrderBy(sortByRaw, sortDirRaw);

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM pcmazing_sales_orders o
       ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const summaryResult = await this.databaseService.query<{
      order_count: string;
      total_sales: string;
      total_discount: string;
      item_count: string;
    }>(
      `SELECT
        COUNT(*)::text AS order_count,
        COALESCE(SUM(CASE WHEN o.is_void THEN 0 ELSE o.total_amount END), 0)::text AS total_sales,
        COALESCE(SUM(CASE WHEN o.is_void THEN 0 ELSE o.discount_total END), 0)::text AS total_discount,
        COALESCE(SUM(CASE WHEN o.is_void THEN 0 ELSE items.item_count END), 0)::text AS item_count
       FROM pcmazing_sales_orders o
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS item_count
         FROM pcmazing_sales_order_items i
         WHERE i.sales_order_id = o.id AND i.deleted_at IS NULL
       ) items ON TRUE
       ${whereClause}`,
      params,
    );

    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;
    const result = await this.databaseService.query<{
      id: number;
      reference_no: string | null;
      customer_name: string;
      customer_phone: string | null;
      notes: string | null;
      custom_discount: string;
      subtotal: string;
      discount_total: string;
      total_amount: string;
      is_void: boolean;
      voided_at: string | null;
      sale_date: string | null;
      item_count: string;
      items_summary: string | null;
      updated_at: string | null;
    }>(
      `SELECT
        o.id,
        o.reference_no,
        o.customer_name,
        o.customer_phone,
        o.notes,
        o.custom_discount::text,
        o.subtotal::text,
        o.discount_total::text,
        o.total_amount::text,
        o.is_void,
        o.voided_at::text,
        o.sale_date::text,
        COALESCE(items.item_count, 0)::text AS item_count,
        items.items_summary,
        o.updated_at::text
       FROM pcmazing_sales_orders o
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS item_count,
           STRING_AGG(DISTINCT COALESCE(m.material_name, m.material_code, 'Item'), ', ' ORDER BY COALESCE(m.material_name, m.material_code, 'Item')) AS items_summary
         FROM pcmazing_sales_order_items i
         LEFT JOIN tblmaterials m ON m.id = i.material_id
         WHERE i.sales_order_id = o.id AND i.deleted_at IS NULL
       ) items ON TRUE
       ${whereClause}
       ${orderBy}
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      [...params, limit, offset],
    );

    return {
      items: result.rows.map((row) => this.mapListRow(row)),
      meta: buildPaginationMeta(page, limit, total),
      summary: {
        orderCount: Number(summaryResult.rows[0]?.order_count ?? 0),
        totalSales: Number(summaryResult.rows[0]?.total_sales ?? 0),
        totalDiscount: Number(summaryResult.rows[0]?.total_discount ?? 0),
        itemCount: Number(summaryResult.rows[0]?.item_count ?? 0),
      } satisfies SalesOrderSummary,
    };
  }

  async getById(id: number): Promise<SalesOrderDetail> {
    if (!(await tableExists(this.databaseService, 'pcmazing_sales_orders'))) {
      throw new ServiceUnavailableException(
        'Sales orders table is not available. Apply migration 047_sales_orders.sql.',
      );
    }

    const result = await this.databaseService.query<{
      id: number;
      reference_no: string | null;
      customer_name: string;
      customer_phone: string | null;
      notes: string | null;
      custom_discount: string;
      subtotal: string;
      discount_total: string;
      total_amount: string;
      is_void: boolean;
      voided_at: string | null;
      sale_date: string | null;
      item_count: string;
      items_summary: string | null;
      updated_at: string | null;
    }>(
      `SELECT
        o.id,
        o.reference_no,
        o.customer_name,
        o.customer_phone,
        o.notes,
        o.custom_discount::text,
        o.subtotal::text,
        o.discount_total::text,
        o.total_amount::text,
        o.is_void,
        o.voided_at::text,
        o.sale_date::text,
        COALESCE(items.item_count, 0)::text AS item_count,
        items.items_summary,
        o.updated_at::text
       FROM pcmazing_sales_orders o
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS item_count,
           STRING_AGG(DISTINCT COALESCE(m.material_name, m.material_code, 'Item'), ', ' ORDER BY COALESCE(m.material_name, m.material_code, 'Item')) AS items_summary
         FROM pcmazing_sales_order_items i
         LEFT JOIN tblmaterials m ON m.id = i.material_id
         WHERE i.sales_order_id = o.id AND i.deleted_at IS NULL
       ) items ON TRUE
       WHERE o.id = $1 AND o.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Sales order ${id} was not found.`);
    }

    const items = await this.loadItems(id);
    return {
      ...this.mapListRow(row),
      items,
    };
  }

  async create(dto: CreateSalesOrderDto, createdBy?: number): Promise<SalesOrderDetail> {
    if (!(await tableExists(this.databaseService, 'pcmazing_sales_orders'))) {
      throw new ServiceUnavailableException(
        'Sales orders table is not available. Apply migration 047_sales_orders.sql.',
      );
    }

    const customerName = dto.customerName?.trim();
    if (!customerName) {
      throw new BadRequestException('Customer name is required.');
    }

    const items = dto.items ?? [];
    if (!items.length) {
      throw new BadRequestException('Add at least one item to the sales order.');
    }

    const saleDate = dto.saleDate ? new Date(dto.saleDate) : new Date();
    if (Number.isNaN(saleDate.getTime())) {
      throw new BadRequestException('Sale date is invalid.');
    }

    const normalizedItems = await this.normalizeItems(items);
    const totals = this.calculateTotals(normalizedItems, dto.customDiscount ?? 0);

    const newId = await this.databaseService.withTransaction(async (client) => {
      await this.assertStockAvailable(client, normalizedItems);

      const insertResult = await client.query<{ id: number }>(
        `INSERT INTO pcmazing_sales_orders (
          customer_name,
          customer_phone,
          notes,
          custom_discount,
          subtotal,
          discount_total,
          total_amount,
          sale_date,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          customerName,
          dto.customerPhone?.trim() || null,
          dto.notes?.trim() || null,
          totals.customDiscount,
          totals.subtotal,
          totals.discountTotal,
          totals.totalAmount,
          saleDate.toISOString(),
          createdBy ?? null,
        ],
      );

      const salesOrderId = insertResult.rows[0]?.id;
      if (!salesOrderId) {
        throw new ServiceUnavailableException('Unable to create sales order.');
      }

      const referenceNo = this.buildReferenceNo(salesOrderId);
      await client.query(
        `UPDATE pcmazing_sales_orders
         SET reference_no = $1
         WHERE id = $2`,
        [referenceNo, salesOrderId],
      );

      for (const item of normalizedItems) {
        await client.query(
          `INSERT INTO pcmazing_sales_order_items (
             sales_order_id,
             material_id,
             quantity,
             unit_price,
             discount_type
           )
           VALUES ($1, $2, $3, $4, $5)`,
          [
            salesOrderId,
            item.materialId,
            item.quantity,
            item.unitPrice,
            item.discountType,
          ],
        );

        await client.query(
          `UPDATE tblmaterials
           SET on_hand_stock = COALESCE(on_hand_stock, 0) - $1,
               updated_at = NOW()
           WHERE id = $2 AND deleted_at IS NULL`,
          [item.quantity, item.materialId],
        );
      }

      return salesOrderId;
    });

    return this.getById(newId);
  }

  async voidOrder(id: number, voidedBy?: number): Promise<SalesOrderDetail> {
    const existing = await this.getById(id);
    if (existing.isVoid) {
      throw new BadRequestException('This sales order is already void.');
    }

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE pcmazing_sales_orders
         SET is_void = TRUE,
             voided_at = NOW(),
             voided_by = $1,
             updated_at = NOW()
         WHERE id = $2 AND deleted_at IS NULL`,
        [voidedBy ?? null, id],
      );

      for (const item of existing.items) {
        await client.query(
          `UPDATE tblmaterials
           SET on_hand_stock = COALESCE(on_hand_stock, 0) + $1,
               updated_at = NOW()
           WHERE id = $2 AND deleted_at IS NULL`,
          [item.quantity, item.materialId],
        );
      }
    });

    return this.getById(id);
  }

  private async loadItems(salesOrderId: number): Promise<SalesOrderItem[]> {
    const result = await this.databaseService.query<{
      id: number;
      material_id: number;
      material_name: string | null;
      material_code: string | null;
      description: string | null;
      quantity: string;
      unit_price: string;
      discount_type: 'none' | 'senior' | 'pwd';
    }>(
      `SELECT
        i.id,
        i.material_id,
        m.material_name,
        m.material_code,
        m.description,
        i.quantity::text,
        i.unit_price::text,
        i.discount_type
       FROM pcmazing_sales_order_items i
       LEFT JOIN tblmaterials m ON m.id = i.material_id
       WHERE i.sales_order_id = $1 AND i.deleted_at IS NULL
       ORDER BY i.id ASC`,
      [salesOrderId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      materialId: row.material_id,
      materialName: row.material_name,
      materialCode: row.material_code,
      description: row.description,
      quantity: Number(row.quantity ?? 0),
      unitPrice: Number(row.unit_price ?? 0),
      discountType: this.normalizeDiscountType(row.discount_type),
    }));
  }

  private async normalizeItems(
    items: CreateSalesOrderDto['items'],
  ): Promise<
    Array<{
      materialId: number;
      quantity: number;
      unitPrice: number;
      discountType: 'none' | 'senior' | 'pwd';
      materialName: string;
      onHandStock: number;
    }>
  > {
    if (!(await tableExists(this.databaseService, 'tblmaterials'))) {
      throw new ServiceUnavailableException('Inventory materials table is not available.');
    }

    const materialIds = [...new Set(items.map((item) => item.materialId))];
    const materialsResult = await this.databaseService.query<{
      id: number;
      material_name: string;
      sell_price: string | null;
      unit_price: string | null;
      on_hand_stock: string | null;
    }>(
      `SELECT id, material_name, sell_price::text, unit_price::text, on_hand_stock::text
       FROM tblmaterials
       WHERE id = ANY($1::bigint[]) AND deleted_at IS NULL`,
      [materialIds],
    );

    const materialMap = new Map<
      number,
      { materialName: string; sellPrice: number; onHandStock: number }
    >(
      materialsResult.rows.map((row) => [
        Number(row.id),
        {
          materialName: row.material_name,
          sellPrice: Number(row.sell_price ?? row.unit_price ?? 0),
          onHandStock: Number(row.on_hand_stock ?? 0),
        },
      ]),
    );

    return items.map((item) => {
      const material = materialMap.get(item.materialId);
      if (!material) {
        throw new BadRequestException(`Material ${item.materialId} was not found.`);
      }

      return {
        materialId: item.materialId,
        quantity: Number(item.quantity),
        unitPrice:
          item.unitPrice !== undefined && item.unitPrice !== null
            ? Number(item.unitPrice)
            : material.sellPrice,
        discountType: this.normalizeDiscountType(item.discountType),
        materialName: material.materialName,
        onHandStock: material.onHandStock,
      };
    });
  }

  private async assertStockAvailable(
    client: { query: DatabaseService['query'] },
    items: Array<{ materialId: number; quantity: number; materialName: string; onHandStock: number }>,
  ): Promise<void> {
    const requiredByMaterial = new Map<number, { quantity: number; materialName: string; onHandStock: number }>();

    for (const item of items) {
      const existing = requiredByMaterial.get(item.materialId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        requiredByMaterial.set(item.materialId, {
          quantity: item.quantity,
          materialName: item.materialName,
          onHandStock: item.onHandStock,
        });
      }
    }

    for (const [materialId, required] of requiredByMaterial) {
      const stockResult = await client.query<{ on_hand_stock: string | null }>(
        `SELECT on_hand_stock::text
         FROM tblmaterials
         WHERE id = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [Number(materialId)],
      );
      const available = Number(stockResult.rows[0]?.on_hand_stock ?? required.onHandStock ?? 0);
      if (required.quantity > available) {
        throw new BadRequestException(
          `Insufficient stock for "${required.materialName}". Available: ${available}, requested: ${required.quantity}.`,
        );
      }
    }
  }

  private calculateTotals(
    items: Array<{ quantity: number; unitPrice: number; discountType: 'none' | 'senior' | 'pwd' }>,
    customDiscount: number,
  ) {
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

  private computeLineDiscount(amount: number, discountType: 'none' | 'senior' | 'pwd'): number {
    if (discountType === 'senior' || discountType === 'pwd') {
      return amount * 0.2;
    }
    return 0;
  }

  private normalizeDiscountType(value?: string | null): 'none' | 'senior' | 'pwd' {
    const normalized = String(value ?? 'none').trim().toLowerCase();
    if (normalized === 'senior' || normalized === 'pwd') {
      return normalized;
    }
    return 'none';
  }

  private buildReferenceNo(id: number): string {
    return `SO-${String(id).padStart(6, '0')}`;
  }

  private buildListOrderBy(sortByRaw?: string, sortDirRaw?: string): string {
    const direction = String(sortDirRaw ?? '').trim().toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const sortBy = String(sortByRaw ?? '').trim();
    const sortMap: Record<string, string> = {
      referenceNo: 'o.reference_no',
      customer: 'o.customer_name',
      items: 'COALESCE(items.item_count, 0)',
      total: 'o.total_amount',
      discount: 'o.discount_total',
      saleDate: 'COALESCE(o.sale_date, o.created_at)',
      createdAt: 'COALESCE(o.sale_date, o.created_at)',
      status: 'o.is_void',
    };
    const column = sortMap[sortBy] ?? 'COALESCE(o.sale_date, o.created_at)';
    return `ORDER BY ${column} ${direction} NULLS LAST, o.id DESC`;
  }

  private parseDateBound(value?: string, endOfDay = false): string | null {
    const raw = String(value ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return null;
    }
    const parsed = new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString();
  }

  private mapListRow(row: {
    id: number;
    reference_no: string | null;
    customer_name: string;
    customer_phone: string | null;
    notes: string | null;
    custom_discount: string;
    subtotal: string;
    discount_total: string;
    total_amount: string;
    is_void: boolean;
    voided_at: string | null;
    sale_date: string | null;
    item_count: string;
    items_summary: string | null;
    updated_at: string | null;
  }): SalesOrderListItem {
    return {
      id: row.id,
      referenceNo: row.reference_no,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      notes: row.notes,
      customDiscount: Number(row.custom_discount ?? 0),
      subtotal: Number(row.subtotal ?? 0),
      discountTotal: Number(row.discount_total ?? 0),
      totalAmount: Number(row.total_amount ?? 0),
      isVoid: row.is_void,
      voidedAt: row.voided_at,
      saleDate: row.sale_date,
      itemCount: Number(row.item_count ?? 0),
      itemsSummary: row.items_summary
        ? row.items_summary.split(', ').filter(Boolean)
        : [],
      updatedAt: row.updated_at,
    };
  }
}
