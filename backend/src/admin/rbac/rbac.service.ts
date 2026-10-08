import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { BUSINESS_ROLE_LABELS, isSuperAdmin } from './admin-roles.util';

/** Fallback labels if roles table is empty / unavailable. */
export const PLACEHOLDER_ROLES = [...BUSINESS_ROLE_LABELS] as const;

@Injectable()
export class RbacService {
  constructor(
    private readonly configService: ConfigService,
    private readonly database: DatabaseService,
  ) {}

  isEnabled(): boolean {
    return this.parseBoolean(this.configService.get<string>('RBAC_ENABLED'), false);
  }

  /** Active, non-deleted role display names for User Management. */
  async listRoles(): Promise<string[]> {
    try {
      const result = await this.database.query<{ name: string }>(
        `SELECT name FROM pcmazing_roles
         WHERE deleted_at IS NULL AND is_active = TRUE
         ORDER BY is_system DESC, name ASC`,
      );
      if (result.rows.length) {
        return result.rows.map((row) => row.name);
      }
    } catch {
      /* table may not exist yet */
    }
    return [...PLACEHOLDER_ROLES];
  }

  async getPermissionKeysForRoleId(roleId: number): Promise<string[]> {
    const result = await this.database.query<{ permission_key: string }>(
      `SELECT permission_key FROM pcmazing_role_permissions
       WHERE role_id = $1
       ORDER BY permission_key`,
      [roleId],
    );
    return result.rows.map((row) => row.permission_key);
  }

  async resolveAuthAccess(
    roleName: string,
    roleId: number | null,
  ): Promise<{ permissionKeys: string[] }> {
    if (isSuperAdmin(roleName)) {
      return { permissionKeys: ['*'] };
    }
    if (roleId == null) {
      return { permissionKeys: ['profile.view'] };
    }
    try {
      const keys = await this.getPermissionKeysForRoleId(roleId);
      return { permissionKeys: keys.length ? keys : ['profile.view'] };
    } catch {
      return { permissionKeys: ['profile.view'] };
    }
  }

  async resolveRoleIdByName(roleName: string | null | undefined): Promise<number | null> {
    const name = roleName?.trim();
    if (!name) {
      return null;
    }
    try {
      const result = await this.database.query<{ id: string }>(
        `SELECT id::text AS id FROM pcmazing_roles
         WHERE deleted_at IS NULL
           AND lower(regexp_replace(trim(name), '[\\s_-]+', '', 'g'))
             = lower(regexp_replace(trim($1), '[\\s_-]+', '', 'g'))
         LIMIT 1`,
        [name],
      );
      return result.rows[0] ? Number(result.rows[0].id) : null;
    } catch {
      return null;
    }
  }

  private parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined || value === null || value.trim() === '') {
      return fallback;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
}
