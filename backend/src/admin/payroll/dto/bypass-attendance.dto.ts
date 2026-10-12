import { BypassAction } from '../attendance-lunch.util';

export class BypassAttendanceDto {
  userId!: number;
  userSource!: 'tblusers' | 'pcmazing_admin_users';
  workDate!: string;
  action!: BypassAction;
  at?: string | null;
}
