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
import type { Request } from 'express';
import { AdminJwtPayload, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { CompanyExpensesService } from './company-expenses.service';
import { CreateCompanyExpenseDto, UpdateCompanyExpenseDto } from './dto/company-expense.dto';

@Controller('admin/company-expenses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompanyExpensesController {
  constructor(private readonly companyExpensesService: CompanyExpensesService) {}

  @Get()
  @RequirePermissions('company_expenses.view')
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.companyExpensesService.listCalendar(from, to, category, status).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('category-suggestions')
  @RequirePermissions('company_expenses.view')
  categorySuggestions() {
    return this.companyExpensesService.listCategorySuggestions().then((data) => ({
      success: true,
      data,
    }));
  }

  @Get(':id')
  @RequirePermissions('company_expenses.view')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.companyExpensesService.getById(id).then((data) => ({
      success: true,
      data,
    }));
  }

  @Post()
  @RequirePermissions('company_expenses.create')
  create(
    @Body() dto: CreateCompanyExpenseDto,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    const createdBy =
      req.user?.sub != null && Number.isFinite(Number(req.user.sub))
        ? Number(req.user.sub)
        : undefined;

    return this.companyExpensesService.create(dto, createdBy).then((data) => ({
      success: true,
      message: 'Expense saved.',
      data,
    }));
  }

  @Patch(':id')
  @RequirePermissions('company_expenses.edit')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCompanyExpenseDto) {
    return this.companyExpensesService.update(id, dto).then((data) => ({
      success: true,
      message: 'Expense updated.',
      data,
    }));
  }

  @Post(':id/attachments')
  @RequirePermissions('company_expenses.edit')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadAttachment(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    const createdBy =
      req.user?.sub != null && Number.isFinite(Number(req.user.sub))
        ? Number(req.user.sub)
        : undefined;

    return this.companyExpensesService.uploadAttachment(id, file, createdBy).then((data) => ({
      success: true,
      message: 'Attachment uploaded.',
      data,
    }));
  }

  @Delete(':id/attachments/:attachmentId')
  @RequirePermissions('company_expenses.edit')
  deleteAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
  ) {
    return this.companyExpensesService.deleteAttachment(id, attachmentId).then(() => ({
      success: true,
      message: 'Attachment deleted.',
    }));
  }

  @Delete(':id')
  @RequirePermissions('company_expenses.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.companyExpensesService.remove(id).then((data) => ({
      success: true,
      message: 'Expense removed.',
      data,
    }));
  }
}
