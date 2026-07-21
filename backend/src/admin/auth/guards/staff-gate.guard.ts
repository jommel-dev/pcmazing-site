import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface StaffGatePayload {
  type: 'staff_gate';
}

@Injectable()
export class StaffGateGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.header('x-staff-gate')?.trim();

    if (!header) {
      throw new ForbiddenException('Staff access verification is required.');
    }

    try {
      const payload = this.jwtService.verify<StaffGatePayload>(header);

      if (payload.type !== 'staff_gate') {
        throw new ForbiddenException('Invalid staff access token.');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new ForbiddenException('Staff access verification expired or invalid.');
    }
  }
}
