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
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { CompanyExpensesService } from './company-expenses.service';
import { CreateCompanyExpenseDto, UpdateCompanyExpenseDto } from './dto/company-expense.dto';

@Controller('admin/company-expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompanyExpensesController {
  constructor(private readonly companyExpensesService: CompanyExpensesService) {}

  @Get()
  @Roles('admin', 'sales')
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
  @Roles('admin', 'sales')
  categorySuggestions() {
    return this.companyExpensesService.listCategorySuggestions().then((data) => ({
      success: true,
      data,
    }));
  }

  @Get(':id')
  @Roles('admin', 'sales')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.companyExpensesService.getById(id).then((data) => ({
      success: true,
      data,
    }));
  }

  @Post()
  @Roles('admin', 'sales')
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
  @Roles('admin', 'sales')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCompanyExpenseDto) {
    return this.companyExpensesService.update(id, dto).then((data) => ({
      success: true,
      message: 'Expense updated.',
      data,
    }));
  }

  @Post(':id/attachments')
  @Roles('admin', 'sales')
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
  @Roles('admin', 'sales')
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
  @Roles('admin', 'sales')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.companyExpensesService.remove(id).then((data) => ({
      success: true,
      message: 'Expense removed.',
      data,
    }));
  }
}
