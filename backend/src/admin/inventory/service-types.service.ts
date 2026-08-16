import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';
import { CreateServiceTypeDto, UpdateServiceTypeDto } from './dto/service-type.dto';

export interface ServiceTypeItem {
  id: number;
  name: string;
  description: string | null;
  laborPrice: number;
  usageCount: number;
  totalLaborCollected: number;
  isActive: boolean;
  updatedAt: string | null;
}

@Injectable()
export class ServiceTypesService {
  constructor(private readonly databaseService: DatabaseService) {}

  private async ensureTable(): Promise<void> {
    if (!(await tableExists(this.databaseService, 'pcmazing_service_types'))) {
      throw new ServiceUnavailableException(
        'Service types table is not available. Apply migration 036_service_types.sql.',
      );
    }
  }

  async list(activeOnly = false): Promise<ServiceTypeItem[]> {
    await this.ensureTable();

    const hasServices = await tableExists(this.databaseService, 'pcmazing_services');

    const result = await this.databaseService.query<{
      id: number;
      name: string;
      description: string | null;
      labor_price: string | null;
      is_active: boolean;
      updated_at: string | null;
      usage_count: string;
      total_labor_collected: string;
    }>(
      hasServices
        ? `SELECT
            t.id,
            t.name,
            t.description,
            t.labor_price::text,
            t.is_active,
            t.updated_at::text,
            COALESCE(usage.usage_count, 0)::text AS usage_count,
            COALESCE(usage.total_labor_collected, 0)::text AS total_labor_collected
           FROM pcmazing_service_types t
           LEFT JOIN LATERAL (
             SELECT
               COUNT(DISTINCT usage_rows.id)::bigint AS usage_count,
               COALESCE(SUM(usage_rows.labor_amt), 0) AS total_labor_collected
             FROM (
               SELECT s.id, COALESCE(sp.labor, 0) AS labor_amt
               FROM pcmazing_service_parts sp
               JOIN pcmazing_services s ON s.id = sp.service_id
               WHERE s.deleted_at IS NULL
                 AND sp.deleted_at IS NULL
                 AND sp.service_type_id = t.id
               UNION ALL
               SELECT s.id, COALESCE(s.labor, 0) AS labor_amt
               FROM pcmazing_services s
               WHERE s.deleted_at IS NULL
                 AND LOWER(TRIM(s.service_type)) = LOWER(TRIM(t.name))
                 AND NOT EXISTS (
                   SELECT 1
                   FROM pcmazing_service_parts sp
                   WHERE sp.service_id = s.id
                     AND sp.deleted_at IS NULL
                     AND sp.service_type_id IS NOT NULL
                 )
             ) usage_rows
           ) usage ON TRUE
           WHERE t.deleted_at IS NULL
             ${activeOnly ? 'AND t.is_active = TRUE' : ''}
           ORDER BY t.name ASC`
        : `SELECT
            id,
            name,
            description,
            labor_price::text,
            is_active,
            updated_at::text,
            '0' AS usage_count,
            '0' AS total_labor_collected
           FROM pcmazing_service_types
           WHERE deleted_at IS NULL
             ${activeOnly ? 'AND is_active = TRUE' : ''}
           ORDER BY name ASC`,
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async create(dto: CreateServiceTypeDto): Promise<ServiceTypeItem> {
    await this.ensureTable();

    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Service type name is required.');
    }

    const existing = await this.databaseService.query<{ id: number }>(
      `SELECT id
       FROM pcmazing_service_types
       WHERE deleted_at IS NULL AND LOWER(TRIM(name)) = LOWER($1)
       LIMIT 1`,
      [name],
    );
    if (existing.rows[0]) {
      throw new BadRequestException(`Service type "${name}" already exists.`);
    }

    const insert = await this.databaseService.query<{ id: number | string }>(
      `INSERT INTO pcmazing_service_types (name, description, labor_price, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [name, dto.description?.trim() || null, dto.laborPrice ?? 0, dto.isActive ?? true],
    );

    return this.getById(Number(insert.rows[0].id));
  }

  async update(id: number, dto: UpdateServiceTypeDto): Promise<ServiceTypeItem> {
    await this.ensureTable();
    await this.getById(id);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Service type name is required.');
      }

      const duplicate = await this.databaseService.query<{ id: number }>(
        `SELECT id
         FROM pcmazing_service_types
         WHERE deleted_at IS NULL
           AND LOWER(TRIM(name)) = LOWER($1)
           AND id <> $2
         LIMIT 1`,
        [name, id],
      );
      if (duplicate.rows[0]) {
        throw new BadRequestException(`Service type "${name}" already exists.`);
      }
    }

    await this.databaseService.query(
      `UPDATE pcmazing_service_types
       SET name = COALESCE($1, name),
           description = CASE
             WHEN $2::boolean THEN $3
             ELSE description
           END,
           labor_price = COALESCE($4, labor_price),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $6 AND deleted_at IS NULL`,
      [
        dto.name?.trim() || null,
        dto.description !== undefined,
        dto.description?.trim() || null,
        dto.laborPrice ?? null,
        dto.isActive ?? null,
        id,
      ],
    );

    return this.getById(id);
  }

  async remove(id: number): Promise<void> {
    await this.ensureTable();
    await this.getById(id);

    await this.databaseService.query(
      `UPDATE pcmazing_service_types
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  private async getById(id: number): Promise<ServiceTypeItem> {
    const items = await this.list(false);
    const item = items.find((entry) => entry.id === Number(id));
    if (!item) {
      throw new NotFoundException(`Service type ${id} was not found.`);
    }
    return item;
  }

  private mapRow(row: {
    id: number | string;
    name: string;
    description: string | null;
    labor_price: string | null;
    is_active: boolean;
    updated_at: string | null;
    usage_count: string;
    total_labor_collected: string;
  }): ServiceTypeItem {
    return {
      id: Number(row.id),
      name: row.name,
      description: row.description,
      laborPrice: Number(row.labor_price ?? 0),
      usageCount: Number(row.usage_count ?? 0),
      totalLaborCollected: Number(row.total_labor_collected ?? 0),
      isActive: row.is_active,
      updatedAt: row.updated_at,
    };
  }
}
