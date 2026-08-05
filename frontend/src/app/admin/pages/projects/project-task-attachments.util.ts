export const PROJECT_TASK_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const PROJECT_TASK_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export type PendingTaskAttachment = {
  id: string;
  file: File;
  previewUrl: string;
};

export type PendingAttachmentAddResult = {
  items: PendingTaskAttachment[];
  errors: string[];
};

function fileIdentity(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}::${file.type}`;
}

export function isAllowedProjectTaskImage(file: File): boolean {
  if (PROJECT_TASK_IMAGE_MIME_TYPES.has(file.type)) {
    return true;
  }
  // Some OS drops omit MIME; fall back to extension.
  if (!file.type || file.type === 'application/octet-stream') {
    return /\.(jpe?g|png|webp|gif)$/i.test(file.name || '');
  }
  return false;
}

export function validateProjectTaskImage(file: File): string | null {
  if (!isAllowedProjectTaskImage(file)) {
    return `"${file.name || 'image'}" must be JPEG, PNG, WebP, or GIF.`;
  }
  if (file.size > PROJECT_TASK_IMAGE_MAX_BYTES) {
    return `"${file.name || 'image'}" must be 10MB or smaller.`;
  }
  return null;
}

/**
 * Queue the original File bytes as-is (no canvas resize/compress/re-encode).
 * Preview is a blob URL over the same File — upload still uses `file`.
 */
export function createPendingTaskAttachment(file: File): PendingTaskAttachment {
  return {
    id: `${fileIdentity(file)}-${Math.random().toString(36).slice(2, 10)}`,
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

export function revokePendingTaskAttachment(item: PendingTaskAttachment): void {
  if (item.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

export function revokePendingTaskAttachments(items: PendingTaskAttachment[]): void {
  for (const item of items) {
    revokePendingTaskAttachment(item);
  }
}

/** Merge new files into the queue: validate, skip duplicates, create previews. */
export function addPendingTaskAttachments(
  existing: PendingTaskAttachment[],
  files: Iterable<File>,
): PendingAttachmentAddResult {
  const seen = new Set(existing.map((item) => fileIdentity(item.file)));
  const items = [...existing];
  const errors: string[] = [];

  for (const file of files) {
    const validationError = validateProjectTaskImage(file);
    if (validationError) {
      errors.push(validationError);
      continue;
    }

    const identity = fileIdentity(file);
    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    items.push(createPendingTaskAttachment(file));
  }

  return { items, errors };
}

export function removePendingTaskAttachment(
  existing: PendingTaskAttachment[],
  id: string,
): PendingTaskAttachment[] {
  const next: PendingTaskAttachment[] = [];
  for (const item of existing) {
    if (item.id === id) {
      revokePendingTaskAttachment(item);
      continue;
    }
    next.push(item);
  }
  return next;
}

/** Move `fromId` so it lands at the index currently occupied by `toId`. */
export function reorderPendingTaskAttachments(
  existing: PendingTaskAttachment[],
  fromId: string,
  toId: string,
): PendingTaskAttachment[] {
  if (fromId === toId) {
    return existing;
  }
  const fromIndex = existing.findIndex((item) => item.id === fromId);
  const toIndex = existing.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < 0) {
    return existing;
  }
  const next = [...existing];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
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

/** Collect image files from an OS/file-manager drag-and-drop DataTransfer. */
export function extractImageFilesFromDataTransfer(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) {
    return [];
  }

  const collected: File[] = [];
  const pushIfImage = (file: File | null) => {
    if (!file) {
      return;
    }
    if (file.type.startsWith('image/') || isAllowedProjectTaskImage(file) || looksLikeImageFileName(file.name)) {
      collected.push(file);
    }
  };

  if (dataTransfer.files?.length) {
    for (const file of Array.from(dataTransfer.files)) {
      pushIfImage(file);
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
    pushIfImage(item.getAsFile());
  }
  return collected;
}

/**
 * During dragover, browsers often hide file MIME types.
 * Accept any OS file drag (`Files` type) so drop can be enabled.
 */
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

export function dataTransferHasImageFiles(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) {
    return false;
  }
  if (dataTransfer.files?.length) {
    return Array.from(dataTransfer.files).some(
      (file) => file.type.startsWith('image/') || looksLikeImageFileName(file.name),
    );
  }
  const items = dataTransfer.items;
  if (!items?.length) {
    return dataTransferHasOsFiles(dataTransfer);
  }
  return Array.from(items).some(
    (item) =>
      item.kind === 'file' &&
      (item.type.startsWith('image/') || item.type === '' || item.type === 'application/octet-stream'),
  );
}

function looksLikeImageFileName(name: string): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(name || '');
}
