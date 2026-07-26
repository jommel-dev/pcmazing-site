import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AdminJwtPayload } from '../auth/guards/jwt-auth.guard';
import { RbacService } from './rbac.service';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.rbacService.isEnabled()) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AdminJwtPayload }>();
    const role = request.user?.role?.trim().toLowerCase();

    if (!role || !requiredRoles.some((item) => item.toLowerCase() === role)) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }

    return true;
  }
}
