export interface AdminUserPayrollProfile {
  employeeCode: string | null;
  department: string | null;
  positionTitle: string | null;
  salaryType: 'weekly' | 'semi_monthly' | 'monthly' | 'cutoff';
  monthlySalary: number | null;
  payrollEnabled: boolean;
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
  payrollEnabled?: boolean;
}

export type UserStore = 'tblusers' | 'pcmazing_admin_users';
