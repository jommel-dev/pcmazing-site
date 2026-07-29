import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  buildPagination,
  buildPaginationMeta,
  tableExists,
} from '../common/admin-table.util';
import { CreateServiceDto } from './dto/create-service.dto';
import { deleteServiceImageFile, saveServiceImageFile } from './service-image.util';

export interface InventoryServiceListItem {
  id: number;
  referenceNo: string | null;
  customerName: string;
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
  totalCosting: number;
  totalSales: number;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  notes?: string | null;
  parts?: Array<{
    materialId?: number;
    materialName?: string | null;
    customItemName?: string;
    quantity: number;
    unitPrice?: number;
  }>;
  updatedAt: string | null;
}

export interface InventoryServiceSummary {
  totalCosting: number;
  totalSales: number;
  totalLaborSales: number;
  totalPartsCost: number;
  itemCount: number;
}

export interface InventoryServiceFilterOption {
  label: string;
  count: number;
}

@Injectable()
export class InventoryServicesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(pageRaw?: string, limitRaw?: string, search?: string, type?: string, status?: string) {
    if (!(await tableExists(this.databaseService, 'pcmazing_services'))) {
      throw new ServiceUnavailableException('Service catalog table is not available in this database.');
    }

    const { page, limit, offset } = buildPagination(pageRaw, limitRaw);
    const params: unknown[] = [];
    const conditions = ['s.deleted_at IS NULL'];

    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(s.service_name ILIKE $${params.length}
          OR s.service_type ILIKE $${params.length}
          OR COALESCE(s.status, '') ILIKE $${params.length})`,
      );
    }

    if (type?.trim()) {
      params.push(type.trim());
      conditions.push(`LOWER(s.service_type) = LOWER($${params.length})`);
    }

    if (status?.trim()) {
      params.push(status.trim());
      conditions.push(`LOWER(s.status) = LOWER($${params.length})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM pcmazing_services s
       ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const summaryResult = await this.databaseService.query<{
      total_parts_cost: string;
      total_base_cost: string;
      total_labor_sales: string;
    }>(
      `SELECT
        COALESCE(SUM(COALESCE(parts.parts_cost, 0)), 0)::text AS total_parts_cost,
        COALESCE(SUM(COALESCE(s.base_cost, 0)), 0)::text AS total_base_cost,
        COALESCE(SUM(COALESCE(s.labor, 0)), 0)::text AS total_labor_sales
       FROM pcmazing_services s
       LEFT JOIN LATERAL (
         SELECT COALESCE(
           SUM(
             sp.quantity * CASE
               WHEN sp.material_id IS NULL THEN COALESCE(sp.unit_price, 0)
               ELSE COALESCE(m.order_cost, m.unit_price, sp.unit_price, 0)
             END
           ),
           0
         ) AS parts_cost
         FROM pcmazing_service_parts sp
         LEFT JOIN tblmaterials m ON m.id = sp.material_id
         WHERE sp.service_id = s.id AND sp.deleted_at IS NULL
       ) parts ON TRUE
       ${whereClause}`,
      params,
    );

    const totalPartsCost = Number(summaryResult.rows[0]?.total_parts_cost ?? 0);
    const totalBaseCost = Number(summaryResult.rows[0]?.total_base_cost ?? 0);
    const totalLaborSales = Number(summaryResult.rows[0]?.total_labor_sales ?? 0);

    const filterWhereClause = search?.trim()
      ? `WHERE s.deleted_at IS NULL AND (
          s.service_name ILIKE $1
          OR s.service_type ILIKE $1
          OR COALESCE(s.status, '') ILIKE $1
        )`
      : `WHERE s.deleted_at IS NULL`;
    const filterParams = search?.trim() ? [`%${search.trim()}%`] : [];

