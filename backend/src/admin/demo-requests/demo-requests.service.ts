import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  buildPagination,
  buildPaginationMeta,
  tableExists,
} from '../common/admin-table.util';
import { UpdateDemoRequestDto } from './dto/update-demo-request.dto';

export interface DemoRequestListItem {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  company: string | null;
  serviceInterest: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  message: string | null;
  status: string;
  followUpNotes: string | null;
  followedUpAt: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class DemoRequestsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(pageRaw?: string, limitRaw?: string, search?: string, status?: string) {
    if (!(await tableExists(this.databaseService, 'demo_requests'))) {
      throw new ServiceUnavailableException('Demo requests table is not available.');
    }

    const { page, limit, offset } = buildPagination(pageRaw, limitRaw);
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(full_name ILIKE $${params.length} OR email ILIKE $${params.length} OR company ILIKE $${params.length})`,
      );
    }

    if (status?.trim()) {
      params.push(status.trim());
      conditions.push(`status = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM demo_requests ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const listParams = [...params, limit, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const result = await this.databaseService.query<{
      id: number;
      full_name: string;
      email: string;
      phone: string | null;
      company: string | null;
      service_interest: string | null;
      preferred_date: string | null;
      preferred_time: string | null;
      message: string | null;
      status: string;
      follow_up_notes: string | null;
      followed_up_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, full_name, email, phone, company, service_interest,
              preferred_date::text, preferred_time, message, status,
              follow_up_notes, followed_up_at, created_at, updated_at
       FROM demo_requests
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      listParams,
    );

    return {
      items: result.rows.map((row) => this.mapRow(row)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(id: number): Promise<DemoRequestListItem> {
    if (!(await tableExists(this.databaseService, 'demo_requests'))) {
      throw new ServiceUnavailableException('Demo requests table is not available.');
    }

    const result = await this.databaseService.query<{
      id: number;
      full_name: string;
      email: string;
      phone: string | null;
      company: string | null;
      service_interest: string | null;
      preferred_date: string | null;
      preferred_time: string | null;
      message: string | null;
      status: string;
      follow_up_notes: string | null;
      followed_up_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, full_name, email, phone, company, service_interest,
              preferred_date::text, preferred_time, message, status,
              follow_up_notes, followed_up_at, created_at, updated_at
       FROM demo_requests WHERE id = $1 LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Demo request ${id} was not found.`);
    }

    return this.mapRow(row);
  }

  async update(id: number, dto: UpdateDemoRequestDto): Promise<DemoRequestListItem> {
    await this.getById(id);

    const followedUpAt =
      dto.status === 'followed_up' || dto.status === 'confirmed'
        ? new Date().toISOString()
        : undefined;

    await this.databaseService.query(
      `UPDATE demo_requests
       SET status = COALESCE($2, status),
           follow_up_notes = COALESCE($3, follow_up_notes),
           followed_up_at = COALESCE($4, followed_up_at),
           updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        dto.status ?? null,
        dto.followUpNotes?.trim() || null,
        followedUpAt ?? null,
      ],
    );

    return this.getById(id);
  }

  private mapRow(row: {
    id: number;
    full_name: string;
    email: string;
    phone: string | null;
    company: string | null;
    service_interest: string | null;
    preferred_date: string | null;
    preferred_time: string | null;
    message: string | null;
    status: string;
    follow_up_notes: string | null;
    followed_up_at: string | null;
    created_at: string;
    updated_at: string;
  }): DemoRequestListItem {
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      company: row.company,
      serviceInterest: row.service_interest,
      preferredDate: row.preferred_date,
      preferredTime: row.preferred_time,
      message: row.message,
      status: row.status,
      followUpNotes: row.follow_up_notes,
      followedUpAt: row.followed_up_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
