import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { TestPrinterConnectionDto, UpdatePrintingSettingsDto } from './dto/printing.dto';
import { PrintingSettingsService } from './printing-settings.service';

@Controller('admin/printing/settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('printing_generator.view')
export class PrintingSettingsController {
  constructor(private readonly printingSettingsService: PrintingSettingsService) {}

  @Get()
  get() {
    return this.printingSettingsService.get().then((data) => ({
      success: true,
      data,
    }));
  }

  @Patch()
  update(@Body() dto: UpdatePrintingSettingsDto) {
    return this.printingSettingsService.update(dto).then((data) => ({
      success: true,
      message: 'Printing settings updated.',
      data,
    }));
  }

  @Post('test-connection')
  testConnection(@Body() dto: TestPrinterConnectionDto) {
    return this.printingSettingsService.testConnection(dto).then((data) => ({
      success: true,
      message: data.message,
      data,
    }));
  }
}
