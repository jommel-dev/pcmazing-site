import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateContactDto } from './dto/create-contact.dto';

export interface ContactInquiryRecord {
  id: number;
  created_at: string;
}

@Injectable()
export class ContactService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createInquiry(dto: CreateContactDto): Promise<{
    success: true;
    message: string;
    data: ContactInquiryRecord;
  }> {
    try {
      const result = await this.databaseService.query<ContactInquiryRecord>(
        `INSERT INTO contact_inquiries (full_name, email, phone, service_interest, message)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at`,
        [dto.name.trim(), dto.email.trim(), dto.phone?.trim() || null, dto.inquiry, dto.message.trim()],
      );

      const record = result.rows[0];

      if (!record) {
        throw new InternalServerErrorException('Failed to save contact inquiry.');
      }

      return {
        success: true,
        message: 'Your message has been received. We will contact you soon.',
        data: record,
      };
    } catch (error) {
      if (this.isMissingTableError(error)) {
        throw new ServiceUnavailableException(
          'Contact service is not ready. Please run database migrations first.',
        );
      }

      if (error instanceof ServiceUnavailableException || error instanceof InternalServerErrorException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Failed to save contact inquiry.';
      throw new InternalServerErrorException(message);
    }
  }

  private isMissingTableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const code = (error as { code?: string }).code;
    return code === '42P01';
  }
}
