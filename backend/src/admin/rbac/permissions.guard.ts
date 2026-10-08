import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AdminJwtPayload } from '../auth/guards/jwt-auth.guard';
import { isSuperAdmin } from './admin-roles.util';
import { hasPermission } from './permission.util';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { RbacService } from './rbac.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.rbacService.isEnabled()) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AdminJwtPayload }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }

    if (isSuperAdmin(user.role)) {
      return true;
    }

    const roleId = user.roleId ?? (await this.rbacService.resolveRoleIdByName(user.role));
    const { permissionKeys } = await this.rbacService.resolveAuthAccess(user.role, roleId);
    if (!hasPermission(permissionKeys, required)) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }

    return true;
  }
}
