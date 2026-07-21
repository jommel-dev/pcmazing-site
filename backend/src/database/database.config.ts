import { ConfigService } from '@nestjs/config';
import { PoolConfig } from 'pg';

export type DatabaseConnectionMode = 'local' | 'supabase-direct' | 'supabase-pooler';

export interface DatabaseConfig {
  mode: DatabaseConnectionMode;
  schema: string;
  poolConfig: PoolConfig;
  migrationPoolConfig: PoolConfig;
}

export function buildDatabaseConfig(configService: ConfigService): DatabaseConfig {
  const schema = configService.get<string>('DB_SCHEMA', 'public').trim();
  const databaseUrl = configService.get<string>('DATABASE_URL')?.trim();
  const directUrl = configService.get<string>('DATABASE_DIRECT_URL')?.trim();
  const migrationUrl = directUrl || databaseUrl;

  const mode = resolveConnectionMode(configService, databaseUrl);
  const shouldUseSsl = resolveSslEnabled(configService, databaseUrl);
  const rejectUnauthorized = resolveRejectUnauthorized(configService, databaseUrl);
  const ssl = shouldUseSsl ? { rejectUnauthorized } : undefined;
  const usePoolerSettings = mode === 'supabase-pooler';

  const poolConfig = buildPoolConfig(configService, schema, {
    databaseUrl,
    ssl,
    usePoolerSettings,
  });

  const migrationPoolConfig = buildPoolConfig(configService, schema, {
    databaseUrl: migrationUrl,
    ssl: resolveSslEnabled(configService, migrationUrl)
      ? { rejectUnauthorized: resolveRejectUnauthorized(configService, migrationUrl) }
      : undefined,
    usePoolerSettings: isSupabasePoolerUrl(migrationUrl),
  });

  return {
    mode,
    schema,
    poolConfig,
    migrationPoolConfig,
  };
}

function buildPoolConfig(
  configService: ConfigService,
  schema: string,
  options: {
    databaseUrl?: string;
    ssl?: { rejectUnauthorized: boolean };
    usePoolerSettings: boolean;
  },
): PoolConfig {
  const connectionString = options.databaseUrl
    ? normalizeConnectionString(
        options.databaseUrl,
        Boolean(options.ssl),
        options.ssl?.rejectUnauthorized ?? false,
      )
    : undefined;

  const baseConfig: PoolConfig = connectionString
    ? { connectionString, ssl: options.ssl }
    : {
        host: configService.get<string>('DB_HOST', '127.0.0.1'),
        port: Number(configService.get<string>('DB_PORT', '5432')),
        database: configService.get<string>('DB_NAME', 'postgres'),
        user: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', ''),
        ssl: options.ssl,
      };

  if (options.usePoolerSettings) {
    // Required for Supabase transaction pooler (PgBouncer).
    baseConfig.prepare = false;
  }

  baseConfig.options = buildSearchPathOption(schema);

  return baseConfig;
}

function buildSearchPathOption(schema: string): string {
  if (schema === 'public') {
    return '-c search_path=public';
  }

  return `-c search_path="${schema}",public`;
}

function resolveConnectionMode(
  configService: ConfigService,
  databaseUrl?: string,
): DatabaseConnectionMode {
  const explicitMode = configService.get<string>('DB_CONNECTION_MODE')?.trim().toLowerCase();

  if (explicitMode === 'supabase-pooler' || explicitMode === 'pooler') {
    return 'supabase-pooler';
  }

  if (explicitMode === 'supabase-direct' || explicitMode === 'direct') {
    return 'supabase-direct';
  }

  if (explicitMode === 'local') {
    return 'local';
  }

  if (isSupabasePoolerUrl(databaseUrl)) {
    return 'supabase-pooler';
  }

  if (isSupabaseDirectUrl(databaseUrl)) {
    return 'supabase-direct';
  }

  return 'local';
}

function isSupabasePoolerUrl(databaseUrl?: string): boolean {
  if (!databaseUrl) {
    return false;
  }

  return (
    databaseUrl.includes('.pooler.supabase.com') ||
    databaseUrl.includes('pgbouncer=true') ||
    databaseUrl.includes(':6543/')
  );
}

function isSupabaseDirectUrl(databaseUrl?: string): boolean {
  if (!databaseUrl) {
    return false;
  }

  return databaseUrl.includes('.supabase.co') && !databaseUrl.includes('.pooler.supabase.com');
}

function resolveSslEnabled(configService: ConfigService, databaseUrl?: string): boolean {
  const defaultFromUrl =
    Boolean(databaseUrl?.includes('sslmode=require')) ||
    isSupabasePoolerUrl(databaseUrl) ||
    isSupabaseDirectUrl(databaseUrl);

  return getBooleanEnv(configService, 'DB_SSL', defaultFromUrl);
}

function resolveRejectUnauthorized(
  configService: ConfigService,
  databaseUrl?: string,
): boolean {
  const isSupabasePooler = isSupabasePoolerUrl(databaseUrl);
  return getBooleanEnv(configService, 'DB_SSL_REJECT_UNAUTHORIZED', !isSupabasePooler);
}

function getBooleanEnv(
  configService: ConfigService,
  key: string,
  defaultValue: boolean,
): boolean {
  const rawValue = configService.get<string>(key);
  if (rawValue === undefined) {
    return defaultValue;
  }

  const normalized = rawValue.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function normalizeConnectionString(
  databaseUrl: string,
  shouldUseSsl: boolean,
  rejectUnauthorized: boolean,
): string {
  if (!shouldUseSsl) {
    return databaseUrl;
  }

  if (!rejectUnauthorized) {
    if (databaseUrl.includes('sslmode=')) {
      return databaseUrl.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
    }

    return `${databaseUrl}${databaseUrl.includes('?') ? '&' : '?'}sslmode=no-verify`;
  }

  return databaseUrl;
}
