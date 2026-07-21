import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  buildPagination,
  buildPaginationMeta,
  tableExists,
} from '../common/admin-table.util';

export interface QuotationListItem {
  id: number;
  quoteNo: string | null;
  quoteDate: string | null;
  customerName: string | null;
  totalAmount: number | null;
  status: string | null;
  expiresAt: string | null;
  convertedSalesId: number | null;
  createdAt: string | null;
}

@Injectable()
export class QuotationService {
  constructor(private readonly databaseService: DatabaseService) {}

  async list(pageRaw?: string, limitRaw?: string, search?: string, status?: string) {
    if (!(await tableExists(this.databaseService, 'tblquotation'))) {
      throw new ServiceUnavailableException('Quotation tables are not available in this database.');
    }

    const { page, limit, offset } = buildPagination(pageRaw, limitRaw);
    const params: unknown[] = [];
    const conditions = ['COALESCE(q.is_deleted, FALSE) = FALSE'];

    if (status?.trim()) {
      params.push(status.trim().toLowerCase());
      conditions.push(`LOWER(COALESCE(q.status, '')) = $${params.length}`);
    }

    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(COALESCE(q.quote_no, '') ILIKE $${params.length}
          OR COALESCE(q.customer_name, '') ILIKE $${params.length}
          OR COALESCE(q.status, '') ILIKE $${params.length})`,
      );
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tblquotation q ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const listParams = [...params, limit, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const result = await this.databaseService.query<{
      id: number;
      quote_no: string | null;
      quote_date: string | null;
      customer_name: string | null;
      total_amount: string | null;
      status: string | null;
      expires_at: string | null;
      converted_sales_id: number | null;
      created_at: string | null;
    }>(
      `SELECT
        q.id,
        q.quote_no,
        q.quote_date::text,
        q.customer_name,
        q.total_amount::text,
        q.status,
        q.expires_at::text,
        q.converted_sales_id,
        q.created_at::text
       FROM tblquotation q
       ${whereClause}
       ORDER BY q.created_at DESC NULLS LAST, q.id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      listParams,
    );

    return {
      items: result.rows.map((row) => this.mapListRow(row)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(id: number) {
    if (!(await tableExists(this.databaseService, 'tblquotation'))) {
      throw new ServiceUnavailableException('Quotation tables are not available in this database.');
    }

    const headerResult = await this.databaseService.query<{
      id: number;
      quote_no: string | null;
      quote_date: string | null;
      customer_name: string | null;
      customer_address: string | null;
      customer_contact_person: string | null;
      customer_contact_number: string | null;
      customer_email: string | null;
      total_amount: string | null;
      status: string | null;
      validity_days: number | null;
      expires_at: string | null;
      converted_sales_id: number | null;
      remarks: string | null;
      created_at: string | null;
    }>(
      `SELECT
        id,
        quote_no,
        quote_date::text,
        customer_name,
        customer_address,
        customer_contact_person,
        customer_contact_number,
        customer_email,
        total_amount::text,
        status,
        validity_days,
        expires_at::text,
        converted_sales_id,
        remarks,
        created_at::text
       FROM tblquotation
       WHERE id = $1 AND COALESCE(is_deleted, FALSE) = FALSE
       LIMIT 1`,
      [id],
    );

    const header = headerResult.rows[0];
    if (!header) {
      throw new NotFoundException(`Quotation ${id} was not found.`);
    }

    let items: Array<Record<string, unknown>> = [];

    if (await tableExists(this.databaseService, 'tblquotation_items')) {
      const itemsResult = await this.databaseService.query<Record<string, unknown>>(
        `SELECT
          id,
          material_id,
          product_id,
          unit_price::text AS unit_price,
          sell_price::text AS sell_price,
          discount_price::text AS discount_price,
          total_set_qty,
          line_total::text AS line_total,
          remarks
         FROM tblquotation_items
         WHERE quotation_id = $1
         ORDER BY id ASC`,
        [id],
      );

      items = itemsResult.rows.map((row) => ({
        id: row['id'],
        materialId: row['material_id'],
        productId: row['product_id'],
        unitPrice: row['unit_price'] !== null ? Number(row['unit_price']) : null,
        sellPrice: row['sell_price'] !== null ? Number(row['sell_price']) : null,
        discountPrice: row['discount_price'] !== null ? Number(row['discount_price']) : null,
        totalSetQty: row['total_set_qty'],
        lineTotal: row['line_total'] !== null ? Number(row['line_total']) : null,
        remarks: row['remarks'],
        metadata: this.parseItemMetadata(String(row['remarks'] ?? '')),
      }));
    }

    return {
      ...this.mapListRow(header),
      customerAddress: header.customer_address,
      customerContactPerson: header.customer_contact_person,
      customerContactNumber: header.customer_contact_number,
      customerEmail: header.customer_email,
      validityDays: header.validity_days,
      remarks: header.remarks,
      items,
    };
  }

  private mapListRow(row: {
    id: number;
    quote_no: string | null;
    quote_date: string | null;
    customer_name: string | null;
    total_amount: string | null;
    status: string | null;
    expires_at: string | null;
    converted_sales_id: number | null;
    created_at: string | null;
  }): QuotationListItem {
    return {
      id: row.id,
      quoteNo: row.quote_no,
      quoteDate: row.quote_date,
      customerName: row.customer_name,
      totalAmount: row.total_amount !== null ? Number(row.total_amount) : null,
      status: row.status,
      expiresAt: row.expires_at,
      convertedSalesId: row.converted_sales_id,
      createdAt: row.created_at,
    };
  }

  private parseItemMetadata(remarks: string): Record<string, unknown> | null {
    if (!remarks.trim()) {
      return null;
    }

    try {
      return JSON.parse(remarks) as Record<string, unknown>;
    } catch {
      return { description: remarks };
    }
  }
}
