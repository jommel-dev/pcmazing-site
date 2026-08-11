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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/roles.guard';
import { Roles } from '../rbac/roles.decorator';
import { CreatePrintingTemplateDto, UpdatePrintingTemplateDto } from './dto/printing.dto';
import { PrintingTemplatesService } from './printing-templates.service';

@Controller('admin/printing/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class PrintingTemplatesController {
  constructor(private readonly printingTemplatesService: PrintingTemplatesService) {}

  @Get()
  list(@Query('documentType') documentType?: string) {
    return this.printingTemplatesService.list(documentType).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.printingTemplatesService.getById(id).then((data) => ({
      success: true,
      data,
    }));
  }

  @Post()
  create(@Body() dto: CreatePrintingTemplateDto) {
    return this.printingTemplatesService.create(dto).then((data) => ({
      success: true,
      message: 'Printing template created.',
      data,
    }));
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePrintingTemplateDto) {
    return this.printingTemplatesService.update(id, dto).then((data) => ({
      success: true,
      message: 'Printing template updated.',
      data,
    }));
  }

  @Post(':id/duplicate')
  duplicate(@Param('id', ParseIntPipe) id: number) {
    return this.printingTemplatesService.duplicate(id).then((data) => ({
      success: true,
      message: 'Printing template duplicated.',
      data,
    }));
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.printingTemplatesService.remove(id).then(() => ({
      success: true,
      message: 'Printing template deleted.',
    }));
  }
}
