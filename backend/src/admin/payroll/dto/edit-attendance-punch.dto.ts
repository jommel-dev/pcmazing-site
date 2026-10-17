export class EditAttendancePunchDto {
  timeIn?: string | null;
  lunchOut?: string | null;
  lunchIn?: string | null;
  timeOut?: string | null;
  reason!: string;
}
