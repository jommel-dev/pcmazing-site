import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../database/database.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminJwtPayload } from './guards/jwt-auth.guard';
import { hashPasswordSha1, sha1PasswordVariants } from './password.util';

export interface AdminAuthUser {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  source: 'tblusers' | 'pcmazing_admin_users';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  verifyStaffPasscode(passcode: string): { staffGateToken: string; expiresIn: string } {
    const expected = this.configService.get<string>('ADMIN_STAFF_PASSCODE', 'pcmazing@2026').trim();
    const provided = passcode?.trim() ?? '';

    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid staff passcode.');
    }

    const expiresIn = this.configService.get<string>('ADMIN_STAFF_GATE_EXPIRES_IN') ?? '30m';

    const staffGateToken = this.jwtService.sign(
      { type: 'staff_gate' },
      { expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}` | number },
    );

    return { staffGateToken, expiresIn };
  }

  async login(dto: AdminLoginDto): Promise<{ accessToken: string; user: AdminAuthUser }> {
    const username = dto.username.trim();
    const password = dto.password;

    const user =
      (await this.findLegacyUser(username, password)) ??
      (await this.findPcmazingAdminUser(username, password));

    if (!user) {
      await this.logLoginFailure(username);
      throw new UnauthorizedException('Invalid username or password.');
    }

    const payload: AdminJwtPayload = {
      sub: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      source: user.source,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ?? '8h') as `${number}${'s' | 'm' | 'h' | 'd'}` | number,
    });

    return { accessToken, user };
  }

  async getProfile(userId: number, source: AdminAuthUser['source']): Promise<AdminAuthUser> {
    if (source === 'tblusers') {
      const result = await this.databaseService.query<{
        id: number;
        username: string;
        fullname: string | null;
        email: string | null;
        rolename: string | null;
      }>(
        `SELECT
          u.id,
          u.username,
          COALESCE(
            to_jsonb(u)->>'fullname',
            to_jsonb(u)->>'fullName',
            to_jsonb(u)->>'full_name',
            u.username
          ) AS fullname,
          COALESCE(
            to_jsonb(u)->>'email',
            to_jsonb(u)->>'emailAddress',
            to_jsonb(u)->>'email_address'
          ) AS email,
          COALESCE(to_jsonb(r)->>'roleName', to_jsonb(r)->>'rolename', 'staff') AS rolename
        FROM tblusers u
        LEFT JOIN tblrbac r ON r.id = u."roleId"
        WHERE u.id = $1
        LIMIT 1`,
        [userId],
      );

      const row = result.rows[0];
      if (!row) {
        throw new UnauthorizedException('User not found.');
      }

      return {
        id: row.id,
        username: row.username,
        fullName: row.fullname ?? row.username,
        email: row.email,
        role: row.rolename ?? 'staff',
        source: 'tblusers',
      };
    }

    const result = await this.databaseService.query<{
      id: number;
      username: string;
      full_name: string;
      email: string | null;
      role: string;
    }>(
      `SELECT id, username, full_name, email, role
       FROM pcmazing_admin_users
       WHERE id = $1 AND is_active = TRUE
       LIMIT 1`,
      [userId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new UnauthorizedException('User not found.');
    }

    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      source: 'pcmazing_admin_users',
    };
  }

  private async findLegacyUser(username: string, password: string): Promise<AdminAuthUser | null> {
    const hasTable = await this.tableExists('tblusers');
    if (!hasTable) {
      return null;
    }

    for (const passwordSha1 of sha1PasswordVariants(password)) {
      const row = await this.queryLegacyUserRow(username, passwordSha1);
      if (row) {
        return row;
      }
    }

    return null;
  }

  private async queryLegacyUserRow(
    username: string,
    passwordSha1: string,
  ): Promise<AdminAuthUser | null> {
    try {
      const result = await this.databaseService.query<{
        id: number;
        username: string;
        fullname: string | null;
        email: string | null;
        rolename: string | null;
      }>(
        `SELECT
          u.id,
          u.username,
          COALESCE(
            to_jsonb(u)->>'fullname',
            to_jsonb(u)->>'fullName',
            to_jsonb(u)->>'full_name',
            u.username
          ) AS fullname,
          COALESCE(
            to_jsonb(u)->>'email',
            to_jsonb(u)->>'emailAddress',
            to_jsonb(u)->>'email_address'
          ) AS email,
          COALESCE(to_jsonb(r)->>'roleName', to_jsonb(r)->>'rolename', 'staff') AS rolename
        FROM tblusers u
        LEFT JOIN tblrbac r ON r.id = u."roleId"
        WHERE LOWER(TRIM(u.username)) = LOWER(TRIM($1))
          AND LOWER(TRIM(u.password)) = LOWER(TRIM($2))
        LIMIT 1`,
        [username, passwordSha1],
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      return {
        id: row.id,
        username: row.username,
        fullName: row.fullname ?? row.username,
        email: row.email,
        role: row.rolename ?? 'staff',
        source: 'tblusers',
      };
    } catch (error) {
      this.logger.warn(
        `tblusers login query failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }

  private async findPcmazingAdminUser(
    username: string,
    password: string,
  ): Promise<AdminAuthUser | null> {
    const hasTable = await this.tableExists('pcmazing_admin_users');
    if (!hasTable) {
      return null;
    }

    const passwordSha1 = hashPasswordSha1(password);

    const result = await this.databaseService.query<{
      id: number;
      username: string;
      full_name: string;
      email: string | null;
      role: string;
    }>(
      `SELECT id, username, full_name, email, role
       FROM pcmazing_admin_users
       WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))
         AND LOWER(TRIM(password_hash)) = LOWER(TRIM($2))
         AND is_active = TRUE
       LIMIT 1`,
      [username, passwordSha1],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      username: row.username,
      fullName: row.full_name,
      email: row.email,
      role: row.role,
      source: 'pcmazing_admin_users',
    };
  }

  private async logLoginFailure(username: string): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      return;
    }

    const hasTblusers = await this.tableExists('tblusers');
    const hasFallback = await this.tableExists('pcmazing_admin_users');

    if (!hasTblusers && !hasFallback) {
      this.logger.warn('Login failed: neither tblusers nor pcmazing_admin_users exists.');
      return;
    }

    if (hasTblusers) {
      const userMatch = await this.databaseService.query<{ id: number }>(
        `SELECT id
         FROM tblusers
         WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))
         LIMIT 1`,
        [username],
      );

      if ((userMatch.rowCount ?? 0) === 0) {
        this.logger.warn(`Login failed: username "${username}" not found in tblusers.`);
      } else {
        this.logger.warn(`Login failed: password mismatch for tblusers user "${username}".`);
      }
    }
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const result = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = $1`,
      [tableName],
    );

    return Number(result.rows[0]?.count ?? 0) > 0;
  }
}
