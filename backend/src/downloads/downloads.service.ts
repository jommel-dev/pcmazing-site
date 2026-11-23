import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { DownloadApkDto } from './downloads.dto';

export type ResolvedApk = {
  absolutePath: string;
  downloadName: string;
  contentType: string;
};

/**
 * Public installer gate for the employee portal.
 * The serial lives in APK_SERIAL_PORTAL and is never sent to the browser bundle.
 */
@Injectable()
export class DownloadsService {
  constructor(private readonly config: ConfigService) {}

  async resolve(dto: DownloadApkDto): Promise<ResolvedApk> {
    const expected = (this.config.get<string>('APK_SERIAL_PORTAL') ?? '').trim();
    if (!expected || !this.serialMatches(dto.serial, expected)) {
      throw new BadRequestException('That serial code is not valid.');
    }
    const absolutePath = await this.findRelease();
    if (!absolutePath) {
      throw new NotFoundException('The release APK is not on the server yet.');
    }
    return {
      absolutePath,
      downloadName: 'MyPeoplePortal.apk',
      contentType: 'application/vnd.android.package-archive',
    };
  }

  private serialMatches(provided: string, expected: string): boolean {
    const left = createHash('sha256').update(provided.trim()).digest();
    const right = createHash('sha256').update(expected).digest();
    return timingSafeEqual(left, right);
  }

  private async findRelease(): Promise<string | null> {
    const override = (this.config.get<string>('APK_PORTAL_PATH') ?? '').trim();
    const candidates = override
      ? [override]
      : [
          path.join(process.cwd(), 'downloads', 'portal.apk'),
          path.join(
            process.cwd(),
            '..',
            'portal-app',
            'androidApp',
            'build',
            'outputs',
            'apk',
            'release',
          ),
        ];

    let newest: { file: string; mtimeMs: number } | null = null;
    for (const candidate of candidates) {
      const info = await stat(candidate).catch(() => null);
      if (!info) {
        continue;
      }
      if (info.isFile()) {
        if (!newest || info.mtimeMs > newest.mtimeMs) {
          newest = { file: candidate, mtimeMs: info.mtimeMs };
        }
        continue;
      }
      if (!info.isDirectory()) {
        continue;
      }
      const names = await readdir(candidate).catch(() => [] as string[]);
      for (const name of names) {
        if (!name.toLowerCase().endsWith('.apk')) {
          continue;
        }
        const file = path.join(candidate, name);
        const fileInfo = await stat(file).catch(() => null);
        if (fileInfo?.isFile() && (!newest || fileInfo.mtimeMs > newest.mtimeMs)) {
          newest = { file, mtimeMs: fileInfo.mtimeMs };
        }
      }
    }
    return newest?.file ?? null;
  }
}
