import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  buildPagination,
  buildPaginationMeta,
  tableExists,
} from '../common/admin-table.util';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { deleteMaterialImageFile, saveMaterialImageFile } from './material-image.util';

export interface InventoryOption {
  id: number;
  name: string;
  productTypeId?: number | null;
}

export interface MaterialListItem {
  id: number;
  materialCode: string | null;
  materialName: string;
  brandName: string | null;
  unit: string | null;
  unitPrice: number | null;
  orderCost: number | null;
  sellPrice: number | null;
  onHandStock: number | null;
  reorderLevel: number | null;
  imageUrl: string | null;
}

export interface InventoryStockSummary {
  totalCost: number;
  totalPrice: number;
  totalMargin: number;
  totalStockValue: number;
  itemCount: number;
}

@Injectable()
export class InventoryService {
  constructor(private readonly databaseService: DatabaseService) {}

  async listMaterials(
    pageRaw?: string,
    limitRaw?: string,
    search?: string,
    brandId?: string,
    productTypeId?: string,
  ) {
    if (!(await tableExists(this.databaseService, 'tblmaterials'))) {
      throw new ServiceUnavailableException('Inventory tables are not available in this database.');
    }

    const { page, limit, offset } = buildPagination(pageRaw, limitRaw);
    const params: unknown[] = [];
    const conditions = ['m.deleted_at IS NULL'];

    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(m.material_name ILIKE $${params.length} OR m.material_code ILIKE $${params.length})`);
    }

    if (brandId?.trim()) {
      params.push(Number(brandId));
      conditions.push(`m.brand_id = $${params.length}`);
    }

    if (productTypeId?.trim()) {
      params.push(Number(productTypeId));
      conditions.push(`m.product_type_id = $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM tblmaterials m
       ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const summaryResult = await this.databaseService.query<{
      total_cost: string;
      total_order_cost: string;
      total_price: string;
    }>(
      `SELECT
        COALESCE(SUM(COALESCE(m.unit_price, 0) * COALESCE(m.on_hand_stock, 0)), 0)::text AS total_cost,
        COALESCE(SUM(COALESCE(m.order_cost, 0) * COALESCE(m.on_hand_stock, 0)), 0)::text AS total_order_cost,
        COALESCE(SUM(COALESCE(m.sell_price, 0) * COALESCE(m.on_hand_stock, 0)), 0)::text AS total_price
       FROM tblmaterials m
       LEFT JOIN tblbrands b ON b.id = m.brand_id
       ${whereClause}`,
      params,
    );

    const totalCost = Number(summaryResult.rows[0]?.total_cost ?? 0);
    const totalOrderCost = Number(summaryResult.rows[0]?.total_order_cost ?? 0);
    const totalPrice = Number(summaryResult.rows[0]?.total_price ?? 0);
    const totalMargin = totalPrice - totalOrderCost;

    const listParams = [...params, limit, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const result = await this.databaseService.query<{
      id: number;
      material_code: string | null;
      material_name: string;
      brand_name: string | null;
      unit: string | null;
      unit_price: string | null;
      order_cost: string | null;
      sell_price: string | null;
      on_hand_stock: string | null;
      reorder_level: string | null;
      image_url: string | null;
    }>(
      `SELECT
        m.id,
        m.material_code,
        m.material_name,
        COALESCE(to_jsonb(b)->>'brandName', to_jsonb(b)->>'brandname', to_jsonb(b)->>'name') AS brand_name,
        m.unit,
        m.unit_price::text,
        m.order_cost::text,
        m.sell_price::text,
        m.on_hand_stock::text,
        m.reorder_level::text,
        m.image_url
       FROM tblmaterials m
       LEFT JOIN tblbrands b ON b.id = m.brand_id
       ${whereClause}
       ORDER BY m.material_name ASC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      listParams,
    );

    return {
      items: result.rows.map((row) => this.mapMaterialRow(row)),
      meta: buildPaginationMeta(page, limit, total),
      summary: {
        totalCost,
        totalPrice,
        totalMargin,
        totalStockValue: totalPrice,
        itemCount: total,
      },
    };
  }

  async getMaterial(id: number) {
    if (!(await tableExists(this.databaseService, 'tblmaterials'))) {
      throw new ServiceUnavailableException('Inventory tables are not available in this database.');
    }

    const result = await this.databaseService.query<{
      id: number;
      material_code: string | null;
      material_name: string;
      description: string | null;
      brand_id: number | null;
      brand_name: string | null;
      product_type_id: number | null;
      product_type_name: string | null;
      unit: string | null;
      unit_price: string | null;
      order_cost: string | null;
      sell_price: string | null;
      on_hand_stock: string | null;
      reorder_level: string | null;
      created_at: string | null;
      updated_at: string | null;
      image_url: string | null;
    }>(
      `SELECT
        m.id,
        m.material_code,
        m.material_name,
        m.description,
        m.brand_id,
        COALESCE(to_jsonb(b)->>'brandName', to_jsonb(b)->>'brandname', to_jsonb(b)->>'name') AS brand_name,
        m.product_type_id,
        COALESCE(to_jsonb(pt)->>'name', to_jsonb(pt)->>'productTypeName') AS product_type_name,
        m.unit,
        m.unit_price::text,
        m.order_cost::text,
        m.sell_price::text,
        m.on_hand_stock::text,
        m.reorder_level::text,
        m.created_at,
        m.updated_at,
        m.image_url
       FROM tblmaterials m
       LEFT JOIN tblbrands b ON b.id = m.brand_id
       LEFT JOIN tblproducttypes pt ON pt.id = m.product_type_id
       WHERE m.id = $1 AND m.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(`Material ${id} was not found.`);
    }

    return {
      ...this.mapMaterialRow(row),
      description: row.description,
      brandId: row.brand_id,
      productTypeId: row.product_type_id,
      productTypeName: row.product_type_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getTree() {
    if (!(await tableExists(this.databaseService, 'tblmaterials'))) {
      throw new ServiceUnavailableException('Inventory tables are not available in this database.');
    }

    const hasProductTypes = await tableExists(this.databaseService, 'tblproducttypes');

    if (!hasProductTypes) {
      const brands = await this.databaseService.query<{ id: number; name: string; count: string }>(
        `SELECT
          b.id,
          COALESCE(to_jsonb(b)->>'brandName', to_jsonb(b)->>'brandname', to_jsonb(b)->>'name', 'Brand') AS name,
          COUNT(m.id)::text AS count
         FROM tblbrands b
         LEFT JOIN tblmaterials m ON m.brand_id = b.id AND m.deleted_at IS NULL
         GROUP BY b.id, to_jsonb(b)
         ORDER BY name ASC`,
      );

      return brands.rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: 'brand' as const,
        materialCount: Number(row.count),
      }));
    }

    const result = await this.databaseService.query<{
      product_type_id: number;
      product_type_name: string;
      brand_id: number | null;
      brand_name: string | null;
      material_count: string;
    }>(
      `SELECT
        pt.id AS product_type_id,
        COALESCE(to_jsonb(pt)->>'name', to_jsonb(pt)->>'productTypeName', 'Type') AS product_type_name,
        b.id AS brand_id,
        COALESCE(to_jsonb(b)->>'brandName', to_jsonb(b)->>'brandname', to_jsonb(b)->>'name') AS brand_name,
        COUNT(m.id)::text AS material_count
       FROM tblproducttypes pt
       LEFT JOIN tblmaterials m ON m.product_type_id = pt.id AND m.deleted_at IS NULL
       LEFT JOIN tblbrands b ON b.id = m.brand_id
       GROUP BY pt.id, to_jsonb(pt), b.id, to_jsonb(b)
       ORDER BY product_type_name ASC, brand_name ASC NULLS LAST`,
    );

    const treeMap = new Map<number, { id: number; name: string; type: 'product-type'; materialCount: number; children: Array<{ id: number; name: string; type: 'brand'; materialCount: number }> }>();

    for (const row of result.rows) {
      if (!treeMap.has(row.product_type_id)) {
        treeMap.set(row.product_type_id, {
          id: row.product_type_id,
          name: row.product_type_name,
          type: 'product-type',
          materialCount: 0,
          children: [],
        });
      }

      const node = treeMap.get(row.product_type_id)!;
      const count = Number(row.material_count);

      if (row.brand_id && row.brand_name) {
        node.children.push({
          id: row.brand_id,
          name: row.brand_name,
          type: 'brand',
          materialCount: count,
        });
      }

      node.materialCount += count;
    }

    return Array.from(treeMap.values());
  }

