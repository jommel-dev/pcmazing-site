import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import {
  buildPagination,
  buildPaginationMeta,
  tableExists,
} from '../common/admin-table.util';
import { CreateServiceDto } from './dto/create-service.dto';
import { JOB_ORDER_STATUSES, UpdateServiceStatusDto } from './dto/update-service-status.dto';
import { deleteServiceImageFile, saveServiceImageFile } from './service-image.util';
import { ensureJobOrderRefundColumns } from './job-order-refund.schema';

const JOB_PAYMENT_METHODS = ['Cash', 'Gcash', 'Bank Transfer'] as const;
type JobPaymentMethod = (typeof JOB_PAYMENT_METHODS)[number];

/** Internal costing for job-order parts (uses purchase/order cost). */
const PART_COST_UNIT_PRICE_SQL = `
  CASE
    WHEN sp.material_id IS NULL THEN COALESCE(sp.unit_price, 0)
    ELSE COALESCE(m.order_cost, m.unit_price, sp.unit_price, 0)
  END
`;

/** Customer-facing unit price for receipts and job-order line display (uses sell price). */
const PART_SALE_UNIT_PRICE_SQL = `
  CASE
    WHEN sp.material_id IS NULL THEN COALESCE(sp.unit_price, 0)
    ELSE COALESCE(NULLIF(sp.unit_price, 0), NULLIF(m.sell_price, 0), NULLIF(m.unit_price, 0), 0)
  END
`;

export interface JobOrderCustomerSuggestion {
  name: string;
  email: string | null;
  contact: string | null;
  address: string | null;
}

export interface InventoryServiceListItem {
  id: number;
  referenceNo: string | null;
  customerName: string;
  customerEmail?: string | null;
  customerContact?: string | null;
  customerAddress?: string | null;
  serviceName: string;
  personInChargeUserId: number | null;
  personInChargeSource: 'tblusers' | 'pcmazing_admin_users';
  personInChargeName: string | null;
  type: string;
  partsUsed: string[];
  cost: number;
  labor: number;
  status: string;
  imageUrl: string | null;
  deviceBrand?: string | null;
  deviceModel?: string | null;
  deviceSerial?: string | null;
  totalCosting: number;
  totalSales: number;
  totalDiscount?: number;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  notes?: string | null;
  cancelReason?: string | null;
  refundReason?: string | null;
  refundAmount?: number;
  laborDiscountType?: 'none' | 'senior' | 'pwd';
  customDiscount?: number;
  downpayment?: number;
  paymentMethod?: string | null;
  parts?: Array<{
    materialId?: number;
    serviceTypeId?: number;
    materialName?: string | null;
    materialCode?: string | null;
    description?: string | null;
    customItemName?: string;
    brandName?: string | null;
    quantity: number;
    unitPrice?: number;
    labor?: number;
    discountType?: 'none' | 'senior' | 'pwd';
    discountAmount?: number;
  }>;
  createdAt: string | null;
  updatedAt: string | null;
  statusHistory?: JobOrderStatusHistoryItem[];
}

export interface JobOrderStatusHistoryItem {
  id: number;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  changedBy: number | null;
  changedByName: string | null;
  createdAt: string;
}

export interface InventoryServiceSummary {
  totalCosting: number;
  totalSales: number;
  totalLaborSales: number;
  totalPartsCost: number;
  totalDiscount: number;
  itemCount: number;
}

export interface InventoryServiceFilterOption {
  label: string;
  count: number;
}

@Injectable()
export class InventoryServicesService {
  constructor(private readonly databaseService: DatabaseService) {}

  redactProfitabilityFields<T extends { totalCosting?: number | null }>(item: T): T {
    return {
      ...item,
      totalCosting: 0,
    };
  }

