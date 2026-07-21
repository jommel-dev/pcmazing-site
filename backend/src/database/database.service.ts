import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult } from 'pg';
import { buildDatabaseConfig, DatabaseConnectionMode } from './database.config';

export interface DatabaseConnectionStatus {
  connected: boolean;
  schema: string;
  mode: DatabaseConnectionMode;
  message?: string;
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly migrationPool: Pool;
  private readonly schema: string;
  private readonly mode: DatabaseConnectionMode;

  constructor(private readonly configService: ConfigService) {
    const config = buildDatabaseConfig(configService);

    this.schema = config.schema;
    this.mode = config.mode;
    this.pool = new Pool(config.poolConfig);
    this.migrationPool = new Pool(config.migrationPoolConfig);

    console.log('Database connection mode:', this.mode);
    console.log('Database schema:', this.schema);
    console.log('Migration pool uses direct URL:', Boolean(configService.get('DATABASE_DIRECT_URL')));
  }

  async query<T = unknown>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async migrationQuery<T = unknown>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.migrationPool.query<T>(text, params);
  }

  async withTransaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.runTransaction(this.pool, callback);
  }

  async withMigrationTransaction<T>(
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.runTransaction(this.migrationPool, callback);
  }

  async checkConnection(): Promise<DatabaseConnectionStatus> {
    try {
      await this.query('SELECT 1');
      return {
        connected: true,
        schema: this.schema,
        mode: this.mode,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Database connection failed';

      return {
        connected: false,
        schema: this.schema,
        mode: this.mode,
        message,
      };
    }
  }

  getConnectionMode(): DatabaseConnectionMode {
    return this.mode;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.pool.end(), this.migrationPool.end()]);
  }

  private async runTransaction<T>(
    pool: Pool,
    callback: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Transaction rollback failed:', rollbackError);
      }

      throw error;
    } finally {
      client.release();
    }
  }
}
