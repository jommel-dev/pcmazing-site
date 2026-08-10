import { Routes } from '@angular/router';
import {
  adminAuthGuard,
  adminGuestGuard,
  adminRoleGuard,
  staffGateGuard,
} from './guards/admin-auth.guards';
import { AdminLayoutComponent } from './layout/admin-layout.component';
import { StaffAccessPageComponent } from './pages/access/staff-access-page.component';
import { AdminDashboardPageComponent } from './pages/dashboard/admin-dashboard-page.component';
import { RoleHomeDashboardPageComponent } from './pages/dashboard/role-home-dashboard-page.component';
import { AdminLoginPageComponent } from './pages/login/admin-login-page.component';
import { ContactInquiriesPageComponent } from './pages/contact-inquiries/contact-inquiries-page.component';
import { ContactInquiryDetailPageComponent } from './pages/contact-inquiries/contact-inquiry-detail-page.component';
import { CustomerReviewsPageComponent } from './pages/customer-reviews/customer-reviews-page.component';
import { CustomerReviewDetailPageComponent } from './pages/customer-reviews/customer-review-detail-page.component';
import { DemoRequestsPageComponent } from './pages/demo-requests/demo-requests-page.component';
import { DemoRequestDetailPageComponent } from './pages/demo-requests/demo-request-detail-page.component';
import { InventoryPageComponent } from './pages/inventory/inventory-page.component';
import { InventoryDetailPageComponent } from './pages/inventory/inventory-detail-page.component';
import { InventoryServiceCreatePageComponent } from './pages/inventory/inventory-service-create-page.component';
import { InventoryServiceReceiptPageComponent } from './pages/inventory/inventory-service-receipt-page.component';
import { InventoryServicesPageComponent } from './pages/inventory/inventory-services-page.component';
import { InventoryServiceTypesPageComponent } from './pages/inventory/inventory-service-types-page.component';
import { PurchasePageComponent } from './pages/inventory/purchase-page.component';
import { PurchaseDetailPageComponent } from './pages/inventory/purchase-detail-page.component';
import { PurchaseCreatePageComponent } from './pages/inventory/purchase-create-page.component';
import { ProductCreatePageComponent } from './pages/inventory/product-create-page.component';
import { ProductEditPageComponent } from './pages/inventory/product-edit-page.component';
import { QuotationsPageComponent } from './pages/quotations/quotations-page.component';
import { QuotationDetailPageComponent } from './pages/quotations/quotation-detail-page.component';
import { UserManagementPageComponent } from './pages/user-management/user-management-page.component';
import { LeadGenerationPageComponent } from './pages/marketing/lead-generation-page.component';
import { LeadProspectViewPageComponent } from './pages/marketing/lead-prospect-view-page.component';
import { LeadProspectEditPageComponent } from './pages/marketing/lead-prospect-edit-page.component';
import { LeadProspectUpdatePageComponent } from './pages/marketing/lead-prospect-update-page.component';
import { OrganizationTeamPageComponent } from './pages/marketing/organization-team-page.component';
import { EditProfilePageComponent } from './pages/profile/edit-profile-page.component';
import { PayrollPageComponent } from './pages/payroll/payroll-page.component';
import { ProjectsPageComponent } from './pages/projects/projects-page.component';
import { ProjectViewPageComponent } from './pages/projects/project-view-page.component';
import { ProjectTasksPageComponent } from './pages/projects/project-tasks-page.component';
import { KanbanHubPageComponent } from './pages/projects/kanban-hub-page.component';
import { AdminModulePlaceholderPageComponent } from './pages/modules/admin-module-placeholder-page.component';

