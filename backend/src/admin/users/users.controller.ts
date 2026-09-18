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
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { AdminJwtPayload } from '../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { ChangeUserPasswordDto } from './dto/change-user-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('rbac-status')
  getRbacStatus() {
    return {
      success: true,
      data: this.usersService.getRbacStatus(),
    };
  }

  @Get('roles')
  async listRoles() {
    return {
      success: true,
      data: await this.usersService.listRoles(),
    };
  }

  @Get()
  @Roles('admin')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.list(page, limit, search).then((result) => ({
      success: true,
      data: result.items,
      meta: result.meta,
    }));
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto).then((item) => ({
      success: true,
      message: 'User created.',
      data: item,
    }));
  }

  @Get(':id')
  @Roles('admin')
  getById(@Param('id', ParseIntPipe) id: number, @Query('source') source?: string) {
    const resolvedSource =
      source === 'tblusers'
        ? ('tblusers' as const)
        : source === 'pcmazing_admin_users'
          ? ('pcmazing_admin_users' as const)
          : undefined;

    return this.usersService.getById(id, resolvedSource).then((item) => ({
      success: true,
      data: item,
    }));
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    return this.usersService
      .update(id, dto, request.user?.sub ?? 0)
      .then((item) => ({
        success: true,
        message: 'User updated.',
        data: item,
      }));
  }

  @Patch(':id/password')
  @Roles('admin')
  changePassword(@Param('id', ParseIntPipe) id: number, @Body() dto: ChangeUserPasswordDto) {
    return this.usersService.changePassword(id, dto).then((item) => ({
      success: true,
      message: 'Password updated.',
      data: item,
    }));
  }

  @Post(':id/profile-image')
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadProfileImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadProfileImage(id, file).then((item) => ({
      success: true,
      message: 'Profile image updated.',
      data: item,
    }));
  }

  @Delete(':id/profile-image')
  @Roles('admin')
  removeProfileImage(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.removeProfileImage(id).then((item) => ({
      success: true,
      message: 'Profile image removed.',
      data: item,
    }));
  }

  @Post(':id/payroll-qr')
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadPayrollQr(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadPayrollQr(id, file).then((item) => ({
      success: true,
      message: 'Payroll QR image updated.',
      data: item,
    }));
  }

  @Delete(':id/payroll-qr')
  @Roles('admin')
  removePayrollQr(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.removePayrollQr(id).then((item) => ({
      success: true,
      message: 'Payroll QR image removed.',
      data: item,
    }));
  }

  @Delete(':id')
  @Roles('admin')
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    return this.usersService.deactivate(id, request.user?.sub ?? 0).then((item) => ({
      success: true,
      message: 'User deactivated.',
      data: item,
    }));
  }
}
