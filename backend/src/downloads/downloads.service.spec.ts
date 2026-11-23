import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DownloadsService } from './downloads.service';

describe('DownloadsService', () => {
  it('rejects an unknown serial before looking for a file', async () => {
    const service = new DownloadsService(config({ APK_SERIAL_PORTAL: 'PCM-PORTAL' }));
    await expect(service.resolve({ app: 'portal', serial: 'wrong-code' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects every serial when the code is not configured', async () => {
    const service = new DownloadsService(config({}));
    await expect(service.resolve({ app: 'portal', serial: 'PCM-PORTAL' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns the portal APK only for the employee serial', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'pcm-apk-'));
    const file = path.join(dir, 'portal.apk');
    await writeFile(file, 'apk-bytes');
    const service = new DownloadsService(
      config({ APK_SERIAL_PORTAL: 'PCM-PORTAL', APK_PORTAL_PATH: file }),
    );
    await expect(service.resolve({ app: 'portal', serial: ' PCM-PORTAL ' })).resolves.toEqual({
      absolutePath: file,
      downloadName: 'MyPeoplePortal.apk',
      contentType: 'application/vnd.android.package-archive',
    });
  });

  it('says the file is missing only after the serial matches', async () => {
    const service = new DownloadsService(
      config({
        APK_SERIAL_PORTAL: 'PCM-PORTAL',
        APK_PORTAL_PATH: path.join(tmpdir(), 'missing-portal.apk'),
      }),
    );
    await expect(service.resolve({ app: 'portal', serial: 'PCM-PORTAL' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}
