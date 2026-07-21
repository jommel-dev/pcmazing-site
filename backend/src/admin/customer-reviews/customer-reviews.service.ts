import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  buildPagination,
  buildPaginationMeta,
  tableExists,
} from '../common/admin-table.util';
import { UpdateCustomerReviewDto } from './dto/update-customer-review.dto';

export interface CustomerReviewListItem {
  id: number;
  fullName: string;
  email: string | null;
  company: string | null;
  rating: number;
  title: string | null;
  message: string;
  status: string;
  isPublished: boolean;
  publishedAt: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CustomerReviewsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(pageRaw?: string, limitRaw?: string, search?: string, status?: string) {
    if (!(await tableExists(this.databaseService, 'customer_reviews'))) {
      throw new ServiceUnavailableException('Customer reviews table is not available.');
    }

    const { page, limit, offset } = buildPagination(pageRaw, limitRaw);
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(full_name ILIKE $${params.length} OR email ILIKE $${params.length} OR company ILIKE $${params.length} OR message ILIKE $${params.length})`,
      );
    }

    if (status?.trim()) {
      params.push(status.trim());
      conditions.push(`status = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM customer_reviews ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const listParams = [...params, limit, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const result = await this.databaseService.query<{
      id: number;
      full_name: string;
      email: string | null;
      company: string | null;
      rating: number;
      title: string | null;
      message: string;
      status: string;
      is_published: boolean;
      published_at: string | null;
      admin_notes: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, full_name, email, company, rating, title, message, status,
              is_published, published_at, admin_notes, created_at, updated_at
       FROM customer_reviews
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

  async getById(id: number): Promise<CustomerReviewListItem> {
    if (!(await tableExists(this.databaseService, 'customer_reviews'))) {
      throw new ServiceUnavailableException('Customer reviews table is not available.');
    }

    const result = await this.databaseService.query<{
      id: number;
      full_name: string;
      email: string | null;
      company: string | null;
      rating: number;
      title: string | null;
      message: string;
      status: string;
      is_published: boolean;
      published_at: string | null;
      admin_notes: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, full_name, email, company, rating, title, message, status,
              is_published, published_at, admin_notes, created_at, updated_at
       FROM customer_reviews WHERE id = $1 LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Customer review ${id} was not found.`);
    }

    return this.mapRow(row);
  }

  async update(id: number, dto: UpdateCustomerReviewDto): Promise<CustomerReviewListItem> {
    const existing = await this.getById(id);
    const nextStatus = dto.status ?? existing.status;
    let nextPublished = dto.isPublished ?? existing.isPublished;

    if (dto.status === 'approved' && dto.isPublished === undefined) {
      nextPublished = true;
    }

    if (dto.status === 'rejected') {
      nextPublished = false;
    }

    const publishedAt =
      nextPublished && !existing.isPublished
        ? new Date().toISOString()
        : nextPublished
          ? existing.publishedAt
          : null;

    await this.databaseService.query(
      `UPDATE customer_reviews
       SET status = $2,
           is_published = $3,
           published_at = $4,
           admin_notes = COALESCE($5, admin_notes),
           updated_at = NOW()
       WHERE id = $1`,
      [id, nextStatus, nextPublished, publishedAt, dto.adminNotes?.trim() || null],
    );

    return this.getById(id);
  }

  private mapRow(row: {
    id: number;
    full_name: string;
    email: string | null;
    company: string | null;
    rating: number;
    title: string | null;
    message: string;
    status: string;
    is_published: boolean;
    published_at: string | null;
    admin_notes: string | null;
    created_at: string;
    updated_at: string;
  }): CustomerReviewListItem {
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      company: row.company,
      rating: Number(row.rating),
      title: row.title,
      message: row.message,
      status: row.status,
      isPublished: row.is_published,
      publishedAt: row.published_at,
      adminNotes: row.admin_notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
