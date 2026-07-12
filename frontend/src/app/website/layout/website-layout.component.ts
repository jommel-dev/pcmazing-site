import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteHeaderComponent } from '../components/site-header/site-header.component';
import { SiteFooterComponent } from '../components/site-footer/site-footer.component';

@Component({
  selector: 'app-website-layout',
  imports: [RouterOutlet, SiteHeaderComponent, SiteFooterComponent],
  templateUrl: './website-layout.component.html',
})
export class WebsiteLayoutComponent {}
