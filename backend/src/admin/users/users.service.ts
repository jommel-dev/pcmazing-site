import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { hashPasswordSha1 } from '../auth/password.util';
import {
  buildPagination,
  buildPaginationMeta,
  tableExists,
} from '../common/admin-table.util';
import { RbacService } from '../rbac/rbac.service';
import { ChangeUserPasswordDto } from './dto/change-user-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ACTIVE_FILTER_SQL,
  buildTblusersSearchClause,
  buildTblusersSelectSql,
  allocateNextTblusersId,
  getTblusersAvatarColumn,
  listTblrbacRoleNames,
  mapTblusersRow,
  resolveTblusersRoleId,
  tblusersIdAutoGenerates,
  usesTblusers,
} from './tblusers.util';
import { PayrollService } from '../payroll/payroll.service';
import { ensureUserManagementTable } from './user-management.schema';
import { deleteProfileImageFile, saveProfileImageFile } from './user-profile-image.util';
import { AdminUserRecord } from './users.types';

export type { AdminUserRecord } from './users.types';

@Injectable()
export class UsersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly rbacService: RbacService,
    private readonly payrollService: PayrollService,
  ) {}

  getRbacStatus() {
    return {
      enabled: this.rbacService.isEnabled(),
      roles: this.rbacService.listRoles(),
    };
  }

  async listRoles() {
    const tblRoles = await listTblrbacRoleNames(this.databaseService);
    if (tblRoles.length) {
      return tblRoles;
    }

    return this.rbacService.listRoles();
  }

  async list(pageRaw?: string, limitRaw?: string, search?: string) {
    const result = (await usesTblusers(this.databaseService))
      ? await this.listTblusers(pageRaw, limitRaw, search)
      : await this.listPcmazingUsers(pageRaw, limitRaw, search);

    return {
      ...result,
      items: await this.attachPayrollProfiles(result.items),
    };
  }

  async getById(id: number, source?: 'pcmazing_admin_users' | 'tblusers') {
    let user: AdminUserRecord;
    if (source === 'pcmazing_admin_users') {
      user = await this.getPcmazingUserById(id);
    } else if ((await usesTblusers(this.databaseService)) || source === 'tblusers') {
      user = await this.getTbluserById(id);
    } else {
      user = await this.getPcmazingUserById(id);
    }

    return this.attachPayrollProfile(user);
  }

  async create(dto: CreateUserDto) {
    const user = (await usesTblusers(this.databaseService))
      ? await this.createTbluser(dto)
      : await this.createPcmazingUser(dto);

    await this.payrollService.upsertProfile(user.id, user.source, {
      employeeCode: dto.employeeCode,
      department: dto.department,
      positionTitle: dto.positionTitle,
      salaryType: dto.salaryType,
      monthlySalary: dto.monthlySalary,
      fixedMonthlySalary: dto.fixedMonthlySalary,
      payoutMethod: dto.payoutMethod,
      bankDetails: dto.bankDetails,
      payrollEnabled: dto.payrollEnabled ?? false,
    });

    return this.attachPayrollProfile(user);
  }

  async update(id: number, dto: UpdateUserDto, currentUserId: number) {
    const existing = await this.getById(id);

    if (existing.id === currentUserId && dto.isActive === false) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }

    const user =
      existing.source === 'tblusers'
        ? await this.updateTbluser(id, dto)
        : await this.updatePcmazingUser(id, dto);

    if (
      dto.employeeCode !== undefined ||
      dto.department !== undefined ||
      dto.positionTitle !== undefined ||
      dto.salaryType !== undefined ||
      dto.monthlySalary !== undefined ||
      dto.fixedMonthlySalary !== undefined ||
      dto.payoutMethod !== undefined ||
      dto.bankDetails !== undefined ||
      dto.payrollEnabled !== undefined
    ) {
      await this.payrollService.upsertProfile(user.id, user.source, {
        employeeCode: dto.employeeCode,
        department: dto.department,
        positionTitle: dto.positionTitle,
        salaryType: dto.salaryType,
        monthlySalary: dto.monthlySalary,
        fixedMonthlySalary: dto.fixedMonthlySalary,
        payoutMethod: dto.payoutMethod,
        bankDetails: dto.bankDetails,
        payrollEnabled: dto.payrollEnabled,
      });
    }

    return this.attachPayrollProfile(user);
  }

  async changePassword(id: number, dto: ChangeUserPasswordDto) {
    const existing = await this.getById(id);
    const passwordHash = hashPasswordSha1(dto.password);

    if (existing.source === 'tblusers') {
      await this.databaseService.query(
        `UPDATE tblusers SET password = $1, updated_at = NOW() WHERE id = $2`,
        [passwordHash, id],
      );
    } else {
      await this.databaseService.query(
        `UPDATE pcmazing_admin_users
         SET password_hash = $1, updated_at = NOW()
         WHERE id = $2`,
        [passwordHash, id],
      );
    }

    return { id, passwordChanged: true };
  }

  async deactivate(id: number, currentUserId: number) {
    if (id === currentUserId) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }

    const existing = await this.getById(id);

    if (existing.source === 'tblusers') {
      const hasIsDeleted = await this.columnExists('tblusers', 'is_deleted');
      if (hasIsDeleted) {
        await this.databaseService.query(
          `UPDATE tblusers SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1`,
          [id],
        );
      } else {
        await this.databaseService.query(
          `UPDATE tblusers SET status = 0, updated_at = NOW() WHERE id = $1`,
          [id],
        );
      }

      return this.getTbluserById(id);
    }

    return this.updatePcmazingUser(id, { isActive: false });
  }

  async uploadProfileImage(id: number, file: Express.Multer.File) {
    const existing = await this.getById(id);
    const profileImageUrl = await saveProfileImageFile(id, file);

    if (existing.source === 'tblusers') {
      const avatarColumn = await getTblusersAvatarColumn(this.databaseService);
      if (!avatarColumn) {
        throw new BadRequestException('The tblusers table does not have an avatar column.');
      }

      await deleteProfileImageFile(existing.profileImageUrl);

      await this.databaseService.query(
        `UPDATE tblusers SET "${avatarColumn}" = $1, updated_at = NOW() WHERE id = $2`,
        [profileImageUrl, id],
      );

      return this.attachPayrollProfile(await this.getTbluserById(id));
    }

    await deleteProfileImageFile(existing.profileImageUrl);

    const result = await this.databaseService.query<{
      id: number;
      username: string;
      full_name: string;
      email: string | null;
      role: string;
      profile_image_url: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `UPDATE pcmazing_admin_users
       SET profile_image_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, username, full_name, email, role, profile_image_url, is_active, created_at,
                 COALESCE(updated_at, created_at) AS updated_at`,
      [profileImageUrl, id],
    );

    return this.attachPayrollProfile(this.mapPcmazingUser(result.rows[0]));
  }

  async removeProfileImage(id: number) {
    const existing = await this.getById(id);

    if (existing.source === 'tblusers') {
      const avatarColumn = await getTblusersAvatarColumn(this.databaseService);
      if (!avatarColumn) {
        throw new BadRequestException('The tblusers table does not have an avatar column.');
      }

      await deleteProfileImageFile(existing.profileImageUrl);

      await this.databaseService.query(
        `UPDATE tblusers SET "${avatarColumn}" = NULL, updated_at = NOW() WHERE id = $1`,
        [id],
      );

      return this.attachPayrollProfile(await this.getTbluserById(id));
    }

    await deleteProfileImageFile(existing.profileImageUrl);

    const result = await this.databaseService.query<{
      id: number;
      username: string;
      full_name: string;
      email: string | null;
      role: string;
      profile_image_url: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `UPDATE pcmazing_admin_users
       SET profile_image_url = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING id, username, full_name, email, role, profile_image_url, is_active, created_at,
                 COALESCE(updated_at, created_at) AS updated_at`,
      [id],
    );

    return this.attachPayrollProfile(this.mapPcmazingUser(result.rows[0]));
  }

  async uploadPayrollQr(id: number, file: Express.Multer.File) {
    const existing = await this.getById(id);
    await this.payrollService.uploadQrImage(existing.id, existing.source, file);
    return this.getById(id);
  }

  async removePayrollQr(id: number) {
    const existing = await this.getById(id);
    await this.payrollService.removeQrImage(existing.id, existing.source);
    return this.getById(id);
  }

  private async listTblusers(pageRaw?: string, limitRaw?: string, search?: string) {
    const { page, limit, offset } = buildPagination(pageRaw, limitRaw);
    const params: unknown[] = [];
    const searchClause = buildTblusersSearchClause(search, params);
    const whereClause = `WHERE ${ACTIVE_FILTER_SQL} ${searchClause}`;

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM tblusers u
       LEFT JOIN tblrbac r ON r.id = u."roleId"
       ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const listParams = [...params, limit, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const result = await this.databaseService.query<{
      id: number;
      username: string;
      fullname: string | null;
      email: string | null;
      rolename: string | null;
      avatar: string | null;
      status: number | null;
      created_at: string | null;
      updated_at: string | null;
    }>(
      `${buildTblusersSelectSql()}
       ${whereClause}
       ORDER BY u.id DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      listParams,
    );

    return {
      items: result.rows.map((row) => mapTblusersRow(row)),
      meta: buildPaginationMeta(page, limit, total),
      userStore: 'tblusers' as const,
    };
  }

  private async listPcmazingUsers(pageRaw?: string, limitRaw?: string, search?: string) {
    await ensureUserManagementTable(this.databaseService);

    const { page, limit, offset } = buildPagination(pageRaw, limitRaw);
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(username ILIKE $${params.length} OR full_name ILIKE $${params.length} OR email ILIKE $${params.length} OR role ILIKE $${params.length})`,
      );
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM pcmazing_admin_users ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const listParams = [...params, limit, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const result = await this.databaseService.query<{
      id: number;
      username: string;
      full_name: string;
      email: string | null;
      role: string;
      profile_image_url: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, username, full_name, email, role, profile_image_url, is_active, created_at,
              COALESCE(updated_at, created_at) AS updated_at
       FROM pcmazing_admin_users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      listParams,
    );

    return {
      items: result.rows.map((row) => this.mapPcmazingUser(row)),
      meta: buildPaginationMeta(page, limit, total),
      userStore: 'pcmazing_admin_users' as const,
    };
  }

  private async getTbluserById(id: number): Promise<AdminUserRecord> {
    const result = await this.databaseService.query<{
      id: number;
      username: string;
      fullname: string | null;
      email: string | null;
      rolename: string | null;
      avatar: string | null;
      status: number | null;
      created_at: string | null;
      updated_at: string | null;
    }>(
      `${buildTblusersSelectSql()}
       WHERE u.id = $1
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('User not found.');
    }

    return mapTblusersRow(row);
  }

  private async getPcmazingUserById(id: number): Promise<AdminUserRecord> {
    await ensureUserManagementTable(this.databaseService);

    const result = await this.databaseService.query<{
      id: number;
      username: string;
      full_name: string;
      email: string | null;
      role: string;
      profile_image_url: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, username, full_name, email, role, profile_image_url, is_active, created_at,
              COALESCE(updated_at, created_at) AS updated_at
       FROM pcmazing_admin_users
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException('User not found.');
    }

    return this.mapPcmazingUser(row);
  }

  private async createTbluser(dto: CreateUserDto) {
    const username = dto.username.trim();
    const fullName = dto.fullName.trim();
    const email = dto.email?.trim() || null;
    const isActive = dto.isActive ?? true;
    const passwordHash = hashPasswordSha1(dto.password);
    const roleId = await resolveTblusersRoleId(this.databaseService, dto.role);

    if (dto.role?.trim() && roleId == null && (await tableExists(this.databaseService, 'tblrbac'))) {
      throw new BadRequestException(`Role "${dto.role.trim()}" was not found.`);
    }

    const duplicate = await this.databaseService.query<{ id: number }>(
      `SELECT id FROM tblusers WHERE LOWER(TRIM(username)) = LOWER(TRIM($1)) LIMIT 1`,
      [username],
    );

    if (duplicate.rows[0]) {
      throw new ConflictException('Username is already taken.');
    }

    const columns = ['username', 'password', 'fullname'];
    const values: unknown[] = [username, passwordHash, fullName];

    if (!(await tblusersIdAutoGenerates(this.databaseService))) {
      const nextId = await allocateNextTblusersId(this.databaseService);
      columns.unshift('id');
      values.unshift(nextId);
    }

    if (email) {
      columns.push('email');
      values.push(email);
    }

    columns.push('status');
    values.push(isActive ? 1 : 0);

    if (roleId != null) {
      columns.push('"roleId"');
      values.push(roleId);
    }

    if (await this.columnExists('tblusers', 'created_at')) {
      columns.push('created_at');
      values.push(new Date());
    }

    if (await this.columnExists('tblusers', 'updated_at')) {
      columns.push('updated_at');
      values.push(new Date());
    }

    const quotedColumns = columns.map((column) =>
      column === 'id' || column.startsWith('"') ? column : `"${column}"`,
    ).join(', ');
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');

    const result = await this.databaseService.query<{ id: number }>(
      `INSERT INTO tblusers (${quotedColumns}) VALUES (${placeholders}) RETURNING id`,
      values,
    );

    return this.getTbluserById(result.rows[0].id);
  }

  private async createPcmazingUser(dto: CreateUserDto) {
    await ensureUserManagementTable(this.databaseService);

    const username = dto.username.trim();
    const fullName = dto.fullName.trim();
    const email = dto.email?.trim() || null;
    const role = this.normalizeRole(dto.role);
    const isActive = dto.isActive ?? true;
    const passwordHash = hashPasswordSha1(dto.password);

    try {
      const result = await this.databaseService.query<{
        id: number;
        username: string;
        full_name: string;
        email: string | null;
        role: string;
        profile_image_url: string | null;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>(
        `INSERT INTO pcmazing_admin_users (username, full_name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, username, full_name, email, role, profile_image_url, is_active, created_at,
                   COALESCE(updated_at, created_at) AS updated_at`,
        [username, fullName, email, passwordHash, role, isActive],
      );

      return this.mapPcmazingUser(result.rows[0]);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Username is already taken.');
      }

      throw error;
    }
  }

  private async updateTbluser(id: number, dto: UpdateUserDto) {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (dto.fullName !== undefined) {
      params.push(dto.fullName.trim());
      updates.push(`fullname = $${params.length}`);
    }

    if (dto.email !== undefined) {
      params.push(dto.email.trim() || null);
      updates.push(`email = $${params.length}`);
    }

    if (dto.isActive !== undefined) {
      params.push(dto.isActive ? 1 : 0);
      updates.push(`status = $${params.length}`);
    }

    if (dto.role !== undefined) {
      const roleId = await resolveTblusersRoleId(this.databaseService, dto.role);
      if (roleId != null) {
        params.push(roleId);
        updates.push(`"roleId" = $${params.length}`);
      }
    }

    if (!updates.length) {
      return this.getTbluserById(id);
    }

    params.push(id);
    await this.databaseService.query(
      `UPDATE tblusers SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
      params,
    );

    return this.getTbluserById(id);
  }

  private async updatePcmazingUser(id: number, dto: UpdateUserDto) {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (dto.fullName !== undefined) {
      params.push(dto.fullName.trim());
      fields.push(`full_name = $${params.length}`);
    }

    if (dto.email !== undefined) {
      params.push(dto.email.trim() || null);
      fields.push(`email = $${params.length}`);
    }

    if (dto.role !== undefined) {
      params.push(this.normalizeRole(dto.role));
      fields.push(`role = $${params.length}`);
    }

    if (dto.isActive !== undefined) {
      params.push(dto.isActive);
      fields.push(`is_active = $${params.length}`);
    }

    if (!fields.length) {
      return this.getPcmazingUserById(id);
    }

    params.push(id);

    const result = await this.databaseService.query<{
      id: number;
      username: string;
      full_name: string;
      email: string | null;
      role: string;
      profile_image_url: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    }>(
      `UPDATE pcmazing_admin_users
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING id, username, full_name, email, role, profile_image_url, is_active, created_at,
                 COALESCE(updated_at, created_at) AS updated_at`,
      params,
    );

    return this.mapPcmazingUser(result.rows[0]);
  }

  private mapPcmazingUser(row: {
    id: number;
    username: string;
    full_name: string;
    email: string | null;
    role: string;
    profile_image_url: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }): AdminUserRecord {
    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      profileImageUrl: row.profile_image_url,
      isActive: row.is_active,
      source: 'pcmazing_admin_users',
      readOnly: false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async attachPayrollProfiles(users: AdminUserRecord[]): Promise<AdminUserRecord[]> {
    const profiles = await this.payrollService.getProfilesForUsers(
      users.map((user) => ({ id: user.id, source: user.source })),
    );

    return users.map((user) => {
      const profile = profiles.get(`${user.source}:${user.id}`);
      return {
        ...user,
        employeeCode: profile?.employeeCode ?? null,
        department: profile?.department ?? null,
        positionTitle: profile?.positionTitle ?? null,
        salaryType: profile?.salaryType ?? 'monthly',
        monthlySalary: profile?.monthlySalary ?? null,
        fixedMonthlySalary: profile?.fixedMonthlySalary ?? null,
        payoutMethod: profile?.payoutMethod ?? 'cash',
        bankDetails: profile?.bankDetails ?? null,
        qrImageUrl: profile?.qrImageUrl ?? null,
        payrollEnabled: profile?.payrollEnabled ?? false,
      };
    });
  }

  private async attachPayrollProfile(user: AdminUserRecord): Promise<AdminUserRecord> {
    const [withProfile] = await this.attachPayrollProfiles([user]);
    return withProfile;
  }

  private normalizeRole(role?: string): string {
    const value = role?.trim().toLowerCase() || 'staff';
    const allowed = this.rbacService.listRoles().map((item) => item.toLowerCase());

    if (!allowed.includes(value)) {
      return 'staff';
    }

    return value;
  }

  private async columnExists(tableName: string, columnName: string): Promise<boolean> {
    const result = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2`,
      [tableName, columnName],
    );

    return Number(result.rows[0]?.count ?? 0) > 0;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }
}
