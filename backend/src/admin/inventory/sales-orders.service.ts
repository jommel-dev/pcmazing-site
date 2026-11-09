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
import { RefundSalesOrderDto } from './dto/refund-sales-order.dto';
import { ensureSalesOrderItemWarrantyColumns } from './item-warranty.schema';
import { normalizeWarranty, type WarrantyUnit } from './item-warranty.util';
import { ensureSalesOrderPromotionColumn } from './order-promotion.schema';
import { ensureSalesOrderCustomItemsSchema } from './sales-order-custom-items.schema';
import { ensureSalesOrderRefundColumns } from './sales-order-refund.schema';

export interface SalesOrderListItem {
  id: number;
  referenceNo: string | null;
  customerName: string;
  customerPhone: string | null;
  notes: string | null;
  promotion?: string | null;
  customDiscount: number;
  subtotal: number;
  discountTotal: number;
  totalAmount: number;
  refundAmount: number;
  netTotalAmount: number;
  refundReason: string | null;
  refundedAt: string | null;
  isVoid: boolean;
  voidedAt: string | null;
  saleDate: string | null;
  itemCount: number;
  itemsSummary: string[];
  updatedAt: string | null;
}

export interface SalesOrderItem {
  id: number;
  materialId: number | null;
  materialName: string | null;
  materialCode: string | null;
  customItemName?: string | null;
  description: string | null;
  quantity: number;
  refundedQuantity: number;
  refundableQuantity: number;
  unitPrice: number;
  discountType: 'none' | 'senior' | 'pwd';
  warrantyValue: number | null;
  warrantyUnit: WarrantyUnit | null;
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

    await ensureSalesOrderRefundColumns(this.databaseService);
    await ensureSalesOrderCustomItemsSchema(this.databaseService);
    await ensureSalesOrderPromotionColumn(this.databaseService);
    await ensureSalesOrderItemWarrantyColumns(this.databaseService);

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
        COALESCE(SUM(
          CASE
            WHEN o.is_void THEN 0
            ELSE GREATEST(o.total_amount - COALESCE(o.refund_amount, 0), 0)
          END
        ), 0)::text AS total_sales,
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
      promotion: string | null;
      custom_discount: string;
      subtotal: string;
      discount_total: string;
      total_amount: string;
      refund_amount: string;
      refund_reason: string | null;
      refunded_at: string | null;
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
        o.promotion,
        o.custom_discount::text,
        o.subtotal::text,
        o.discount_total::text,
        o.total_amount::text,
        COALESCE(o.refund_amount, 0)::text AS refund_amount,
        o.refund_reason,
        o.refunded_at::text,
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
           STRING_AGG(
             DISTINCT COALESCE(NULLIF(TRIM(i.custom_item_name), ''), m.material_name, m.material_code, 'Item'),
             ', '
             ORDER BY COALESCE(NULLIF(TRIM(i.custom_item_name), ''), m.material_name, m.material_code, 'Item')
           ) AS items_summary
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

