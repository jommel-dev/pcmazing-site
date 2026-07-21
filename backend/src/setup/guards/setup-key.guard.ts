import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class SetupKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const setupKey = this.configService.get<string>('SETUP_API_KEY')?.trim();

    if (!setupKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.header('x-setup-key')?.trim();

    if (providedKey !== setupKey) {
      throw new UnauthorizedException('Invalid or missing x-setup-key header.');
    }

    return true;
  }
}
