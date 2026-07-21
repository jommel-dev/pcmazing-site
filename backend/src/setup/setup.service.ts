import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { DatabaseService } from '../database/database.service';
import { buildPsqlConnectionConfig, executeSqlViaPsql, isPsqlAvailable } from './psql.runner';
import {
  isDuplicateCatalogError,
  isForeignKeyError,
  prepareMigrationStatements,
  previewSqlStatement,
  describeSqlStatement,
  shouldPreferPsqlExecution,
} from './sql.utils';

export interface UploadMigrationOptions {
  force?: boolean;
  disableForeignKeyChecks?: boolean;
}

interface MigrationApplyOptions {
  disableForeignKeyChecks?: boolean;
  onStatementProgress?: (current: number, total: number, statement: string) => void;
}

export type SetupProgressStatus = 'idle' | 'running' | 'done' | 'error';

export interface SetupProgress {
  status: SetupProgressStatus;
  progress: number;
  total: number;
  currentFile: string;
  message: string;
  error: string;
  startedAt: string | null;
  currentLabel: string;
  statementPreview: string;
}

export interface MigrationRecord {
  id: number;
  filename: string;
  applied_at: string;
  checksum: string;
  source: string;
}

export interface SetupStatus {
  connected: boolean;
  schema: string;
  mode: string;
  dbHost: string;
  dbName: string;
  isBlank: boolean;
  setupAvailable: boolean;
  tableCount: number;
  appliedMigrations: number;
  pendingBundledMigrations: number;
  connectionError?: string;
}

