import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';
import { CreatePrintingTemplateDto, UpdatePrintingTemplateDto } from './dto/printing.dto';

export type PrintElementType = 'text' | 'field' | 'image' | 'line' | 'table';

export interface PrintLayoutElement {
  id: string;
  type: PrintElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  fieldKey?: string;
  content?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
}

export interface PrintLayout {
  elements: PrintLayoutElement[];
}

export interface PrintingTemplateItem {
  id: number;
  name: string;
  documentType: 'sales_receipt' | 'quotation' | 'invoice' | 'custom';
  paperWidthMm: number;
  paperHeightMm: number;
  layout: PrintLayout;
  isDefault: boolean;
  isActive: boolean;
  updatedAt: string | null;
}

type TemplateRow = {
  id: number;
  name: string;
  document_type: string;
  paper_width_mm: string;
  paper_height_mm: string;
  layout_json: PrintLayout | string;
  is_default: boolean;
  is_active: boolean;
  updated_at: string | null;
};

const PAPER_PRESETS: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 216, height: 279 },
  Receipt80: { width: 80, height: 200 },
  Receipt58: { width: 58, height: 200 },
};

@Injectable()
export class PrintingTemplatesService {
  constructor(private readonly databaseService: DatabaseService) {}

  private async ensureTable(): Promise<void> {
    if (!(await tableExists(this.databaseService, 'pcmazing_printing_templates'))) {
      throw new ServiceUnavailableException(
        'Printing templates table is not available. Apply migration 042_printing.sql.',
      );
    }
  }

  async list(documentType?: string): Promise<PrintingTemplateItem[]> {
    await this.ensureTable();

    const params: unknown[] = [];
    let filter = '';
    if (documentType?.trim()) {
      params.push(documentType.trim());
      filter = `AND document_type = $${params.length}`;
    }

    const result = await this.databaseService.query<TemplateRow>(
      `SELECT
         id,
         name,
         document_type,
         paper_width_mm::text,
         paper_height_mm::text,
         layout_json,
         is_default,
         is_active,
         updated_at::text
       FROM pcmazing_printing_templates
       WHERE deleted_at IS NULL
       ${filter}
       ORDER BY is_default DESC, name ASC`,
      params,
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async getById(id: number): Promise<PrintingTemplateItem> {
    await this.ensureTable();

    const result = await this.databaseService.query<TemplateRow>(
      `SELECT
         id,
         name,
         document_type,
         paper_width_mm::text,
         paper_height_mm::text,
         layout_json,
         is_default,
         is_active,
         updated_at::text
       FROM pcmazing_printing_templates
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Printing template ${id} was not found.`);
    }

    return this.mapRow(row);
  }

  async create(dto: CreatePrintingTemplateDto): Promise<PrintingTemplateItem> {
    await this.ensureTable();

    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Template name is required.');
    }

    await this.assertUniqueName(name);

    const documentType = dto.documentType ?? 'sales_receipt';
    const paper = this.resolvePaperSize(dto.paperWidthMm, dto.paperHeightMm, documentType);
    const layout = this.normalizeLayout(dto.layout);

    const insert = await this.databaseService.query<{ id: number }>(
      `INSERT INTO pcmazing_printing_templates (
         name,
         document_type,
         paper_width_mm,
         paper_height_mm,
         layout_json,
         is_default,
         is_active
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       RETURNING id`,
      [
        name,
        documentType,
        paper.width,
        paper.height,
        JSON.stringify(layout),
        dto.isDefault ?? false,
        dto.isActive ?? true,
      ],
    );

    const id = Number(insert.rows[0]?.id);
    if (!id) {
      throw new ServiceUnavailableException('Unable to create printing template.');
    }

    if (dto.isDefault) {
      await this.setDefault(id);
    }

    return this.getById(id);
  }

  async update(id: number, dto: UpdatePrintingTemplateDto): Promise<PrintingTemplateItem> {
    await this.ensureTable();
    const existing = await this.getById(id);

    if (dto.name?.trim()) {
      await this.assertUniqueName(dto.name.trim(), id);
    }

    const documentType = dto.documentType ?? existing.documentType;
    const paper = this.resolvePaperSize(
      dto.paperWidthMm ?? existing.paperWidthMm,
      dto.paperHeightMm ?? existing.paperHeightMm,
      documentType,
    );
    const layout = dto.layout ? this.normalizeLayout(dto.layout) : existing.layout;

    await this.databaseService.query(
      `UPDATE pcmazing_printing_templates
       SET name = COALESCE($1, name),
           document_type = COALESCE($2, document_type),
           paper_width_mm = COALESCE($3, paper_width_mm),
           paper_height_mm = COALESCE($4, paper_height_mm),
           layout_json = COALESCE($5::jsonb, layout_json),
           is_default = COALESCE($6, is_default),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
       WHERE id = $8 AND deleted_at IS NULL`,
      [
        dto.name?.trim() ?? null,
        dto.documentType ?? null,
        dto.paperWidthMm ?? null,
        dto.paperHeightMm ?? null,
        dto.layout ? JSON.stringify(layout) : null,
        dto.isDefault ?? null,
        dto.isActive ?? null,
        id,
      ],
    );

    if (dto.isDefault) {
      await this.setDefault(id);
    }

    return this.getById(id);
  }

