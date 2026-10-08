import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { RolesAdminService } from './roles-admin.service';

@Controller('admin/roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class RolesAdminController {
  constructor(private readonly rolesAdmin: RolesAdminService) {}

  @Get('catalog')
  getCatalog() {
    return { success: true, data: this.rolesAdmin.getCatalog() };
  }

  @Get()
  async list() {
    return { success: true, data: await this.rolesAdmin.listRoles() };
  }

  @Post()
  async create(@Body() dto: CreateRoleDto) {
    return {
      success: true,
      message: 'Role created.',
      data: await this.rolesAdmin.create(dto),
    };
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return {
      success: true,
      message: 'Role updated.',
      data: await this.rolesAdmin.update(id, dto),
    };
  }

  @Post(':id/soft-delete')
  async softDelete(@Param('id', ParseIntPipe) id: number) {
    return {
      success: true,
      message: 'Role soft deleted.',
      data: await this.rolesAdmin.softDelete(id),
    };
  }
}