    await ensureSalesOrderRefundColumns(this.databaseService);
    await ensureSalesOrderCustomItemsSchema(this.databaseService);
    await ensureSalesOrderPromotionColumn(this.databaseService);
    await ensureSalesOrderItemWarrantyColumns(this.databaseService);

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
      refund_amount: string;
      refund_reason: string | null;
      refunded_at: string | null;
      is_void: boolean;
      voided_at: string | null;
      sale_date: string | null;
      item_count: string;
      items_summary: string | null;
      updated_at: string | null;
      promotion: string | null;
    }>(
      `SELECT
        o.id,
        o.reference_no,
        o.customer_name,
        o.customer_phone,
        o.notes,
        o.promotion,
        o.custom_discount::text,
        o.subtotal::text,
        o.discount_total::text,
        o.total_amount::text,
        COALESCE(o.refund_amount, 0)::text AS refund_amount,
        o.refund_reason,
        o.refunded_at::text,
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
           STRING_AGG(
             DISTINCT COALESCE(NULLIF(TRIM(i.custom_item_name), ''), m.material_name, m.material_code, 'Item'),
             ', '
             ORDER BY COALESCE(NULLIF(TRIM(i.custom_item_name), ''), m.material_name, m.material_code, 'Item')
           ) AS items_summary
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

    await ensureSalesOrderCustomItemsSchema(this.databaseService);
    await ensureSalesOrderPromotionColumn(this.databaseService);
    await ensureSalesOrderItemWarrantyColumns(this.databaseService);

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
      await this.assertStockAvailable(
        client,
        normalizedItems.filter(
          (item): item is typeof item & { materialId: number } => item.materialId != null,
        ),
      );

      const insertResult = await client.query<{ id: number }>(
        `INSERT INTO pcmazing_sales_orders (
          customer_name,
          customer_phone,
          notes,
          promotion,
          custom_discount,
          subtotal,
          discount_total,
          total_amount,
          sale_date,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
        [
          customerName,
          dto.customerPhone?.trim() || null,
          dto.notes?.trim() || null,
          dto.promotion?.trim() || null,
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
             custom_item_name,
             quantity,
             unit_price,
             discount_type,
             warranty_value,
             warranty_unit
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            salesOrderId,
            item.materialId,
            item.customItemName,
            item.quantity,
            item.unitPrice,
            item.discountType,
            item.warrantyValue,
            item.warrantyUnit,
          ],
        );

        if (item.materialId != null) {
          await client.query(
            `UPDATE tblmaterials
             SET on_hand_stock = COALESCE(on_hand_stock, 0) - $1,
                 updated_at = NOW()
             WHERE id = $2 AND deleted_at IS NULL`,
            [item.quantity, item.materialId],
          );
        }
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
        if (item.materialId == null) {
          continue;
        }
        const restoreQty = Math.max(0, item.quantity - (item.refundedQuantity ?? 0));
        if (restoreQty <= 0) {
          continue;
        }
        await client.query(
          `UPDATE tblmaterials
           SET on_hand_stock = COALESCE(on_hand_stock, 0) + $1,
               updated_at = NOW()
           WHERE id = $2 AND deleted_at IS NULL`,
          [restoreQty, item.materialId],
        );
      }
    });

    return this.getById(id);
  }

  async refundOrder(
    id: number,
    dto: RefundSalesOrderDto,
    refundedBy?: number,
  ): Promise<SalesOrderDetail> {
    await ensureSalesOrderRefundColumns(this.databaseService);

    const existing = await this.getById(id);
    if (existing.isVoid) {
      throw new BadRequestException('Voided sales orders cannot be refunded.');
    }

    const refundReason = dto.refundReason?.trim();
    if (!refundReason || refundReason.length < 3) {
      throw new BadRequestException('Refund reason is required (at least 3 characters).');
    }

    const refundLines = dto.items ?? [];
    if (!refundLines.length) {
      throw new BadRequestException('Select at least one item to refund.');
    }

    const itemMap = new Map(existing.items.map((item) => [Number(item.id), item]));
    const normalizedLines: Array<{
      itemId: number;
      quantity: number;
      materialId: number | null;
    }> = [];

    for (const line of refundLines) {
      const item = itemMap.get(Number(line.itemId));
      if (!item) {
        throw new BadRequestException(`Sales order item ${line.itemId} was not found.`);
      }

      const quantity = Number(line.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new BadRequestException(`Invalid refund quantity for item ${line.itemId}.`);
      }

      const remaining = Math.max(0, item.quantity - item.refundedQuantity);
      if (quantity > remaining + 0.0001) {
        const label =
          item.customItemName || item.materialName || item.materialCode || `item ${item.id}`;
        throw new BadRequestException(
          `Refund quantity for "${label}" exceeds remaining quantity (${remaining}).`,
        );
      }

      normalizedLines.push({
        itemId: item.id,
        quantity,
        materialId: item.materialId,
      });
    }

    const refundAmount = this.computeRefundAmountForLines(
      existing.items,
      normalizedLines,
      existing.customDiscount,
      existing.subtotal,
    );

    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero.');
    }

    const priorRefund = Math.max(0, existing.refundAmount);
    const maxRefund = Math.max(0, existing.totalAmount - priorRefund);
    if (refundAmount > maxRefund + 0.009) {
      throw new BadRequestException(
        `Refund amount cannot exceed ${maxRefund.toFixed(2)}.`,
      );
    }

    const combinedReason = existing.refundReason?.trim()
      ? `${existing.refundReason.trim()}; ${refundReason}`
      : refundReason;

    await this.databaseService.withTransaction(async (client) => {
      for (const line of normalizedLines) {
        await client.query(
          `UPDATE pcmazing_sales_order_items
           SET refunded_quantity = COALESCE(refunded_quantity, 0) + $1,
               updated_at = NOW()
           WHERE id = $2 AND sales_order_id = $3 AND deleted_at IS NULL`,
          [line.quantity, line.itemId, id],
        );

        if (line.materialId != null) {
          await client.query(
            `UPDATE tblmaterials
             SET on_hand_stock = COALESCE(on_hand_stock, 0) + $1,
                 updated_at = NOW()
             WHERE id = $2 AND deleted_at IS NULL`,
            [line.quantity, line.materialId],
          );
        }
      }

      await client.query(
        `UPDATE pcmazing_sales_orders
         SET refund_reason = $1,
             refund_amount = COALESCE(refund_amount, 0) + $2::numeric,
             refunded_at = NOW(),
             refunded_by = $3,
             updated_at = NOW()
         WHERE id = $4 AND deleted_at IS NULL`,
        [combinedReason, refundAmount, refundedBy ?? null, id],
      );
    });

    return this.getById(id);
  }

  private async loadItems(salesOrderId: number): Promise<SalesOrderItem[]> {
    await ensureSalesOrderCustomItemsSchema(this.databaseService);
    await ensureSalesOrderItemWarrantyColumns(this.databaseService);

    const result = await this.databaseService.query<{
      id: number;
      material_id: string | null;
      material_name: string | null;
      material_code: string | null;
      custom_item_name: string | null;
      description: string | null;
      quantity: string;
      refunded_quantity: string;
      unit_price: string;
      discount_type: 'none' | 'senior' | 'pwd';
      warranty_value: string | null;
      warranty_unit: string | null;
    }>(
      `SELECT
        i.id,
        i.material_id::text,
        m.material_name,
        m.material_code,
        i.custom_item_name,
        m.description,
        i.quantity::text,
        COALESCE(i.refunded_quantity, 0)::text AS refunded_quantity,
        i.unit_price::text,
        i.discount_type,
        i.warranty_value::text,
        i.warranty_unit
       FROM pcmazing_sales_order_items i
       LEFT JOIN tblmaterials m ON m.id = i.material_id
       WHERE i.sales_order_id = $1 AND i.deleted_at IS NULL
       ORDER BY i.id ASC`,
      [salesOrderId],
    );

    return result.rows.map((row) => {
      const quantity = Number(row.quantity ?? 0);
      const refundedQuantity = Number(row.refunded_quantity ?? 0);
      const customItemName = row.custom_item_name?.trim() || null;
      const materialId =
        row.material_id != null && row.material_id !== ''
          ? Number(row.material_id)
          : null;
      let warrantyValue: number | null = null;
      let warrantyUnit: WarrantyUnit | null = null;
      try {
        const warranty = normalizeWarranty(
          row.warranty_value != null && row.warranty_value !== ''
            ? Number(row.warranty_value)
            : null,
          row.warranty_unit,
        );
        warrantyValue = warranty?.warrantyValue ?? null;
        warrantyUnit = warranty?.warrantyUnit ?? null;
      } catch {
        warrantyValue = null;
        warrantyUnit = null;
      }
      return {
        id: Number(row.id),
        materialId: Number.isFinite(materialId) ? materialId : null,
        materialName: customItemName || row.material_name,
        materialCode: row.material_code,
        customItemName,
        description: row.description,
        quantity,
        refundedQuantity,
        refundableQuantity: Math.max(0, quantity - refundedQuantity),
        unitPrice: Number(row.unit_price ?? 0),
        discountType: this.normalizeDiscountType(row.discount_type),
        warrantyValue,
        warrantyUnit,
      };
    });
  }

  private computeRefundAmountForLines(
    orderItems: SalesOrderItem[],
    refundLines: Array<{ itemId: number; quantity: number }>,
    customDiscount: number,
    orderSubtotal: number,
  ): number {
    const itemMap = new Map(orderItems.map((item) => [Number(item.id), item]));
    let total = 0;

    for (const line of refundLines) {
      const item = itemMap.get(Number(line.itemId));
      if (!item) {
        continue;
      }

      const gross = line.quantity * item.unitPrice;
      const lineDiscount = this.computeLineDiscount(gross, item.discountType);
      const customShare =
        orderSubtotal > 0 ? (gross / orderSubtotal) * Math.max(0, customDiscount) : 0;
      total += Math.max(0, gross - lineDiscount - customShare);
    }

    return Math.round(total * 100) / 100;
  }

  private async normalizeItems(
    items: CreateSalesOrderDto['items'],
  ): Promise<
    Array<{
      materialId: number | null;
      customItemName: string | null;
      quantity: number;
      unitPrice: number;
      discountType: 'none' | 'senior' | 'pwd';
      warrantyValue: number | null;
      warrantyUnit: WarrantyUnit | null;
      materialName: string;
      onHandStock: number;
    }>
  > {
    const materialIds = [
      ...new Set(
        items
          .map((item) => Number(item.materialId))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];

    const materialMap = new Map<
      number,
      { materialName: string; sellPrice: number; onHandStock: number }
    >();

    if (materialIds.length > 0) {
      if (!(await tableExists(this.databaseService, 'tblmaterials'))) {
        throw new ServiceUnavailableException('Inventory materials table is not available.');
      }

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

      for (const row of materialsResult.rows) {
        materialMap.set(Number(row.id), {
          materialName: row.material_name,
          sellPrice: Number(row.sell_price ?? row.unit_price ?? 0),
          onHandStock: Number(row.on_hand_stock ?? 0),
        });
      }
    }

    return items.map((item, index) => {
      const materialIdRaw = Number(item.materialId);
      const hasMaterial = Number.isFinite(materialIdRaw) && materialIdRaw > 0;
      const customItemName = String(item.customItemName ?? '').trim() || null;

      if (!hasMaterial && !customItemName) {
        throw new BadRequestException(
          `Row ${index + 1}: select an inventory item or enter a custom item name.`,
        );
      }

      if (hasMaterial) {
        const material = materialMap.get(materialIdRaw);
        if (!material) {
          throw new BadRequestException(`Material ${materialIdRaw} was not found.`);
        }

        const warranty = normalizeWarranty(item.warrantyValue, item.warrantyUnit);
        return {
          materialId: materialIdRaw,
          customItemName: null,
          quantity: Number(item.quantity),
          unitPrice:
            item.unitPrice !== undefined && item.unitPrice !== null
              ? Number(item.unitPrice)
              : material.sellPrice,
          discountType: this.normalizeDiscountType(item.discountType),
          warrantyValue: warranty?.warrantyValue ?? null,
          warrantyUnit: warranty?.warrantyUnit ?? null,
          materialName: material.materialName,
          onHandStock: material.onHandStock,
        };
      }

      const unitPrice = Number(item.unitPrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new BadRequestException(
          `Row ${index + 1}: set a unit price for custom item "${customItemName}".`,
        );
      }

      const warranty = normalizeWarranty(item.warrantyValue, item.warrantyUnit);
      return {
        materialId: null,
        customItemName,
        quantity: Number(item.quantity),
        unitPrice,
        discountType: this.normalizeDiscountType(item.discountType),
        warrantyValue: warranty?.warrantyValue ?? null,
        warrantyUnit: warranty?.warrantyUnit ?? null,
        materialName: customItemName!,
        onHandStock: 0,
      };
    });
  }

  private async assertStockAvailable(
    client: { query: DatabaseService['query'] },
    items: Array<{ materialId: number; quantity: number; materialName: string; onHandStock: number }>,
  ): Promise<void> {
    if (!items.length) {
      return;
    }

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
    promotion?: string | null;
    custom_discount: string;
    subtotal: string;
    discount_total: string;
    total_amount: string;
    refund_amount?: string;
    refund_reason?: string | null;
    refunded_at?: string | null;
    is_void: boolean;
    voided_at: string | null;
    sale_date: string | null;
    item_count: string;
    items_summary: string | null;
    updated_at: string | null;
  }): SalesOrderListItem {
    const totalAmount = Number(row.total_amount ?? 0);
    const refundAmount = Number(row.refund_amount ?? 0);
    return {
      id: Number(row.id),
      referenceNo: row.reference_no,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      notes: row.notes,
      promotion: row.promotion?.trim() || null,
      customDiscount: Number(row.custom_discount ?? 0),
      subtotal: Number(row.subtotal ?? 0),
      discountTotal: Number(row.discount_total ?? 0),
      totalAmount,
      refundAmount,
      netTotalAmount: Math.max(0, totalAmount - refundAmount),
      refundReason: row.refund_reason ?? null,
      refundedAt: row.refunded_at ?? null,
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