    const [typesResult, statusesResult] = await Promise.all([
      this.databaseService.query<{ label: string | null; count: string }>(
        `SELECT NULLIF(TRIM(s.service_type), '') AS label, COUNT(*)::text AS count
         FROM pcmazing_services s
         ${filterWhereClause}
         GROUP BY NULLIF(TRIM(s.service_type), '')
         ORDER BY label ASC NULLS LAST`,
        filterParams,
      ),
      this.databaseService.query<{ label: string | null; count: string }>(
        `SELECT NULLIF(TRIM(s.status), '') AS label, COUNT(*)::text AS count
         FROM pcmazing_services s
         ${filterWhereClause}
         GROUP BY NULLIF(TRIM(s.status), '')
         ORDER BY label ASC NULLS LAST`,
        filterParams,
      ),
    ]);

    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;
    const result = await this.databaseService.query<{
      id: number;
      reference_no: string | null;
      customer_name: string | null;
      service_name: string;
      person_in_charge_user_id: string | null;
      person_in_charge_source: 'tblusers' | 'pcmazing_admin_users' | null;
      service_type: string;
      parts_used: string | null;
      parts_cost: string | null;
      base_cost: string | null;
      labor: string | null;
      status: string | null;
      image_url: string | null;
      started_at: string | null;
      ended_at: string | null;
      updated_at: string | null;
    }>(
      `SELECT
        s.id,
        s.reference_no,
        s.customer_name,
        s.service_name,
        s.person_in_charge_user_id::text,
        s.person_in_charge_source,
        s.service_type,
        parts.parts_used,
        COALESCE(parts.parts_cost, 0)::text AS parts_cost,
        s.base_cost::text,
        s.labor::text,
        s.status,
        s.image_url,
        s.started_at::text,
        s.ended_at::text,
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
               sp.quantity * CASE
                 WHEN sp.material_id IS NULL THEN COALESCE(sp.unit_price, 0)
                 ELSE COALESCE(m.order_cost, m.unit_price, sp.unit_price, 0)
               END
             ),
             0
           ) AS parts_cost
         FROM pcmazing_service_parts sp
         LEFT JOIN tblmaterials m ON m.id = sp.material_id
         WHERE sp.service_id = s.id AND sp.deleted_at IS NULL
       ) parts ON TRUE
       ${whereClause}
       ORDER BY s.service_name ASC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      [...params, limit, offset],
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
        const labor = Number(row.labor ?? 0);
        const partsCost = Number(row.parts_cost ?? 0);
        const userId = row.person_in_charge_user_id ? Number(row.person_in_charge_user_id) : null;
        const source = row.person_in_charge_source ?? 'tblusers';

        return {
          id: row.id,
          referenceNo: row.reference_no,
          customerName: row.customer_name ?? 'Unknown customer',
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
          totalSales: baseCost + labor,
          startedAt: row.started_at,
          endedAt: row.ended_at,
          durationMinutes: this.computeDurationMinutes(row.started_at, row.ended_at),
          updatedAt: row.updated_at,
        } satisfies InventoryServiceListItem;
      }),
      meta: buildPaginationMeta(page, limit, total),
      summary: {
        totalCosting: totalPartsCost,
        totalSales: totalBaseCost + totalLaborSales,
        totalLaborSales,
        totalPartsCost,
        itemCount: total,
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

    const customerName = dto.customerName.trim();
    const serviceName = dto.serviceName.trim();
    const serviceType = dto.type.trim();
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
          service_name,
          person_in_charge_user_id,
          person_in_charge_source,
          service_type,
          base_cost,
          labor,
          status,
          notes,
          started_at,
          ended_at,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id`,
        [
          customerName,
          serviceName,
          dto.personInChargeUserId ?? null,
          source,
          serviceType,
          dto.cost ?? 0,
          dto.labor ?? 0,
          dto.status?.trim() || 'Active',
          dto.notes?.trim() || null,
          startedAt ? startedAt.toISOString() : null,
          endedAt ? endedAt.toISOString() : null,
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
        await client.query(
          `INSERT INTO pcmazing_service_parts (
             service_id,
             material_id,
             custom_item_name,
             quantity,
             unit_price
           )
           VALUES ($1, $2, $3, $4, $5)`,
          [
            serviceId,
            part.materialId ?? null,
            part.customItemName?.trim() || null,
            part.quantity,
            part.unitPrice ?? 0,
          ],
        );
      }

      return serviceId;
    });

    return this.getById(newId);
  }

  async update(id: number, dto: CreateServiceDto) {
    if (!(await tableExists(this.databaseService, 'pcmazing_services'))) {
      throw new ServiceUnavailableException('Service catalog table is not available in this database.');
    }

    await this.getById(id);

    const customerName = dto.customerName.trim();
    const serviceName = dto.serviceName.trim();
    const serviceType = dto.type.trim();
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
             service_name = $2,
             person_in_charge_user_id = $3,
             person_in_charge_source = $4,
             service_type = $5,
             base_cost = $6,
             labor = $7,
             status = $8,
             notes = $9,
             started_at = $10,
             ended_at = $11,
             updated_at = NOW()
         WHERE id = $12 AND deleted_at IS NULL`,
        [
          customerName,
          serviceName,
          dto.personInChargeUserId ?? null,
          source,
          serviceType,
          dto.cost ?? 0,
          dto.labor ?? 0,
          dto.status?.trim() || 'Active',
          dto.notes?.trim() || null,
          startedAt ? startedAt.toISOString() : null,
          endedAt ? endedAt.toISOString() : null,
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
        await client.query(
          `INSERT INTO pcmazing_service_parts (
             service_id,
             material_id,
             custom_item_name,
             quantity,
             unit_price
           )
           VALUES ($1, $2, $3, $4, $5)`,
          [
            id,
            part.materialId ?? null,
            part.customItemName?.trim() || null,
            part.quantity,
            part.unitPrice ?? 0,
          ],
        );
      }
    });

    return this.getById(id);
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
    const result = await this.databaseService.query<{
      id: number;
      reference_no: string | null;
      customer_name: string | null;
      service_name: string;
      person_in_charge_user_id: string | null;
      person_in_charge_source: 'tblusers' | 'pcmazing_admin_users' | null;
      service_type: string;
      parts_used: string | null;
      parts_cost: string | null;
      base_cost: string | null;
      labor: string | null;
      status: string | null;
      notes: string | null;
      image_url: string | null;
      started_at: string | null;
      ended_at: string | null;
      updated_at: string | null;
    }>(
      `SELECT
        s.id,
        s.reference_no,
        s.customer_name,
        s.service_name,
        s.person_in_charge_user_id::text,
        s.person_in_charge_source,
        s.service_type,
        parts.parts_used,
        COALESCE(parts.parts_cost, 0)::text AS parts_cost,
        s.base_cost::text,
        s.labor::text,
        s.status,
        s.notes,
        s.image_url,
        s.started_at::text,
        s.ended_at::text,
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
               sp.quantity * CASE
                 WHEN sp.material_id IS NULL THEN COALESCE(sp.unit_price, 0)
                 ELSE COALESCE(m.order_cost, m.unit_price, sp.unit_price, 0)
               END
             ),
             0
           ) AS parts_cost
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
    const partsResult = await this.databaseService.query<{
      material_id: number | null;
      material_name: string | null;
      custom_item_name: string | null;
      quantity: string;
      unit_price: string | null;
    }>(
      `SELECT
         sp.material_id,
         m.material_name,
         sp.custom_item_name,
         sp.quantity::text,
         (
           CASE
             WHEN sp.material_id IS NULL THEN COALESCE(sp.unit_price, 0)
             ELSE COALESCE(m.order_cost, m.unit_price, sp.unit_price, 0)
           END
         )::text AS unit_price
       FROM pcmazing_service_parts sp
       LEFT JOIN tblmaterials m ON m.id = sp.material_id
       WHERE sp.service_id = $1 AND sp.deleted_at IS NULL
       ORDER BY sp.id ASC`,
      [id],
    );

    return {
      id: row.id,
      referenceNo: row.reference_no,
      customerName: row.customer_name ?? 'Unknown customer',
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
      imageUrl: row.image_url,
      totalCosting: partsCost,
      totalSales: cost + labor,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationMinutes: this.computeDurationMinutes(row.started_at, row.ended_at),
      parts: partsResult.rows.map((part) => ({
        materialId: part.material_id ?? undefined,
        materialName: part.material_name,
        customItemName: part.custom_item_name ?? undefined,
        quantity: Number(part.quantity ?? 0),
        unitPrice: Number(part.unit_price ?? 0),
      })),
      updatedAt: row.updated_at,
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

  private async assertPartsExist(
    parts: Array<{ materialId?: number; customItemName?: string; unitPrice?: number; quantity: number }>,
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
      const hasCustomItem = Boolean(part.customItemName?.trim());
      if (!hasInventoryItem && !hasCustomItem) {
        throw new BadRequestException('Each service line must use an inventory item or a custom item.');
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

    const uniqueIds = [...new Set(inventoryIds)];
    const result = await this.databaseService.query<{ id: number }>(
      `SELECT id
       FROM tblmaterials
       WHERE id = ANY($1::bigint[]) AND deleted_at IS NULL`,
      [uniqueIds],
    );
    const validIds = new Set(result.rows.map((row) => row.id));
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

    const result = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM ${tableName} WHERE id = $1 LIMIT 1`,
      [userId],
    );

    if (!result.rows[0]) {
      throw new BadRequestException(`Person in charge ${userId} was not found.`);
    }
  }
}
