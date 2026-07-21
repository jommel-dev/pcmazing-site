import { existsSync, readdirSync } from 'fs';
import { spawn } from 'child_process';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';

export interface PsqlConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema: string;
}

export function buildPsqlConnectionConfig(configService: ConfigService): PsqlConnectionConfig {
  const databaseUrl = configService.get<string>('DATABASE_URL')?.trim();

  if (databaseUrl) {
    const parsed = parseDatabaseUrl(databaseUrl);

    return {
      ...parsed,
      schema: configService.get<string>('DB_SCHEMA', 'public').trim(),
    };
  }

  return {
    host: configService.get<string>('DB_HOST', '127.0.0.1'),
    port: Number(configService.get<string>('DB_PORT', '5432')),
    database: configService.get<string>('DB_NAME', 'postgres'),
    user: configService.get<string>('DB_USER', 'postgres'),
    password: configService.get<string>('DB_PASSWORD', ''),
    schema: configService.get<string>('DB_SCHEMA', 'public').trim(),
  };
}

export function isPsqlAvailable(): Promise<boolean> {
  return Promise.resolve(resolvePsqlExecutable() !== null);
}

export async function executeSqlViaPsql(
  sql: string,
  config: PsqlConnectionConfig,
  options: { disableForeignKeyChecks?: boolean } = {},
): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), 'pcmazing-migration-'));
  const tempFile = join(tempDir, 'migration.sql');

  const scriptParts: string[] = [];

  if (config.schema && config.schema !== 'public') {
    scriptParts.push(`SET search_path TO "${config.schema}", public;`);
  }

  if (options.disableForeignKeyChecks) {
    scriptParts.push('SET session_replication_role = replica;');
  }

  scriptParts.push(sql);

  if (options.disableForeignKeyChecks) {
    scriptParts.push('SET session_replication_role = origin;');
  }

  await writeFile(tempFile, scriptParts.join('\n\n'), 'utf8');

  try {
    await runPsql(tempFile, config);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function runPsql(filePath: string, config: PsqlConnectionConfig): Promise<void> {
  const psqlExecutable = resolvePsqlExecutable();

  if (!psqlExecutable) {
    return Promise.reject(
      new Error(
        'psql is not installed or not on PATH. Install PostgreSQL client tools, add Laragon PostgreSQL bin to PATH, set PSQL_PATH in .env, or import the SQL file using pgAdmin Query Tool.',
      ),
    );
  }

  return new Promise((resolve, reject) => {
    const args = [
      '-h',
      config.host,
      '-p',
      String(config.port),
      '-U',
      config.user,
      '-d',
      config.database,
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      filePath,
    ];

    const child = spawn(psqlExecutable, args, {
      env: { ...process.env, PGPASSWORD: config.password },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `psql exited with code ${code}`));
    });
  });
}

function parseDatabaseUrl(databaseUrl: string): Omit<PsqlConnectionConfig, 'schema'> {
  const parsed = new URL(databaseUrl);

  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    database: parsed.pathname.replace(/^\//, ''),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

function resolvePsqlExecutable(): string | null {
  const configuredPath = process.env.PSQL_PATH?.trim();
  if (configuredPath && existsSync(configuredPath)) {
    return configuredPath;
  }

  const pathEntries = (process.env.PATH ?? '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of pathEntries) {
    const candidate = entry.toLowerCase().endsWith('psql.exe')
      ? entry
      : join(entry, process.platform === 'win32' ? 'psql.exe' : 'psql');

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const laragonRoot = process.env.LARAGON_ROOT?.trim() || 'C:\\laragon';
  const postgresRoot = join(laragonRoot, 'bin', 'postgresql');

  if (existsSync(postgresRoot)) {
    for (const versionDir of readdirSync(postgresRoot, { withFileTypes: true })) {
      if (!versionDir.isDirectory()) {
        continue;
      }

      const candidate = join(postgresRoot, versionDir.name, 'bin', 'psql.exe');
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  const programFilesRoots = [
    process.env['ProgramFiles'],
    process.env['ProgramFiles(x86)'],
  ].filter(Boolean) as string[];

  for (const root of programFilesRoots) {
    const postgresRoot = join(root, 'PostgreSQL');
    if (!existsSync(postgresRoot)) {
      continue;
    }

    for (const versionDir of readdirSync(postgresRoot, { withFileTypes: true })) {
      if (!versionDir.isDirectory()) {
        continue;
      }

      const candidate = join(postgresRoot, versionDir.name, 'bin', 'psql.exe');
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}
