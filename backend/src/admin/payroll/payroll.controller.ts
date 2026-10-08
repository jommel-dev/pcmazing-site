import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminJwtPayload, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import {
  CommissionEntryQueryDto,
  CreateCommissionEntryDto,
  UpdateCommissionEntryDto,
} from './dto/commission-entry.dto';
import {
  CreateCommissionTypeDto,
  UpdateCommissionTypeDto,
} from './dto/commission-type.dto';
import { GeneratePayslipsDto } from './dto/generate-payslips.dto';
import { UpdateEmployeeLocationScheduleDto } from './dto/update-employee-location-schedule.dto';
import { UpdatePayrollSettingsDto } from './dto/payroll-settings.dto';
import { ReviewAdjustmentDto } from './dto/review-adjustment.dto';
import { ReviewOvertimeDto } from './dto/review-overtime.dto';
import { CreateLoanDto, LoanQueryDto, UpdateLoanDto } from './dto/loan.dto';
import {
  LoanPeriodDto,
  UpsertLoanPeriodOverrideDto,
} from './dto/loan-period-override.dto';
import {
  CreateManualDeductionDto,
  ManualDeductionQueryDto,
  UpdateManualDeductionDto,
} from './dto/manual-deduction.dto';
import { UpdatePayslipRemarksDto } from './dto/update-payslip-remarks.dto';
import { PayrollService } from './payroll.service';

