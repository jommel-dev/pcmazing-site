import { Component } from '@angular/core';
import { products } from '../../data/site.data';

@Component({
  selector: 'app-site-products',
  templateUrl: './site-products.component.html',
})
export class SiteProductsComponent {
  readonly products = products;
}
