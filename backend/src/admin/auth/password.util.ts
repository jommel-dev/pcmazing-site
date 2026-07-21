import { createHash } from 'crypto';

/** Same hashing used by 3BMA `tblusers.password`. */
export function hashPasswordSha1(password: string): string {
  return createHash('sha1').update(password).digest('hex');
}

export function sha1PasswordVariants(password: string): string[] {
  const hex = hashPasswordSha1(password);
  const upper = hex.toUpperCase();

  return hex === upper ? [hex] : [hex, upper];
}
