import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { APP_CONFIG } from '../../core/config/app-config';
import { DashboardOverview, DashboardPeriod } from '../data/dashboard.types';
import { AdminAuthService } from './admin-auth.service';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ListResponse<T> {
  success: boolean;
  data: T[];
  meta: PaginationMeta;
}

interface ItemResponse<T> {
  success: boolean;
  data: T;
}

export interface ContactInquiry {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  serviceInterest: string;
  message: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerReview {
  id: number;
  fullName: string;
  email: string | null;
  company: string | null;
  rating: number;
  title: string | null;
  message: string;
  status: string;
  isPublished: boolean;
  publishedAt: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DemoRequest {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  company: string | null;
  serviceInterest: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  message: string | null;
  status: string;
  followUpNotes: string | null;
  followedUpAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialItem {
  id: number;
  materialCode: string | null;
  materialName: string;
  brandName: string | null;
  brandId?: number | null;
  productTypeId?: number | null;
  productTypeName?: string | null;
  unit: string | null;
  unitPrice: number | null;
  orderCost: number | null;
  sellPrice: number | null;
  onHandStock: number | null;
  reorderLevel: number | null;
  imageUrl?: string | null;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface InventoryStockSummary {
  totalCost: number;
  totalPrice: number;
  totalMargin: number;
  totalStockValue: number;
  itemCount: number;
}

export interface InventoryServiceSummary {
  totalCosting: number;
  totalSales: number;
  totalLaborSales: number;
  totalPartsCost: number;
  itemCount: number;
}

export interface InventoryServiceFilterOption {
  label: string;
  count: number;
}

export interface InventoryServiceItem {
  id: number;
  referenceNo: string | null;
  customerName: string;
  serviceName: string;
  personInChargeUserId: number | null;
  personInChargeSource: 'tblusers' | 'pcmazing_admin_users';
  personInChargeName: string | null;
  type: string;
  partsUsed: string[];
  cost: number;
  labor: number;
  status: string;
  imageUrl: string | null;
  totalCosting: number;
  totalSales: number;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  notes?: string | null;
  laborDiscountType?: 'none' | 'senior' | 'pwd';
  parts?: Array<{
    materialId?: number;
    materialName?: string | null;
    materialCode?: string | null;
    description?: string | null;
    customItemName?: string;
    quantity: number;
    unitPrice?: number;
    labor?: number;
    discountType?: 'none' | 'senior' | 'pwd';
  }>;
  updatedAt: string | null;
}

export interface CreateInventoryServicePayload {
  customerName: string;
  serviceName: string;
  personInChargeUserId?: number;
  personInChargeSource?: 'tblusers' | 'pcmazing_admin_users';
  type: string;
  parts?: Array<{
    materialId?: number;
    customItemName?: string;
    quantity: number;
    unitPrice?: number;
    labor?: number;
    discountType?: 'none' | 'senior' | 'pwd';
  }>;
  cost?: number;
  labor?: number;
  laborDiscountType?: 'none' | 'senior' | 'pwd';
  status?: string;
  notes?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface ServiceTypeItem {
  id: number;
  name: string;
  description: string | null;
  laborPrice: number;
  usageCount: number;
  totalLaborCollected: number;
  isActive: boolean;
  updatedAt: string | null;
}

export interface InventoryTreeNode {
  id: number;
  name: string;
  type: 'product-type' | 'brand';
  materialCount: number;
  children?: InventoryTreeNode[];
}

export interface InventoryOption {
  id: number;
  name: string;
  productTypeId?: number | null;
}

export interface CreateMaterialPayload {
  materialName: string;
  materialCode?: string;
  description?: string;
  brandId?: number;
  brandName?: string;
  productTypeId?: number;
  productTypeName?: string;
  unit?: string;
  unitPrice?: number;
  orderCost?: number;
  sellPrice?: number;
  onHandStock?: number;
  reorderLevel?: number;
}

export interface UpdateMaterialPayload {
  materialName?: string;
  materialCode?: string;
  description?: string;
  brandId?: number;
  brandName?: string;
  productTypeId?: number;
  productTypeName?: string;
  unit?: string;
  unitPrice?: number;
  orderCost?: number;
  sellPrice?: number;
  onHandStock?: number;
  reorderLevel?: number;
}

export interface PurchaseListItem {
  id: number;
  poNumber: string | null;
  vendorName: string | null;
  totalAmount: number | null;
  status: string | null;
  poType: string | null;
  createdAt: string | null;
}

export interface PurchaseLineItem {
  id: number;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
}

export interface PurchaseDetail extends PurchaseListItem {
  vendorId: string | null;
  branchId: number | null;
  items: PurchaseLineItem[];
}

export interface PurchaseVendorOption {
  id: string;
  name: string;
}

export interface CreatePurchasePayload {
  vendorId?: string;
  vendorName?: string;
  poType?: string;
  status?: string;
  branchId?: number;
  remarks?: string;
  items: Array<{
    materialId: number;
    quantity: number;
    unitPrice: number;
    discountPrice?: number;
  }>;
  payments?: Array<{
    method: string;
    amount?: number;
    paymentDate?: string;
    status?: string;
  }>;
}

export interface QuotationListItem {
  id: number;
  quoteNo: string | null;
  quoteDate: string | null;
  customerName: string | null;
  totalAmount: number | null;
  status: string | null;
  expiresAt: string | null;
  convertedSalesId: number | null;
  createdAt: string | null;
}

export interface QuotationDetail extends QuotationListItem {
  customerAddress?: string | null;
  customerContactPerson?: string | null;
  customerContactNumber?: string | null;
  customerEmail?: string | null;
  validityDays?: number | null;
  remarks?: string | null;
  items: Array<{
    id: number;
    materialId: number | null;
    productId: number | null;
    unitPrice: number | null;
    sellPrice: number | null;
    discountPrice: number | null;
    totalSetQty: number | null;
    lineTotal: number | null;
    remarks: string | null;
    metadata: Record<string, unknown> | null;
  }>;
}

export interface AdminUser {
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

export interface PayrollAttendanceItem {
  id: number;
  userId: number;
  userSource: 'pcmazing_admin_users' | 'tblusers';
  username: string;
  fullName: string;
  workDate: string;
  timeIn: string | null;
  timeOut: string | null;
  hoursWorked?: number | null;
  status?: 'timed_in' | 'completed' | 'incomplete';
  employeeCode: string | null;
  department: string | null;
  timeInSelfieUrl?: string | null;
  timeOutSelfieUrl?: string | null;
}

export interface EmployeeDayOffItem {
  id: number;
  dayOffDate: string;
  reason: string | null;
}

export interface EmployeeTodoItem {
  id: number;
  title: string;
  notes: string | null;
  dueDate: string;
  isDone: boolean;
}

export interface EmployeeActivityItem {
  id: number;
  actionType: string;
  title: string;
  details: string | null;
  createdAt: string;
}

export interface EmployeePayslipItem {
  id: string;
  label: string;
  dateFrom: string;
  dateTo: string;
  periodDays: number;
  daysPresent: number;
  daysCompleted: number;
  totalHours: number;
  salaryType: string;
  salaryAmount: number | null;
  estimatedPay: number;
  payrollEnabled: boolean;
}

export interface EmployeeWorkspaceDashboard {
  workDate: string;
  month: string;
  today: {
    timeIn: string | null;
    timeOut: string | null;
    hoursWorked: number | null;
    status: string;
  };
  monthSummary: {
    totalHours: number;
    daysPresent: number;
    daysCompleted: number;
    dayOffCount: number;
  };
  attendanceDays: Array<{
    workDate: string;
    timeIn: string | null;
    timeOut: string | null;
    hoursWorked: number | null;
  }>;
  dayOffs: EmployeeDayOffItem[];
  todos: EmployeeTodoItem[];
  activities: EmployeeActivityItem[];
  payslips: EmployeePayslipItem[];
}

export interface PayrollOverview {
  workDate: string;
  enrolledEmployees: number;
  timedInToday: number;
  completedToday: number;
  stillWorking: number;
  notYetIn: number;
}

export interface PayrollEmployeeItem {
  userId: number;
  userSource: 'pcmazing_admin_users' | 'tblusers';
  username: string;
  fullName: string;
  isActive: boolean;
  employeeCode: string | null;
  department: string | null;
  positionTitle: string | null;
  salaryType: 'weekly' | 'semi_monthly' | 'monthly' | 'cutoff';
  monthlySalary: number | null;
  payrollEnabled: boolean;
  todayStatus: 'not_started' | 'timed_in' | 'completed' | 'absent';
  todayTimeIn: string | null;
  todayTimeOut: string | null;
}

export interface PayrollPeriodItem {
  userId: number;
  userSource: 'pcmazing_admin_users' | 'tblusers';
  username: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
  salaryType: 'weekly' | 'semi_monthly' | 'monthly' | 'cutoff';
  salaryAmount: number | null;
  daysPresent: number;
  daysCompleted: number;
  totalHours: number;
  estimatedPay: number;
}

export interface PayrollPeriodMeta {
  dateFrom: string;
  dateTo: string;
  periodDays: number;
  totals: {
    employees: number;
    totalHours: number;
    estimatedPay: number;
  };
}

export interface PayrollGenerateResult {
  runId: number;
  label: string;
  dateFrom: string;
  dateTo: string;
  periodDays: number;
  employeeCount: number;
  totals: {
    employees: number;
    totalHours: number;
    estimatedPay: number;
  };
  replaced: boolean;
}

export interface RbacStatus {
  enabled: boolean;
  roles: string[];
}

export interface MarketingTeamMember {
  id: number;
  userId: number;
  memberRole: string;
  userName: string | null;
}

export interface MarketingTeamNode {
  id: number;
  name: string;
  parentTeamId: number | null;
  createdByUserId: number;
  members: MarketingTeamMember[];
  children: MarketingTeamNode[];
  createdAt: string;
  updatedAt: string;
}

export interface AssignableMarketingUser {
  id: number;
  fullName: string;
  role: string;
}

export interface ClientProspectListItem {
  id: number;
  clientName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  source: string;
  assignedUserId: number | null;
  assignedUserName: string | null;
  pickedUpBy: number | null;
  pickedUpByName: string | null;
  pickedUpAt: string | null;
  responseCount: number;
  latestResponseAt: string | null;
  hasAppointment: boolean;
  followUpCount: number;
  maxFollowUps: number;
  clientType: string;
  currency: string;
  proposedPriceDeal: number | null;
  estimatedPriceDealPhp: number | null;
  exchangeRateUsed: number | null;
  exchangeRateDate: string | null;
  commissionPercent: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectDealSummary {
  estimatedProjectDeal: number;
  projectDeal: number;
  commissioned: number;
  totalProjectDeal: number;
}

export interface ProspectImportPreviewRow {
  rowNumber: number;
  clientName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  clientType: string;
  currency: string;
  proposedPriceDeal: number | null;
}

export interface ProspectImportPreview {
  fileName: string;
  totalDataRows: number;
  validRows: number;
  skippedRows: number;
  previewRows: ProspectImportPreviewRow[];
  skippedDetails: Array<{ rowNumber: number; reason: string }>;
}

export interface MaterialImportPreviewRow {
  rowNumber: number;
  materialCode: string | null;
  materialName: string;
  brandName: string | null;
  productTypeName: string | null;
  unit: string | null;
  unitPrice: number | null;
  orderCost: number | null;
  sellPrice: number | null;
  onHandStock: number | null;
  reorderLevel: number | null;
  action: 'create' | 'update';
}

export interface MaterialImportPreview {
  fileName: string;
  totalDataRows: number;
  validRows: number;
  skippedRows: number;
  createCount: number;
  updateCount: number;
  previewRows: MaterialImportPreviewRow[];
  skippedDetails: Array<{ rowNumber: number; reason: string }>;
}

export interface ProspectContractModule {
  id: number;
  name: string;
  description: string | null;
  features: string | null;
  processFlow: string | null;
}

export interface ProspectContractMilestone {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  connectedModuleId: string | null;
}

export interface ProspectContractPaymentSchedule {
  id: number;
  label: string;
  amount: number;
  description: string | null;
  dueDate: string | null;
  notes: string | null;
  connectedMilestoneId: string | null;
}

export interface ProjectUserRef {
  id: number;
  source: 'pcmazing_admin_users' | 'tblusers';
}

export interface ProjectUserSummary extends ProjectUserRef {
  username: string;
  fullName: string;
  role: string;
  email: string | null;
  isActive: boolean;
}

export interface ProjectListItem {
  id: number;
  prospectId: number;
  name: string;
  projectType: string | null;
  status: string;
  clientName: string;
  company: string | null;
  projectManager: ProjectUserSummary | null;
  teamMemberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends ProjectListItem {
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  contract: {
    id: number;
    projectName: string;
    projectType: string;
    signedAt: string | null;
    remarks: string | null;
    modules: ProspectContractModule[];
    milestones: ProspectContractMilestone[];
    paymentSchedule: ProspectContractPaymentSchedule[];
  } | null;
  teamMembers: ProjectUserSummary[];
}

export interface ProjectWritePayload {
  prospectId?: number;
  clientName?: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  name?: string;
  contract?: {
    projectName: string;
    projectType: string;
    signedAt?: string;
    remarks?: string;
    modules: Array<{
      name: string;
      description?: string;
      features?: string;
      processFlow?: string;
    }>;
    milestones: Array<{
      title: string;
      description?: string;
      dueDate?: string;
      connectedModuleId?: string;
    }>;
    paymentSchedule: Array<{
      label: string;
      amount: number;
      description?: string;
      dueDate?: string;
      notes?: string;
      connectedMilestoneId?: string;
    }>;
  };
  projectManager: ProjectUserRef;
  teamMembers: ProjectUserRef[];
}

export type ProjectBoardStatus = 'epics' | ProjectTaskStatus;
export type ProjectTaskStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'testing'
  | 'done';
export type ProjectTaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ProjectTaskActivityActionType =
  | 'created'
  | 'edited'
  | 'moved'
  | 'deleted'
  | 'comment_added'
  | 'attachment_added'
  | 'attachment_deleted';

export interface ProjectTaskActivityActor {
  userId: number | null;
  source: 'pcmazing_admin_users' | 'tblusers' | null;
  name: string | null;
}

export interface ProjectTaskActivityItem {
  id: number;
  projectId: number;
  phaseId: number | null;
  taskId: number | null;
  taskTitle: string;
  epicId: number | null;
  epicTitle: string | null;
  actionType: ProjectTaskActivityActionType;
  actor: ProjectTaskActivityActor;
  fromStatus: string | null;
  toStatus: string | null;
  details: string | null;
  meta: Record<string, unknown> | null;
  summary: string;
  createdAt: string;
}

export interface ProjectTaskActivityList {
  items: ProjectTaskActivityItem[];
  meta: PaginationMeta;
  selectedPhaseId: number | null;
}

export interface ProjectTaskItem {
  id: number;
  projectId: number;
  epicId: number | null;
  epicTitle: string | null;
  title: string;
  description: string | null;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  sortOrder: number;
  assignee: ProjectUserSummary | null;
  dueDate: string | null;
  commentCount: number;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTaskCommentItem {
  id: number;
  taskId: number;
  body: string;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTaskAttachmentItem {
  id: number;
  taskId: number;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  kind: 'screenshot' | 'file';
  createdByUserId: number;
  createdAt: string;
}

export interface ProjectTaskDetail extends ProjectTaskItem {
  comments: ProjectTaskCommentItem[];
  attachments: ProjectTaskAttachmentItem[];
}

export interface ProjectPhaseItem {
  id: number;
  projectId: number;
  contractMilestoneId: number | null;
  title: string;
  description: string | null;
  dueDate: string | null;
  sortOrder: number;
  status: 'planned' | 'active' | 'completed';
  phaseLabel: string;
  epicCount: number;
}

export interface ProjectEpicItem {
  id: number;
  projectId: number;
  phaseId: number;
  contractModuleId: number | null;
  title: string;
  description: string | null;
  sortOrder: number;
  status: 'planned' | 'active' | 'completed';
  boardStatus: ProjectBoardStatus;
  taskCount: number;
  doneTaskCount: number;
  tasks: ProjectTaskItem[];
}

export interface ProjectTaskBoard {
  columns: Array<{ key: ProjectBoardStatus; label: string }>;
  phases: ProjectPhaseItem[];
  epics: ProjectEpicItem[];
  tasks: ProjectTaskItem[];
  currentPhaseId: number | null;
  selectedPhaseId: number | null;
}

export interface ProspectContract {
  id: number;
  projectName: string;
  projectType: string;
  signedAt: string | null;
  remarks: string | null;
  modules: ProspectContractModule[];
  milestones: ProspectContractMilestone[];
  paymentSchedule: ProspectContractPaymentSchedule[];
}

export interface ClientProspectDetail extends ClientProspectListItem {
  notes: string | null;
  assignedTeamId: number | null;
  contract: ProspectContract | null;
  responses: Array<{
    id: number;
    userId: number;
    userName: string | null;
    responseType: string;
    notes: string | null;
    outcome: string | null;
    followUpDate: string | null;
    followUpMethod: string | null;
    remarks: string | null;
    createdAt: string;
  }>;
  appointments: Array<{
    id: number;
    title: string;
    startsAt: string;
    endsAt: string;
    meetingType: string;
    locationOrLink: string | null;
    notes: string | null;
    userId: number;
    userName: string | null;
  }>;
}

export interface ClientAppointmentItem {
  id: number;
  prospectId: number;
  userId: number;
  clientName: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetingType: string;
  locationOrLink: string | null;
}

interface MessageResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly adminAuth = inject(AdminAuthService);

  listContactInquiries(page = 1, limit = 20, search = '', status = '') {
    let params = this.listParams(page, limit, search);
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<ListResponse<ContactInquiry>>(
      `${APP_CONFIG.apiUrl}/admin/contact-inquiries`,
      { headers: this.headers(), params },
    );
  }

  getContactInquiry(id: number) {
    return this.http.get<ItemResponse<ContactInquiry>>(
      `${APP_CONFIG.apiUrl}/admin/contact-inquiries/${id}`,
      { headers: this.headers() },
    );
  }

  updateContactInquiry(id: number, payload: { status?: string; adminNotes?: string }) {
    return this.http.patch<ItemResponse<ContactInquiry>>(
      `${APP_CONFIG.apiUrl}/admin/contact-inquiries/${id}`,
      payload,
      { headers: this.headers() },
    );
  }

  listCustomerReviews(page = 1, limit = 20, search = '', status = '') {
    let params = this.listParams(page, limit, search);
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<ListResponse<CustomerReview>>(
      `${APP_CONFIG.apiUrl}/admin/customer-reviews`,
      { headers: this.headers(), params },
    );
  }

  getCustomerReview(id: number) {
    return this.http.get<ItemResponse<CustomerReview>>(
      `${APP_CONFIG.apiUrl}/admin/customer-reviews/${id}`,
      { headers: this.headers() },
    );
  }

  updateCustomerReview(
    id: number,
    payload: { status?: string; isPublished?: boolean; adminNotes?: string },
  ) {
    return this.http.patch<ItemResponse<CustomerReview>>(
      `${APP_CONFIG.apiUrl}/admin/customer-reviews/${id}`,
      payload,
      { headers: this.headers() },
    );
  }

  listDemoRequests(page = 1, limit = 20, search = '', status = '') {
    let params = this.listParams(page, limit, search);
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<ListResponse<DemoRequest>>(
      `${APP_CONFIG.apiUrl}/admin/demo-requests`,
      { headers: this.headers(), params },
    );
  }

  getDemoRequest(id: number) {
    return this.http.get<ItemResponse<DemoRequest>>(
      `${APP_CONFIG.apiUrl}/admin/demo-requests/${id}`,
      { headers: this.headers() },
    );
  }

  updateDemoRequest(id: number, payload: { status?: string; followUpNotes?: string }) {
    return this.http.patch<ItemResponse<DemoRequest>>(
      `${APP_CONFIG.apiUrl}/admin/demo-requests/${id}`,
      payload,
      { headers: this.headers() },
    );
  }

  listMaterials(page = 1, limit = 20, search = '', brandId?: number, productTypeId?: number) {
    let params = this.listParams(page, limit, search);
    if (brandId) {
      params = params.set('brandId', String(brandId));
    }
    if (productTypeId) {
      params = params.set('productTypeId', String(productTypeId));
    }

    return this.http.get<ListResponse<MaterialItem> & { summary: InventoryStockSummary | null }>(
      `${APP_CONFIG.apiUrl}/admin/inventory/materials`,
      { headers: this.headers(), params },
    );
  }

  exportMaterialsCsv(search = '', brandId?: number, productTypeId?: number) {
    let params = new HttpParams();
    if (search.trim()) {
      params = params.set('search', search.trim());
    }
    if (brandId) {
      params = params.set('brandId', String(brandId));
    }
    if (productTypeId) {
      params = params.set('productTypeId', String(productTypeId));
    }

    return this.http.get(`${APP_CONFIG.apiUrl}/admin/inventory/materials/export`, {
      headers: this.headers(),
      params,
      responseType: 'blob',
    });
  }

  downloadMaterialsImportTemplate() {
    return this.http.get(`${APP_CONFIG.apiUrl}/admin/inventory/materials/import/template`, {
      headers: this.headers(),
      responseType: 'blob',
    });
  }

  previewImportMaterials(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ItemResponse<MaterialImportPreview>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/materials/import/preview`,
      formData,
      { headers: this.headers() },
    );
  }

  importMaterials(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<
      MessageResponse<{ imported: number; created: number; updated: number; skipped: number }>
    >(`${APP_CONFIG.apiUrl}/admin/inventory/materials/import`, formData, {
      headers: this.headers(),
    });
  }

  listInventoryServices(
    page = 1,
    limit = 20,
    search = '',
    type = '',
    status = '',
    sortBy = '',
    sortDir: 'asc' | 'desc' = 'desc',
  ) {
    let params = this.listParams(page, limit, search);
    if (type.trim()) {
      params = params.set('type', type.trim());
    }
    if (status.trim()) {
      params = params.set('status', status.trim());
    }
    if (sortBy.trim()) {
      params = params.set('sortBy', sortBy.trim());
    }
    if (sortDir) {
      params = params.set('sortDir', sortDir);
    }

    return this.http.get<
      ListResponse<InventoryServiceItem> & {
        summary: InventoryServiceSummary;
        filters: {
          types: InventoryServiceFilterOption[];
          statuses: InventoryServiceFilterOption[];
        };
      }
    >(`${APP_CONFIG.apiUrl}/admin/inventory/services`, {
      headers: this.headers(),
      params,
    });
  }

  createInventoryService(payload: CreateInventoryServicePayload) {
    return this.http.post<ItemResponse<InventoryServiceItem>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/services`,
      payload,
      { headers: this.headers() },
    );
  }

  getInventoryService(id: number) {
    return this.http.get<ItemResponse<InventoryServiceItem>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/services/${id}`,
      { headers: this.headers() },
    );
  }

  updateInventoryService(id: number, payload: CreateInventoryServicePayload) {
    return this.http.patch<ItemResponse<InventoryServiceItem>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/services/${id}`,
      payload,
      { headers: this.headers() },
    );
  }

  updateInventoryServiceStatus(id: number, status: string) {
    return this.http.patch<ItemResponse<InventoryServiceItem>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/services/${id}/status`,
      { status },
      { headers: this.headers() },
    );
  }

  deleteInventoryService(id: number) {
    return this.http.delete<{ success: boolean; message: string }>(
      `${APP_CONFIG.apiUrl}/admin/inventory/services/${id}`,
      { headers: this.headers() },
    );
  }

  uploadInventoryServiceImage(id: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<ItemResponse<InventoryServiceItem>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/services/${id}/image`,
      formData,
      { headers: this.headers() },
    );
  }

  listServiceTypes(activeOnly = false) {
    let params = new HttpParams();
    if (activeOnly) {
      params = params.set('activeOnly', 'true');
    }

    return this.http.get<ItemResponse<ServiceTypeItem[]>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/service-types`,
      { headers: this.headers(), params },
    );
  }

  createServiceType(payload: {
    name: string;
    description?: string;
    laborPrice?: number;
    isActive?: boolean;
  }) {
    return this.http.post<ItemResponse<ServiceTypeItem>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/service-types`,
      payload,
      { headers: this.headers() },
    );
  }

  updateServiceType(
    id: number,
    payload: {
      name?: string;
      description?: string;
      laborPrice?: number;
      isActive?: boolean;
    },
  ) {
    return this.http.patch<ItemResponse<ServiceTypeItem>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/service-types/${id}`,
      payload,
      { headers: this.headers() },
    );
  }

  deleteServiceType(id: number) {
    return this.http.delete<{ success: boolean; message: string }>(
      `${APP_CONFIG.apiUrl}/admin/inventory/service-types/${id}`,
      { headers: this.headers() },
    );
  }

  getMaterial(id: number) {
    return this.http.get<ItemResponse<MaterialItem>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/materials/${id}`,
      { headers: this.headers() },
    );
  }

  getInventoryTree() {
    return this.http.get<{ success: boolean; data: InventoryTreeNode[] }>(
      `${APP_CONFIG.apiUrl}/admin/inventory/materials/tree`,
      { headers: this.headers() },
    );
  }

  listInventoryBrands(productTypeId?: number, search = '') {
    let params = new HttpParams();
    if (productTypeId) {
      params = params.set('productTypeId', String(productTypeId));
    }
    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<ItemResponse<InventoryOption[]>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/materials/brands`,
      { headers: this.headers(), params },
    );
  }

  listInventoryProductTypes(search = '') {
    let params = new HttpParams();
    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<ItemResponse<InventoryOption[]>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/materials/product-types`,
      { headers: this.headers(), params },
    );
  }

  createMaterial(payload: CreateMaterialPayload) {
    return this.http.post<ItemResponse<MaterialItem>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/materials`,
      payload,
      { headers: this.headers() },
    );
  }

  updateMaterial(id: number, payload: UpdateMaterialPayload) {
    return this.http.patch<ItemResponse<MaterialItem>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/materials/${id}`,
      payload,
      { headers: this.headers() },
    );
  }

  uploadMaterialImage(id: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<ItemResponse<MaterialItem>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/materials/${id}/image`,
      formData,
      { headers: this.headers() },
    );
  }

  removeMaterialImage(id: number) {
    return this.http.delete<ItemResponse<MaterialItem>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/materials/${id}/image`,
      { headers: this.headers() },
    );
  }

  listPurchaseOrders(page = 1, limit = 20, search = '', status = '') {
    let params = this.listParams(page, limit, search);
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<ListResponse<PurchaseListItem>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/purchase`,
      { headers: this.headers(), params },
    );
  }

  listPurchaseVendors() {
    return this.http.get<ItemResponse<PurchaseVendorOption[]>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/purchase/vendors`,
      { headers: this.headers() },
    );
  }

