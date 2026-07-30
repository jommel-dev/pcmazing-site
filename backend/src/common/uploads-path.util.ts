import { existsSync, mkdirSync } from 'node:fs';
import { join, relative as pathRelative, resolve, sep } from 'node:path';

/**
 * Absolute directory for local file uploads.
 * Prefer UPLOADS_DIR in production so files live on a persistent volume
 * (process.cwd()/uploads is wiped on many PaaS redeploys).
 */
export function getUploadsRoot(): string {
  const configured = process.env.UPLOADS_DIR?.trim();
  if (configured) {
    return resolve(configured);
  }
  return resolve(process.cwd(), 'uploads');
}

export function getUploadSubdir(...parts: string[]): string {
  return join(getUploadsRoot(), ...parts);
}

/** Map a public URL like `/uploads/foo/bar.jpg` to an absolute disk path. */
export function resolveUploadDiskPath(publicUrl: string): string {
  const normalized = publicUrl.replace(/\\/g, '/').trim();
  const relativePath = normalized.startsWith('/uploads/')
    ? normalized.slice('/uploads/'.length)
    : normalized.replace(/^\/+/, '');

  const root = getUploadsRoot();
  const absolute = resolve(root, relativePath);
  const fromRoot = pathRelative(root, absolute);

  if (fromRoot.startsWith(`..${sep}`) || fromRoot === '..') {
    throw new Error('Invalid upload path.');
  }

  return absolute;
}

export function ensureUploadsRoot(): string {
  const root = getUploadsRoot();
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  return root;
}

export function toPublicUploadUrl(...parts: string[]): string {
  const cleaned = parts.map((part) => part.replace(/^\/+|\/+$/g, '')).filter(Boolean);
  return `/uploads/${cleaned.join('/')}`;
}

export function isUnderUploadsUrl(publicUrl: string | null | undefined, subdir: string): boolean {
  if (!publicUrl) {
    return false;
  }
  const prefix = `${toPublicUploadUrl(subdir)}/`;
  return publicUrl.replace(/\\/g, '/').startsWith(prefix);
}
