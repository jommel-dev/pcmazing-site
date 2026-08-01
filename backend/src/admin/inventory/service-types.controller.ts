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
import { CreateServiceTypeDto, UpdateServiceTypeDto } from './dto/service-type.dto';
import { ServiceTypesService } from './service-types.service';

@Controller('admin/inventory/service-types')
@UseGuards(JwtAuthGuard)
export class ServiceTypesController {
  constructor(private readonly serviceTypesService: ServiceTypesService) {}

  @Get()
  list(@Query('activeOnly') activeOnly?: string) {
    const onlyActive = activeOnly === 'true' || activeOnly === '1';
    return this.serviceTypesService.list(onlyActive).then((data) => ({
      success: true,
      data,
    }));
  }

  @Post()
  create(@Body() dto: CreateServiceTypeDto) {
    return this.serviceTypesService.create(dto).then((data) => ({
      success: true,
      message: 'Service type created.',
      data,
    }));
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServiceTypeDto) {
    return this.serviceTypesService.update(id, dto).then((data) => ({
      success: true,
      message: 'Service type updated.',
      data,
    }));
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.serviceTypesService.remove(id).then(() => ({
      success: true,
      message: 'Service type deleted.',
    }));
  }
}
