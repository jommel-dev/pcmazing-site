import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PayrollService } from './payroll.service';

/** Public time clock — no admin auth. Punches use database NOW(), never device time. */
@Controller('payroll/time-clock')
export class TimeClockController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('now')
  now() {
    return this.payrollService.getServerClock().then((data) => ({
      success: true,
      data,
    }));
  }

  @Get('status')
  async status(@Query('username') username?: string) {
    const value = username?.trim();
    if (!value) {
      const clock = await this.payrollService.getServerClock();
      return {
        success: true,
        data: {
          username: '',
          fullName: '',
          employeeCode: null,
          workDate: clock.workDate,
          timeIn: null,
          timeOut: null,
          canTimeIn: false,
          canTimeOut: false,
          status: 'not_found',
          message: 'Enter a username to continue.',
          serverNow: clock.serverNow,
        },
      };
    }

    return this.payrollService.getTimeClockStatus(value).then((data) => ({
      success: true,
      data,
    }));
  }

  @Post('time-in')
  @UseInterceptors(
    FileInterceptor('selfie', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  timeIn(@Body('username') username: string, @UploadedFile() selfie?: Express.Multer.File) {
    const value = username?.trim();
    if (!value) {
      throw new BadRequestException('Username is required.');
    }
    if (!selfie) {
      throw new BadRequestException('Selfie photo is required before time in.');
    }

    return this.payrollService.timeIn(value, selfie).then((data) => ({
      success: true,
      message: 'Time in recorded.',
      data,
    }));
  }

  @Post('time-out')
  @UseInterceptors(
    FileInterceptor('selfie', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  timeOut(@Body('username') username: string, @UploadedFile() selfie?: Express.Multer.File) {
    const value = username?.trim();
    if (!value) {
      throw new BadRequestException('Username is required.');
    }
    if (!selfie) {
      throw new BadRequestException('Selfie photo is required before time out.');
    }

    return this.payrollService.timeOut(value, selfie).then((data) => ({
      success: true,
      message: 'Time out recorded.',
      data,
    }));
  }
}
