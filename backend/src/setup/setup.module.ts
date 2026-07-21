import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SetupAvailableGuard } from './guards/setup-available.guard';
import { SetupKeyGuard } from './guards/setup-key.guard';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SetupController],
  providers: [SetupService, SetupKeyGuard, SetupAvailableGuard],
})
export class SetupModule {}
