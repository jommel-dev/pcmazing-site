import { Injectable, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateDemoDto } from './dto/create-demo.dto';

@Injectable()
export class DemoService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(dto: CreateDemoDto) {
    try {
      const result = await this.databaseService.query<{ id: number; created_at: string }>(
        `INSERT INTO demo_requests (
          full_name, email, phone, company, service_interest,
          preferred_date, preferred_time, message
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, created_at`,
        [
          dto.name.trim(),
          dto.email.trim(),
          dto.phone?.trim() || null,
          dto.company?.trim() || null,
          dto.serviceInterest?.trim() || null,
          dto.preferredDate || null,
          dto.preferredTime?.trim() || null,
          dto.message?.trim() || null,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new InternalServerErrorException('Failed to save demo request.');
      }

      return {
        success: true,
        message: 'Your demo request has been received. Our team will follow up to confirm your schedule.',
        data: row,
      };
    } catch (error) {
      if ((error as { code?: string }).code === '42P01') {
        throw new ServiceUnavailableException('Demo scheduling is not ready. Please run database migrations first.');
      }
      throw error;
    }
  }
}
