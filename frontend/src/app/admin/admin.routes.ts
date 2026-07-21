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
import { QuotationsPageComponent } from './pages/quotations/quotations-page.component';
import { QuotationDetailPageComponent } from './pages/quotations/quotation-detail-page.component';
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
