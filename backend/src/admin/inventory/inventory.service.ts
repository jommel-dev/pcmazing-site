import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  buildPagination,
  buildPaginationMeta,
  tableExists,
} from '../common/admin-table.util';

export interface MaterialListItem {
  id: number;
  materialCode: string | null;
  materialName: string;
  brandName: string | null;
  unit: string | null;
  unitPrice: number | null;
  sellPrice: number | null;
  onHandStock: number | null;
  reorderLevel: number | null;
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
      sell_price: string | null;
      on_hand_stock: string | null;
      reorder_level: string | null;
    }>(
      `SELECT
        m.id,
        m.material_code,
        m.material_name,
        COALESCE(to_jsonb(b)->>'brandName', to_jsonb(b)->>'brandname', to_jsonb(b)->>'name') AS brand_name,
        m.unit,
        m.unit_price::text,
        m.sell_price::text,
        m.on_hand_stock::text,
        m.reorder_level::text
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
      brand_name: string | null;
      unit: string | null;
      unit_price: string | null;
      sell_price: string | null;
      on_hand_stock: string | null;
      reorder_level: string | null;
      created_at: string | null;
      updated_at: string | null;
    }>(
      `SELECT
        m.id,
        m.material_code,
        m.material_name,
        m.description,
        COALESCE(to_jsonb(b)->>'brandName', to_jsonb(b)->>'brandname', to_jsonb(b)->>'name') AS brand_name,
        m.unit,
        m.unit_price::text,
        m.sell_price::text,
        m.on_hand_stock::text,
        m.reorder_level::text,
        m.created_at,
        m.updated_at
       FROM tblmaterials m
       LEFT JOIN tblbrands b ON b.id = m.brand_id
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

  private mapMaterialRow(row: {
    id: number;
    material_code: string | null;
    material_name: string;
    brand_name: string | null;
    unit: string | null;
    unit_price: string | null;
    sell_price: string | null;
    on_hand_stock: string | null;
    reorder_level: string | null;
  }): MaterialListItem {
    return {
      id: row.id,
      materialCode: row.material_code,
      materialName: row.material_name,
      brandName: row.brand_name,
      unit: row.unit,
      unitPrice: row.unit_price !== null ? Number(row.unit_price) : null,
      sellPrice: row.sell_price !== null ? Number(row.sell_price) : null,
      onHandStock: row.on_hand_stock !== null ? Number(row.on_hand_stock) : null,
      reorderLevel: row.reorder_level !== null ? Number(row.reorder_level) : null,
    };
  }
}
