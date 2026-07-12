import { Component } from '@angular/core';
import { footerInfo } from '../../data/site.data';

@Component({
  selector: 'app-site-footer',
  templateUrl: './site-footer.component.html',
})
export class SiteFooterComponent {
  readonly footer = footerInfo;
  readonly currentYear = new Date().getFullYear();
}
