import { IsIn, IsObject, ValidateIf } from 'class-validator';
import { WeeklyLocationSchedule } from '../work-location.util';

export class UpdateEmployeeLocationScheduleDto {
  @IsIn(['pcmazing_admin_users', 'tblusers'])
  userSource!: 'pcmazing_admin_users' | 'tblusers';

  @ValidateIf((_, value) => value !== null)
  @IsObject()
  weeklyLocationSchedule!: WeeklyLocationSchedule | null;
}
