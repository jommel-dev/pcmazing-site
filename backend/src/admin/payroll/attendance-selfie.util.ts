import { BadRequestException } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  getUploadSubdir,
  isUnderUploadsUrl,
  resolveUploadDiskPath,
  toPublicUploadUrl,
} from '../../common/uploads-path.util';

const UPLOAD_SUBDIR = 'attendance-selfies';
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 2 * 1024 * 1024;

export async function saveAttendanceSelfieFile(
  kind: 'in' | 'out',
  username: string,
  file: Express.Multer.File,
): Promise<string> {
  if (!file) {
    throw new BadRequestException('Selfie photo is required.');
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new BadRequestException('Selfie must be JPEG, PNG, or WEBP.');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestException('Selfie must be 2MB or smaller.');
  }

  const safeUser = username.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'user';
  const extension = normalizeExtension(extname(file.originalname), file.mimetype);
  const uploadDir = getUploadSubdir(UPLOAD_SUBDIR);
  await mkdir(uploadDir, { recursive: true });

  const filename = `${kind}-${safeUser}-${Date.now()}${extension}`;
  await writeFile(join(uploadDir, filename), file.buffer);

  return toPublicUploadUrl(UPLOAD_SUBDIR, filename);
}

export async function deleteAttendanceSelfieFile(imageUrl: string | null | undefined): Promise<void> {
  if (!isUnderUploadsUrl(imageUrl, UPLOAD_SUBDIR)) {
    return;
  }

  try {
    await unlink(resolveUploadDiskPath(imageUrl!));
  } catch {
    // Ignore missing files during cleanup.
  }
}

function normalizeExtension(extension: string, mimeType: string): string {
  const value = extension.toLowerCase();
  if (value === '.jpeg' || value === '.jpg') {
    return '.jpg';
  }
  if (value === '.png' || value === '.webp') {
    return value;
  }

  if (mimeType === 'image/png') {
    return '.png';
  }
  if (mimeType === 'image/webp') {
    return '.webp';
  }

  return '.jpg';
}
