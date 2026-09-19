import { Controller, Get, Param } from '@nestjs/common';
import { QuotationService } from './quotation.service';

@Controller('public/quotations')
export class PublicQuotationsController {
  constructor(private readonly quotationService: QuotationService) {}

  @Get(':token')
  getByToken(@Param('token') token: string) {
    return this.quotationService.getByShareToken(token).then((item) => ({
      success: true,
      data: item,
    }));
  }
}
