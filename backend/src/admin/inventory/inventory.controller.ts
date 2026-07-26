import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { AdminJwtPayload, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { InventoryService } from './inventory.service';

@Controller('admin/inventory/materials')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('tree')
  getTree() {
    return this.inventoryService.getTree().then((tree) => ({
      success: true,
      data: tree,
    }));
  }

  @Get('brands')
  listBrands(
    @Query('productTypeId') productTypeId?: string,
    @Query('search') search?: string,
  ) {
    const parsedProductTypeId = productTypeId?.trim() ? Number(productTypeId) : undefined;
    return this.inventoryService.listBrands(parsedProductTypeId, search).then((items) => ({
      success: true,
      data: items,
    }));
  }

  @Get('product-types')
  listProductTypes(@Query('search') search?: string) {
    return this.inventoryService.listProductTypes(search).then((items) => ({
      success: true,
      data: items,
    }));
  }

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('brandId') brandId?: string,
    @Query('productTypeId') productTypeId?: string,
  ) {
    return this.inventoryService
      .listMaterials(page, limit, search, brandId, productTypeId)
      .then((result) => ({
        success: true,
        data: result.items,
        meta: result.meta,
        summary: result.summary,
      }));
  }

  @Post()
  create(
    @Body() dto: CreateMaterialDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    return this.inventoryService.createMaterial(dto, request.user?.sub).then((item) => ({
      success: true,
      message: 'Product created.',
      data: item,
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
    return this.inventoryService.uploadMaterialImage(id, file).then((item) => ({
      success: true,
      message: 'Product image updated.',
      data: item,
    }));
  }

  @Delete(':id/image')
  removeImage(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.removeMaterialImage(id).then((item) => ({
      success: true,
      message: 'Product image removed.',
      data: item,
    }));
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMaterialDto) {
    return this.inventoryService.updateMaterial(id, dto).then((item) => ({
      success: true,
      message: 'Product updated.',
      data: item,
    }));
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.getMaterial(id).then((item) => ({
      success: true,
      data: item,
    }));
  }
}
