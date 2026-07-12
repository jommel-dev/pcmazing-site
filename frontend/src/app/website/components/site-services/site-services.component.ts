import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { services } from '../../data/site.data';
import { getServiceRoute } from '../../data/pages.data';
import { SiteServiceIconComponent } from './site-service-icon.component';

@Component({
  selector: 'app-site-services',
  imports: [SiteServiceIconComponent, RouterLink],
  templateUrl: './site-services.component.html',
})
export class SiteServicesComponent {
  readonly services = services;
  readonly getServiceRoute = getServiceRoute;
}