  async listBrands(productTypeId?: number, search?: string): Promise<InventoryOption[]> {
    if (!(await tableExists(this.databaseService, 'tblbrands'))) {
      return [];
    }

    const params: unknown[] = [];
    const conditions: string[] = [];

    if (productTypeId) {
      params.push(productTypeId);
      conditions.push(`b.product_type_id = $${params.length}`);
    }

    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `COALESCE(to_jsonb(b)->>'brandName', to_jsonb(b)->>'brandname', to_jsonb(b)->>'name', '') ILIKE $${params.length}`,
      );
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.databaseService.query<{ id: number; name: string; product_type_id: number | null }>(
      `SELECT
        b.id,
        COALESCE(to_jsonb(b)->>'brandName', to_jsonb(b)->>'brandname', to_jsonb(b)->>'name', 'Brand') AS name,
        b.product_type_id
       FROM tblbrands b
       ${whereClause}
       ORDER BY name ASC
       LIMIT 20`,
      params,
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      productTypeId: row.product_type_id,
    }));
  }

  async listProductTypes(search?: string): Promise<InventoryOption[]> {
    if (!(await tableExists(this.databaseService, 'tblproducttypes'))) {
      return [];
    }

    const params: unknown[] = [];
    let filter = '';
    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      filter = `WHERE COALESCE(to_jsonb(pt)->>'name', to_jsonb(pt)->>'productTypeName', '') ILIKE $1`;
    }

    const result = await this.databaseService.query<{ id: number; name: string }>(
      `SELECT
        pt.id,
        COALESCE(to_jsonb(pt)->>'name', to_jsonb(pt)->>'productTypeName', 'Type') AS name
       FROM tblproducttypes pt
       ${filter}
       ORDER BY name ASC
       LIMIT 20`,
      params,
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
    }));
  }

  async createMaterial(dto: CreateMaterialDto, createdBy?: number) {
    if (!(await tableExists(this.databaseService, 'tblmaterials'))) {
      throw new ServiceUnavailableException('Inventory tables are not available in this database.');
    }

    const materialName = dto.materialName.trim();
    const materialCode = dto.materialCode?.trim() || null;

    if (materialCode) {
      const duplicate = await this.databaseService.query<{ id: number }>(
        `SELECT id
         FROM tblmaterials
         WHERE material_code = $1 AND deleted_at IS NULL
         LIMIT 1`,
        [materialCode],
      );

      if (duplicate.rows[0]) {
        throw new BadRequestException(`Product code "${materialCode}" is already in use.`);
      }
    }

    const productTypeId = await this.resolveProductTypeId(dto.productTypeId, dto.productTypeName);
    const brandId = await this.resolveBrandId(dto.brandId, dto.brandName, productTypeId);

    const result = await this.databaseService.query<{ id: number }>(
      `INSERT INTO tblmaterials (
        material_name,
        material_code,
        description,
        brand_id,
        product_type_id,
        unit,
        unit_price,
        order_cost,
        sell_price,
        on_hand_stock,
        reorder_level,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        materialName,
        materialCode,
        dto.description?.trim() || null,
        brandId,
        productTypeId,
        dto.unit?.trim() || 'PCS',
        dto.unitPrice ?? 0,
        dto.orderCost ?? 0,
        dto.sellPrice ?? 0,
        dto.onHandStock ?? 0,
        dto.reorderLevel ?? 0,
        createdBy ?? null,
      ],
    );

    const id = result.rows[0]?.id;
    if (!id) {
      throw new ServiceUnavailableException('Unable to create product.');
    }

    return this.getMaterial(id);
  }

  async updateMaterial(id: number, dto: UpdateMaterialDto) {
    if (!(await tableExists(this.databaseService, 'tblmaterials'))) {
      throw new ServiceUnavailableException('Inventory tables are not available in this database.');
    }

    const existing = await this.getMaterial(id);
    const materialName = dto.materialName?.trim() ?? existing.materialName;
    const materialCode =
      dto.materialCode !== undefined ? dto.materialCode.trim() || null : existing.materialCode;

    if (materialCode) {
      const duplicate = await this.databaseService.query<{ id: number }>(
        `SELECT id
         FROM tblmaterials
         WHERE material_code = $1 AND deleted_at IS NULL AND id <> $2
         LIMIT 1`,
        [materialCode, id],
      );

      if (duplicate.rows[0]) {
        throw new BadRequestException(`Product code "${materialCode}" is already in use.`);
      }
    }

    const productTypeId =
      dto.productTypeId !== undefined || dto.productTypeName !== undefined
        ? await this.resolveProductTypeId(dto.productTypeId, dto.productTypeName)
        : existing.productTypeId ?? null;

    const brandId =
      dto.brandId !== undefined || dto.brandName !== undefined
        ? await this.resolveBrandId(dto.brandId, dto.brandName, productTypeId ?? undefined)
        : existing.brandId ?? null;

    await this.databaseService.query(
      `UPDATE tblmaterials
       SET material_name = $1,
           material_code = $2,
           description = $3,
           brand_id = $4,
           product_type_id = $5,
           unit = $6,
           unit_price = $7,
           order_cost = $8,
           sell_price = $9,
           on_hand_stock = $10,
           reorder_level = $11,
           updated_at = NOW()
       WHERE id = $12`,
      [
        materialName,
        materialCode,
        dto.description !== undefined ? dto.description.trim() || null : existing.description ?? null,
        brandId,
        productTypeId,
        dto.unit?.trim() ?? existing.unit ?? 'PCS',
        dto.unitPrice ?? existing.unitPrice ?? 0,
        dto.orderCost ?? existing.orderCost ?? 0,
        dto.sellPrice ?? existing.sellPrice ?? 0,
        dto.onHandStock ?? existing.onHandStock ?? 0,
        dto.reorderLevel ?? existing.reorderLevel ?? 0,
        id,
      ],
    );

    return this.getMaterial(id);
  }

  async uploadMaterialImage(id: number, file: Express.Multer.File) {
    const existing = await this.getMaterial(id);
    const imageUrl = await saveMaterialImageFile(id, file);

    await deleteMaterialImageFile(existing.imageUrl);

    await this.databaseService.query(
      `UPDATE tblmaterials SET image_url = $1, updated_at = NOW() WHERE id = $2`,
      [imageUrl, id],
    );

    return this.getMaterial(id);
  }

  async removeMaterialImage(id: number) {
    const existing = await this.getMaterial(id);
    await deleteMaterialImageFile(existing.imageUrl);

    await this.databaseService.query(
      `UPDATE tblmaterials SET image_url = NULL, updated_at = NOW() WHERE id = $1`,
      [id],
    );

    return this.getMaterial(id);
  }

  private async assertBrandExists(brandId: number): Promise<void> {
    if (!(await tableExists(this.databaseService, 'tblbrands'))) {
      throw new BadRequestException('Brand was not found.');
    }

    const result = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM tblbrands WHERE id = $1 LIMIT 1`,
      [brandId],
    );

    if (!result.rows[0]) {
      throw new BadRequestException(`Brand ${brandId} was not found.`);
    }
  }

  private async assertProductTypeExists(productTypeId: number): Promise<void> {
    if (!(await tableExists(this.databaseService, 'tblproducttypes'))) {
      throw new BadRequestException('Product type was not found.');
    }

    const result = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM tblproducttypes WHERE id = $1 LIMIT 1`,
      [productTypeId],
    );

    if (!result.rows[0]) {
      throw new BadRequestException(`Product type ${productTypeId} was not found.`);
    }
  }

  private async resolveProductTypeId(
    productTypeId?: number,
    productTypeName?: string,
  ): Promise<number | null> {
    if (productTypeId) {
      await this.assertProductTypeExists(productTypeId);
      return productTypeId;
    }

    const normalizedName = productTypeName?.trim();
    if (!normalizedName) {
      return null;
    }

    if (!(await tableExists(this.databaseService, 'tblproducttypes'))) {
      throw new BadRequestException('Product type records are not available.');
    }

    const existing = await this.databaseService.query<{ id: number }>(
      `SELECT id
       FROM tblproducttypes
       WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
       LIMIT 1`,
      [normalizedName],
    );

    if (existing.rows[0]) {
      return existing.rows[0].id;
    }

    const nextIdResult = await this.databaseService.query<{ next_id: string }>(
      `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM tblproducttypes`,
    );
    const nextId = Number(nextIdResult.rows[0]?.next_id ?? 1);

    const inserted = await this.databaseService.query<{ id: number }>(
      `INSERT INTO tblproducttypes (id, name) VALUES ($1, $2) RETURNING id`,
      [nextId, normalizedName],
    );

    return inserted.rows[0]?.id ?? nextId;
  }

  private async resolveBrandId(
    brandId?: number,
    brandName?: string,
    productTypeId?: number | null,
  ): Promise<number | null> {
    if (brandId) {
      await this.assertBrandExists(brandId);
      return brandId;
    }

    const normalizedName = brandName?.trim();
    if (!normalizedName) {
      return null;
    }

    if (!(await tableExists(this.databaseService, 'tblbrands'))) {
      throw new BadRequestException('Brand records are not available.');
    }

    const params: unknown[] = [normalizedName];
    let productTypeFilter = '';
    if (productTypeId) {
      params.push(productTypeId);
      productTypeFilter = ` AND product_type_id = $${params.length}`;
    }

    const existing = await this.databaseService.query<{ id: number }>(
      `SELECT id
       FROM tblbrands
       WHERE LOWER(TRIM(COALESCE("brandName", ''))) = LOWER(TRIM($1))
       ${productTypeFilter}
       LIMIT 1`,
      params,
    );

    if (existing.rows[0]) {
      return existing.rows[0].id;
    }

    const nextIdResult = await this.databaseService.query<{ next_id: string }>(
      `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM tblbrands`,
    );
    const nextId = Number(nextIdResult.rows[0]?.next_id ?? 1);

    const inserted = await this.databaseService.query<{ id: number }>(
      `INSERT INTO tblbrands (id, "brandName", product_type_id, type)
       VALUES ($1, $2, $3, 'ACU')
       RETURNING id`,
      [nextId, normalizedName, productTypeId ?? null],
    );

    return inserted.rows[0]?.id ?? nextId;
  }

  private mapMaterialRow(row: {
    id: number;
    material_code: string | null;
    material_name: string;
    brand_name: string | null;
    unit: string | null;
    unit_price: string | null;
    order_cost: string | null;
    sell_price: string | null;
    on_hand_stock: string | null;
    reorder_level: string | null;
    image_url?: string | null;
  }): MaterialListItem {
    return {
      id: row.id,
      materialCode: row.material_code,
      materialName: row.material_name,
      brandName: row.brand_name,
      unit: row.unit,
      unitPrice: row.unit_price !== null ? Number(row.unit_price) : null,
      orderCost: row.order_cost !== null ? Number(row.order_cost) : null,
      sellPrice: row.sell_price !== null ? Number(row.sell_price) : null,
      onHandStock: row.on_hand_stock !== null ? Number(row.on_hand_stock) : null,
      reorderLevel: row.reorder_level !== null ? Number(row.reorder_level) : null,
      imageUrl: row.image_url ?? null,
    };
  }

  redactCostFields<T extends { orderCost?: number | null; unitPrice?: number | null }>(
    item: T,
  ): T {
    return {
      ...item,
      orderCost: null,
      unitPrice: null,
    };
  }
}
