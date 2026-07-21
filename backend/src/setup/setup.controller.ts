import {
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SetupAvailableGuard } from './guards/setup-available.guard';
import { SetupKeyGuard } from './guards/setup-key.guard';
import { SetupService } from './setup.service';

@Controller('setup')
@UseGuards(SetupKeyGuard)
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  getStatus() {
    return this.setupService.getStatus().then((status) => ({
      success: true,
      data: status,
    }));
  }

  @Get('migrations')
  @UseGuards(SetupAvailableGuard)
  listMigrations() {
    return this.setupService.listMigrations().then((migrations) => ({
      success: true,
      data: migrations,
    }));
  }

  @Get('migrate/progress')
  getProgress() {
    return {
      success: true,
      data: this.setupService.getProgress(),
    };
  }

  @Post('migrate')
  @UseGuards(SetupAvailableGuard)
  runBundledMigrations(@Query('force') force?: string) {
    const allowForce = force === 'true' || force === '1';
    return this.setupService.runBundledMigrations(allowForce);
  }

  @Post('migrate/upload')
  @UseGuards(SetupAvailableGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 500 * 1024 * 1024 },
    }),
  )
  uploadMigration(
    @UploadedFile() file: Express.Multer.File,
    @Query('force') force?: string,
    @Query('disableFkChecks') disableFkChecks?: string,
  ) {
    return this.setupService.runUploadedMigration(file, {
      force: force === 'true' || force === '1',
      disableForeignKeyChecks: disableFkChecks !== 'false' && disableFkChecks !== '0',
    });
  }
}
