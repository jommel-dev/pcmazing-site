import { BadRequestException } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'project-task-files');
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const FILE_MIME = new Set([
  ...IMAGE_MIME,
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
]);

export async function saveProjectTaskAttachmentFile(
  taskId: number,
  file: Express.Multer.File,
): Promise<{ fileUrl: string; kind: 'screenshot' | 'file' }> {
  if (!file) {
    throw new BadRequestException('Attachment file is required.');
  }

  if (!FILE_MIME.has(file.mimetype)) {
    throw new BadRequestException(
      'Unsupported file type. Use images, PDF, Office docs, CSV, TXT, or ZIP.',
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestException('Attachment must be 10MB or smaller.');
  }

  const extension = normalizeExtension(extname(file.originalname), file.mimetype);
  await mkdir(UPLOAD_DIR, { recursive: true });

  const filename = `task-${taskId}-${Date.now()}${extension}`;
  await writeFile(join(UPLOAD_DIR, filename), file.buffer);

  return {
    fileUrl: `/uploads/project-task-files/${filename}`,
    kind: IMAGE_MIME.has(file.mimetype) ? 'screenshot' : 'file',
  };
}

export async function deleteProjectTaskAttachmentFile(
  fileUrl: string | null | undefined,
): Promise<void> {
  if (!fileUrl?.startsWith('/uploads/project-task-files/')) {
    return;
  }

  try {
    await unlink(join(process.cwd(), fileUrl));
  } catch {
    // Ignore missing files during cleanup.
  }
}

function normalizeExtension(extension: string, mimeType: string): string {
  const value = extension.toLowerCase();
  if (value === '.jpeg') {
    return '.jpg';
  }
  if (value && value.length <= 8) {
    return value;
  }
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'application/pdf') return '.pdf';
  return '.bin';
}
