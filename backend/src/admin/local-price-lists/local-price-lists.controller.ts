import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateLocalPriceItemDto, UpdateLocalPriceItemDto } from './dto/local-price-item.dto';
import { CreateLocalPriceStoreDto, UpdateLocalPriceStoreDto } from './dto/local-price-store.dto';
import { LocalPriceListsService } from './local-price-lists.service';

@Controller('admin/local-price-stores')
@UseGuards(JwtAuthGuard)
export class LocalPriceListsController {
  constructor(private readonly localPriceListsService: LocalPriceListsService) {}

  @Get()
  listStores() {
    return this.localPriceListsService.listStores().then((data) => ({
      success: true,
      data,
    }));
  }

  @Post()
  createStore(@Body() dto: CreateLocalPriceStoreDto) {
    return this.localPriceListsService.createStore(dto).then((data) => ({
      success: true,
      message: 'Local price store created.',
      data,
    }));
  }

  @Patch(':id')
  updateStore(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLocalPriceStoreDto) {
    return this.localPriceListsService.updateStore(id, dto).then((data) => ({
      success: true,
      message: 'Local price store updated.',
      data,
    }));
  }

  @Get(':id/items')
  listItems(@Param('id', ParseIntPipe) id: number) {
    return this.localPriceListsService.listItems(id).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get(':id/items/import/template')
  getImportTemplate(
    @Param('id', ParseIntPipe) _id: number,
    @Res({ passthrough: true }) response: import('express').Response,
  ) {
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="local-price-list-import-template.csv"',
    );
    return this.localPriceListsService.getImportTemplate();
  }

  @Post(':id/items/import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importItems(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const content = file?.buffer?.toString('utf8') ?? '';
    return this.localPriceListsService.replaceItemsFromCsv(id, content).then((data) => ({
      success: true,
      message: `${data.imported} item(s) imported (store list replaced).`,
      data,
    }));
  }

  @Post(':id/items')
  createItem(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateLocalPriceItemDto) {
    return this.localPriceListsService.createItem(id, dto).then((data) => ({
      success: true,
      message: 'Local price item created.',
      data,
    }));
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateLocalPriceItemDto,
  ) {
    return this.localPriceListsService.updateItem(id, itemId, dto).then((data) => ({
      success: true,
      message: 'Local price item updated.',
      data,
    }));
  }

  @Delete(':id/items/:itemId')
  deleteItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.localPriceListsService.deleteItem(id, itemId).then(() => ({
      success: true,
      message: 'Local price item deleted.',
    }));
  }
}
