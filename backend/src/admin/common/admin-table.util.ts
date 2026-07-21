import { DatabaseService } from '../../database/database.service';

export async function tableExists(
  databaseService: DatabaseService,
  tableName: string,
): Promise<boolean> {
  const result = await databaseService.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [tableName],
  );

  return Number(result.rows[0]?.count ?? 0) > 0;
}

export function buildPagination(pageRaw?: string, limitRaw?: string) {
  const page = Math.max(Number(pageRaw) || 1, 1);
  const limit = Math.min(Math.max(Number(limitRaw) || 20, 1), 100);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function buildPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
