import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { AdminJwtPayload, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { isSalesRestrictedInventory } from '../rbac/admin-roles.util';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { InventoryService } from './inventory.service';

@Controller('admin/inventory/materials')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  private assertCanMutateInventory(role?: string | null): void {
    if (isSalesRestrictedInventory(role)) {
      throw new ForbiddenException('Sales roles can view products and SRP only.');
    }
  }

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
    @Req() request: Request & { user?: AdminJwtPayload },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('brandId') brandId?: string,
    @Query('productTypeId') productTypeId?: string,
  ) {
    const hideCosts = isSalesRestrictedInventory(request.user?.role);
    return this.inventoryService
      .listMaterials(page, limit, search, brandId, productTypeId)
      .then((result) => ({
        success: true,
        data: hideCosts
          ? result.items.map((item) => this.inventoryService.redactCostFields(item))
          : result.items,
        meta: result.meta,
        summary: hideCosts ? null : result.summary,
      }));
  }

  @Get('export')
  exportCsv(
    @Req() request: Request & { user?: AdminJwtPayload },
    @Res({ passthrough: true }) response: import('express').Response,
    @Query('search') search?: string,
    @Query('brandId') brandId?: string,
    @Query('productTypeId') productTypeId?: string,
  ) {
    this.assertCanMutateInventory(request.user?.role);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="inventory-stock-export.csv"');
    return this.inventoryService.exportCsv(search, brandId, productTypeId);
  }

  @Get('import/template')
  getImportTemplate(
    @Req() request: Request & { user?: AdminJwtPayload },
    @Res({ passthrough: true }) response: import('express').Response,
  ) {
    this.assertCanMutateInventory(request.user?.role);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="inventory-stock-import-template.csv"',
    );
    return this.inventoryService.getImportTemplate();
  }

  @Post('import/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async previewImport(
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    this.assertCanMutateInventory(request.user?.role);
    const content = file?.buffer?.toString('utf8') ?? '';
    const data = await this.inventoryService.previewImportFromCsv(content);
    return {
      success: true,
      data: {
        ...data,
        fileName: file?.originalname ?? 'upload.csv',
      },
    };
  }

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importMaterials(
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    this.assertCanMutateInventory(request.user?.role);
    const content = file?.buffer?.toString('utf8') ?? '';
    return this.inventoryService.importFromCsv(content, request.user?.sub).then((data) => ({
      success: true,
      message: `${data.imported} product(s) imported (${data.created} created, ${data.updated} updated).`,
      data,
    }));
  }

  @Post()
  create(
    @Body() dto: CreateMaterialDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    this.assertCanMutateInventory(request.user?.role);
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
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    this.assertCanMutateInventory(request.user?.role);
    return this.inventoryService.uploadMaterialImage(id, file).then((item) => ({
      success: true,
      message: 'Product image updated.',
      data: item,
    }));
  }

  @Delete(':id/image')
  removeImage(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    this.assertCanMutateInventory(request.user?.role);
    return this.inventoryService.removeMaterialImage(id).then((item) => ({
      success: true,
      message: 'Product image removed.',
      data: item,
    }));
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaterialDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    this.assertCanMutateInventory(request.user?.role);
    return this.inventoryService.updateMaterial(id, dto).then((item) => ({
      success: true,
      message: 'Product updated.',
      data: item,
    }));
  }

  @Get(':id')
  getById(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    const hideCosts = isSalesRestrictedInventory(request.user?.role);
    return this.inventoryService.getMaterial(id).then((item) => ({
      success: true,
      data: hideCosts ? this.inventoryService.redactCostFields(item) : item,
    }));
  }
}
