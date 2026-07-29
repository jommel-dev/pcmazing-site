import { Routes } from '@angular/router';
import { adminAuthGuard, adminGuestGuard, staffGateGuard } from './guards/admin-auth.guards';
import { AdminLayoutComponent } from './layout/admin-layout.component';
import { StaffAccessPageComponent } from './pages/access/staff-access-page.component';
import { AdminDashboardPageComponent } from './pages/dashboard/admin-dashboard-page.component';
import { AdminLoginPageComponent } from './pages/login/admin-login-page.component';
import { ContactInquiriesPageComponent } from './pages/contact-inquiries/contact-inquiries-page.component';
import { ContactInquiryDetailPageComponent } from './pages/contact-inquiries/contact-inquiry-detail-page.component';
import { CustomerReviewsPageComponent } from './pages/customer-reviews/customer-reviews-page.component';
import { CustomerReviewDetailPageComponent } from './pages/customer-reviews/customer-review-detail-page.component';
import { DemoRequestsPageComponent } from './pages/demo-requests/demo-requests-page.component';
import { DemoRequestDetailPageComponent } from './pages/demo-requests/demo-request-detail-page.component';
import { InventoryPageComponent } from './pages/inventory/inventory-page.component';
import { InventoryDetailPageComponent } from './pages/inventory/inventory-detail-page.component';
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
      },
      {
        path: 'profile',
        component: EditProfilePageComponent,
        title: 'Edit Profile | PCMazing Admin',
      },
      {
        path: 'contact-inquiries',
        component: ContactInquiriesPageComponent,
        title: 'Customer Contact Us | PCMazing Admin',
      },
      {
        path: 'contact-inquiries/:id',
        component: ContactInquiryDetailPageComponent,
        title: 'Contact Inquiry Detail | PCMazing Admin',
      },
      {
        path: 'customer-reviews',
        component: CustomerReviewsPageComponent,
        title: 'Customer Reviews | PCMazing Admin',
      },
      {
        path: 'customer-reviews/:id',
        component: CustomerReviewDetailPageComponent,
        title: 'Review Detail | PCMazing Admin',
      },
      {
        path: 'demo-requests',
        component: DemoRequestsPageComponent,
        title: 'Schedule A Demo | PCMazing Admin',
      },
      {
        path: 'demo-requests/:id',
        component: DemoRequestDetailPageComponent,
        title: 'Demo Request Detail | PCMazing Admin',
      },
      {
        path: 'inventory',
        component: InventoryPageComponent,
        title: 'Inventory | PCMazing Admin',
      },
      {
        path: 'inventory/products/new',
        component: ProductCreatePageComponent,
        title: 'Add Product | PCMazing Admin',
      },
      {
        path: 'inventory/purchase',
        component: PurchasePageComponent,
        title: 'Purchase Orders | PCMazing Admin',
      },
      {
        path: 'inventory/purchase/new',
        component: PurchaseCreatePageComponent,
        title: 'Add Purchase Order | PCMazing Admin',
      },
      {
        path: 'inventory/purchase/:id',
        component: PurchaseDetailPageComponent,
        title: 'Purchase Order Detail | PCMazing Admin',
      },
      {
        path: 'inventory/materials/:id/edit',
        component: ProductEditPageComponent,
        title: 'Edit Product | PCMazing Admin',
      },
      {
        path: 'inventory/materials/:id',
        component: InventoryDetailPageComponent,
        title: 'Material Detail | PCMazing Admin',
      },
      {
        path: 'quotations',
        component: QuotationsPageComponent,
        title: 'Quotations | PCMazing Admin',
      },
      {
        path: 'quotations/:id',
        component: QuotationDetailPageComponent,
        title: 'Quotation Detail | PCMazing Admin',
      },
      {
        path: 'users',
        component: UserManagementPageComponent,
        title: 'User Management | PCMazing Admin',
      },
      {
        path: 'payroll',
        component: PayrollPageComponent,
        title: 'Payroll | PCMazing Admin',
      },
      {
        path: 'lead-generation',
        component: LeadGenerationPageComponent,
        title: 'Lead Generation | PCMazing Admin',
      },
      {
        path: 'lead-generation/:id/edit',
        component: LeadProspectEditPageComponent,
        title: 'Edit Client Prospect | PCMazing Admin',
      },
      {
        path: 'lead-generation/:id/update',
        component: LeadProspectUpdatePageComponent,
        title: 'Update Client Prospect | PCMazing Admin',
      },
      {
        path: 'lead-generation/:id/view',
        component: LeadProspectViewPageComponent,
        title: 'View Client Prospect | PCMazing Admin',
      },
      {
        path: 'lead-generation/:id',
        component: LeadProspectViewPageComponent,
        title: 'View Client Prospect | PCMazing Admin',
      },
      {
        path: 'organization-team',
        component: OrganizationTeamPageComponent,
        title: 'Organization & Team | PCMazing Admin',
      },
      {
        path: 'modules/:moduleKey',
        component: AdminModulePlaceholderPageComponent,
        title: 'Admin Module | PCMazing',
      },
      {
        path: '**',
        redirectTo: 'dashboard',
      },
    ],
  },
];
