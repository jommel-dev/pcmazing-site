import { DOCUMENT } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { APP_CONFIG } from '../../core/config/app-config';
import { SiteHeaderComponent } from '../components/site-header/site-header.component';
import { SiteFooterComponent } from '../components/site-footer/site-footer.component';
import { buildLocalBusinessJsonLd } from '../seo/json-ld.util';
import { normalizeSiteOrigin } from '../seo/seo-url.util';

const JSON_LD_ID = 'pcmazing-jsonld';

@Component({
  selector: 'app-website-layout',
  imports: [RouterOutlet, SiteHeaderComponent, SiteFooterComponent],
  templateUrl: './website-layout.component.html',
})
export class WebsiteLayoutComponent implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);

  ngOnInit(): void {
    this.removeJsonLd();
    const origin = normalizeSiteOrigin(APP_CONFIG.publicSiteUrl);
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.id = JSON_LD_ID;
    script.text = JSON.stringify(buildLocalBusinessJsonLd(origin));
    this.document.head.appendChild(script);
  }

  ngOnDestroy(): void {
    this.removeJsonLd();
  }

  private removeJsonLd(): void {
    this.document.getElementById(JSON_LD_ID)?.remove();
  }
}
