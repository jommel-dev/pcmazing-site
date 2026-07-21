import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Injectable()
export class AppService {
  constructor(private readonly databaseService: DatabaseService) {}

  getRoot() {
    return {
      success: true,
      service: 'pcmazing-site-backend',
      message: 'PCmazing website API',
    };
  }

  async getHealth() {
    const database = await this.databaseService.checkConnection();

    return {
      success: true,
      status: database.connected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database,
    };
  }
}
