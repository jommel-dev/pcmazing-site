import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { products } from '../../data/site.data';

@Component({
  selector: 'app-site-products',
  imports: [RouterLink],
  templateUrl: './site-products.component.html',
})
export class SiteProductsComponent {
  readonly products = products;
}
