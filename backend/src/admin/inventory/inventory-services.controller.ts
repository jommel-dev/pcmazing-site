import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { AdminJwtPayload, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { canSeeInventoryCosts } from '../rbac/admin-roles.util';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceStatusDto } from './dto/update-service-status.dto';
import { InventoryServicesService } from './inventory-services.service';

@Controller('admin/inventory/services')
@UseGuards(JwtAuthGuard)
export class InventoryServicesController {
  constructor(private readonly inventoryServicesService: InventoryServicesService) {}

  @Get()
  list(
    @Req() request: Request & { user?: AdminJwtPayload },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const hideProfitability = !canSeeInventoryCosts(request.user?.role);
    return this.inventoryServicesService
      .list(page, limit, search, type, status, sortBy, sortDir, startDate, endDate)
      .then((result) => ({
        success: true,
        data: hideProfitability
          ? result.items.map((item) => this.inventoryServicesService.redactProfitabilityFields(item))
          : result.items,
        meta: result.meta,
        summary: hideProfitability ? null : result.summary,
        filters: result.filters,
      }));
  }

  @Get('customer-names')
  searchCustomers(@Query('search') search?: string) {
    return this.inventoryServicesService.searchCustomers(search).then((customers) => ({
      success: true,
      data: customers,
    }));
  }

  @Post()
  create(
    @Body() dto: CreateServiceDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    const hideProfitability = !canSeeInventoryCosts(request.user?.role);
    return this.inventoryServicesService.create(dto, request.user?.sub).then((item) => ({
      success: true,
      message: 'Service created.',
      data: hideProfitability
        ? this.inventoryServicesService.redactProfitabilityFields(item)
        : item,
    }));
  }

  @Get(':id')
  getById(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    const hideProfitability = !canSeeInventoryCosts(request.user?.role);
    return this.inventoryServicesService.getById(id).then((item) => ({
      success: true,
      data: hideProfitability
        ? this.inventoryServicesService.redactProfitabilityFields(item)
        : item,
    }));
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateServiceDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    const hideProfitability = !canSeeInventoryCosts(request.user?.role);
    return this.inventoryServicesService.update(id, dto, request.user?.sub).then((item) => ({
      success: true,
      message: 'Service updated.',
      data: hideProfitability
        ? this.inventoryServicesService.redactProfitabilityFields(item)
        : item,
    }));
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceStatusDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    return this.inventoryServicesService.updateStatus(id, dto, request.user?.sub).then((item) => ({
      success: true,
      message: 'Service status updated.',
      data: item,
    }));
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    return this.inventoryServicesService.softDelete(id, request.user?.sub).then(() => ({
      success: true,
      message: 'Service deleted.',
    }));
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.inventoryServicesService.uploadImage(id, file).then((item) => ({
      success: true,
      message: 'Service image updated.',
      data: item,
    }));
  }
}
