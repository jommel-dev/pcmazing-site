import { Component } from '@angular/core';
import { SiteHeaderComponent } from '../../components/site-header/site-header.component';
import { SiteHeroComponent } from '../../components/site-hero/site-hero.component';
import { SiteServicesComponent } from '../../components/site-services/site-services.component';
import { SiteProductsComponent } from '../../components/site-products/site-products.component';
import { SiteStudyHubComponent } from '../../components/site-study-hub/site-study-hub.component';
import { SiteFooterComponent } from '../../components/site-footer/site-footer.component';

@Component({
  selector: 'app-home',
  imports: [
    SiteHeaderComponent,
    SiteHeroComponent,
    SiteServicesComponent,
    SiteProductsComponent,
    SiteStudyHubComponent,
    SiteFooterComponent,
  ],
  templateUrl: './home.component.html',
})
export class HomeComponent {}
