import { Component } from '@angular/core';
import { SiteHeroComponent } from '../../components/site-hero/site-hero.component';
import { SiteServicesComponent } from '../../components/site-services/site-services.component';
import { SiteProductsComponent } from '../../components/site-products/site-products.component';
import { SiteClientsComponent } from '../../components/site-clients/site-clients.component';

@Component({
  selector: 'app-home',
  imports: [
    SiteHeroComponent,
    SiteServicesComponent,
    SiteProductsComponent,
    SiteClientsComponent,
  ],
  templateUrl: './home.component.html',
})
export class HomeComponent {}
