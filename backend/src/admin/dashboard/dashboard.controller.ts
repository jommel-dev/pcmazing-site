import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';
import { DashboardService } from './dashboard.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview(@Query() query: DashboardOverviewQueryDto) {
    const data = await this.dashboardService.getOverview(query);

    return {
      success: true,
      data,
    };
  }
}
