import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