@Injectable()
export class SetupService {
  private readonly schema: string;
  private readonly migrationsDir: string;
  private progress: SetupProgress = this.createIdleProgress();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    this.schema = this.configService.get<string>('DB_SCHEMA', 'public').trim();
    this.migrationsDir = join(__dirname, '..', 'sql', 'migrations');
  }

  getProgress(): SetupProgress {
    return { ...this.progress };
  }

  async isSetupAvailable(): Promise<boolean> {
    if (this.progress.status === 'running') {
      return true;
    }

    const connection = await this.databaseService.checkConnection();

    if (!connection.connected) {
      return true;
    }

    await this.ensureMigrationsTable();

    return (await this.getUserTableCount()) === 0;
  }

  async getStatus(): Promise<SetupStatus> {
    const connection = await this.databaseService.checkConnection();

    if (!connection.connected) {
      return {
        connected: false,
        schema: connection.schema,
        mode: this.databaseService.getConnectionMode(),
        dbHost: this.getDatabaseHost(),
        dbName: this.getDatabaseName(),
        isBlank: false,
        setupAvailable: true,
        tableCount: 0,
        appliedMigrations: 0,
        pendingBundledMigrations: 0,
        connectionError: connection.message,
      };
    }

    await this.ensureMigrationsTable();

    const tableCount = await this.getUserTableCount();
    const appliedMigrations = await this.getAppliedMigrationCount();
    const pendingBundledMigrations = (await this.getPendingBundledMigrations()).length;
    const setupAvailable = this.progress.status === 'running' || tableCount === 0;

    return {
      connected: true,
      schema: this.schema,
      mode: this.databaseService.getConnectionMode(),
      dbHost: this.getDatabaseHost(),
      dbName: this.getDatabaseName(),
      isBlank: tableCount === 0,
      setupAvailable,
      tableCount,
      appliedMigrations,
      pendingBundledMigrations,
    };
  }

  async listMigrations(): Promise<{
    bundled: string[];
    applied: MigrationRecord[];
    pending: string[];
  }> {
    const bundled = await this.listBundledMigrationFiles();
    const connection = await this.databaseService.checkConnection();

    if (!connection.connected) {
      return { bundled, applied: [], pending: bundled };
    }

    await this.ensureMigrationsTable();

    const applied = await this.getAppliedMigrations();
    const appliedNames = new Set(applied.map((entry) => entry.filename));
    const pending = bundled.filter((filename) => !appliedNames.has(filename));

    return { bundled, applied, pending };
  }

  async runBundledMigrations(force = false): Promise<{ success: boolean; message: string; applied: string[] }> {
    if (this.progress.status === 'running') {
      throw new BadRequestException('A migration is already running.');
    }

    await this.ensureConnectionReady();
    await this.ensureSchemaExists();
    await this.ensureMigrationsTable();

    if (!force) {
      const isBlank = (await this.getUserTableCount()) === 0;
      const appliedCount = await this.getAppliedMigrationCount();

      if (!isBlank && appliedCount === 0) {
        throw new BadRequestException(
          'Database is not blank. Upload with force=true or apply bundled migrations only on a fresh database.',
        );
      }
    }

    const pending = await this.getPendingBundledMigrations();

    if (pending.length === 0) {
      return {
        success: true,
        message: 'No pending bundled migrations.',
        applied: [],
      };
    }

    this.progress = {
      status: 'running',
      progress: 0,
      total: pending.length,
      currentFile: '',
      message: 'Starting bundled migrations...',
      error: '',
      startedAt: new Date().toISOString(),
      currentLabel: '',
      statementPreview: '',
    };

    const applied: string[] = [];

    try {
      for (let index = 0; index < pending.length; index += 1) {
        const filename = pending[index];
        this.progress = {
          ...this.progress,
          progress: index,
          currentFile: filename,
          message: `Applying ${filename}...`,
        };

        const filePath = join(this.migrationsDir, filename);
        const sql = await readFile(filePath, 'utf8');
        await this.applyMigration(filename, sql, 'bundled');
        applied.push(filename);
      }

      this.progress = {
        ...this.progress,
        status: 'done',
        progress: pending.length,
        total: pending.length,
        currentFile: '',
        message: `Applied ${applied.length} migration(s).`,
        error: '',
        currentLabel: 'Completed',
        statementPreview: '',
      };

      return {
        success: true,
        message: `Applied ${applied.length} migration(s).`,
        applied,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Migration failed';

      this.progress = {
        ...this.progress,
        status: 'error',
        error: message,
        message: 'Migration failed.',
      };

      throw new InternalServerErrorException(message);
    }
  }

  async runUploadedMigration(
    file: Express.Multer.File,
    options: UploadMigrationOptions = {},
  ): Promise<{ success: boolean; message: string; filename: string; statementsExecuted: number }> {
    const force = options.force ?? false;
    const disableForeignKeyChecks = options.disableForeignKeyChecks ?? true;
    if (this.progress.status === 'running') {
      throw new BadRequestException('A migration is already running.');
    }

    if (!file) {
      throw new BadRequestException('No file uploaded. Provide a .sql file in the "file" field.');
    }

    const extension = file.originalname?.split('.').pop()?.toLowerCase();
    if (extension !== 'sql') {
      throw new BadRequestException('Only .sql files are accepted.');
    }

    const sql = file.buffer.toString('utf8').trim();
    if (!sql) {
      throw new BadRequestException('Uploaded SQL file is empty.');
    }

    const filename = this.normalizeUploadedFilename(file.originalname);

    await this.ensureConnectionReady();
    await this.ensureSchemaExists();
    await this.ensureMigrationsTable();

    const alreadyApplied = await this.isMigrationApplied(filename);
    if (alreadyApplied) {
      throw new BadRequestException(`Migration "${filename}" was already applied.`);
    }

    if (!force && (await this.getUserTableCount()) > 0) {
      throw new BadRequestException(
        'Database is not blank. Pass force=true to run an uploaded migration on an existing database.',
      );
    }

    this.progress = {
      status: 'running',
      progress: 0,
      total: 0,
      currentFile: filename,
      message: `Upload received. Preparing ${filename}...`,
      error: '',
      startedAt: new Date().toISOString(),
      currentLabel: 'Upload received',
      statementPreview: '',
    };

    void this.executeUploadedMigration(filename, sql, {
      force,
      disableForeignKeyChecks,
    });

    return {
      success: true,
      message: `Upload accepted. Import started for ${filename}.`,
      filename,
      statementsExecuted: 0,
    };
  }

  private async executeUploadedMigration(
    filename: string,
    sql: string,
    options: UploadMigrationOptions,
  ): Promise<void> {
    const disableForeignKeyChecks = options.disableForeignKeyChecks ?? true;

    this.progress = {
      ...this.progress,
      message: `Parsing ${filename}...`,
      currentLabel: 'Parsing SQL file',
    };

    const statements = prepareMigrationStatements(sql);
    const preferPsql = shouldPreferPsqlExecution(sql, statements.length);
    const usePsql = preferPsql && (await isPsqlAvailable());

    this.progress = {
      status: 'running',
      progress: 0,
      total: usePsql ? 1 : Math.max(statements.length, 1),
      currentFile: filename,
      message: usePsql
        ? `Importing ${filename} via psql (recommended for large pgAdmin dumps)...`
        : preferPsql
          ? `Applying large pgAdmin dump ${filename} (${statements.length.toLocaleString()} statement(s))...`
          : `Applying uploaded migration ${filename}...`,
      error: '',
      startedAt: this.progress.startedAt,
      currentLabel: usePsql ? 'Running via psql' : 'Preparing import',
      statementPreview: '',
    };

    try {
      if (usePsql) {
        await this.applyMigrationViaPsql(filename, sql, {
          disableForeignKeyChecks,
        });
      } else {
        await this.applyMigration(filename, sql, 'upload', {
          disableForeignKeyChecks,
          onStatementProgress: (current, total, statement) => {
            this.progress = {
              ...this.progress,
              progress: current,
              total,
              message: `Executing statement ${current.toLocaleString()} of ${total.toLocaleString()}...`,
              currentLabel: describeSqlStatement(statement),
              statementPreview: previewSqlStatement(statement),
            };
          },
        });
      }

      this.progress = {
        ...this.progress,
        status: 'done',
        progress: usePsql ? 1 : statements.length,
        total: usePsql ? 1 : statements.length,
        currentFile: filename,
        message: `Applied uploaded migration ${filename}.`,
        error: '',
        currentLabel: 'Completed',
        statementPreview: '',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Migration failed';

      this.progress = {
        ...this.progress,
        status: 'error',
        error: message,
        message: 'Uploaded migration failed.',
      };
    }
  }

  private getDatabaseHost(): string {
    const databaseUrl = this.configService.get<string>('DATABASE_URL')?.trim();
    if (databaseUrl) {
      try {
        return new URL(databaseUrl).hostname;
      } catch {
        return 'unknown';
      }
    }

    return this.configService.get<string>('DB_HOST', '127.0.0.1');
  }

  private getDatabaseName(): string {
    const databaseUrl = this.configService.get<string>('DATABASE_URL')?.trim();
    if (databaseUrl) {
      try {
        return new URL(databaseUrl).pathname.replace(/^\//, '');
      } catch {
        return 'unknown';
      }
    }

    return this.configService.get<string>('DB_NAME', 'postgres');
  }

  private async ensureConnectionReady(): Promise<void> {
    const connection = await this.databaseService.checkConnection();

    if (!connection.connected) {
      throw new BadRequestException(
        connection.message ??
          'Database is not connected. Check DB_HOST in .env (use 127.0.0.1 for local Laragon, db for Docker).',
      );
    }
  }

  private createIdleProgress(): SetupProgress {
    return {
      status: 'idle',
      progress: 0,
      total: 0,
      currentFile: '',
      message: '',
      error: '',
      startedAt: null,
      currentLabel: '',
      statementPreview: '',
    };
  }

  private normalizeUploadedFilename(originalName: string): string {
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return safeName.toLowerCase().endsWith('.sql') ? safeName : `${safeName}.sql`;
  }

  private async ensureSchemaExists(): Promise<void> {
    if (this.schema === 'public') {
      return;
    }

    await this.databaseService.migrationQuery(`CREATE SCHEMA IF NOT EXISTS "${this.schema}"`);
  }

  private async ensureMigrationsTable(): Promise<void> {
    await this.databaseService.migrationQuery(`
      CREATE TABLE IF NOT EXISTS _pcmazing_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL,
        source VARCHAR(32) NOT NULL DEFAULT 'bundled'
      )
    `);
  }

  private async listBundledMigrationFiles(): Promise<string[]> {
    try {
      const entries = await readdir(this.migrationsDir);
      return entries
        .filter((entry) => entry.toLowerCase().endsWith('.sql'))
        .sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  }

  private async getPendingBundledMigrations(): Promise<string[]> {
    const bundled = await this.listBundledMigrationFiles();
    const applied = await this.getAppliedMigrations();
    const appliedNames = new Set(applied.map((entry) => entry.filename));
    return bundled.filter((filename) => !appliedNames.has(filename));
  }

  private async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.databaseService.migrationQuery<MigrationRecord>(
      `SELECT id, filename, applied_at, checksum, source
       FROM _pcmazing_migrations
       ORDER BY applied_at ASC`,
    );

    return result.rows;
  }

  private async getAppliedMigrationCount(): Promise<number> {
    const result = await this.databaseService.migrationQuery<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM _pcmazing_migrations',
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  private async isMigrationApplied(filename: string): Promise<boolean> {
    const result = await this.databaseService.migrationQuery<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM _pcmazing_migrations WHERE filename = $1',
      [filename],
    );

    return Number(result.rows[0]?.count ?? 0) > 0;
  }

  private async getUserTableCount(): Promise<number> {
    const result = await this.databaseService.migrationQuery<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM information_schema.tables
       WHERE table_schema = $1
         AND table_type = 'BASE TABLE'
         AND table_name <> '_pcmazing_migrations'`,
      [this.schema],
    );

    return Number(result.rows[0]?.count ?? 0);
  }

  private async applyMigration(
    filename: string,
    sql: string,
    source: 'bundled' | 'upload',
    options: MigrationApplyOptions = {},
  ): Promise<void> {
    const checksum = createHash('sha256').update(sql).digest('hex');
    const statements = prepareMigrationStatements(sql);

    if (statements.length === 0) {
      throw new BadRequestException('Migration file contains no executable SQL statements.');
    }

    try {
      await this.databaseService.withMigrationTransaction(async (client) => {
        if (options.disableForeignKeyChecks) {
          await client.query(`SET LOCAL session_replication_role = replica`);
        }

        for (let index = 0; index < statements.length; index += 1) {
          options.onStatementProgress?.(index + 1, statements.length, statements[index]);

          try {
            await client.query(statements[index]);
          } catch (statementError) {
            const message =
              statementError instanceof Error ? statementError.message : 'Statement failed';
            const snippet = statements[index].replace(/\s+/g, ' ').trim().slice(0, 160);

            throw new Error(
              `Statement ${index + 1}/${statements.length} failed: ${message}\nNear: ${snippet}`,
            );
          }
        }

        if (options.disableForeignKeyChecks) {
          await client.query(`SET LOCAL session_replication_role = origin`);
        }

        await client.query(
          `INSERT INTO _pcmazing_migrations (filename, checksum, source)
           VALUES ($1, $2, $3)`,
          [filename, checksum, source],
        );
      });
    } catch (error) {
      if (isDuplicateCatalogError(error)) {
        throw new BadRequestException(
          'Migration objects already exist in the database. If setup was partially applied, mark the migration as complete in _pcmazing_migrations or drop conflicting tables in pgAdmin before retrying.',
        );
      }

      if (isForeignKeyError(error)) {
        throw new BadRequestException(
          'Foreign key violation while importing SQL. Enable "Disable foreign key checks during import" for pgAdmin dumps, or ensure parent tables/data are imported before child tables.',
        );
      }

      if (this.isPermissionError(error) && options.disableForeignKeyChecks) {
        throw new BadRequestException(
          'Could not disable foreign key checks. Your database user needs SUPERUSER privilege, or import the SQL file using pgAdmin Query Tool / psql as a superuser.',
        );
      }

      throw error;
    }
  }

  private async applyMigrationViaPsql(
    filename: string,
    sql: string,
    options: { disableForeignKeyChecks?: boolean } = {},
  ): Promise<void> {
    const checksum = createHash('sha256').update(sql).digest('hex');
    const connection = buildPsqlConnectionConfig(this.configService);

    try {
      await executeSqlViaPsql(sql, connection, {
        disableForeignKeyChecks: options.disableForeignKeyChecks,
      });

      await this.databaseService.migrationQuery(
        `INSERT INTO _pcmazing_migrations (filename, checksum, source)
         VALUES ($1, $2, $3)`,
        [filename, checksum, 'upload'],
      );
    } catch (error) {
      if (this.isPermissionError(error) && options.disableForeignKeyChecks) {
        throw new BadRequestException(
          'Could not disable foreign key checks. Your database user needs SUPERUSER privilege, or import the SQL file using pgAdmin Query Tool / psql as a superuser.',
        );
      }

      const message = error instanceof Error ? error.message : 'Migration failed';
      throw new Error(message);
    }
  }

  private isPermissionError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const code = (error as { code?: string }).code;
    const message = (error as { message?: string }).message ?? '';

    return code === '42501' || message.toLowerCase().includes('permission denied');
  }
}
