import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { EmployeeMemosService } from './employee-memos.service';
import { PayrollService } from './payroll.service';

@Module({
  imports: [DatabaseModule],
  providers: [PayrollService, EmployeeMemosService],
  exports: [PayrollService, EmployeeMemosService],
})
export class PayrollModule {}
