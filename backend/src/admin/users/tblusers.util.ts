import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';
import { AdminUserRecord } from './users.types';

const AVATAR_SQL = `COALESCE(
  NULLIF(to_jsonb(u)->>'profileImage', ''),
  NULLIF(to_jsonb(u)->>'profile_image', ''),
  NULLIF(to_jsonb(u)->>'avatar', ''),
  NULLIF(to_jsonb(u)->>'avatar_url', '')
)`;

const FULLNAME_SQL = `COALESCE(
  to_jsonb(u)->>'fullname',
  to_jsonb(u)->>'fullName',
  to_jsonb(u)->>'full_name',
  u.username
)`;

const EMAIL_SQL = `COALESCE(
  to_jsonb(u)->>'email',
  to_jsonb(u)->>'emailAddress',
  to_jsonb(u)->>'email_address'
)`;

const ROLE_NAME_SQL = `COALESCE(to_jsonb(r)->>'roleName', to_jsonb(r)->>'rolename', 'staff')`;

const ACTIVE_FILTER_SQL = `COALESCE(
  LOWER(NULLIF(COALESCE(to_jsonb(u)->>'is_deleted', to_jsonb(u)->>'isDeleted'), '')),
  'false'
) NOT IN ('true', '1', 't', 'yes')`;

export async function usesTblusers(databaseService: DatabaseService): Promise<boolean> {
  return tableExists(databaseService, 'tblusers');
}

export async function listTblrbacRoleNames(databaseService: DatabaseService): Promise<string[]> {
  if (!(await tableExists(databaseService, 'tblrbac'))) {
    return [];
  }

  const result = await databaseService.query<{ name: string }>(
    `SELECT COALESCE(to_jsonb(r)->>'roleName', to_jsonb(r)->>'rolename', 'staff') AS name
     FROM tblrbac r
     ORDER BY r.id ASC`,
  );

  return result.rows
    .map((row) => row.name?.trim())
    .filter((name): name is string => Boolean(name));
}

export async function resolveTblusersRoleId(
  databaseService: DatabaseService,
  roleName?: string,
): Promise<number | null> {
  if (!(await tableExists(databaseService, 'tblrbac'))) {
    return null;
  }

  const normalized = roleName?.trim().toLowerCase() || 'staff';
  const normalizedSpaced = normalized.replace(/_/g, ' ');

  const result = await databaseService.query<{ id: number }>(
    `SELECT r.id
     FROM tblrbac r
     WHERE LOWER(TRIM(COALESCE(to_jsonb(r)->>'roleName', to_jsonb(r)->>'rolename', ''))) = $1
        OR LOWER(TRIM(COALESCE(to_jsonb(r)->>'roleName', to_jsonb(r)->>'rolename', ''))) = $2
     LIMIT 1`,
    [normalized, normalizedSpaced],
  );

  if (result.rows[0]?.id) {
    return result.rows[0].id;
  }

  const fallback = await databaseService.query<{ id: number }>(
    `SELECT r.id FROM tblrbac r ORDER BY r.id ASC LIMIT 1`,
  );

  return fallback.rows[0]?.id ?? null;
}

export async function tblusersIdAutoGenerates(databaseService: DatabaseService): Promise<boolean> {
  const result = await databaseService.query<{
    is_identity: string | null;
    column_default: string | null;
  }>(
    `SELECT is_identity, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'tblusers'
       AND column_name = 'id'
     LIMIT 1`,
  );

  const row = result.rows[0];
  if (!row) {
    return false;
  }

  if (row.is_identity === 'YES') {
    return true;
  }

  return Boolean(row.column_default?.includes('nextval'));
}

export async function allocateNextTblusersId(databaseService: DatabaseService): Promise<number> {
  const sequenceResult = await databaseService.query<{ sequence_name: string | null }>(
    `SELECT pg_get_serial_sequence('public.tblusers', 'id') AS sequence_name`,
  );

  const sequenceName = sequenceResult.rows[0]?.sequence_name;
  if (sequenceName) {
    const nextResult = await databaseService.query<{ next_id: string }>(
      `SELECT nextval($1::regclass)::text AS next_id`,
      [sequenceName],
    );
    return Number(nextResult.rows[0]?.next_id);
  }

  const maxResult = await databaseService.query<{ next_id: string }>(
    `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM tblusers`,
  );

  return Number(maxResult.rows[0]?.next_id ?? 1);
}

export async function getTblusersAvatarColumn(
  databaseService: DatabaseService,
): Promise<string | null> {
  const result = await databaseService.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'tblusers'
       AND column_name IN ('avatar', 'avatar_url', 'profile_image', 'profileImage')
     ORDER BY CASE column_name
       WHEN 'avatar' THEN 1
       WHEN 'avatar_url' THEN 2
       WHEN 'profile_image' THEN 3
       WHEN 'profileImage' THEN 4
       ELSE 5
     END
     LIMIT 1`,
  );

  return result.rows[0]?.column_name ?? null;
}

export function mapTblusersRow(row: {
  id: number;
  username: string;
  fullname: string | null;
  email: string | null;
  rolename: string | null;
  avatar: string | null;
  status: number | null;
  created_at: string | null;
  updated_at: string | null;
}): AdminUserRecord {
  return {
    id: row.id,
    username: row.username,
    fullName: row.fullname ?? row.username,
    email: row.email,
    role: row.rolename ?? 'staff',
    profileImageUrl: row.avatar,
    isActive: row.status == null ? true : row.status !== 0,
    source: 'tblusers',
    readOnly: false,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

export function buildTblusersSelectSql(): string {
  return `
    SELECT
      u.id,
      u.username,
      ${FULLNAME_SQL} AS fullname,
      ${EMAIL_SQL} AS email,
      ${ROLE_NAME_SQL} AS rolename,
      ${AVATAR_SQL} AS avatar,
      COALESCE(NULLIF(to_jsonb(u)->>'status', '')::int, 1) AS status,
      COALESCE(to_jsonb(u)->>'created_at', to_jsonb(u)->>'createdAt', NOW()::text) AS created_at,
      COALESCE(to_jsonb(u)->>'updated_at', to_jsonb(u)->>'updatedAt', to_jsonb(u)->>'created_at', NOW()::text) AS updated_at
    FROM tblusers u
    LEFT JOIN tblrbac r ON r.id = u."roleId"
  `;
}

export function buildTblusersSearchClause(search: string | undefined, params: unknown[]): string {
  if (!search?.trim()) {
    return '';
  }

  params.push(`%${search.trim()}%`);
  const index = params.length;

  return `AND (
    u.username ILIKE $${index}
    OR ${FULLNAME_SQL} ILIKE $${index}
    OR ${EMAIL_SQL} ILIKE $${index}
    OR ${ROLE_NAME_SQL} ILIKE $${index}
  )`;
}

export { ACTIVE_FILTER_SQL, AVATAR_SQL };
