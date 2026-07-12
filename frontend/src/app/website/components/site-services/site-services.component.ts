import { Component } from '@angular/core';
import { services } from '../../data/site.data';
import { SiteServiceIconComponent } from './site-service-icon.component';

@Component({
  selector: 'app-site-services',
  imports: [SiteServiceIconComponent],
  templateUrl: './site-services.component.html',
})
export class SiteServicesComponent {
  readonly services = services;
}
