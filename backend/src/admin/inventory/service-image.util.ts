import { BadRequestException } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  getUploadSubdir,
  isUnderUploadsUrl,
  resolveUploadDiskPath,
  toPublicUploadUrl,
} from '../../common/uploads-path.util';

const UPLOAD_SUBDIR = 'service-images';
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE = 2 * 1024 * 1024;

export async function saveServiceImageFile(
  serviceId: number,
  file: Express.Multer.File,
): Promise<string> {
  if (!file) {
    throw new BadRequestException('Service image file is required.');
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new BadRequestException('Service image must be JPEG, PNG, WEBP, or GIF.');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestException('Service image must be 2MB or smaller.');
  }

  const extension = normalizeExtension(extname(file.originalname));
  const uploadDir = getUploadSubdir(UPLOAD_SUBDIR);
  await mkdir(uploadDir, { recursive: true });

  const filename = `service-${serviceId}-${Date.now()}${extension}`;
  await writeFile(join(uploadDir, filename), file.buffer);

  return toPublicUploadUrl(UPLOAD_SUBDIR, filename);
}

export async function deleteServiceImageFile(imageUrl: string | null | undefined): Promise<void> {
  if (!isUnderUploadsUrl(imageUrl, UPLOAD_SUBDIR)) {
    return;
  }

  try {
    await unlink(resolveUploadDiskPath(imageUrl!));
  } catch {
    // Ignore missing files during cleanup.
  }
}

function normalizeExtension(extension: string): string {
  const value = extension.toLowerCase();
  if (value === '.jpeg') {
    return '.jpg';
  }

  if (ALLOWED_EXTENSIONS.has(value)) {
    return value;
  }

  return '.jpg';
}