  async list(
    pageRaw?: string,
    limitRaw?: string,
    search?: string,
    type?: string,
    status?: string,
    sortByRaw?: string,
    sortDirRaw?: string,
    startDateRaw?: string,
    endDateRaw?: string,
  ) {
    if (!(await tableExists(this.databaseService, 'pcmazing_services'))) {
      throw new ServiceUnavailableException('Service catalog table is not available in this database.');
    }

    await ensureJobOrderRefundColumns(this.databaseService);

    const { page, limit, offset } = buildPagination(pageRaw, limitRaw);
    const listParams: unknown[] = [];
    const listConditions = ['s.deleted_at IS NULL'];
    const summaryParams: unknown[] = [];
    const summaryConditions = ['s.deleted_at IS NULL'];

    if (search?.trim()) {
      listParams.push(`%${search.trim()}%`);
      listConditions.push(
        `(s.service_name ILIKE $${listParams.length}
          OR s.service_type ILIKE $${listParams.length}
          OR COALESCE(s.status, '') ILIKE $${listParams.length}
          OR COALESCE(s.customer_name, '') ILIKE $${listParams.length}
          OR COALESCE(s.customer_email, '') ILIKE $${listParams.length}
          OR COALESCE(s.customer_contact, '') ILIKE $${listParams.length}
          OR COALESCE(s.reference_no, '') ILIKE $${listParams.length})`,
      );
    }

    if (type?.trim()) {
      listParams.push(type.trim());
      listConditions.push(
        `(LOWER(TRIM(s.service_type)) = LOWER($${listParams.length})
          OR EXISTS (
            SELECT 1
            FROM unnest(string_to_array(s.service_type, ',')) token
            WHERE LOWER(TRIM(token)) = LOWER($${listParams.length})
          ))`,
      );
      summaryParams.push(type.trim());
      summaryConditions.push(
        `(LOWER(TRIM(s.service_type)) = LOWER($${summaryParams.length})
          OR EXISTS (
            SELECT 1
            FROM unnest(string_to_array(s.service_type, ',')) token
            WHERE LOWER(TRIM(token)) = LOWER($${summaryParams.length})
          ))`,
      );
    }

    if (status?.trim()) {
      listParams.push(status.trim());
      listConditions.push(`LOWER(s.status) = LOWER($${listParams.length})`);
      summaryParams.push(status.trim());
      summaryConditions.push(`LOWER(s.status) = LOWER($${summaryParams.length})`);
    }

    const startDate = this.parseDateBound(startDateRaw, false);
    const endDate = this.parseDateBound(endDateRaw, true);
    if (startDate) {
      listParams.push(startDate);
      listConditions.push(`s.created_at >= $${listParams.length}::timestamptz`);
      summaryParams.push(startDate);
      summaryConditions.push(`s.created_at >= $${summaryParams.length}::timestamptz`);
    }
    if (endDate) {
      listParams.push(endDate);
      listConditions.push(`s.created_at <= $${listParams.length}::timestamptz`);
      summaryParams.push(endDate);
      summaryConditions.push(`s.created_at <= $${summaryParams.length}::timestamptz`);
    }

    const whereClause = `WHERE ${listConditions.join(' AND ')}`;
    const summaryWhereClause = `WHERE ${summaryConditions.join(' AND ')}`;
    const orderBy = this.buildListOrderBy(sortByRaw, sortDirRaw);

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM pcmazing_services s
       ${whereClause}`,
      listParams,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const summaryResult = await this.databaseService.query<{
      item_count: string;
      total_parts_cost: string;
      total_base_cost: string;
      total_labor_sales: string;
      total_parts_sales: string;
      total_discount: string;
      total_refunds: string;
    }>(
      `SELECT
        COUNT(*)::text AS item_count,
        COALESCE(SUM(COALESCE(parts.parts_cost, 0)), 0)::text AS total_parts_cost,
        COALESCE(SUM(COALESCE(s.base_cost, 0)), 0)::text AS total_base_cost,
        COALESCE(SUM(COALESCE(s.labor, 0) + COALESCE(parts.parts_labor, 0)), 0)::text AS total_labor_sales,
        COALESCE(SUM(COALESCE(parts.parts_sales, 0)), 0)::text AS total_parts_sales,
        COALESCE(SUM(
          COALESCE(s.custom_discount, 0)
          + COALESCE(parts.parts_discount, 0)
          + CASE
              WHEN LOWER(TRIM(COALESCE(s.labor_discount_type, ''))) IN ('senior', 'pwd')
                THEN ROUND(COALESCE(s.labor, 0) * 0.20, 2)
              ELSE 0
            END
        ), 0)::text AS total_discount,
        COALESCE(SUM(
          CASE
            WHEN LOWER(TRIM(COALESCE(s.status, ''))) = 'refunded'
              THEN COALESCE(s.refund_amount, 0)
            ELSE 0
          END
        ), 0)::text AS total_refunds
       FROM pcmazing_services s
       LEFT JOIN LATERAL (
         SELECT COALESCE(
           SUM(
             sp.quantity * ${PART_COST_UNIT_PRICE_SQL}
           ),
           0
         ) AS parts_cost,
         COALESCE(SUM(COALESCE(sp.labor, 0)), 0) AS parts_labor,
         COALESCE(SUM(COALESCE(sp.discount_amount, 0)), 0) AS parts_discount,
         COALESCE(SUM(sp.quantity * ${PART_SALE_UNIT_PRICE_SQL}), 0) AS parts_sales
         FROM pcmazing_service_parts sp
         LEFT JOIN tblmaterials m ON m.id = sp.material_id
         WHERE sp.service_id = s.id AND sp.deleted_at IS NULL
       ) parts ON TRUE
       ${summaryWhereClause}`,
      summaryParams,
    );

    const summaryItemCount = Number(summaryResult.rows[0]?.item_count ?? 0);
    const totalPartsCost = Number(summaryResult.rows[0]?.total_parts_cost ?? 0);
    const totalBaseCost = Number(summaryResult.rows[0]?.total_base_cost ?? 0);
    const totalLaborSales = Number(summaryResult.rows[0]?.total_labor_sales ?? 0);
    const totalPartsSales = Number(summaryResult.rows[0]?.total_parts_sales ?? 0);
    const totalDiscount = Number(summaryResult.rows[0]?.total_discount ?? 0);
    const totalRefunds = Number(summaryResult.rows[0]?.total_refunds ?? 0);

    const filterWhereClause = `WHERE s.deleted_at IS NULL`;

    const [typesResult, statusesResult] = await Promise.all([
      this.databaseService.query<{ label: string | null; count: string }>(
        `SELECT NULLIF(TRIM(token), '') AS label, COUNT(*)::text AS count
         FROM pcmazing_services s
         CROSS JOIN LATERAL unnest(string_to_array(COALESCE(s.service_type, ''), ',')) AS token
         ${filterWhereClause}
         GROUP BY NULLIF(TRIM(token), '')
         ORDER BY label ASC NULLS LAST`,
      ),
      this.databaseService.query<{ label: string | null; count: string }>(
        `SELECT NULLIF(TRIM(s.status), '') AS label, COUNT(*)::text AS count
         FROM pcmazing_services s
         ${filterWhereClause}
         GROUP BY NULLIF(TRIM(s.status), '')
         ORDER BY label ASC NULLS LAST`,
      ),
    ]);

    const limitIndex = listParams.length + 1;
    const offsetIndex = listParams.length + 2;
    const result = await this.databaseService.query<{
      id: number;
      reference_no: string | null;
      customer_name: string | null;
      customer_email: string | null;
      customer_contact: string | null;
      service_name: string;
      person_in_charge_user_id: string | null;
      person_in_charge_source: 'tblusers' | 'pcmazing_admin_users' | null;
      service_type: string;
      parts_used: string | null;
      parts_cost: string | null;
      parts_labor: string | null;
      parts_discount: string | null;
      parts_sales: string | null;
      base_cost: string | null;
      labor: string | null;
      labor_discount_type: string | null;
      custom_discount: string | null;
      refund_amount: string | null;
      status: string | null;
      image_url: string | null;
      started_at: string | null;
      ended_at: string | null;
      created_at: string | null;
      updated_at: string | null;
    }>(
      `SELECT
        s.id,
        s.reference_no,
        s.customer_name,
        s.customer_email,
        s.customer_contact,
        s.service_name,
        s.person_in_charge_user_id::text,
        s.person_in_charge_source,
        s.service_type,
        parts.parts_used,
        COALESCE(parts.parts_cost, 0)::text AS parts_cost,
        COALESCE(parts.parts_labor, 0)::text AS parts_labor,
        COALESCE(parts.parts_discount, 0)::text AS parts_discount,
        COALESCE(parts.parts_sales, 0)::text AS parts_sales,
        s.base_cost::text,
        s.labor::text,
        s.labor_discount_type,
        s.custom_discount::text,
        s.refund_amount::text,
        s.status,
        s.image_url,
        s.started_at::text,
        s.ended_at::text,
        s.created_at::text,
        s.updated_at::text
       FROM pcmazing_services s
       LEFT JOIN LATERAL (
         SELECT
           STRING_AGG(
             DISTINCT COALESCE(m.material_name, sp.custom_item_name),
             ', '
             ORDER BY COALESCE(m.material_name, sp.custom_item_name)
           ) AS parts_used,
           COALESCE(
             SUM(
               sp.quantity * ${PART_COST_UNIT_PRICE_SQL}
             ),
             0
           ) AS parts_cost,
           COALESCE(SUM(COALESCE(sp.labor, 0)), 0) AS parts_labor,
           COALESCE(SUM(COALESCE(sp.discount_amount, 0)), 0) AS parts_discount,
           COALESCE(SUM(sp.quantity * ${PART_SALE_UNIT_PRICE_SQL}), 0) AS parts_sales
         FROM pcmazing_service_parts sp
         LEFT JOIN tblmaterials m ON m.id = sp.material_id
         WHERE sp.service_id = s.id AND sp.deleted_at IS NULL
       ) parts ON TRUE
       ${whereClause}
       ${orderBy}
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      [...listParams, limit, offset],
    );

    const personNames = await this.loadPersonNames(
      result.rows.map((row) => ({
        userId: row.person_in_charge_user_id ? Number(row.person_in_charge_user_id) : null,
        source: row.person_in_charge_source ?? 'tblusers',
      })),
    );

