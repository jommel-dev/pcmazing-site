export const EXPENSE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const EXPENSE_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const EXPENSE_FILE_MIME_TYPES = new Set([
  ...EXPENSE_IMAGE_MIME_TYPES,
  'application/pdf',
]);

export type PendingExpenseAttachment = {
  id: string;
  file: File;
  previewUrl: string | null;
  isImage: boolean;
};

export type PendingExpenseAttachmentAddResult = {
  items: PendingExpenseAttachment[];
  errors: string[];
};

function fileIdentity(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}::${file.type}`;
}

function looksLikeImageFileName(name: string): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(name || '');
}

function looksLikePdfFileName(name: string): boolean {
  return /\.pdf$/i.test(name || '');
}

export function isExpenseImageFile(file: File): boolean {
  if (EXPENSE_IMAGE_MIME_TYPES.has(file.type)) {
    return true;
  }
  if (!file.type || file.type === 'application/octet-stream') {
    return looksLikeImageFileName(file.name || '');
  }
  return false;
}

export function isAllowedExpenseAttachment(file: File): boolean {
  if (EXPENSE_FILE_MIME_TYPES.has(file.type)) {
    return true;
  }
  if (!file.type || file.type === 'application/octet-stream') {
    return looksLikeImageFileName(file.name || '') || looksLikePdfFileName(file.name || '');
  }
  return false;
}

export function validateExpenseAttachment(file: File): string | null {
  if (!isAllowedExpenseAttachment(file)) {
    return `"${file.name || 'file'}" must be JPEG, PNG, WebP, GIF, or PDF.`;
  }
  if (file.size > EXPENSE_ATTACHMENT_MAX_BYTES) {
    return `"${file.name || 'file'}" must be 10MB or smaller.`;
  }
  return null;
}

export function createPendingExpenseAttachment(file: File): PendingExpenseAttachment {
  const isImage = isExpenseImageFile(file);
  return {
    id: `${fileIdentity(file)}-${Math.random().toString(36).slice(2, 10)}`,
    file,
    previewUrl: isImage ? URL.createObjectURL(file) : null,
    isImage,
  };
}

export function revokePendingExpenseAttachment(item: PendingExpenseAttachment): void {
  if (item.previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

export function revokePendingExpenseAttachments(items: PendingExpenseAttachment[]): void {
  for (const item of items) {
    revokePendingExpenseAttachment(item);
  }
}

export function addPendingExpenseAttachments(
  existing: PendingExpenseAttachment[],
  files: Iterable<File>,
): PendingExpenseAttachmentAddResult {
  const seen = new Set(existing.map((item) => fileIdentity(item.file)));
  const items = [...existing];
  const errors: string[] = [];

  for (const file of files) {
    const validationError = validateExpenseAttachment(file);
    if (validationError) {
      errors.push(validationError);
      continue;
    }

    const identity = fileIdentity(file);
    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    items.push(createPendingExpenseAttachment(file));
  }

  return { items, errors };
}

export function removePendingExpenseAttachment(
  existing: PendingExpenseAttachment[],
  id: string,
): PendingExpenseAttachment[] {
  const next: PendingExpenseAttachment[] = [];
  for (const item of existing) {
    if (item.id === id) {
      revokePendingExpenseAttachment(item);
      continue;
    }
    next.push(item);
  }
  return next;
}

export function extractImageFilesFromClipboard(event: ClipboardEvent): File[] {
  const items = event.clipboardData?.items;
  if (!items?.length) {
    return [];
  }

  const files: File[] = [];
  for (const item of Array.from(items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) {
      continue;
    }
    const file = item.getAsFile();
    if (file) {
      files.push(file);
    }
  }
  return files;
}

export function extractFilesFromDataTransfer(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) {
    return [];
  }

  const collected: File[] = [];
  const pushIfAllowed = (file: File | null) => {
    if (!file) {
      return;
    }
    if (
      file.type.startsWith('image/') ||
      file.type === 'application/pdf' ||
      isAllowedExpenseAttachment(file)
    ) {
      collected.push(file);
    }
  };

  if (dataTransfer.files?.length) {
    for (const file of Array.from(dataTransfer.files)) {
      pushIfAllowed(file);
    }
    return collected;
  }

  const items = dataTransfer.items;
  if (!items?.length) {
    return [];
  }
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') {
      continue;
    }
    pushIfAllowed(item.getAsFile());
  }
  return collected;
}

export function dataTransferHasOsFiles(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) {
    return false;
  }
  const types = dataTransfer.types ? Array.from(dataTransfer.types) : [];
  if (types.includes('Files')) {
    return true;
  }
  return (dataTransfer.files?.length ?? 0) > 0 || (dataTransfer.items?.length ?? 0) > 0;
}
