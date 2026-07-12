import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { webServiceOfferings } from '../../data/pages.data';

@Component({
  selector: 'app-web-services-page',
  imports: [PageHeroComponent, RouterLink],
  templateUrl: './web-services-page.component.html',
})
export class WebServicesPageComponent {
  readonly offerings = webServiceOfferings;
}
