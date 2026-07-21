import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export interface AdminJwtPayload {
  sub: number;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  source: 'tblusers' | 'pcmazing_admin_users';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AdminJwtPayload }>();
    const header = request.header('authorization');

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header.');
    }

    const token = header.slice('Bearer '.length).trim();

    try {
      request.user = this.jwtService.verify<AdminJwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired session.');
    }
  }
}
