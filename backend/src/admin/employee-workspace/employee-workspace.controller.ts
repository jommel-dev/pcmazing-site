import {
  BadRequestException,
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
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
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

  @Get('payslips/:id')
  async payslipDetail(
    @Req() req: Request & { user?: AdminJwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const { userId, source } = this.actor(req);
    const data = await this.workspaceService.getPayslipDetail(userId, source, id);
    return { success: true, data };
  }

  @Get('payslips/:id/pdf')
  async payslipPdf(
    @Req() req: Request & { user?: AdminJwtPayload },
    @Param('id', ParseIntPipe) id: number,
    @Query('download') download?: string,
  ) {
    const { userId, source } = this.actor(req);
    const { filename, buffer } = await this.workspaceService.getPayslipPdf(userId, source, id);
    const forceDownload = download === '1' || download === 'true';
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `${forceDownload ? 'attachment' : 'inline'}; filename="${filename}"`,
    });
  }

  @Post('overtime/:id/request')
  async requestOvertime(
    @Req() req: Request & { user?: AdminJwtPayload },
    @Param('id', ParseIntPipe) id: number,
  ) {
    const { userId, source } = this.actor(req);
    const data = await this.workspaceService.requestOvertime(userId, source, id);
    return { success: true, message: data.message, data };
  }

  @Post('attendance/:id/request-time-out')
  @UseInterceptors(
    FileInterceptor('selfie', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  async requestTimeOutAdjustment(
    @Req() req: Request & { user?: AdminJwtPayload },
    @Param('id', ParseIntPipe) id: number,
    @Body('requestedTimeOut') requestedTimeOut: string,
    @Body('note') note: string,
    @Body('undertimeCategory') undertimeCategory: string,
    @UploadedFile() selfie?: Express.Multer.File,
  ) {
    const { userId, source } = this.actor(req);
    if (!selfie) {
      throw new BadRequestException('Upload a time-out photo before submitting.');
    }
    if (!requestedTimeOut?.trim()) {
      throw new BadRequestException('Enter the time you actually left.');
    }
    if (!note?.trim()) {
      throw new BadRequestException('Explain why you missed clocking out.');
    }
    const data = await this.workspaceService.requestTimeOutAdjustment(
      userId,
      source,
      id,
      selfie,
      requestedTimeOut,
      note,
      undertimeCategory,
    );
    return { success: true, message: data.message, data };
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
