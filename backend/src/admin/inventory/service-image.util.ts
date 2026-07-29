import { BadRequestException } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'service-images');
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
  await mkdir(UPLOAD_DIR, { recursive: true });

  const filename = `service-${serviceId}-${Date.now()}${extension}`;
  await writeFile(join(UPLOAD_DIR, filename), file.buffer);

  return `/uploads/service-images/${filename}`;
}

export async function deleteServiceImageFile(imageUrl: string | null | undefined): Promise<void> {
  if (!imageUrl?.startsWith('/uploads/service-images/')) {
    return;
  }

  try {
    await unlink(join(process.cwd(), imageUrl));
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
