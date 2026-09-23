export interface AdminUserPayrollProfile {
  employeeCode: string | null;
  department: string | null;
  positionTitle: string | null;
  salaryType: 'weekly' | 'semi_monthly' | 'monthly' | 'cutoff';
  monthlySalary: number | null;
  fixedMonthlySalary: number | null;
  payoutMethod: 'cash' | 'online';
  bankDetails: string | null;
  qrImageUrl: string | null;
  payrollEnabled: boolean;
  weeklyLocationSchedule?: Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', 'office' | 'wfh' | 'off'> | null;
}

export interface AdminUserRecord {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  profileImageUrl: string | null;
  isActive: boolean;
  source: 'pcmazing_admin_users' | 'tblusers';
  readOnly: boolean;
  createdAt: string;
  updatedAt: string;
  employeeCode?: string | null;
  department?: string | null;
  positionTitle?: string | null;
  salaryType?: 'weekly' | 'semi_monthly' | 'monthly' | 'cutoff';
  monthlySalary?: number | null;
  wfhSalary?: number | null;
  fixedMonthlySalary?: number | null;
  payoutMethod?: 'cash' | 'online';
  bankDetails?: string | null;
  qrImageUrl?: string | null;
  payrollEnabled?: boolean;
  weeklyLocationSchedule?: Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', 'office' | 'wfh' | 'off'> | null;
}

export type UserStore = 'tblusers' | 'pcmazing_admin_users';
