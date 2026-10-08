import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import {
  DashboardDetailsQueryDto,
  DashboardOverviewQueryDto,
} from './dto/dashboard-overview-query.dto';
import { DashboardService } from './dashboard.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @RequirePermissions('sales_dashboard.view')
  async getOverview(@Query() query: DashboardOverviewQueryDto) {
    const data = await this.dashboardService.getOverview(query);

    return {
      success: true,
      data,
    };
  }

  @Get('details')
  @RequirePermissions('sales_dashboard.view')
  async getDetails(@Query() query: DashboardDetailsQueryDto) {
    const data = await this.dashboardService.getDetails(query);

    return {
      success: true,
      data,
    };
  }
}
