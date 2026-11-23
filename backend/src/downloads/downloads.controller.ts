import { Body, Controller, Post, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { DownloadApkDto } from './downloads.dto';
import { DownloadsService } from './downloads.service';

/** Public APK download. No sign-in; the serial is checked before any bytes are sent. */
@Controller('downloads')
export class DownloadsController {
  constructor(private readonly downloads: DownloadsService) {}

  @Post('apk')
  async apk(@Body() dto: DownloadApkDto): Promise<StreamableFile> {
    const file = await this.downloads.resolve(dto);
    return new StreamableFile(createReadStream(file.absolutePath), {
      type: file.contentType,
      disposition: `attachment; filename="${file.downloadName}"`,
    });
  }
}
