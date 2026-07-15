import { Routes } from '@angular/router';
import { WebsiteLayoutComponent } from './website/layout/website-layout.component';
import { HomeComponent } from './website/pages/home/home.component';
import { WebServicesPageComponent } from './website/pages/web-services/web-services-page.component';
import { OurWorkPageComponent } from './website/pages/our-work/our-work-page.component';
import { ServiceDetailPageComponent } from './website/pages/service-detail/service-detail-page.component';
import { AboutPageComponent } from './website/pages/about/about-page.component';
import { ContactPageComponent } from './website/pages/contact/contact-page.component';

export const routes: Routes = [
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
        path: 'services/:slug',
        component: ServiceDetailPageComponent,
        title: 'Service | PCmazing',
      },
    ],
  },
];
