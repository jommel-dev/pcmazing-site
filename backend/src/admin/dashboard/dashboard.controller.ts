import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';
import { DashboardService } from './dashboard.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @Roles('admin', 'sales')
  async getOverview(@Query() query: DashboardOverviewQueryDto) {
    const data = await this.dashboardService.getOverview(query);

    return {
      success: true,
      data,
    };
  }
}
