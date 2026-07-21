import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DemoRequestsService } from './demo-requests.service';
import { UpdateDemoRequestDto } from './dto/update-demo-request.dto';

@Controller('admin/demo-requests')
@UseGuards(JwtAuthGuard)
export class DemoRequestsController {
  constructor(private readonly demoRequestsService: DemoRequestsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.demoRequestsService.list(page, limit, search, status).then((result) => ({
      success: true,
      data: result.items,
      meta: result.meta,
    }));
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.demoRequestsService.getById(id).then((item) => ({
      success: true,
      data: item,
    }));
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDemoRequestDto) {
    return this.demoRequestsService.update(id, dto).then((item) => ({
      success: true,
      message: 'Demo request updated.',
      data: item,
    }));
  }
}
