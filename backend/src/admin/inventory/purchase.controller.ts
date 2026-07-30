import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminJwtPayload } from '../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { isSalesRestrictedInventory } from '../rbac/admin-roles.util';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchaseService } from './purchase.service';

@Controller('admin/inventory/purchase')
@UseGuards(JwtAuthGuard)
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  private assertNotSales(role?: string | null): void {
    if (isSalesRestrictedInventory(role)) {
      throw new ForbiddenException('Sales roles cannot access purchase orders.');
    }
  }

  @Get('vendors')
  listVendors(@Req() request: Request & { user?: AdminJwtPayload }) {
    this.assertNotSales(request.user?.role);
    return this.purchaseService.listVendors().then((items) => ({
      success: true,
      data: items,
    }));
  }

  @Get()
  list(
    @Req() request: Request & { user?: AdminJwtPayload },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    this.assertNotSales(request.user?.role);
    return this.purchaseService.list(page, limit, search, status).then((result) => ({
      success: true,
      data: result.items,
      meta: result.meta,
    }));
  }

  @Post()
  create(
    @Body() dto: CreatePurchaseDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    this.assertNotSales(request.user?.role);
    return this.purchaseService.create(dto, request.user?.sub).then((item) => ({
      success: true,
      message: 'Purchase order created.',
      data: item,
    }));
  }

  @Get(':id')
  getById(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    this.assertNotSales(request.user?.role);
    return this.purchaseService.getById(id).then((item) => ({
      success: true,
      data: item,
    }));
  }
}
