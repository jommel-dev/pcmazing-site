import {
  Body,
  Controller,
  Delete,
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
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.quotationService.list(page, limit, search, status, sortBy, sortDir).then((result) => ({
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

  @Post(':id/duplicate')
  duplicate(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    return this.quotationService.duplicate(id, request.user?.sub).then((item) => ({
      success: true,
      message: 'Quotation duplicated as draft.',
      data: item,
    }));
  }

  @Post(':id/share-link')
  ensureShareLink(@Param('id', ParseIntPipe) id: number) {
    return this.quotationService.ensureShareLink(id).then((data) => ({
      success: true,
      message: 'Share link ready.',
      data,
    }));
  }

  @Post(':id/share-link/regenerate')
  regenerateShareLink(@Param('id', ParseIntPipe) id: number) {
    return this.quotationService.regenerateShareLink(id).then((data) => ({
      success: true,
      message: 'Share link regenerated. Previous links no longer work.',
      data,
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
      message: item.status === 'finalized' ? 'Quotation finalized.' : 'Quotation saved as draft.',
      data: item,
    }));
  }

  @Delete(':id')
  softDelete(@Param('id', ParseIntPipe) id: number) {
    return this.quotationService.softDelete(id).then(() => ({
      success: true,
      message: 'Quotation deleted.',
    }));
  }
}
