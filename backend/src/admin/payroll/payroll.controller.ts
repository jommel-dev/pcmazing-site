import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminJwtPayload, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { GeneratePayslipsDto } from './dto/generate-payslips.dto';
import { ReviewOvertimeDto } from './dto/review-overtime.dto';
import { PayrollService } from './payroll.service';

@Controller('admin/payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('overview')
  @Roles('admin')
  overview(@Query('workDate') workDate?: string) {
    return this.payrollService.getOverview(workDate).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('employees')
  @Roles('admin')
  employees(@Query('search') search?: string) {
    return this.payrollService.listEmployees(search ?? '').then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('period')
  @Roles('admin')
  period(@Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    return this.payrollService.getPeriodSummary(dateFrom, dateTo).then((result) => ({
      success: true,
      data: result.items,
      meta: {
        dateFrom: result.dateFrom,
        dateTo: result.dateTo,
        periodDays: result.periodDays,
        totals: result.totals,
      },
    }));
  }

  @Post('period/generate')
  @Roles('admin')
  generatePeriod(
    @Body() body: GeneratePayslipsDto,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    const generatedBy =
      req.user?.sub != null
        ? { userId: Number(req.user.sub), username: req.user.username }
        : undefined;

    return this.payrollService
      .generatePayslips(body?.dateFrom, body?.dateTo, generatedBy, body?.employees)
      .then((data) => ({
        success: true,
        data,
      }));
  }

  @Get('attendance')
  @Roles('admin')
  listAttendance(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('workDate') workDate?: string,
  ) {
    return this.payrollService.listAttendance(page, limit, workDate).then((result) => ({
      success: true,
      data: result.items,
      meta: result.meta,
      workDate: result.workDate,
    }));
  }

  @Get('overtime')
  @Roles('admin')
  listOvertime(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.payrollService.listOvertime(status, page, limit).then((result) => ({
      success: true,
      data: result.items,
      meta: result.meta,
      status: result.status,
    }));
  }

  @Patch('overtime/:id')
  @Roles('admin')
  reviewOvertime(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReviewOvertimeDto,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    const reviewedBy =
      req.user?.sub != null && Number.isFinite(Number(req.user.sub))
        ? Number(req.user.sub)
        : undefined;

    return this.payrollService
      .reviewOvertime(id, body.status, body.note, reviewedBy)
      .then((data) => ({
        success: true,
        data,
      }));
  }
}