  createPurchaseOrder(payload: CreatePurchasePayload) {
    return this.http.post<MessageResponse<PurchaseDetail>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/purchase`,
      payload,
      { headers: this.headers() },
    );
  }

  getPurchaseOrder(id: number) {
    return this.http.get<ItemResponse<PurchaseDetail>>(
      `${APP_CONFIG.apiUrl}/admin/inventory/purchase/${id}`,
      { headers: this.headers() },
    );
  }

  listQuotations(page = 1, limit = 20, search = '', status = '') {
    let params = this.listParams(page, limit, search);
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<ListResponse<QuotationListItem>>(
      `${APP_CONFIG.apiUrl}/admin/quotations`,
      { headers: this.headers(), params },
    );
  }

  getQuotation(id: number) {
    return this.http.get<ItemResponse<QuotationDetail>>(
      `${APP_CONFIG.apiUrl}/admin/quotations/${id}`,
      { headers: this.headers() },
    );
  }

  getDashboardOverview(options: {
    period?: DashboardPeriod;
    startDate?: string;
    endDate?: string;
  } = {}) {
    let params = new HttpParams();

    if (options.period) {
      params = params.set('period', options.period);
    }
    if (options.startDate) {
      params = params.set('startDate', options.startDate);
    }
    if (options.endDate) {
      params = params.set('endDate', options.endDate);
    }

    return this.http.get<ItemResponse<DashboardOverview>>(
      `${APP_CONFIG.apiUrl}/admin/dashboard/overview`,
      { headers: this.headers(), params },
    );
  }

  getRbacStatus() {
    return this.http.get<ItemResponse<RbacStatus>>(
      `${APP_CONFIG.apiUrl}/admin/users/rbac-status`,
      { headers: this.headers() },
    );
  }

  listUserRoles() {
    return this.http.get<ItemResponse<string[]>>(
      `${APP_CONFIG.apiUrl}/admin/users/roles`,
      { headers: this.headers() },
    );
  }

  listUsers(page = 1, limit = 20, search = '') {
    const params = this.listParams(page, limit, search);

    return this.http.get<ListResponse<AdminUser>>(
      `${APP_CONFIG.apiUrl}/admin/users`,
      { headers: this.headers(), params },
    );
  }

  createUser(payload: {
    username: string;
    fullName: string;
    email?: string;
    password: string;
    role?: string;
    isActive?: boolean;
    employeeCode?: string;
    department?: string;
    positionTitle?: string;
    salaryType?: 'weekly' | 'semi_monthly' | 'monthly' | 'cutoff';
    monthlySalary?: number | null;
    payrollEnabled?: boolean;
  }) {
    return this.http.post<MessageResponse<AdminUser>>(
      `${APP_CONFIG.apiUrl}/admin/users`,
      payload,
      { headers: this.headers() },
    );
  }

  updateUser(
    id: number,
    payload: {
      fullName?: string;
      email?: string;
      role?: string;
      isActive?: boolean;
      employeeCode?: string;
      department?: string;
      positionTitle?: string;
      salaryType?: 'weekly' | 'semi_monthly' | 'monthly' | 'cutoff';
      monthlySalary?: number | null;
      payrollEnabled?: boolean;
    },
  ) {
    return this.http.patch<MessageResponse<AdminUser>>(
      `${APP_CONFIG.apiUrl}/admin/users/${id}`,
      payload,
      { headers: this.headers() },
    );
  }

  changeUserPassword(id: number, password: string) {
    return this.http.patch<MessageResponse<{ id: number; passwordChanged: boolean }>>(
      `${APP_CONFIG.apiUrl}/admin/users/${id}/password`,
      { password },
      { headers: this.headers() },
    );
  }

  deactivateUser(id: number) {
    return this.http.delete<MessageResponse<AdminUser>>(
      `${APP_CONFIG.apiUrl}/admin/users/${id}`,
      { headers: this.headers() },
    );
  }

  uploadUserProfileImage(id: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<MessageResponse<AdminUser>>(
      `${APP_CONFIG.apiUrl}/admin/users/${id}/profile-image`,
      formData,
      { headers: this.headers() },
    );
  }

  removeUserProfileImage(id: number) {
    return this.http.delete<MessageResponse<AdminUser>>(
      `${APP_CONFIG.apiUrl}/admin/users/${id}/profile-image`,
      { headers: this.headers() },
    );
  }

  listPayrollAttendance(page = 1, limit = 50, workDate = '') {
    let params = this.listParams(page, limit, '');
    if (workDate.trim()) {
      params = params.set('workDate', workDate.trim());
    }

    return this.http.get<ListResponse<PayrollAttendanceItem> & { workDate: string }>(
      `${APP_CONFIG.apiUrl}/admin/payroll/attendance`,
      { headers: this.headers(), params },
    );
  }

  getPayrollOverview(workDate = '') {
    let params = new HttpParams();
    if (workDate.trim()) {
      params = params.set('workDate', workDate.trim());
    }

    return this.http.get<ItemResponse<PayrollOverview>>(
      `${APP_CONFIG.apiUrl}/admin/payroll/overview`,
      { headers: this.headers(), params },
    );
  }

  listPayrollEmployees(search = '') {
    let params = new HttpParams();
    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<ItemResponse<PayrollEmployeeItem[]>>(
      `${APP_CONFIG.apiUrl}/admin/payroll/employees`,
      { headers: this.headers(), params },
    );
  }

  getPayrollPeriod(dateFrom = '', dateTo = '') {
    let params = new HttpParams();
    if (dateFrom.trim()) {
      params = params.set('dateFrom', dateFrom.trim());
    }
    if (dateTo.trim()) {
      params = params.set('dateTo', dateTo.trim());
    }

    return this.http.get<{ success: boolean; data: PayrollPeriodItem[]; meta: PayrollPeriodMeta }>(
      `${APP_CONFIG.apiUrl}/admin/payroll/period`,
      { headers: this.headers(), params },
    );
  }

  generatePayrollPeriod(dateFrom = '', dateTo = '') {
    return this.http.post<ItemResponse<PayrollGenerateResult>>(
      `${APP_CONFIG.apiUrl}/admin/payroll/period/generate`,
      {
        dateFrom: dateFrom.trim() || undefined,
        dateTo: dateTo.trim() || undefined,
      },
      { headers: this.headers() },
    );
  }

  listProjects() {
    return this.http.get<ItemResponse<{ items: ProjectListItem[] }>>(
      `${APP_CONFIG.apiUrl}/admin/projects`,
      { headers: this.headers() },
    );
  }

  getProject(id: number) {
    return this.http.get<ItemResponse<ProjectDetail>>(
      `${APP_CONFIG.apiUrl}/admin/projects/${id}`,
      { headers: this.headers() },
    );
  }

  getProjectByProspect(prospectId: number) {
    return this.http.get<ItemResponse<{ id: number } | null>>(
      `${APP_CONFIG.apiUrl}/admin/projects/by-prospect/${prospectId}`,
      { headers: this.headers() },
    );
  }

  listProjectAssignees(role?: string) {
    let params = new HttpParams();
    if (role?.trim()) {
      params = params.set('role', role.trim());
    }

    return this.http.get<ItemResponse<ProjectUserSummary[]>>(
      `${APP_CONFIG.apiUrl}/admin/projects/assignees`,
      { headers: this.headers(), params },
    );
  }

  createProject(payload: ProjectWritePayload) {
    return this.http.post<MessageResponse<ProjectDetail>>(
      `${APP_CONFIG.apiUrl}/admin/projects`,
      payload,
      { headers: this.headers() },
    );
  }

  updateProject(projectId: number, payload: ProjectWritePayload) {
    return this.http.patch<MessageResponse<ProjectDetail>>(
      `${APP_CONFIG.apiUrl}/admin/projects/${projectId}`,
      payload,
      { headers: this.headers() },
    );
  }

  updateProjectAssignments(projectId: number, payload: { projectManager: ProjectUserRef; teamMembers: ProjectUserRef[] }) {
    return this.http.patch<MessageResponse<ProjectDetail>>(
      `${APP_CONFIG.apiUrl}/admin/projects/${projectId}/assignments`,
      payload,
      { headers: this.headers() },
    );
  }

  listProjectTasks(projectId: number, options?: { phaseId?: number | null }) {
    let params = new HttpParams();
    if (options?.phaseId != null) {
      params = params.set('phaseId', String(options.phaseId));
    }

    return this.http.get<ItemResponse<ProjectTaskBoard>>(
      `${APP_CONFIG.apiUrl}/admin/projects/${projectId}/tasks`,
      { headers: this.headers(), params },
    );
  }

  listProjectTaskActivity(
    projectId: number,
    options?: { phaseId?: number | null; taskId?: number | null; page?: number; limit?: number },
  ) {
    let params = new HttpParams();
    if (options?.phaseId != null) {
      params = params.set('phaseId', String(options.phaseId));
    }
    if (options?.taskId != null) {
      params = params.set('taskId', String(options.taskId));
    }
    if (options?.page != null) {
      params = params.set('page', String(options.page));
    }
    if (options?.limit != null) {
      params = params.set('limit', String(options.limit));
    }

    return this.http.get<ItemResponse<ProjectTaskActivityList>>(
      `${APP_CONFIG.apiUrl}/admin/projects/${projectId}/task-activity`,
      { headers: this.headers(), params },
    );
  }

  setProjectCurrentPhase(projectId: number, phaseId: number) {
    return this.http.patch<
      MessageResponse<{
        currentPhaseId: number;
        phases: ProjectPhaseItem[];
        epics: ProjectEpicItem[];
      }>
    >(
      `${APP_CONFIG.apiUrl}/admin/projects/${projectId}/current-phase`,
      { phaseId },
      { headers: this.headers() },
    );
  }

  moveProjectEpic(
    projectId: number,
    epicId: number,
    payload: { status: 'epics'; sortOrder: number },
  ) {
    return this.http.patch<MessageResponse<ProjectEpicItem>>(
      `${APP_CONFIG.apiUrl}/admin/projects/${projectId}/epics/${epicId}/move`,
      payload,
      { headers: this.headers() },
    );
  }

  getProjectTaskDetail(projectId: number, taskId: number) {
    return this.http.get<ItemResponse<ProjectTaskDetail>>(
      `${APP_CONFIG.apiUrl}/admin/projects/${projectId}/tasks/${taskId}`,
      { headers: this.headers() },
    );
  }

  addProjectTaskComment(projectId: number, taskId: number, body: string) {
    return this.http.post<MessageResponse<ProjectTaskCommentItem>>(
      `${APP_CONFIG.apiUrl}/admin/projects/${projectId}/tasks/${taskId}/comments`,
      { body },
      { headers: this.headers() },
    );
  }

  uploadProjectTaskAttachment(projectId: number, taskId: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<MessageResponse<ProjectTaskAttachmentItem>>(
      `${APP_CONFIG.apiUrl}/admin/projects/${projectId}/tasks/${taskId}/attachments`,
      formData,
      { headers: this.headers() },
    );
  }

  deleteProjectTaskAttachment(projectId: number, taskId: number, attachmentId: number) {
    return this.http.delete<MessageResponse<null>>(
      `${APP_CONFIG.apiUrl}/admin/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`,
      { headers: this.headers() },
    );
  }

  resolveProjectUploadUrl(uploadUrl: string | null | undefined): string | null {
    return this.resolveUploadUrl(uploadUrl);
  }

  createProjectTask(
    projectId: number,
    payload: {
      title: string;
      description?: string;
      status?: ProjectTaskStatus;
      priority?: ProjectTaskPriority;
      epicId: number;
      assignee?: ProjectUserRef | null;
      dueDate?: string;
    },
  ) {
    return this.http.post<MessageResponse<ProjectTaskItem>>(
      `${APP_CONFIG.apiUrl}/admin/projects/${projectId}/tasks`,
      payload,
      { headers: this.headers() },
    );
  }

  updateProjectTask(
    projectId: number,
    taskId: number,
    payload: {
      title?: string;
      description?: string;
      status?: ProjectTaskStatus;
      priority?: ProjectTaskPriority;
      assignee?: ProjectUserRef | null;
      dueDate?: string | null;
      sortOrder?: number;
    },
  ) {
    return this.http.patch<MessageResponse<ProjectTaskItem>>(
      `${APP_CONFIG.apiUrl}/admin/projects/${projectId}/tasks/${taskId}`,
      payload,
      { headers: this.headers() },
    );
  }

  moveProjectTask(
    projectId: number,
    taskId: number,
    payload: { status: ProjectTaskStatus; sortOrder: number },
  ) {
    return this.http.patch<MessageResponse<ProjectTaskItem>>(
      `${APP_CONFIG.apiUrl}/admin/projects/${projectId}/tasks/${taskId}/move`,
      payload,
      { headers: this.headers() },
    );
  }

  deleteProjectTask(projectId: number, taskId: number) {
    return this.http.delete<MessageResponse<null>>(
      `${APP_CONFIG.apiUrl}/admin/projects/${projectId}/tasks/${taskId}`,
      { headers: this.headers() },
    );
  }

  listMarketingTeams() {
    return this.http.get<ItemResponse<MarketingTeamNode[]>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/teams`,
      { headers: this.headers() },
    );
  }

  listAssignableMarketingUsers() {
    return this.http.get<ItemResponse<AssignableMarketingUser[]>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/teams/assignable-users`,
      { headers: this.headers() },
    );
  }

  createMarketingTeam(payload: { name: string; parentTeamId?: number; managerUserId?: number }) {
    return this.http.post<MessageResponse<MarketingTeamNode>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/teams`,
      payload,
      { headers: this.headers() },
    );
  }

  addMarketingTeamMember(teamId: number, payload: { userId: number; memberRole?: string }) {
    return this.http.post<MessageResponse<MarketingTeamMember>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/teams/${teamId}/members`,
      payload,
      { headers: this.headers() },
    );
  }

  listClientProspects(page = 1, limit = 20, search = '', status = '') {
    let params = this.listParams(page, limit, search);
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<ListResponse<ClientProspectListItem> & { fullAccess?: boolean }>(
      `${APP_CONFIG.apiUrl}/admin/marketing/prospects`,
      { headers: this.headers(), params },
    );
  }

  createClientProspect(payload: {
    clientName: string;
    company?: string;
    email?: string;
    phone?: string;
    address?: string;
    notes?: string;
    status?: string;
    clientType?: string;
    currency?: string;
    proposedPriceDeal?: number | null;
  }) {
    return this.http.post<MessageResponse<ClientProspectDetail>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/prospects`,
      payload,
      { headers: this.headers() },
    );
  }

  previewImportClientProspects(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ItemResponse<ProspectImportPreview>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/prospects/import/preview`,
      formData,
      { headers: this.headers() },
    );
  }

  importClientProspects(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<MessageResponse<{ imported: number; total: number }>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/prospects/import`,
      formData,
      { headers: this.headers() },
    );
  }

  getClientProspect(id: number) {
    return this.http.get<ItemResponse<ClientProspectDetail>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/prospects/${id}`,
      { headers: this.headers() },
    );
  }

  pickupClientProspect(id: number) {
    return this.http.post<MessageResponse<ClientProspectDetail>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/prospects/${id}/pickup`,
      {},
      { headers: this.headers() },
    );
  }

  updateClientProspect(
    id: number,
    payload: {
      clientName?: string;
      company?: string;
      email?: string;
      phone?: string;
      address?: string;
      notes?: string;
      clientType?: string;
      currency?: string;
      proposedPriceDeal?: number | null;
      commissionPercent?: number | null;
      contract?: {
        projectName: string;
        projectType: string;
        signedAt?: string;
        remarks?: string;
        modules: Array<{
          name: string;
          description?: string;
          features?: string;
          processFlow?: string;
        }>;
        milestones: Array<{
          title: string;
          description?: string;
          dueDate?: string;
          connectedModuleId?: string;
        }>;
        paymentSchedule: Array<{
          label: string;
          amount: number;
          description?: string;
          dueDate?: string;
          notes?: string;
          connectedMilestoneId?: string;
        }>;
      };
    },
  ) {
    return this.http.patch<MessageResponse<ClientProspectDetail>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/prospects/${id}`,
      payload,
      { headers: this.headers() },
    );
  }

  convertDealEstimate(from: string, amount: number) {
    const params = new HttpParams().set('from', from).set('amount', String(amount));
    return this.http.get<
      ItemResponse<{
        fromCurrency: string;
        toCurrency: string;
        amount: number;
        convertedAmount: number;
        rate: number;
        rateDate: string;
      }>
    >(`${APP_CONFIG.apiUrl}/admin/marketing/exchange-rate`, {
      headers: this.headers(),
      params,
    });
  }

  getProspectDealSummary() {
    return this.http.get<ItemResponse<ProspectDealSummary>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/deal-summary`,
      { headers: this.headers() },
    );
  }

  updateClientProspectStatus(
    id: number,
    payload: {
      status: string;
      notes?: string;
      followUpDate?: string;
      followUpMethod?: string;
      remarks?: string;
      title?: string;
      startsAt?: string;
      endsAt?: string;
      meetingType?: string;
      locationOrLink?: string;
      contractReviewRemarks?: string;
      responseDate?: string;
      contract?: {
        projectName: string;
        projectType: string;
        signedAt?: string;
        remarks?: string;
        modules: Array<{
          name: string;
          description?: string;
          features?: string;
          processFlow?: string;
        }>;
        milestones: Array<{
          title: string;
          description?: string;
          dueDate?: string;
          connectedModuleId?: string;
        }>;
        paymentSchedule: Array<{
          label: string;
          amount: number;
          description?: string;
          dueDate?: string;
          notes?: string;
          connectedMilestoneId?: string;
        }>;
      };
    },
  ) {
    return this.http.patch<MessageResponse<ClientProspectDetail>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/prospects/${id}/status`,
      payload,
      { headers: this.headers() },
    );
  }

  addClientProspectResponse(
    id: number,
    payload: { responseType?: string; notes?: string; outcome?: string },
  ) {
    return this.http.post<MessageResponse<ClientProspectDetail>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/prospects/${id}/responses`,
      payload,
      { headers: this.headers() },
    );
  }

  listClientAppointments(start?: string, end?: string) {
    let params = new HttpParams();
    if (start) params = params.set('start', start);
    if (end) params = params.set('end', end);
    return this.http.get<ItemResponse<ClientAppointmentItem[]>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/appointments`,
      { headers: this.headers(), params },
    );
  }

  checkAppointmentConflicts(startsAt: string, endsAt: string) {
    const params = new HttpParams().set('startsAt', startsAt).set('endsAt', endsAt);
    return this.http.get<ItemResponse<Array<{ id: number; title: string; startsAt: string; endsAt: string }>>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/appointments/conflicts`,
      { headers: this.headers(), params },
    );
  }

  createClientAppointment(payload: {
    prospectId: number;
    title: string;
    startsAt: string;
    endsAt: string;
    meetingType: string;
    locationOrLink?: string;
    notes?: string;
  }) {
    return this.http.post<MessageResponse<ClientProspectDetail>>(
      `${APP_CONFIG.apiUrl}/admin/marketing/appointments`,
      payload,
      { headers: this.headers() },
    );
  }

  resolveProfileImageUrl(profileImageUrl: string | null | undefined): string | null {
    return this.resolveUploadUrl(profileImageUrl);
  }

  resolveMaterialImageUrl(imageUrl: string | null | undefined): string | null {
    return this.resolveUploadUrl(imageUrl);
  }

  resolveServiceImageUrl(imageUrl: string | null | undefined): string | null {
    return this.resolveUploadUrl(imageUrl);
  }

  resolveAttendanceSelfieUrl(imageUrl: string | null | undefined): string | null {
    return this.resolveUploadUrl(imageUrl);
  }

  getEmployeeWorkspaceDashboard(month?: string) {
    let params = new HttpParams();
    if (month?.trim()) {
      params = params.set('month', month.trim());
    }
    return this.http.get<ItemResponse<EmployeeWorkspaceDashboard>>(
      `${APP_CONFIG.apiUrl}/admin/employee-workspace/dashboard`,
      { headers: this.headers(), params },
    );
  }

  upsertEmployeeDayOff(payload: { dayOffDate: string; reason?: string }) {
    return this.http.put<MessageResponse<EmployeeDayOffItem>>(
      `${APP_CONFIG.apiUrl}/admin/employee-workspace/day-offs`,
      payload,
      { headers: this.headers() },
    );
  }

  deleteEmployeeDayOff(id: number) {
    return this.http.delete<MessageResponse<null>>(
      `${APP_CONFIG.apiUrl}/admin/employee-workspace/day-offs/${id}`,
      { headers: this.headers() },
    );
  }

  createEmployeeTodo(payload: { title: string; notes?: string; dueDate: string }) {
    return this.http.post<MessageResponse<EmployeeTodoItem>>(
      `${APP_CONFIG.apiUrl}/admin/employee-workspace/todos`,
      payload,
      { headers: this.headers() },
    );
  }

  updateEmployeeTodo(
    id: number,
    payload: { title?: string; notes?: string; dueDate?: string; isDone?: boolean },
  ) {
    return this.http.patch<MessageResponse<EmployeeTodoItem>>(
      `${APP_CONFIG.apiUrl}/admin/employee-workspace/todos/${id}`,
      payload,
      { headers: this.headers() },
    );
  }

  deleteEmployeeTodo(id: number) {
    return this.http.delete<MessageResponse<null>>(
      `${APP_CONFIG.apiUrl}/admin/employee-workspace/todos/${id}`,
      { headers: this.headers() },
    );
  }

  createEmployeeActivity(payload: { actionType: string; title: string; details?: string }) {
    return this.http.post<MessageResponse<EmployeeActivityItem>>(
      `${APP_CONFIG.apiUrl}/admin/employee-workspace/activities`,
      payload,
      { headers: this.headers() },
    );
  }

  private resolveUploadUrl(uploadUrl: string | null | undefined): string | null {
    if (!uploadUrl) {
      return null;
    }

    if (uploadUrl.startsWith('data:') || /^https?:\/\//i.test(uploadUrl)) {
      return uploadUrl;
    }

    return `${APP_CONFIG.apiUrl.replace(/\/$/, '')}${uploadUrl}`;
  }

  private listParams(page: number, limit: number, search: string): HttpParams {
    let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    if (search.trim()) {
      params = params.set('search', search.trim());
    }
    return params;
  }

  private headers(): HttpHeaders {
    return this.adminAuth.buildAuthHeaders();
  }
}
