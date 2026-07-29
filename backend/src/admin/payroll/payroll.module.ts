import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PayrollService } from './payroll.service';

@Module({
  imports: [DatabaseModule],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
