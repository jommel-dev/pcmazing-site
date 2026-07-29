import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ContractSigningController } from './contract-signing.controller';
import { ContractSigningService } from './contract-signing.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ContractSigningController],
  providers: [ContractSigningService],
  exports: [ContractSigningService],
})
export class ContractsModule {}