    return {
      items: result.rows.map((row) => {
        const baseCost = Number(row.base_cost ?? 0);
        const labor = Number(row.labor ?? 0) + Number(row.parts_labor ?? 0);
        const partsCost = Number(row.parts_cost ?? 0);
        const customDiscount = Number(row.custom_discount ?? 0);
        const partsDiscount = Number(row.parts_discount ?? 0);
        const partsSales = Number(row.parts_sales ?? 0);
        const laborDiscountType = String(row.labor_discount_type ?? '').trim().toLowerCase();
        const laborDiscount =
          laborDiscountType === 'senior' || laborDiscountType === 'pwd'
            ? Math.round(Number(row.labor ?? 0) * 0.2 * 100) / 100
            : 0;
        const totalDiscount = customDiscount + partsDiscount + laborDiscount;
        const grossSales = Math.max(
          0,
          labor + partsSales - partsDiscount - customDiscount - laborDiscount,
        );
        const refundAmount =
          this.normalizeStatusLabel(row.status) === 'refunded'
            ? Math.max(0, Number(row.refund_amount ?? 0))
            : 0;
        const userId = row.person_in_charge_user_id ? Number(row.person_in_charge_user_id) : null;
        const source = row.person_in_charge_source ?? 'tblusers';

        return {
          id: Number(row.id),
          referenceNo: row.reference_no,
          customerName: row.customer_name ?? 'Unknown customer',
          customerEmail: row.customer_email?.trim() || null,
          customerContact: row.customer_contact?.trim() || null,
          serviceName: row.service_name,
          personInChargeUserId: userId,
          personInChargeSource: source,
          personInChargeName: userId ? personNames.get(`${source}:${userId}`) ?? null : null,
          type: row.service_type,
          partsUsed: row.parts_used
            ? row.parts_used.split(',').map((item) => item.trim()).filter(Boolean)
            : [],
          cost: baseCost,
          labor,
          status: row.status ?? 'Active',
          imageUrl: row.image_url,
          totalCosting: partsCost,
          totalSales: Math.max(0, grossSales - refundAmount),
          totalDiscount,
          refundAmount: refundAmount > 0 ? refundAmount : undefined,
          customDiscount,
          startedAt: row.started_at,
          endedAt: row.ended_at,
          durationMinutes: this.computeDurationMinutes(row.started_at, row.ended_at),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        } satisfies InventoryServiceListItem;
      }),
      meta: buildPaginationMeta(page, limit, total),
      summary: {
        totalCosting: totalPartsCost,
        totalSales: Math.max(0, totalLaborSales + totalPartsSales - totalDiscount - totalRefunds),
        totalLaborSales,
        totalPartsCost,
        totalDiscount,
        itemCount: summaryItemCount,
      } satisfies InventoryServiceSummary,
      filters: {
        types: typesResult.rows
          .filter((row) => row.label?.trim())
          .map((row) => ({ label: row.label!.trim(), count: Number(row.count) })),
        statuses: statusesResult.rows
          .filter((row) => row.label?.trim())
          .map((row) => ({ label: row.label!.trim(), count: Number(row.count) })),
      },
    };
  }

  async create(dto: CreateServiceDto, createdBy?: number) {
    if (!(await tableExists(this.databaseService, 'pcmazing_services'))) {
      throw new ServiceUnavailableException('Service catalog table is not available in this database.');
    }

    const customerName = dto.customerName?.trim() || '';
    const customerEmail = dto.customerEmail?.trim() || null;
    const customerContact = dto.customerContact?.trim() || null;
    const customerAddress = dto.customerAddress?.trim() || null;
    const deviceBrand = dto.deviceBrand?.trim() || null;
    const deviceModel = dto.deviceModel?.trim() || null;
    const deviceSerial = dto.deviceSerial?.trim() || null;
    const serviceName = dto.serviceName?.trim() || '';
    const serviceType = dto.type?.trim() || '';
    const source = dto.personInChargeSource ?? 'tblusers';
    const startedAt = dto.startedAt ? new Date(dto.startedAt) : null;
    const endedAt = dto.endedAt ? new Date(dto.endedAt) : null;

    if (startedAt && Number.isNaN(startedAt.getTime())) {
      throw new BadRequestException('Start date/time is invalid.');
    }

    if (endedAt && Number.isNaN(endedAt.getTime())) {
      throw new BadRequestException('End date/time is invalid.');
    }

    if (startedAt && endedAt && endedAt.getTime() < startedAt.getTime()) {
      throw new BadRequestException('End date/time must be later than the start date/time.');
    }

    if (dto.personInChargeUserId) {
      await this.assertPersonExists(dto.personInChargeUserId, source);
    }

    await this.assertPartsExist(dto.parts ?? []);

    const newId = await this.databaseService.withTransaction(async (client) => {
      const insertResult = await client.query<{ id: number }>(
        `INSERT INTO pcmazing_services (
          customer_name,
          customer_email,
          customer_contact,
          customer_address,
          service_name,
          person_in_charge_user_id,
          person_in_charge_source,
          service_type,
          base_cost,
          labor,
          labor_discount_type,
          custom_discount,
          downpayment,
          payment_method,
          status,
          notes,
          started_at,
          ended_at,
          device_brand,
          device_model,
          device_serial,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING id`,
        [
          customerName,
          customerEmail,
          customerContact,
          customerAddress,
          serviceName,
          dto.personInChargeUserId ?? null,
          source,
          serviceType,
          dto.cost ?? 0,
          dto.labor ?? 0,
          this.normalizeDiscountType(dto.laborDiscountType),
          dto.customDiscount ?? 0,
          dto.downpayment ?? 0,
          this.normalizePaymentMethod(dto.paymentMethod),
          dto.status?.trim() || 'Pending',
          dto.notes?.trim() || null,
          startedAt ? startedAt.toISOString() : null,
          endedAt ? endedAt.toISOString() : null,
          deviceBrand,
          deviceModel,
          deviceSerial,
          createdBy ?? null,
        ],
      );

      const serviceId = insertResult.rows[0]?.id;
      if (!serviceId) {
        throw new ServiceUnavailableException('Unable to create service.');
      }

      await client.query(
        `UPDATE pcmazing_services
         SET reference_no = $1
         WHERE id = $2`,
        [this.buildReferenceNo(serviceId), serviceId],
      );

      for (const part of dto.parts ?? []) {
        const serviceTypeId = await this.resolveServiceTypeId(client, part);
        const materialId = await this.resolveMaterialId(client, part);
        await client.query(
          `INSERT INTO pcmazing_service_parts (
             service_id,
             material_id,
             service_type_id,
             custom_item_name,
             brand_name,
             quantity,
             unit_price,
             labor,
             discount_type,
             discount_amount
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            serviceId,
            materialId,
            serviceTypeId,
            part.customItemName?.trim() || null,
            this.normalizeBrandName(part.brandName),
            part.quantity,
            part.unitPrice ?? 0,
            part.labor ?? 0,
            this.normalizeDiscountType(part.discountType),
            Math.max(0, Number(part.discountAmount) || 0),
          ],
        );
      }

      await this.recordStatusChange(client, {
        serviceId,
        fromStatus: null,
        toStatus: dto.status?.trim() || 'Pending',
        reason: null,
        changedBy: createdBy ?? null,
      });

      return serviceId;
    });

    return this.getById(newId);
  }

  async update(id: number, dto: CreateServiceDto, changedBy?: number) {
    if (!(await tableExists(this.databaseService, 'pcmazing_services'))) {
      throw new ServiceUnavailableException('Service catalog table is not available in this database.');
    }

    const existing = await this.getById(id);

    const customerName = dto.customerName?.trim() || '';
    const customerEmail = dto.customerEmail?.trim() || null;
    const customerContact = dto.customerContact?.trim() || null;
    const customerAddress = dto.customerAddress?.trim() || null;
    const deviceBrand = dto.deviceBrand?.trim() || null;
    const deviceModel = dto.deviceModel?.trim() || null;
    const deviceSerial = dto.deviceSerial?.trim() || null;
    const serviceName = dto.serviceName?.trim() || '';
    const serviceType = dto.type?.trim() || '';
    const nextStatus = dto.status?.trim() || 'Active';
    const source = dto.personInChargeSource ?? 'tblusers';
    const startedAt = dto.startedAt ? new Date(dto.startedAt) : null;
    const endedAt = dto.endedAt ? new Date(dto.endedAt) : null;

    if (startedAt && Number.isNaN(startedAt.getTime())) {
      throw new BadRequestException('Start date/time is invalid.');
    }

    if (endedAt && Number.isNaN(endedAt.getTime())) {
      throw new BadRequestException('End date/time is invalid.');
    }

    if (startedAt && endedAt && endedAt.getTime() < startedAt.getTime()) {
      throw new BadRequestException('End date/time must be later than the start date/time.');
    }

    if (dto.personInChargeUserId) {
      await this.assertPersonExists(dto.personInChargeUserId, source);
    }

    await this.assertPartsExist(dto.parts ?? []);

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE pcmazing_services
         SET customer_name = $1,
             customer_email = $2,
             customer_contact = $3,
             customer_address = $4,
             service_name = $5,
             person_in_charge_user_id = $6,
             person_in_charge_source = $7,
             service_type = $8,
             base_cost = $9,
             labor = $10,
             labor_discount_type = $11,
             custom_discount = $12,
             downpayment = $13,
             payment_method = $14,
             status = $15,
             notes = $16,
             started_at = $17,
             ended_at = $18,
             device_brand = $19,
             device_model = $20,
             device_serial = $21,
             updated_at = NOW()
         WHERE id = $22 AND deleted_at IS NULL`,
        [
          customerName,
          customerEmail,
          customerContact,
          customerAddress,
          serviceName,
          dto.personInChargeUserId ?? null,
          source,
          serviceType,
          dto.cost ?? 0,
          dto.labor ?? 0,
          this.normalizeDiscountType(dto.laborDiscountType),
          dto.customDiscount ?? 0,
          dto.downpayment ?? 0,
          this.normalizePaymentMethod(dto.paymentMethod),
          nextStatus,
          dto.notes?.trim() || null,
          startedAt ? startedAt.toISOString() : null,
          endedAt ? endedAt.toISOString() : null,
          deviceBrand,
          deviceModel,
          deviceSerial,
          id,
        ],
      );

      await client.query(
        `UPDATE pcmazing_service_parts
         SET deleted_at = NOW()
         WHERE service_id = $1 AND deleted_at IS NULL`,
        [id],
      );

      for (const part of dto.parts ?? []) {
        const serviceTypeId = await this.resolveServiceTypeId(client, part);
        const materialId = await this.resolveMaterialId(client, part);
        await client.query(
          `INSERT INTO pcmazing_service_parts (
             service_id,
             material_id,
             service_type_id,
             custom_item_name,
             brand_name,
             quantity,
             unit_price,
             labor,
             discount_type,
             discount_amount
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            id,
            materialId,
            serviceTypeId,
            part.customItemName?.trim() || null,
            this.normalizeBrandName(part.brandName),
            part.quantity,
            part.unitPrice ?? 0,
            part.labor ?? 0,
            this.normalizeDiscountType(part.discountType),
            Math.max(0, Number(part.discountAmount) || 0),
          ],
        );
      }

      if (this.normalizeStatusLabel(existing.status) !== this.normalizeStatusLabel(nextStatus)) {
        await this.recordStatusChange(client, {
          serviceId: id,
          fromStatus: existing.status,
          toStatus: nextStatus,
          reason: nextStatus.toLowerCase() === 'cancelled' ? dto.notes?.trim() || null : null,
          changedBy: changedBy ?? null,
        });
      }
    });

    return this.getById(id);
  }

  async updateStatus(id: number, dto: UpdateServiceStatusDto, changedBy?: number) {
    if (!(await tableExists(this.databaseService, 'pcmazing_services'))) {
      throw new ServiceUnavailableException('Service catalog table is not available in this database.');
    }

    await ensureJobOrderRefundColumns(this.databaseService);

    const existing = await this.getById(id);

    const status = dto.status.trim();
    if (!(JOB_ORDER_STATUSES as readonly string[]).includes(status)) {
      throw new BadRequestException(`Invalid status "${status}".`);
    }

    const cancelReason = String(dto.cancelReason ?? '').trim();
    if (status.toLowerCase() === 'cancelled' && cancelReason.length < 3) {
      throw new BadRequestException('A cancellation reason is required.');
    }

    const refundReason = String(dto.refundReason ?? '').trim();
    const refundAmount = Number(dto.refundAmount ?? 0);
    if (status.toLowerCase() === 'refunded') {
      if (refundReason.length < 3) {
        throw new BadRequestException('A refund reason is required.');
      }
      if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        throw new BadRequestException('A valid refund amount is required.');
      }
      const grossSales = this.computeGrossFromServiceItem(existing);
      if (refundAmount > grossSales) {
        throw new BadRequestException(
          `Refund amount cannot exceed the job order total of ${grossSales.toFixed(2)}.`,
        );
      }
    }

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE pcmazing_services
         SET status = $1::varchar,
             started_at = CASE
               WHEN LOWER($1::text) = 'active' AND started_at IS NULL THEN NOW()
               ELSE started_at
             END,
             payment_method = COALESCE($3::varchar, payment_method),
             cancel_reason = CASE
               WHEN LOWER($1::text) = 'cancelled' THEN $4
               ELSE NULL
             END,
             refund_reason = CASE
               WHEN LOWER($1::text) = 'refunded' THEN $5
               ELSE NULL
             END,
             refund_amount = CASE
               WHEN LOWER($1::text) = 'refunded' THEN $6::numeric
               ELSE NULL::numeric
             END,
             updated_at = NOW()
         WHERE id = $2::int AND deleted_at IS NULL`,
        [
          status,
          id,
          this.normalizePaymentMethod(dto.paymentMethod),
          cancelReason || null,
          refundReason || null,
          status.toLowerCase() === 'refunded' ? refundAmount : null,
        ],
      );

      if (this.normalizeStatusLabel(existing.status) !== this.normalizeStatusLabel(status)) {
        const historyReason =
          status.toLowerCase() === 'cancelled'
            ? cancelReason
            : status.toLowerCase() === 'refunded'
              ? `${refundReason} (Refunded ${refundAmount.toFixed(2)})`
              : null;
        await this.recordStatusChange(client, {
          serviceId: id,
          fromStatus: existing.status,
          toStatus: status,
          reason: historyReason,
          changedBy: changedBy ?? null,
        });
      }
    });

    return this.getById(id);
  }

  async softDelete(id: number, changedBy?: number): Promise<void> {
    if (!(await tableExists(this.databaseService, 'pcmazing_services'))) {
      throw new ServiceUnavailableException('Service catalog table is not available in this database.');
    }

    const existing = await this.getById(id);

    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE pcmazing_services
         SET status = 'Deleted',
             deleted_at = NOW(),
             updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL`,
        [id],
      );

      await this.recordStatusChange(client, {
        serviceId: id,
        fromStatus: existing.status,
        toStatus: 'Deleted',
        reason: null,
        changedBy: changedBy ?? null,
      });
    });
  }

  async uploadImage(id: number, file: Express.Multer.File) {
    const existing = await this.getById(id);
    const imageUrl = await saveServiceImageFile(id, file);

    await deleteServiceImageFile(existing.imageUrl);
    await this.databaseService.query(
      `UPDATE pcmazing_services
       SET image_url = $1, updated_at = NOW()
       WHERE id = $2`,
      [imageUrl, id],
    );

    return this.getById(id);
  }

  private buildListOrderBy(sortByRaw?: string, sortDirRaw?: string): string {
    const direction = String(sortDirRaw ?? '').trim().toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const sortBy = String(sortByRaw ?? '').trim();

    const sortMap: Record<string, string> = {
      referenceNo: 's.reference_no',
      customer: 's.customer_name',
      serviceName: 's.service_name',
      type: 's.service_type',
      cost: 's.base_cost',
      labor: '(COALESCE(s.labor, 0) + COALESCE(parts.parts_labor, 0))',
      totalCosting: 'COALESCE(parts.parts_cost, 0)',
      totalSales:
        '(COALESCE(s.base_cost, 0) + COALESCE(s.labor, 0) + COALESCE(parts.parts_labor, 0) - COALESCE(s.custom_discount, 0))',
      totalDiscount: '(COALESCE(s.custom_discount, 0) + COALESCE(parts.parts_discount, 0))',
      status: 's.status',
      interval: 's.started_at',
      personInCharge: 's.person_in_charge_user_id',
      createdAt: 's.created_at',
    };

    const column = sortMap[sortBy] ?? 's.created_at';
    const fallbackDirection = sortMap[sortBy] ? direction : 'DESC';
    return `ORDER BY ${column} ${fallbackDirection} NULLS LAST, s.id DESC`;
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

  private async loadPersonNames(
    records: Array<{ userId: number | null; source: 'tblusers' | 'pcmazing_admin_users' }>,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const tblUserIds = [...new Set(records.filter((item) => item.userId && item.source === 'tblusers').map((item) => item.userId!))];
    const adminUserIds = [...new Set(records.filter((item) => item.userId && item.source === 'pcmazing_admin_users').map((item) => item.userId!))];

    if (tblUserIds.length && (await tableExists(this.databaseService, 'tblusers'))) {
      const tblUsers = await this.databaseService.query<{
        id: number;
        fullname: string | null;
        username: string;
      }>(
        `SELECT
          u.id,
          COALESCE(
            to_jsonb(u)->>'fullName',
            to_jsonb(u)->>'full_name',
            to_jsonb(u)->>'name',
            u.username
          ) AS fullname,
          u.username
         FROM tblusers u
         WHERE u.id = ANY($1::bigint[])`,
        [tblUserIds],
      );

      for (const row of tblUsers.rows) {
        result.set(`tblusers:${row.id}`, row.fullname ?? row.username);
      }
    }

    if (adminUserIds.length && (await tableExists(this.databaseService, 'pcmazing_admin_users'))) {
      const adminUsers = await this.databaseService.query<{ id: number; full_name: string }>(
        `SELECT id, full_name
         FROM pcmazing_admin_users
         WHERE id = ANY($1::bigint[])`,
        [adminUserIds],
      );

      for (const row of adminUsers.rows) {
        result.set(`pcmazing_admin_users:${row.id}`, row.full_name);
      }
    }

    return result;
  }

  async getById(id: number): Promise<InventoryServiceListItem> {
    await ensureJobOrderRefundColumns(this.databaseService);

    const result = await this.databaseService.query<{
      id: number;
      reference_no: string | null;
      customer_name: string | null;
      customer_email: string | null;
      customer_contact: string | null;
      customer_address: string | null;
      service_name: string;
      person_in_charge_user_id: string | null;
      person_in_charge_source: 'tblusers' | 'pcmazing_admin_users' | null;
      service_type: string;
      parts_used: string | null;
      parts_cost: string | null;
      parts_labor: string | null;
      base_cost: string | null;
      labor: string | null;
      status: string | null;
      notes: string | null;
      cancel_reason: string | null;
      refund_reason: string | null;
      refund_amount: string | null;
      labor_discount_type: string | null;
      custom_discount: string | null;
      downpayment: string | null;
      payment_method: string | null;
      image_url: string | null;
      device_brand: string | null;
      device_model: string | null;
      device_serial: string | null;
      started_at: string | null;
      ended_at: string | null;
      created_at: string | null;
      updated_at: string | null;
    }>(
      `SELECT
        s.id,
        s.reference_no,
        s.customer_name,
        s.customer_email,
        s.customer_contact,
        s.customer_address,
        s.service_name,
        s.person_in_charge_user_id::text,
        s.person_in_charge_source,
        s.service_type,
        parts.parts_used,
        COALESCE(parts.parts_cost, 0)::text AS parts_cost,
        COALESCE(parts.parts_labor, 0)::text AS parts_labor,
        s.base_cost::text,
        s.labor::text,
        s.status,
        s.notes,
        s.cancel_reason,
        s.refund_reason,
        s.refund_amount::text,
        s.labor_discount_type,
        s.custom_discount::text,
        s.downpayment::text,
        s.payment_method,
        s.image_url,
        s.device_brand,
        s.device_model,
        s.device_serial,
        s.started_at::text,
        s.ended_at::text,
        s.created_at::text,
        s.updated_at::text
       FROM pcmazing_services s
       LEFT JOIN LATERAL (
         SELECT
           STRING_AGG(
             DISTINCT COALESCE(m.material_name, sp.custom_item_name),
             ', '
             ORDER BY COALESCE(m.material_name, sp.custom_item_name)
           ) AS parts_used,
           COALESCE(
             SUM(
               sp.quantity * ${PART_COST_UNIT_PRICE_SQL}
             ),
             0
           ) AS parts_cost,
           COALESCE(SUM(COALESCE(sp.labor, 0)), 0) AS parts_labor
         FROM pcmazing_service_parts sp
         LEFT JOIN tblmaterials m ON m.id = sp.material_id
         WHERE sp.service_id = s.id AND sp.deleted_at IS NULL
       ) parts ON TRUE
       WHERE s.id = $1 AND s.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Service ${id} was not found.`);
    }

    const userId = row.person_in_charge_user_id ? Number(row.person_in_charge_user_id) : null;
    const source = row.person_in_charge_source ?? 'tblusers';
    const personNames = await this.loadPersonNames([{ userId, source }]);
    const cost = Number(row.base_cost ?? 0);
    const labor = Number(row.labor ?? 0);
    const partsCost = Number(row.parts_cost ?? 0);
    const partsLabor = Number(row.parts_labor ?? 0);
    const partsResult = await this.databaseService.query<{
      material_id: number | null;
      service_type_id: number | null;
      material_name: string | null;
      material_description: string | null;
      material_code: string | null;
      custom_item_name: string | null;
      brand_name: string | null;
      quantity: string;
      unit_price: string | null;
      labor: string | null;
      discount_type: string | null;
      discount_amount: string | null;
    }>(
      `SELECT
         sp.material_id,
         sp.service_type_id,
         m.material_name,
         m.description AS material_description,
         m.material_code,
         sp.custom_item_name,
         COALESCE(
           NULLIF(TRIM(sp.brand_name), ''),
           NULLIF(
             TRIM(
               COALESCE(
                 to_jsonb(b)->>'brandName',
                 to_jsonb(b)->>'brandname',
                 to_jsonb(b)->>'name',
                 ''
               )
             ),
             ''
           )
         ) AS brand_name,
         sp.quantity::text,
         (
           ${PART_SALE_UNIT_PRICE_SQL}
         )::text AS unit_price,
         COALESCE(sp.labor, 0)::text AS labor,
         sp.discount_type,
         COALESCE(sp.discount_amount, 0)::text AS discount_amount
       FROM pcmazing_service_parts sp
       LEFT JOIN tblmaterials m ON m.id = sp.material_id
       LEFT JOIN tblbrands b ON b.id = m.brand_id
       WHERE sp.service_id = $1 AND sp.deleted_at IS NULL
       ORDER BY sp.id ASC`,
      [id],
    );

    const partsDiscount = partsResult.rows.reduce(
      (sum, part) => sum + Number(part.discount_amount ?? 0),
      0,
    );
    const partsSales = partsResult.rows.reduce(
      (sum, part) => sum + Number(part.quantity ?? 0) * Number(part.unit_price ?? 0),
      0,
    );
    const grossSales = this.computeGrossJobSale(
      labor,
      partsLabor,
      partsSales,
      partsDiscount,
      Number(row.custom_discount ?? 0),
      row.labor_discount_type,
    );
    const refundAmount =
      this.normalizeStatusLabel(row.status) === 'refunded'
        ? Math.max(0, Number(row.refund_amount ?? 0))
        : 0;

    return {
      id: Number(row.id),
      referenceNo: row.reference_no,
      customerName: row.customer_name ?? 'Unknown customer',
      customerEmail: row.customer_email?.trim() || null,
      customerContact: row.customer_contact?.trim() || null,
      customerAddress: row.customer_address?.trim() || null,
      serviceName: row.service_name,
      personInChargeUserId: userId,
      personInChargeSource: source,
      personInChargeName: userId ? personNames.get(`${source}:${userId}`) ?? null : null,
      type: row.service_type,
      partsUsed: row.parts_used
        ? row.parts_used.split(',').map((item) => item.trim()).filter(Boolean)
        : [],
      cost,
      labor,
      status: row.status ?? 'Active',
      notes: row.notes,
      cancelReason: row.cancel_reason?.trim() || null,
      refundReason: row.refund_reason?.trim() || null,
      refundAmount: refundAmount > 0 ? refundAmount : undefined,
      laborDiscountType: this.normalizeDiscountType(row.labor_discount_type),
      customDiscount: Number(row.custom_discount ?? 0),
      downpayment: Number(row.downpayment ?? 0),
      paymentMethod: this.normalizePaymentMethod(row.payment_method),
      imageUrl: row.image_url,
      deviceBrand: row.device_brand?.trim() || null,
      deviceModel: row.device_model?.trim() || null,
      deviceSerial: row.device_serial?.trim() || null,
      totalCosting: partsCost,
      totalSales: Math.max(0, grossSales - refundAmount),
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationMinutes: this.computeDurationMinutes(row.started_at, row.ended_at),
      createdAt: row.created_at,
      parts: partsResult.rows.map((part) => ({
        materialId: part.material_id ?? undefined,
        serviceTypeId: part.service_type_id ?? undefined,
        materialName: part.material_name,
        materialCode: part.material_code,
        description: part.material_description,
        customItemName: part.custom_item_name ?? undefined,
        brandName: part.brand_name?.trim() || null,
        quantity: Number(part.quantity ?? 0),
        unitPrice: Number(part.unit_price ?? 0),
        labor: Number(part.labor ?? 0),
        discountType: this.normalizeDiscountType(part.discount_type),
        discountAmount: Number(part.discount_amount ?? 0),
      })),
      updatedAt: row.updated_at,
      statusHistory: await this.loadStatusHistory(id),
    };
  }

  private computeDurationMinutes(startedAt: string | null, endedAt: string | null): number | null {
    if (!startedAt || !endedAt) {
      return null;
    }

    const start = new Date(startedAt);
    const end = new Date(endedAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }

    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) {
      return null;
    }

    return Math.round(diffMs / 60000);
  }

  private buildReferenceNo(id: number): string {
    return `SRV-${String(id).padStart(6, '0')}`;
  }

  private normalizeDiscountType(value: unknown): 'none' | 'senior' | 'pwd' {
    const raw = String(value ?? '')
      .trim()
      .toLowerCase();
    if (raw === 'senior' || raw === 'sc' || raw === 'senior_citizen') {
      return 'senior';
    }
    if (raw === 'pwd' || raw === 'person_with_disability') {
      return 'pwd';
    }
    return 'none';
  }

  private normalizePaymentMethod(value: unknown): JobPaymentMethod | null {
    const raw = String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ');
    return JOB_PAYMENT_METHODS.find((method) => method.toLowerCase() === raw) ?? null;
  }

  private normalizeBrandName(value?: string | null): string | null {
    const name = String(value ?? '').trim();
    return name ? name.slice(0, 120) : null;
  }

  private static readonly NON_INVENTORY_PRODUCT_TYPE = 'Non-Inventory';

  private async resolveMaterialId(
    client: PoolClient,
    part: {
      materialId?: number;
      serviceTypeId?: number;
      customItemName?: string;
      brandName?: string;
      unitPrice?: number;
      createCatalogService?: boolean;
      createInventoryMaterial?: boolean;
    },
  ): Promise<number | null> {
    const existingId = Number(part.materialId);
    if (Number.isFinite(existingId) && existingId > 0) {
      return existingId;
    }

    const name = part.customItemName?.trim() || '';
    const shouldCreate =
      Boolean(part.createInventoryMaterial) &&
      !part.createCatalogService &&
      !(Number(part.serviceTypeId) > 0) &&
      Boolean(name);

    if (!shouldCreate) {
      return null;
    }

    const found = await client.query<{ id: number | string }>(
      `SELECT id
       FROM tblmaterials
       WHERE deleted_at IS NULL AND LOWER(TRIM(material_name)) = LOWER($1)
       LIMIT 1`,
      [name],
    );
    if (found.rows[0]) {
      return Number(found.rows[0].id);
    }

    const productTypeId = await this.resolveNonInventoryProductTypeId(client);
    const brandId = await this.resolveBrandId(client, part.brandName, productTypeId);
    const unitPrice = Math.max(0, Number(part.unitPrice) || 0);

    try {
      const inserted = await client.query<{ id: number | string }>(
        `INSERT INTO tblmaterials (
           material_name,
           material_code,
           description,
           product_type_id,
           brand_id,
           unit,
           unit_price,
           order_cost,
           sell_price,
           on_hand_stock,
           reorder_level
         )
         VALUES ($1, NULL, NULL, $2, $3, 'PCS', $4, 0, $4, 0, 0)
         RETURNING id`,
        [name, productTypeId, brandId, unitPrice],
      );
      return Number(inserted.rows[0].id);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== '23505') {
        throw error;
      }
      const retry = await client.query<{ id: number | string }>(
        `SELECT id
         FROM tblmaterials
         WHERE deleted_at IS NULL AND LOWER(TRIM(material_name)) = LOWER($1)
         LIMIT 1`,
        [name],
      );
      if (!retry.rows[0]) {
        throw error;
      }
      return Number(retry.rows[0].id);
    }
  }

  private async resolveNonInventoryProductTypeId(client: PoolClient): Promise<number | null> {
    if (!(await tableExists(this.databaseService, 'tblproducttypes'))) {
      return null;
    }

    const typeName = InventoryServicesService.NON_INVENTORY_PRODUCT_TYPE;
    const found = await client.query<{ id: number | string }>(
      `SELECT id
       FROM tblproducttypes pt
       WHERE LOWER(TRIM(COALESCE(to_jsonb(pt)->>'name', to_jsonb(pt)->>'productTypeName', ''))) = LOWER($1)
       LIMIT 1`,
      [typeName],
    );
    if (found.rows[0]) {
      return Number(found.rows[0].id);
    }

    const nextIdResult = await client.query<{ next_id: string }>(
      `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM tblproducttypes`,
    );
    const nextId = Number(nextIdResult.rows[0]?.next_id ?? 1);

    try {
      const inserted = await client.query<{ id: number | string }>(
        `INSERT INTO tblproducttypes (id, name) VALUES ($1, $2) RETURNING id`,
        [nextId, typeName],
      );
      return Number(inserted.rows[0]?.id ?? nextId);
    } catch {
      const inserted = await client.query<{ id: number | string }>(
        `INSERT INTO tblproducttypes (id, "productTypeName") VALUES ($1, $2) RETURNING id`,
        [nextId, typeName],
      );
      return Number(inserted.rows[0]?.id ?? nextId);
    }
  }

  private async resolveBrandId(
    client: PoolClient,
    brandName?: string,
    productTypeId?: number | null,
  ): Promise<number | null> {
    const normalizedName = this.normalizeBrandName(brandName);
    if (!normalizedName) {
      return null;
    }

    if (!(await tableExists(this.databaseService, 'tblbrands'))) {
      return null;
    }

    const params: unknown[] = [normalizedName];
    let productTypeFilter = '';
    if (productTypeId) {
      params.push(productTypeId);
      productTypeFilter = ` AND product_type_id = $${params.length}`;
    }

    const existing = await client.query<{ id: number | string }>(
      `SELECT id
       FROM tblbrands
       WHERE LOWER(TRIM(COALESCE("brandName", ''))) = LOWER(TRIM($1))
       ${productTypeFilter}
       LIMIT 1`,
      params,
    );
    if (existing.rows[0]) {
      return Number(existing.rows[0].id);
    }

    const nextIdResult = await client.query<{ next_id: string }>(
      `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM tblbrands`,
    );
    const nextId = Number(nextIdResult.rows[0]?.next_id ?? 1);

    try {
      const inserted = await client.query<{ id: number | string }>(
        `INSERT INTO tblbrands (id, "brandName", product_type_id, type)
         VALUES ($1, $2, $3, 'ACU')
         RETURNING id`,
        [nextId, normalizedName, productTypeId ?? null],
      );
      return Number(inserted.rows[0]?.id ?? nextId);
    } catch {
      const retry = await client.query<{ id: number | string }>(
        `SELECT id
         FROM tblbrands
         WHERE LOWER(TRIM(COALESCE("brandName", ''))) = LOWER(TRIM($1))
         LIMIT 1`,
        [normalizedName],
      );
      return retry.rows[0] ? Number(retry.rows[0].id) : null;
    }
  }

  private async resolveServiceTypeId(
    client: PoolClient,
    part: {
      materialId?: number;
      serviceTypeId?: number;
      customItemName?: string;
      labor?: number;
      unitPrice?: number;
      createCatalogService?: boolean;
    },
  ): Promise<number | null> {
    const existingId = Number(part.serviceTypeId);
    if (Number.isFinite(existingId) && existingId > 0) {
      return existingId;
    }

    const name = part.customItemName?.trim() || '';
    const shouldCreate =
      Boolean(part.createCatalogService) &&
      !part.materialId &&
      Boolean(name);

    if (!shouldCreate) {
      return null;
    }

    const found = await client.query<{ id: number | string }>(
      `SELECT id
       FROM pcmazing_service_types
       WHERE deleted_at IS NULL AND LOWER(TRIM(name)) = LOWER($1)
       LIMIT 1`,
      [name],
    );
    if (found.rows[0]) {
      return Number(found.rows[0].id);
    }

    try {
      const inserted = await client.query<{ id: number | string }>(
        `INSERT INTO pcmazing_service_types (name, description, labor_price, is_active)
         VALUES ($1, NULL, $2, TRUE)
         RETURNING id`,
        [name, Number(part.labor) || 0],
      );
      return Number(inserted.rows[0].id);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== '23505') {
        throw error;
      }
      const retry = await client.query<{ id: number | string }>(
        `SELECT id
         FROM pcmazing_service_types
         WHERE deleted_at IS NULL AND LOWER(TRIM(name)) = LOWER($1)
         LIMIT 1`,
        [name],
      );
      if (!retry.rows[0]) {
        throw error;
      }
      return Number(retry.rows[0].id);
    }
  }

  async searchCustomers(search?: string): Promise<JobOrderCustomerSuggestion[]> {
    const query = search?.trim() ?? '';
    const like = `%${query}%`;
    const unions: string[] = [];
    const params: unknown[] = [];

    if (await tableExists(this.databaseService, 'pcmazing_services')) {
      params.push(like);
      unions.push(
        `SELECT
           TRIM(customer_name) AS customer_name,
           NULLIF(TRIM(customer_email), '') AS customer_email,
           NULLIF(TRIM(customer_contact), '') AS customer_contact,
           NULLIF(TRIM(customer_address), '') AS customer_address,
           COALESCE(updated_at, created_at) AS sort_at,
           1 AS priority
         FROM pcmazing_services
         WHERE deleted_at IS NULL
           AND NULLIF(TRIM(customer_name), '') IS NOT NULL
           AND (
             $${params.length} = '%%'
             OR customer_name ILIKE $${params.length}
             OR COALESCE(customer_email, '') ILIKE $${params.length}
             OR COALESCE(customer_contact, '') ILIKE $${params.length}
           )`,
      );
    }

    if (await tableExists(this.databaseService, 'pcmazing_sales_orders')) {
      params.push(like);
      unions.push(
        `SELECT
           TRIM(customer_name) AS customer_name,
           NULL::text AS customer_email,
           NULLIF(TRIM(customer_phone), '') AS customer_contact,
           NULL::text AS customer_address,
           COALESCE(updated_at, created_at) AS sort_at,
           2 AS priority
         FROM pcmazing_sales_orders
         WHERE deleted_at IS NULL
           AND NULLIF(TRIM(customer_name), '') IS NOT NULL
           AND (
             $${params.length} = '%%'
             OR customer_name ILIKE $${params.length}
             OR COALESCE(customer_phone, '') ILIKE $${params.length}
           )`,
      );
    }

    if (await tableExists(this.databaseService, 'pcmazing_quotations')) {
      params.push(like);
      unions.push(
        `SELECT
           TRIM(customer_name) AS customer_name,
           NULLIF(TRIM(customer_email), '') AS customer_email,
           NULLIF(TRIM(customer_contact_number), '') AS customer_contact,
           NULLIF(TRIM(customer_address), '') AS customer_address,
           COALESCE(updated_at, created_at) AS sort_at,
           3 AS priority
         FROM pcmazing_quotations
         WHERE deleted_at IS NULL
           AND NULLIF(TRIM(customer_name), '') IS NOT NULL
           AND (
             $${params.length} = '%%'
             OR customer_name ILIKE $${params.length}
             OR COALESCE(customer_email, '') ILIKE $${params.length}
             OR COALESCE(customer_contact_number, '') ILIKE $${params.length}
           )`,
      );
    }

    if (await tableExists(this.databaseService, 'tblquotation')) {
      params.push(like);
      unions.push(
        `SELECT
           TRIM(customer_name) AS customer_name,
           NULLIF(TRIM(customer_email), '') AS customer_email,
           NULLIF(TRIM(customer_contact_number), '') AS customer_contact,
           NULLIF(TRIM(customer_address), '') AS customer_address,
           COALESCE(created_at, quote_date) AS sort_at,
           4 AS priority
         FROM tblquotation
         WHERE COALESCE(is_deleted, FALSE) = FALSE
           AND NULLIF(TRIM(customer_name), '') IS NOT NULL
           AND (
             $${params.length} = '%%'
             OR customer_name ILIKE $${params.length}
             OR COALESCE(customer_email, '') ILIKE $${params.length}
             OR COALESCE(customer_contact_number, '') ILIKE $${params.length}
           )`,
      );
    }

    if (unions.length === 0) {
      return [];
    }

    const result = await this.databaseService.query<{
      customer_name: string;
      customer_email: string | null;
      customer_contact: string | null;
      customer_address: string | null;
    }>(
      `SELECT DISTINCT ON (LOWER(customer_name))
         customer_name,
         customer_email,
         customer_contact,
         customer_address
       FROM (
         ${unions.join('\nUNION ALL\n')}
       ) customers
       ORDER BY LOWER(customer_name), priority ASC, sort_at DESC NULLS LAST
       LIMIT 25`,
      params,
    );

    return result.rows
      .filter((row) => row.customer_name)
      .map((row) => ({
        name: row.customer_name,
        email: row.customer_email,
        contact: row.customer_contact,
        address: row.customer_address,
      }));
  }

  private async assertPartsExist(
    parts: Array<{
      materialId?: number;
      serviceTypeId?: number;
      customItemName?: string;
      unitPrice?: number;
      quantity: number;
    }>,
  ): Promise<void> {
    if (parts.length === 0) {
      return;
    }

    const inventoryIds = parts
      .map((part) => part.materialId)
      .filter(
        (materialId): materialId is number =>
          typeof materialId === 'number' && Number.isFinite(materialId) && materialId > 0,
      );

    for (const part of parts) {
      const hasInventoryItem = Number.isFinite(part.materialId) && Number(part.materialId) > 0;
      const hasServiceType = Number.isFinite(part.serviceTypeId) && Number(part.serviceTypeId) > 0;
      const hasCustomItem = Boolean(part.customItemName?.trim());
      if (!hasInventoryItem && !hasCustomItem && !hasServiceType) {
        throw new BadRequestException(
          'Each line must use an inventory part, a catalog service, or a custom item.',
        );
      }

      if (hasCustomItem && (part.unitPrice ?? 0) < 0) {
        throw new BadRequestException('Custom item amount cannot be negative.');
      }
    }

    if (inventoryIds.length === 0) {
      return;
    }

    if (!(await tableExists(this.databaseService, 'tblmaterials'))) {
      throw new BadRequestException('Inventory materials are not available.');
    }

    const uniqueIds = [...new Set(inventoryIds.map((id) => Number(id)))];
    const result = await this.databaseService.query<{ id: number | string }>(
      `SELECT id
       FROM tblmaterials
       WHERE id = ANY($1::bigint[]) AND deleted_at IS NULL`,
      [uniqueIds],
    );
    const validIds = new Set(result.rows.map((row) => Number(row.id)));
    const missing = uniqueIds.filter((id) => !validIds.has(id));
    if (missing.length) {
      throw new BadRequestException(`Parts not found: ${missing.join(', ')}`);
    }
  }

  private async assertPersonExists(
    userId: number,
    source: 'tblusers' | 'pcmazing_admin_users',
  ): Promise<void> {
    const tableName = source === 'pcmazing_admin_users' ? 'pcmazing_admin_users' : 'tblusers';
    if (!(await tableExists(this.databaseService, tableName))) {
      throw new BadRequestException('Person in charge source table is not available.');
    }

    const result = await this.databaseService.query<{ id: number | string }>(
      `SELECT id FROM ${tableName} WHERE id = $1 LIMIT 1`,
      [userId],
    );

    if (!result.rows[0]) {
      throw new BadRequestException(`Person in charge ${userId} was not found.`);
    }
  }

  private computeGrossJobSale(
    laborBase: number,
    partsLabor: number,
    partsSales: number,
    partsDiscount: number,
    customDiscount: number,
    laborDiscountType: string | null | undefined,
  ): number {
    const laborDiscount =
      this.normalizeDiscountType(laborDiscountType) === 'senior' ||
      this.normalizeDiscountType(laborDiscountType) === 'pwd'
        ? Math.round(laborBase * 0.2 * 100) / 100
        : 0;

    return Math.max(
      0,
      laborBase + partsLabor + partsSales - partsDiscount - customDiscount - laborDiscount,
    );
  }

  private computeGrossFromServiceItem(item: InventoryServiceListItem): number {
    const parts = item.parts ?? [];
    const partsSales = parts.reduce(
      (sum, part) => sum + (Number(part.quantity) || 0) * (Number(part.unitPrice) || 0),
      0,
    );
    const partsDiscount = parts.reduce(
      (sum, part) => sum + (Number(part.discountAmount) || 0),
      0,
    );
    const partsLabor = parts.reduce((sum, part) => sum + (Number(part.labor) || 0), 0);
    const laborBase = Number(item.labor) || 0;

    return this.computeGrossJobSale(
      laborBase,
      partsLabor,
      partsSales,
      partsDiscount,
      Number(item.customDiscount) || 0,
      item.laborDiscountType,
    );
  }

  private normalizeStatusLabel(status: string | null | undefined): string {
    return String(status ?? '').trim().toLowerCase();
  }

  private async recordStatusChange(
    client: PoolClient,
    entry: {
      serviceId: number;
      fromStatus: string | null;
      toStatus: string;
      reason: string | null;
      changedBy: number | null;
    },
  ): Promise<void> {
    if (!(await tableExists(this.databaseService, 'pcmazing_service_status_history'))) {
      return;
    }

    await client.query(
      `INSERT INTO pcmazing_service_status_history (
         service_id,
         from_status,
         to_status,
         reason,
         changed_by
       )
       VALUES ($1, $2, $3, $4, $5)`,
      [entry.serviceId, entry.fromStatus, entry.toStatus, entry.reason, entry.changedBy],
    );
  }

  private async loadStatusHistory(serviceId: number): Promise<JobOrderStatusHistoryItem[]> {
    if (!(await tableExists(this.databaseService, 'pcmazing_service_status_history'))) {
      return [];
    }

    const result = await this.databaseService.query<{
      id: number;
      from_status: string | null;
      to_status: string;
      reason: string | null;
      changed_by: string | null;
      created_at: string;
    }>(
      `SELECT
         id,
         from_status,
         to_status,
         reason,
         changed_by::text,
         created_at::text
       FROM pcmazing_service_status_history
       WHERE service_id = $1
       ORDER BY created_at DESC, id DESC`,
      [serviceId],
    );

    const names = await this.loadPersonNames(
      result.rows.flatMap((row) => {
        const userId = row.changed_by ? Number(row.changed_by) : null;
        if (!userId) {
          return [];
        }
        return [
          { userId, source: 'pcmazing_admin_users' as const },
          { userId, source: 'tblusers' as const },
        ];
      }),
    );

    return result.rows.map((row) => {
      const changedBy = row.changed_by ? Number(row.changed_by) : null;
      return {
        id: row.id,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        reason: row.reason,
        changedBy,
        changedByName: changedBy
          ? names.get(`pcmazing_admin_users:${changedBy}`) ??
            names.get(`tblusers:${changedBy}`) ??
            null
          : null,
        createdAt: row.created_at,
      };
    });
  }
}
