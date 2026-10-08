import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PERMISSION_CATALOG } from './permission-catalog';
import { isKnownPermissionKey, slugifyRoleName } from './permission.util';
import { CreateRoleDto } from './dto/role.dto';
import { UpdateRoleDto } from './dto/role.dto';
import { assertCanMutateRole, assertSoftDeleteAllowed } from './roles-admin.rules';

export type AdminRoleRow = {
  id: number;
  name: string;
  slug: string;
  isSystem: boolean;
  isActive: boolean;
  deletedAt: Date | string | null;
  permissionKeys: string[];
};

@Injectable()
export class RolesAdminService {
  constructor(private readonly database: DatabaseService) {}

  getCatalog() {
    return PERMISSION_CATALOG;
  }

  async listRoles(): Promise<AdminRoleRow[]> {
    const result = await this.database.query<{
      id: string;
      name: string;
      slug: string;
      is_system: boolean;
      is_active: boolean;
      deleted_at: Date | null;
      permission_keys: string[] | null;
    }>(
      `SELECT r.id::text AS id, r.name, r.slug, r.is_system, r.is_active, r.deleted_at,
              COALESCE(
                (SELECT array_agg(p.permission_key ORDER BY p.permission_key)
                 FROM pcmazing_role_permissions p WHERE p.role_id = r.id),
                ARRAY[]::text[]
              ) AS permission_keys
       FROM pcmazing_roles r
       WHERE r.deleted_at IS NULL
       ORDER BY r.is_system DESC, r.name ASC`,
    );

    return result.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      slug: row.slug,
      isSystem: row.is_system,
      isActive: row.is_active,
      deletedAt: row.deleted_at,
      permissionKeys: row.permission_keys ?? [],
    }));
  }

  async create(dto: CreateRoleDto): Promise<AdminRoleRow> {
    const name = dto.name.trim();
    const slug = slugifyRoleName(name);
    if (!slug) {
      throw new BadRequestException('Role name is invalid.');
    }
    this.assertPermissionKeys(dto.permissionKeys);

    const existing = await this.database.query(
      `SELECT id FROM pcmazing_roles WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`,
      [slug],
    );
    if (existing.rows.length) {
      throw new BadRequestException(`A role with slug "${slug}" already exists.`);
    }

    const inserted = await this.database.query<{ id: string }>(
      `INSERT INTO pcmazing_roles (name, slug, is_system, is_active)
       VALUES ($1, $2, FALSE, TRUE)
       RETURNING id::text AS id`,
      [name, slug],
    );
    const id = Number(inserted.rows[0].id);
    await this.replacePermissions(id, dto.permissionKeys);
    return this.getById(id);
  }

  async update(id: number, dto: UpdateRoleDto): Promise<AdminRoleRow> {
    const current = await this.getRawById(id);
    assertCanMutateRole(
      { isSystem: current.is_system, deletedAt: current.deleted_at },
      dto.permissionKeys ? 'permissions' : dto.isActive === false ? 'deactivate' : 'update',
    );

    const name = dto.name?.trim();
    let slug: string | undefined;
    if (name) {
      slug = slugifyRoleName(name);
      if (!slug) {
        throw new BadRequestException('Role name is invalid.');
      }
      const clash = await this.database.query(
        `SELECT id FROM pcmazing_roles
         WHERE slug = $1 AND deleted_at IS NULL AND id <> $2 LIMIT 1`,
        [slug, id],
      );
      if (clash.rows.length) {
        throw new BadRequestException(`A role with slug "${slug}" already exists.`);
      }
    }

    if (dto.permissionKeys) {
      this.assertPermissionKeys(dto.permissionKeys);
    }

    await this.database.query(
      `UPDATE pcmazing_roles
       SET name = COALESCE($2, name),
           slug = COALESCE($3, slug),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $1`,
      [id, name ?? null, slug ?? null, dto.isActive ?? null],
    );

    if (dto.permissionKeys) {
      await this.replacePermissions(id, dto.permissionKeys);
    }

    return this.getById(id);
  }

  async softDelete(id: number): Promise<{ id: number }> {
    const current = await this.getRawById(id);
    assertCanMutateRole(
      { isSystem: current.is_system, deletedAt: current.deleted_at },
      'soft_delete',
    );

    const assignees = await this.countAssignees(id, current.name);
    assertSoftDeleteAllowed(assignees);

    await this.database.query(
      `UPDATE pcmazing_roles
       SET deleted_at = NOW(), is_active = FALSE, updated_at = NOW()
       WHERE id = $1`,
      [id],
    );
    return { id };
  }

  private async getById(id: number): Promise<AdminRoleRow> {
    const roles = await this.listRoles();
    const found = roles.find((role) => role.id === id);
    if (!found) {
      throw new NotFoundException('Role was not found.');
    }
    return found;
  }

  private async getRawById(id: number): Promise<{
    id: number;
    name: string;
    is_system: boolean;
    deleted_at: Date | null;
  }> {
    const result = await this.database.query<{
      id: string;
      name: string;
      is_system: boolean;
      deleted_at: Date | null;
    }>(
      `SELECT id::text AS id, name, is_system, deleted_at
       FROM pcmazing_roles WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (!result.rows[0]) {
      throw new NotFoundException('Role was not found.');
    }
    return {
      id: Number(result.rows[0].id),
      name: result.rows[0].name,
      is_system: result.rows[0].is_system,
      deleted_at: result.rows[0].deleted_at,
    };
  }

  private async replacePermissions(roleId: number, keys: string[]): Promise<void> {
    await this.database.query(`DELETE FROM pcmazing_role_permissions WHERE role_id = $1`, [
      roleId,
    ]);
    for (const key of keys) {
      await this.database.query(
        `INSERT INTO pcmazing_role_permissions (role_id, permission_key) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [roleId, key],
      );
    }
  }

  private assertPermissionKeys(keys: string[]): void {
    const unknown = keys.filter((key) => !isKnownPermissionKey(key));
    if (unknown.length) {
      throw new BadRequestException(`Unknown permission key(s): ${unknown.join(', ')}`);
    }
  }

  private async countAssignees(roleId: number, roleName: string): Promise<number> {
    const admin = await this.database.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM pcmazing_admin_users WHERE role_id = $1`,
      [roleId],
    );
    let total = Number(admin.rows[0]?.count ?? 0);

    const legacyTable = await this.database.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = current_schema() AND table_name = 'tblusers'
       ) AS exists`,
    );
    if (legacyTable.rows[0]?.exists) {
      const legacy = await this.database.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM tblusers u
         LEFT JOIN tblrbac r ON r.id = u."roleId"
         WHERE COALESCE(r."roleName", r.rolename, '') = $1
           AND COALESCE(u.is_deleted, FALSE) = FALSE`,
        [roleName],
      );
      total += Number(legacy.rows[0]?.count ?? 0);
    }

    return total;
  }
}
