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
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminJwtPayload, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateActivityDto,
  CreateTodoDto,
  UpdateTodoDto,
  UpsertDayOffDto,
} from './dto/employee-workspace.dto';
import { EmployeeWorkspaceService } from './employee-workspace.service';

@Controller('admin/employee-workspace')
@UseGuards(JwtAuthGuard)
export class EmployeeWorkspaceController {
  constructor(private readonly workspaceService: EmployeeWorkspaceService) {}

  private actor(req: Request & { user?: AdminJwtPayload }) {
    const user = req.user;
    if (!user?.sub || !user.source) {
      throw new UnauthorizedException('Missing authenticated user.');
    }
    this.workspaceService.assertSalesWorkspaceAccess(user.role);
    return {
      userId: Number(user.sub),
      source: user.source,
    };
  }

  @Get('dashboard')
  async dashboard(
    @Req() req: Request & { user?: AdminJwtPayload },
    @Query('month') month?: string,
  ) {
    const { userId, source } = this.actor(req);
    const data = await this.workspaceService.getDashboard(userId, source, month);
    return { success: true, data };
  }

  @Put('day-offs')
  async upsertDayOff(
    @Req() req: Request & { user?: AdminJwtPayload },
    @Body() dto: UpsertDayOffDto,
  ) {
    const { userId, source } = this.actor(req);
    const data = await this.workspaceService.upsertDayOff(userId, source, dto);
    return { success: true, message: 'Day off saved.', data };
  }

  @Delete('day-offs/:id')
  async deleteDayOff(
    @Req() req: Request & { user?: AdminJwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const { userId, source } = this.actor(req);
    await this.workspaceService.deleteDayOff(userId, source, id);
    return { success: true, message: 'Day off removed.' };
  }

  @Post('todos')
  async createTodo(
    @Req() req: Request & { user?: AdminJwtPayload },
    @Body() dto: CreateTodoDto,
  ) {
    const { userId, source } = this.actor(req);
    const data = await this.workspaceService.createTodo(userId, source, dto);
    return { success: true, message: 'Todo created.', data };
  }

  @Patch('todos/:id')
  async updateTodo(
    @Req() req: Request & { user?: AdminJwtPayload },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTodoDto,
  ) {
    const { userId, source } = this.actor(req);
    const data = await this.workspaceService.updateTodo(userId, source, id, dto);
    return { success: true, message: 'Todo updated.', data };
  }

  @Delete('todos/:id')
  async deleteTodo(
    @Req() req: Request & { user?: AdminJwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const { userId, source } = this.actor(req);
    await this.workspaceService.deleteTodo(userId, source, id);
    return { success: true, message: 'Todo deleted.' };
  }

  @Post('activities')
  async createActivity(
    @Req() req: Request & { user?: AdminJwtPayload },
    @Body() dto: CreateActivityDto,
  ) {
    const { userId, source } = this.actor(req);
    const data = await this.workspaceService.createActivity(userId, source, dto);
    return { success: true, message: 'Activity logged.', data };
  }
}
