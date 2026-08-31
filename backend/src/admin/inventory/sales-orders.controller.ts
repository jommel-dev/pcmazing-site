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
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { RefundSalesOrderDto } from './dto/refund-sales-order.dto';
import { SalesOrdersService } from './sales-orders.service';

@Controller('admin/inventory/sales-orders')
@UseGuards(JwtAuthGuard)
export class SalesOrdersController {
  constructor(private readonly salesOrdersService: SalesOrdersService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('void') voidFilter?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.salesOrdersService
      .list(page, limit, search, voidFilter, sortBy, sortDir, startDate, endDate)
      .then((result) => ({
        success: true,
        data: result.items,
        meta: result.meta,
        summary: result.summary,
      }));
  }

  @Post()
  create(
    @Body() dto: CreateSalesOrderDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    return this.salesOrdersService.create(dto, request.user?.sub).then((item) => ({
      success: true,
      message: 'Sales order created.',
      data: item,
    }));
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.salesOrdersService.getById(id).then((item) => ({
      success: true,
      data: item,
    }));
  }

  @Patch(':id/void')
  voidOrder(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    return this.salesOrdersService.voidOrder(id, request.user?.sub).then((item) => ({
      success: true,
      message: 'Sales order voided and inventory restored.',
      data: item,
    }));
  }

  @Patch(':id/refund')
  refundOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RefundSalesOrderDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    return this.salesOrdersService.refundOrder(id, dto, request.user?.sub).then((item) => ({
      success: true,
      message: 'Sales order items refunded and inventory restored.',
      data: item,
    }));
  }
}
