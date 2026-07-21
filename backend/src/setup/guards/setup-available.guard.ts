import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SetupService } from '../setup.service';

@Injectable()
export class SetupAvailableGuard implements CanActivate {
  constructor(private readonly setupService: SetupService) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    const available = await this.setupService.isSetupAvailable();

    if (!available) {
      throw new ForbiddenException(
        'Database setup is already complete. The setup API is only available when the database has no application tables.',
      );
    }

    return true;
  }
}
