import { Routes } from '@angular/router';
import { WebsiteLayoutComponent } from './website/layout/website-layout.component';
import { HomeComponent } from './website/pages/home/home.component';
import { WebServicesPageComponent } from './website/pages/web-services/web-services-page.component';
import { OurWorkPageComponent } from './website/pages/our-work/our-work-page.component';
import { ServiceDetailPageComponent } from './website/pages/service-detail/service-detail-page.component';
import { AboutPageComponent } from './website/pages/about/about-page.component';
import { ContactPageComponent } from './website/pages/contact/contact-page.component';
import { ScheduleDemoPageComponent } from './website/pages/schedule-demo/schedule-demo-page.component';
import { LeaveReviewPageComponent } from './website/pages/leave-review/leave-review-page.component';
import { SetupPageComponent } from './website/pages/setup/setup-page.component';
import { setupAvailableGuard } from './core/guards/setup-available.guard';
import { adminRoutes } from './admin/admin.routes';

export const routes: Routes = [
  {
    path: 'admin',
    children: adminRoutes,
  },
  {
    path: '',
    component: WebsiteLayoutComponent,
    children: [
      {
        path: '',
        component: HomeComponent,
        title: 'PCmazing | Web Development & Tech Solutions',
      },
      {
        path: 'web-services',
        component: WebServicesPageComponent,
        title: 'Web Development Services | PCmazing',
      },
      {
        path: 'our-work',
        component: OurWorkPageComponent,
        title: 'Our Work | PCmazing',
      },
      {
        path: 'about',
        component: AboutPageComponent,
        title: 'About Us | PCmazing',
      },
      {
        path: 'contact',
        component: ContactPageComponent,
        title: 'Contact Us | PCmazing',
      },
      {
        path: 'schedule-demo',
        component: ScheduleDemoPageComponent,
        title: 'Schedule A Demo | PCmazing',
      },
      {
        path: 'leave-a-review',
        component: LeaveReviewPageComponent,
        title: 'Leave a Review | PCmazing',
      },
      {
        path: 'setup',
        component: SetupPageComponent,
        title: 'Database Setup | PCmazing',
        canActivate: [setupAvailableGuard],
      },
      {
        path: 'services/:slug',
        component: ServiceDetailPageComponent,
        title: 'Service | PCmazing',
      },
    ],
  },
];