@Controller('admin/payroll')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('overview')
  @RequirePermissions('payroll.view')
  overview(@Query('workDate') workDate?: string) {
    return this.payrollService.getOverview(workDate).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('employees')
  @RequirePermissions('payroll.view')
  employees(@Query('search') search?: string) {
    return this.payrollService.listEmployees(search ?? '').then((data) => ({
      success: true,
      data,
    }));
  }

  @Patch('employees/:userId/weekly-location')
  @RequirePermissions('payroll.edit')
  updateEmployeeWeeklyLocation(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: UpdateEmployeeLocationScheduleDto,
  ) {
    return this.payrollService
      .upsertProfile(userId, body.userSource, {
        weeklyLocationSchedule: body.weeklyLocationSchedule,
      })
      .then((data) => ({
        success: true,
        data,
      }));
  }

  @Get('settings')
  @RequirePermissions('payroll.view')
  settings() {
    return this.payrollService.getSettings().then((data) => ({
      success: true,
      data,
    }));
  }

  @Patch('settings')
  @RequirePermissions('payroll.edit')
  updateSettings(@Body() body: UpdatePayrollSettingsDto) {
    return this.payrollService.updateSettings(body).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('commission-types')
  @RequirePermissions('payroll.view')
  listCommissionTypes() {
    return this.payrollService.listCommissionTypes().then((data) => ({
      success: true,
      data,
    }));
  }

  @Post('commission-types')
  @RequirePermissions('payroll.edit')
  createCommissionType(@Body() body: CreateCommissionTypeDto) {
    return this.payrollService.createCommissionType(body).then((data) => ({
      success: true,
      data,
    }));
  }

  @Patch('commission-types/:id')
  @RequirePermissions('payroll.edit')
  updateCommissionType(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCommissionTypeDto,
  ) {
    return this.payrollService.updateCommissionType(id, body).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('commission-entries')
  @RequirePermissions('payroll.view')
  listCommissionEntries(@Query() query: CommissionEntryQueryDto) {
    return this.payrollService
      .listCommissionEntries(
        query.userId,
        query.userSource,
        query.dateFrom,
        query.dateTo,
      )
      .then((data) => ({
        success: true,
        data,
      }));
  }

  @Post('commission-entries')
  @RequirePermissions('payroll.edit')
  createCommissionEntry(
    @Query() query: CommissionEntryQueryDto,
    @Body() body: CreateCommissionEntryDto,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    const createdBy =
      req.user?.sub != null && Number.isFinite(Number(req.user.sub))
        ? Number(req.user.sub)
        : undefined;
    return this.payrollService
      .createCommissionEntry(
        query.userId,
        query.userSource,
        query.dateFrom,
        query.dateTo,
        body,
        createdBy,
      )
      .then((data) => ({
        success: true,
        data,
      }));
  }

  @Patch('commission-entries/:id')
  @RequirePermissions('payroll.edit')
  updateCommissionEntry(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCommissionEntryDto,
  ) {
    return this.payrollService.updateCommissionEntry(id, body).then((data) => ({
      success: true,
      data,
    }));
  }

  @Delete('commission-entries/:id')
  @RequirePermissions('payroll.edit')
  deleteCommissionEntry(@Param('id', ParseIntPipe) id: number) {
    return this.payrollService.deleteCommissionEntry(id).then(() => ({
      success: true,
      message: 'Commission entry deleted.',
    }));
  }

  @Get('manual-deductions')
  @RequirePermissions('payroll.view')
  listManualDeductions(@Query() query: ManualDeductionQueryDto) {
    return this.payrollService
      .listManualDeductions(
        query.userId,
        query.userSource,
        query.dateFrom,
        query.dateTo,
      )
      .then((data) => ({
        success: true,
        data,
      }));
  }

  @Post('manual-deductions')
  @RequirePermissions('payroll.edit')
  createManualDeduction(
    @Query() query: ManualDeductionQueryDto,
    @Body() body: CreateManualDeductionDto,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    const createdBy =
      req.user?.sub != null && Number.isFinite(Number(req.user.sub))
        ? Number(req.user.sub)
        : undefined;
    return this.payrollService
      .createManualDeduction(
        query.userId,
        query.userSource,
        query.dateFrom,
        query.dateTo,
        body,
        createdBy,
      )
      .then((data) => ({
        success: true,
        data,
      }));
  }

  @Patch('manual-deductions/:id')
  @RequirePermissions('payroll.edit')
  updateManualDeduction(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateManualDeductionDto,
  ) {
    return this.payrollService.updateManualDeduction(id, body).then((data) => ({
      success: true,
      data,
    }));
  }

  @Delete('manual-deductions/:id')
  @RequirePermissions('payroll.edit')
  deleteManualDeduction(@Param('id', ParseIntPipe) id: number) {
    return this.payrollService.deleteManualDeduction(id).then(() => ({
      success: true,
      message: 'Manual deduction deleted.',
    }));
  }

  @Get('loans')
  @RequirePermissions('payroll.view')
  listLoans(@Query() query: LoanQueryDto) {
    return this.payrollService
      .listLoans(query.userId, query.userSource)
      .then((data) => ({
        success: true,
        data,
      }));
  }

  @Post('loans')
  @RequirePermissions('payroll.edit')
  createLoan(@Body() body: CreateLoanDto) {
    return this.payrollService.createLoan(body).then((data) => ({
      success: true,
      data,
    }));
  }

  @Patch('loans/:id')
  @RequirePermissions('payroll.edit')
  updateLoan(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateLoanDto,
  ) {
    return this.payrollService.updateLoan(id, body).then((data) => ({
      success: true,
      data,
    }));
  }

  @Put('loans/:id/period-override')
  @RequirePermissions('payroll.edit')
  upsertLoanPeriodOverride(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpsertLoanPeriodOverrideDto,
  ) {
    return this.payrollService
      .upsertLoanPeriodOverride(id, body)
      .then((data) => ({
        success: true,
        data,
      }));
  }

  @Delete('loans/:id/period-override')
  @RequirePermissions('payroll.edit')
  deleteLoanPeriodOverride(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: LoanPeriodDto,
  ) {
    return this.payrollService
      .deleteLoanPeriodOverride(id, query.dateFrom, query.dateTo)
      .then(() => ({
        success: true,
        message: 'Loan period override deleted.',
      }));
  }

  @Get('period')
  @RequirePermissions('payroll.view')
  period(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('periodType') periodType?: string,
  ) {
    return this.payrollService
      .getPeriodSummary(dateFrom, dateTo, periodType)
      .then((result) => ({
        success: true,
        data: result.items,
        meta: {
          dateFrom: result.dateFrom,
          dateTo: result.dateTo,
          periodType: result.periodType,
          workWeek: result.workWeek,
          undertimeGraceMinutes: result.undertimeGraceMinutes,
          periodDays: result.periodDays,
          totals: result.totals,
          overlaps: result.overlaps,
        },
      }));
  }

  @Post('period/preview')
  @RequirePermissions('payroll.view')
  previewPeriod(@Body() body: GeneratePayslipsDto) {
    return this.payrollService
      .previewPayslips(
        body?.dateFrom,
        body?.dateTo,
        body?.employees,
        body?.periodType,
      )
      .then((data) => ({
        success: true,
        data,
      }));
  }

  @Post('period/generate')
  @RequirePermissions('payroll.run')
  generatePeriod(
    @Body() body: GeneratePayslipsDto,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    const generatedBy =
      req.user?.sub != null
        ? { userId: Number(req.user.sub), username: req.user.username }
        : undefined;

    return this.payrollService
      .generatePayslips(
        body?.dateFrom,
        body?.dateTo,
        generatedBy,
        body?.employees,
        body?.periodType,
        body?.confirmOverlap,
      )
      .then((data) => ({
        success: true,
        data,
      }));
  }

  @Patch('payslips/:id/remarks')
  @RequirePermissions('payroll.edit')
  updatePayslipRemarks(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePayslipRemarksDto,
  ) {
    return this.payrollService
      .updatePayslipRemarks(id, body.remarks)
      .then((data) => ({
        success: true,
        data,
      }));
  }

  @Get('attendance')
  @RequirePermissions('payroll.view')
  listAttendance(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('workDate') workDate?: string,
  ) {
    return this.payrollService
      .listAttendance(page, limit, workDate)
      .then((result) => ({
        success: true,
        data: result.items,
        meta: result.meta,
        workDate: result.workDate,
      }));
  }

  @Get('overtime')
  @RequirePermissions('payroll.view')
  listOvertime(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.payrollService
      .listOvertime(status, page, limit)
      .then((result) => ({
        success: true,
        data: result.items,
        meta: result.meta,
        status: result.status,
      }));
  }

  @Patch('overtime/:id')
  @RequirePermissions('payroll.edit')
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

  @Get('adjustments')
  @RequirePermissions('payroll.view')
  listAdjustments(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.payrollService
      .listAdjustments(status, page, limit)
      .then((result) => ({
        success: true,
        data: result.items,
        meta: result.meta,
        status: result.status,
      }));
  }

  @Patch('adjustments/:id')
  @RequirePermissions('payroll.edit')
  reviewAdjustment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReviewAdjustmentDto,
    @Req() req: Request & { user?: AdminJwtPayload },
  ) {
    const reviewedBy =
      req.user?.sub != null && Number.isFinite(Number(req.user.sub))
        ? Number(req.user.sub)
        : undefined;

    return this.payrollService
      .reviewAdjustment(id, body.status, body.note, reviewedBy)
      .then((data) => ({
        success: true,
        data,
      }));
  }
}
