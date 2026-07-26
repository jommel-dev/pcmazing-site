import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { AdminJwtPayload, JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientProspectsService } from './client-prospects.service';
import { CreateClientAppointmentDto } from './dto/create-client-appointment.dto';
import { CreateClientProspectDto } from './dto/create-client-prospect.dto';
import { CreateClientResponseDto } from './dto/create-client-response.dto';
import { UpdateClientProspectDto } from './dto/update-client-prospect.dto';
import { UpdateClientProspectStatusDto } from './dto/update-client-prospect-status.dto';

@Controller('admin/marketing')
@UseGuards(JwtAuthGuard)
export class ClientProspectsController {
  constructor(private readonly clientProspectsService: ClientProspectsService) {}

  @Get('deal-summary')
  getDealSummary(@Req() request: Request & { user?: AdminJwtPayload }) {
    const user = request.user;
    return this.clientProspectsService.getDealSummary(user?.sub ?? 0, user?.role).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('exchange-rate')
  convertDealEstimate(
    @Query('from') from: string,
    @Query('amount') amountRaw: string,
  ) {
    const amount = Number(amountRaw);
    return this.clientProspectsService.convertDealEstimate(from, amount).then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('prospects')
  list(
    @Req() request: Request & { user?: AdminJwtPayload },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const user = request.user;
    return this.clientProspectsService
      .list(user?.sub ?? 0, user?.role, page, limit, search, status)
      .then((result) => ({
        success: true,
        data: result.items,
        meta: result.meta,
        fullAccess: result.fullAccess,
      }));
  }

  @Post('prospects')
  create(@Body() dto: CreateClientProspectDto, @Req() request: Request & { user?: AdminJwtPayload }) {
    return this.clientProspectsService
      .create(dto, request.user?.sub ?? 0, request.user?.role)
      .then((data) => ({
      success: true,
      message: 'Client prospect created.',
      data,
    }));
  }

  @Get('prospects/import/template')
  getImportTemplate(@Res({ passthrough: true }) response: import('express').Response) {
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename="client-prospects-import-template.csv"');
    return this.clientProspectsService.getImportTemplate();
  }

  @Post('prospects/import/preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  previewImportProspects(@UploadedFile() file: Express.Multer.File) {
    const content = file?.buffer?.toString('utf8') ?? '';
    const data = this.clientProspectsService.previewImportFromCsv(content);
    return {
      success: true,
      data: {
        ...data,
        fileName: file?.originalname ?? 'upload.csv',
      },
    };
  }

  @Post('prospects/import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importProspects(
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    const content = file?.buffer?.toString('utf8') ?? '';
    return this.clientProspectsService.importFromCsv(content, request.user?.sub ?? 0).then((data) => ({
      success: true,
      message: `${data.imported} client prospect(s) imported.`,
      data,
    }));
  }

  @Get('prospects/:id')
  getById(@Param('id', ParseIntPipe) id: number, @Req() request: Request & { user?: AdminJwtPayload }) {
    const user = request.user;
    return this.clientProspectsService.getById(id, user?.sub ?? 0, user?.role).then((data) => ({
      success: true,
      data,
    }));
  }

  @Post('prospects/:id/pickup')
  pickup(@Param('id', ParseIntPipe) id: number, @Req() request: Request & { user?: AdminJwtPayload }) {
    const user = request.user;
    return this.clientProspectsService.pickup(id, user?.sub ?? 0, user?.role).then((data) => ({
      success: true,
      message: 'Prospect picked up. Consultation is now in progress.',
      data,
    }));
  }

  @Patch('prospects/:id')
  updateDetails(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientProspectDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    const user = request.user;
    return this.clientProspectsService
      .updateDetails(id, dto, user?.sub ?? 0, user?.role)
      .then((data) => ({
        success: true,
        message: 'Client prospect updated.',
        data,
      }));
  }

  @Patch('prospects/:id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClientProspectStatusDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    const user = request.user;
    return this.clientProspectsService
      .updateStatus(id, dto, user?.sub ?? 0, user?.role)
      .then((data) => ({
        success: true,
        message: 'Prospect progress updated.',
        data,
      }));
  }

  @Post('prospects/:id/responses')
  addResponse(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateClientResponseDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    const user = request.user;
    return this.clientProspectsService.addResponse(id, dto, user?.sub ?? 0, user?.role).then((data) => ({
      success: true,
      message: 'Client response recorded.',
      data,
    }));
  }

  @Get('appointments')
  listAppointments(
    @Req() request: Request & { user?: AdminJwtPayload },
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const user = request.user;
    return this.clientProspectsService
      .listAppointments(user?.sub ?? 0, user?.role, start, end)
      .then((data) => ({
        success: true,
        data,
      }));
  }

  @Get('appointments/conflicts')
  checkConflicts(
    @Req() request: Request & { user?: AdminJwtPayload },
    @Query('startsAt') startsAt: string,
    @Query('endsAt') endsAt: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.clientProspectsService
      .checkAppointmentConflict(
        request.user?.sub ?? 0,
        startsAt,
        endsAt,
        excludeId ? Number(excludeId) : undefined,
      )
      .then((data) => ({
        success: true,
        data,
      }));
  }

  @Post('appointments')
  createAppointment(
    @Body() dto: CreateClientAppointmentDto,
    @Req() request: Request & { user?: AdminJwtPayload },
  ) {
    const user = request.user;
    return this.clientProspectsService.createAppointment(dto, user?.sub ?? 0, user?.role).then((data) => ({
      success: true,
      message: 'Appointment scheduled.',
      data,
    }));
  }
}
