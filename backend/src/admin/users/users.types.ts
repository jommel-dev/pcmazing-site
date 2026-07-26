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
}

export type UserStore = 'tblusers' | 'pcmazing_admin_users';
