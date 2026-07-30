import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BUSINESS_ROLE_LABELS } from './admin-roles.util';

/** Placeholder roles until RBAC permissions are finalized. */
export const PLACEHOLDER_ROLES = [...BUSINESS_ROLE_LABELS] as const;

@Injectable()
export class RbacService {
  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.parseBoolean(this.configService.get<string>('RBAC_ENABLED'), false);
  }

  listRoles(): string[] {
    return [...PLACEHOLDER_ROLES];
  }

  private parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined || value === null || value.trim() === '') {
      return fallback;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
}
