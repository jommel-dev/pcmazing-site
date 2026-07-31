import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { isSalesRestrictedInventory } from '../rbac/admin-roles.util';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceStatusDto } from './dto/update-service-status.dto';
import { InventoryServicesService } from './inventory-services.service';

@Controller('admin/inventory/services')
@UseGuards(JwtAuthGuard)
export class InventoryServicesController {
  constructor(private readonly inventoryServicesService: InventoryServicesService) {}

  private assertNotSales(role?: string | null): void {
    if (isSalesRestrictedInventory(role)) {
      throw new ForbiddenException('Sales roles cannot access services profitability.');
    }
  }

  @Get()
  list(
    @Req() request: Request & { user?: AdminJwtPayload },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    this.assertNotSales(request.user?.role);
    return this.inventoryServicesService.list(page, limit, search, type, status).then((result) => ({
      success: true,
      data: result.items,
      meta: result.meta,
      summary: result.summary,
      filters: result.filters,
    }));
  }

  @Post()
  create(
    @Body() dto: CreateServiceDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    this.assertNotSales(request.user?.role);
    return this.inventoryServicesService.create(dto, request.user?.sub).then((item) => ({
      success: true,
      message: 'Service created.',
      data: item,
    }));
  }

  @Get(':id')
  getById(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    this.assertNotSales(request.user?.role);
    return this.inventoryServicesService.getById(id).then((item) => ({
      success: true,
      data: item,
    }));
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateServiceDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    this.assertNotSales(request.user?.role);
    return this.inventoryServicesService.update(id, dto).then((item) => ({
      success: true,
      message: 'Service updated.',
      data: item,
    }));
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceStatusDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    this.assertNotSales(request.user?.role);
    return this.inventoryServicesService.updateStatus(id, dto).then((item) => ({
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
    this.assertNotSales(request.user?.role);
    return this.inventoryServicesService.softDelete(id).then(() => ({
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
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    this.assertNotSales(request.user?.role);
    return this.inventoryServicesService.uploadImage(id, file).then((item) => ({
      success: true,
      message: 'Service image updated.',
      data: item,
    }));
  }
}
