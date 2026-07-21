import { Injectable, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(dto: CreateReviewDto) {
    const rating = this.normalizeRating(dto.rating ?? 5);

    try {
      const result = await this.databaseService.query<{ id: number; created_at: string }>(
        `INSERT INTO customer_reviews (full_name, email, company, rating, title, message)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [
          dto.name.trim(),
          dto.email?.trim() || null,
          dto.company?.trim() || null,
          rating,
          dto.title?.trim() || null,
          dto.message.trim(),
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new InternalServerErrorException('Failed to save review.');
      }

      return {
        success: true,
        message: 'Thank you for your feedback. Your review will appear after admin approval.',
        data: row,
      };
    } catch (error) {
      if ((error as { code?: string }).code === '42P01') {
        throw new ServiceUnavailableException('Review service is not ready. Please run database migrations first.');
      }
      throw error;
    }
  }

  private normalizeRating(value: number): number {
    const clamped = Math.min(Math.max(value, 0.5), 5);
    return Math.round(clamped * 2) / 2;
  }

  async listPublished(limitRaw?: string) {
    const limit = Math.min(Math.max(Number(limitRaw ?? 12) || 12, 1), 50);

    try {
      const result = await this.databaseService.query<{
        id: number;
        full_name: string;
        company: string | null;
        rating: number;
        title: string | null;
        message: string;
        published_at: string | null;
        created_at: string;
      }>(
        `SELECT id, full_name, company, rating, title, message, published_at, created_at
         FROM customer_reviews
         WHERE is_published = TRUE AND status = 'approved'
         ORDER BY COALESCE(published_at, created_at) DESC
         LIMIT $1`,
        [limit],
      );

      return {
        success: true,
        data: result.rows.map((row) => ({
          id: row.id,
          fullName: row.full_name,
          company: row.company,
          rating: Number(row.rating),
          title: row.title,
          message: row.message,
          publishedAt: row.published_at ?? row.created_at,
        })),
      };
    } catch (error) {
      if ((error as { code?: string }).code === '42P01') {
        return { success: true, data: [] };
      }
      throw error;
    }
  }
}