export const adminRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'access',
  },
  {
    path: 'access',
    component: StaffAccessPageComponent,
    title: 'Staff Access | PCMazing Admin',
    canActivate: [adminGuestGuard],
  },
  {
    path: 'login',
    component: AdminLoginPageComponent,
    title: 'Admin Login | PCMazing',
    canActivate: [staffGateGuard, adminGuestGuard],
  },
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [adminAuthGuard],
    children: [
      {
        path: 'dashboard',
        component: AdminDashboardPageComponent,
        title: 'Admin Dashboard | PCMazing',
        canActivate: [adminRoleGuard],
        data: { module: 'dashboard' },
      },
      {
        path: 'marketing-dashboard',
        component: RoleHomeDashboardPageComponent,
        title: 'Marketing Dashboard | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'marketing_dashboard', roleHome: 'marketing' },
      },
      {
        path: 'sales-dashboard',
        component: RoleHomeDashboardPageComponent,
        title: 'Sales Dashboard | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'sales_dashboard', roleHome: 'sales' },
      },
      {
        path: 'developers-dashboard',
        component: RoleHomeDashboardPageComponent,
        title: 'Developers Dashboard | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'developers_dashboard', roleHome: 'developers' },
      },
      {
        path: 'profile',
        component: EditProfilePageComponent,
        title: 'Edit Profile | PCMazing Admin',
        data: { module: 'profile' },
      },
      {
        path: 'contact-inquiries',
        component: ContactInquiriesPageComponent,
        title: 'Customer Contact Us | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'contact_inquiries' },
      },
      {
        path: 'contact-inquiries/:id',
        component: ContactInquiryDetailPageComponent,
        title: 'Contact Inquiry Detail | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'contact_inquiries' },
      },
      {
        path: 'customer-reviews',
        component: CustomerReviewsPageComponent,
        title: 'Customer Reviews | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'customer_reviews' },
      },
      {
        path: 'customer-reviews/:id',
        component: CustomerReviewDetailPageComponent,
        title: 'Review Detail | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'customer_reviews' },
      },
      {
        path: 'demo-requests',
        component: DemoRequestsPageComponent,
        title: 'Schedule A Demo | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'demo_requests' },
      },
      {
        path: 'demo-requests/:id',
        component: DemoRequestDetailPageComponent,
        title: 'Demo Request Detail | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'demo_requests' },
      },
      {
        path: 'inventory',
        component: InventoryPageComponent,
        title: 'Inventory | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'inventory' },
      },
      {
        path: 'inventory/service-types',
        component: InventoryServiceTypesPageComponent,
        title: 'Service Types | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'inventory', inventoryWrite: true },
      },
      {
        path: 'job-order',
        component: InventoryServicesPageComponent,
        title: 'Job Order | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'job_order' },
      },
      {
        path: 'job-order/new',
        component: InventoryServiceCreatePageComponent,
        title: 'Add Service | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'job_order' },
      },
      {
        path: 'job-order/:id/receipt',
        component: InventoryServiceReceiptPageComponent,
        title: 'Sales Receipt | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'job_order' },
      },
      {
        path: 'job-order/:id',
        component: InventoryServiceCreatePageComponent,
        title: 'Edit Service | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'job_order' },
      },
      {
        path: 'inventory/services',
        redirectTo: 'job-order',
        pathMatch: 'full',
      },
      {
        path: 'inventory/services/new',
        redirectTo: 'job-order/new',
        pathMatch: 'full',
      },
      {
        path: 'inventory/services/:id',
        redirectTo: 'job-order/:id',
      },
      {
        path: 'inventory/products/new',
        component: ProductCreatePageComponent,
        title: 'Add Product | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'inventory', inventoryWrite: true },
      },
      {
        path: 'inventory/purchase',
        component: PurchasePageComponent,
        title: 'Purchase Orders | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'inventory', inventoryWrite: true },
      },
      {
        path: 'inventory/purchase/new',
        component: PurchaseCreatePageComponent,
        title: 'Add Purchase Order | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'inventory', inventoryWrite: true },
      },
      {
        path: 'inventory/purchase/:id',
        component: PurchaseDetailPageComponent,
        title: 'Purchase Order Detail | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'inventory', inventoryWrite: true },
      },
      {
        path: 'inventory/materials/:id/edit',
        component: ProductEditPageComponent,
        title: 'Edit Product | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'inventory', inventoryWrite: true },
      },
      {
        path: 'inventory/materials/:id',
        component: InventoryDetailPageComponent,
        title: 'Material Detail | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'inventory' },
      },
      {
        path: 'quotations',
        component: QuotationsPageComponent,
        title: 'Quotations | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'quotation' },
      },
      {
        path: 'quotations/:id',
        component: QuotationDetailPageComponent,
        title: 'Quotation Detail | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'quotation' },
      },
      {
        path: 'users',
        component: UserManagementPageComponent,
        title: 'User Management | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'user_management' },
      },
      {
        path: 'payroll',
        component: PayrollPageComponent,
        title: 'Payroll | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'payroll' },
      },
      {
        path: 'projects',
        component: ProjectsPageComponent,
        title: 'Projects | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'projects' },
      },
      {
        path: 'projects/new',
        component: ProjectsPageComponent,
        title: 'Create Project | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'projects' },
      },
      {
        path: 'kanban',
        component: KanbanHubPageComponent,
        title: 'Kanban | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'kanban' },
      },
      {
        path: 'projects/:id/tasks',
        component: ProjectTasksPageComponent,
        title: 'Project Tasks | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'projects' },
      },
      {
        path: 'projects/:id/edit',
        component: ProjectsPageComponent,
        title: 'Update Project | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'projects' },
      },
      {
        path: 'projects/:id',
        component: ProjectViewPageComponent,
        title: 'Project Details | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'projects' },
      },
      {
        path: 'lead-generation',
        component: LeadGenerationPageComponent,
        title: 'Lead Generation | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'lead_generation' },
      },
      {
        path: 'lead-generation/:id/edit',
        component: LeadProspectEditPageComponent,
        title: 'Edit Client Prospect | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'lead_generation' },
      },
      {
        path: 'lead-generation/:id/update',
        component: LeadProspectUpdatePageComponent,
        title: 'Update Client Prospect | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'lead_generation' },
      },
      {
        path: 'lead-generation/:id/view',
        component: LeadProspectViewPageComponent,
        title: 'View Client Prospect | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'lead_generation' },
      },
      {
        path: 'lead-generation/:id',
        component: LeadProspectViewPageComponent,
        title: 'View Client Prospect | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'lead_generation' },
      },
      {
        path: 'organization-team',
        component: OrganizationTeamPageComponent,
        title: 'Organization & Team | PCMazing Admin',
        canActivate: [adminRoleGuard],
        data: { module: 'organization_team' },
      },
      {
        path: 'modules/:moduleKey',
        component: AdminModulePlaceholderPageComponent,
        title: 'Admin Module | PCMazing',
        canActivate: [adminRoleGuard],
        data: { module: 'dashboard' },
      },
      {
        path: '**',
        redirectTo: 'profile',
      },
    ],
  },
];
