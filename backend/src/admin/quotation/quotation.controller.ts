import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminJwtPayload, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { QuotationService } from './quotation.service';

@Controller('admin/quotations')
@UseGuards(JwtAuthGuard)
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.quotationService.list(page, limit, search, status).then((result) => ({
      success: true,
      data: result.items,
      meta: result.meta,
    }));
  }

  @Post()
  create(
    @Body() dto: CreateQuotationDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    return this.quotationService.create(dto, request.user?.sub).then((item) => ({
      success: true,
      message: item.status === 'finalized' ? 'Quotation finalized.' : 'Quotation saved as draft.',
      data: item,
    }));
  }

  @Get(':id')
  getById(
    @Param('id', ParseIntPipe) id: number,
    @Query('source') source?: string,
  ) {
    return this.quotationService.getById(id, source).then((item) => ({
      success: true,
      data: item,
    }));
  }

  @Patch(':id')
  updateDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateQuotationDto,
  ) {
    return this.quotationService.updateDraft(id, dto).then((item) => ({
      success: true,
      message: item.status === 'finalized' ? 'Quotation finalized.' : 'Draft quotation updated.',
      data: item,
    }));
  }
}