  async remove(id: number): Promise<void> {
    await this.ensureTable();
    await this.getById(id);

    await this.databaseService.query(
      `UPDATE pcmazing_printing_templates
       SET deleted_at = NOW(),
           is_default = FALSE,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );

    await this.databaseService.query(
      `UPDATE pcmazing_printing_settings
       SET default_template_id = NULL,
           updated_at = NOW()
       WHERE default_template_id = $1`,
      [id],
    );
  }

  async duplicate(id: number): Promise<PrintingTemplateItem> {
    const source = await this.getById(id);
    const copyName = await this.buildCopyName(source.name);

    return this.create({
      name: copyName,
      documentType: source.documentType,
      paperWidthMm: source.paperWidthMm,
      paperHeightMm: source.paperHeightMm,
      layout: source.layout,
      isDefault: false,
      isActive: source.isActive,
    });
  }

  private async setDefault(id: number): Promise<void> {
    await this.databaseService.query(
      `UPDATE pcmazing_printing_templates
       SET is_default = (id = $1),
           updated_at = NOW()
       WHERE deleted_at IS NULL`,
      [id],
    );
  }

  private async assertUniqueName(name: string, excludeId?: number): Promise<void> {
    const params: unknown[] = [name];
    let exclude = '';
    if (excludeId) {
      params.push(excludeId);
      exclude = `AND id <> $${params.length}`;
    }

    const existing = await this.databaseService.query<{ id: number }>(
      `SELECT id
       FROM pcmazing_printing_templates
       WHERE deleted_at IS NULL
         AND LOWER(TRIM(name)) = LOWER(TRIM($1))
         ${exclude}
       LIMIT 1`,
      params,
    );

    if (existing.rows[0]) {
      throw new BadRequestException(`Template "${name}" already exists.`);
    }
  }

  private async buildCopyName(name: string): Promise<string> {
    const base = `${name.trim()} (Copy)`;
    let candidate = base;
    let index = 2;

    while (true) {
      const existing = await this.databaseService.query<{ id: number }>(
        `SELECT id
         FROM pcmazing_printing_templates
         WHERE deleted_at IS NULL AND LOWER(TRIM(name)) = LOWER(TRIM($1))
         LIMIT 1`,
        [candidate],
      );
      if (!existing.rows[0]) {
        return candidate;
      }
      candidate = `${base} ${index}`;
      index += 1;
    }
  }

  private resolvePaperSize(
    widthInput: number | undefined,
    heightInput: number | undefined,
    documentType: string,
  ): { width: number; height: number } {
    if (widthInput && heightInput) {
      return { width: widthInput, height: heightInput };
    }

    if (documentType === 'sales_receipt') {
      return PAPER_PRESETS.A4;
    }

    return PAPER_PRESETS.A4;
  }

  private normalizeLayout(layout?: PrintLayout): PrintLayout {
    const elements = Array.isArray(layout?.elements) ? layout.elements : [];
    return {
      elements: elements.map((element) => ({
        id: String(element.id),
        type: element.type,
        x: Number(element.x) || 0,
        y: Number(element.y) || 0,
        width: element.width == null ? undefined : Number(element.width),
        height: element.height == null ? undefined : Number(element.height),
        label: element.label?.trim() || undefined,
        fieldKey: element.fieldKey?.trim() || undefined,
        content: element.content?.trim() || undefined,
        fontSize: element.fontSize == null ? undefined : Number(element.fontSize),
        fontWeight: element.fontWeight ?? 'normal',
        textAlign: element.textAlign ?? 'left',
      })),
    };
  }

  private mapRow(row: TemplateRow): PrintingTemplateItem {
    const layout =
      typeof row.layout_json === 'string'
        ? (JSON.parse(row.layout_json) as PrintLayout)
        : row.layout_json;

    return {
      id: Number(row.id),
      name: row.name,
      documentType: row.document_type as PrintingTemplateItem['documentType'],
      paperWidthMm: Number(row.paper_width_mm ?? 210),
      paperHeightMm: Number(row.paper_height_mm ?? 297),
      layout: this.normalizeLayout(layout),
      isDefault: row.is_default,
      isActive: row.is_active,
      updatedAt: row.updated_at,
    };
  }
}
