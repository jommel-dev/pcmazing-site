import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { SiteServiceIconComponent } from '../../components/site-services/site-service-icon.component';
import { getServiceBySlug } from '../../data/pages.data';

@Component({
  selector: 'app-service-detail-page',
  imports: [PageHeroComponent, SiteServiceIconComponent, RouterLink],
  templateUrl: './service-detail-page.component.html',
})
export class ServiceDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  readonly service = getServiceBySlug(this.route.snapshot.paramMap.get('slug') ?? '');
}
