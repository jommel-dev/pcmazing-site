import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  buildPagination,
  buildPaginationMeta,
  tableExists,
} from '../common/admin-table.util';
import { UpdateContactInquiryDto } from './dto/update-contact-inquiry.dto';

export interface ContactInquiryListItem {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  serviceInterest: string;
  message: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ContactInquiriesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(pageRaw?: string, limitRaw?: string, search?: string, status?: string) {
    if (!(await tableExists(this.databaseService, 'contact_inquiries'))) {
      throw new ServiceUnavailableException('Contact inquiries table is not available.');
    }

    const { page, limit, offset } = buildPagination(pageRaw, limitRaw);
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(full_name ILIKE $${params.length} OR email ILIKE $${params.length} OR service_interest ILIKE $${params.length} OR message ILIKE $${params.length})`,
      );
    }

    if (status?.trim()) {
      params.push(status.trim());
      conditions.push(`COALESCE(status, 'new') = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM contact_inquiries ${whereClause}`,
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
      service_interest: string;
      message: string;
      status: string | null;
      admin_notes: string | null;
      created_at: string;
      updated_at: string | null;
    }>(
      `SELECT id, full_name, email, phone, service_interest, message,
              COALESCE(status, 'new') AS status, admin_notes, created_at,
              COALESCE(updated_at, created_at) AS updated_at
       FROM contact_inquiries
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

  async getById(id: number): Promise<ContactInquiryListItem> {
    if (!(await tableExists(this.databaseService, 'contact_inquiries'))) {
      throw new ServiceUnavailableException('Contact inquiries table is not available.');
    }

    const result = await this.databaseService.query<{
      id: number;
      full_name: string;
      email: string;
      phone: string | null;
      service_interest: string;
      message: string;
      status: string | null;
      admin_notes: string | null;
      created_at: string;
      updated_at: string | null;
    }>(
      `SELECT id, full_name, email, phone, service_interest, message,
              COALESCE(status, 'new') AS status, admin_notes, created_at,
              COALESCE(updated_at, created_at) AS updated_at
       FROM contact_inquiries
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Contact inquiry ${id} was not found.`);
    }

    return this.mapRow(row);
  }

  async update(id: number, dto: UpdateContactInquiryDto): Promise<ContactInquiryListItem> {
    await this.getById(id);

    await this.databaseService.query(
      `UPDATE contact_inquiries
       SET status = COALESCE($2, status),
           admin_notes = COALESCE($3, admin_notes),
           updated_at = NOW()
       WHERE id = $1`,
      [id, dto.status ?? null, dto.adminNotes?.trim() || null],
    );

    return this.getById(id);
  }

  private mapRow(row: {
    id: number;
    full_name: string;
    email: string;
    phone: string | null;
    service_interest: string;
    message: string;
    status: string | null;
    admin_notes: string | null;
    created_at: string;
    updated_at: string | null;
  }): ContactInquiryListItem {
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      serviceInterest: row.service_interest,
      message: row.message,
      status: row.status ?? 'new',
      adminNotes: row.admin_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
    };
  }
}
