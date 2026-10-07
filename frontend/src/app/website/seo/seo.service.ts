import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { APP_CONFIG } from '../../core/config/app-config';
import { normalizeSiteOrigin, toAbsoluteUrl } from './seo-url.util';
import { DEFAULT_OG_IMAGE_PATH, PageSeoMeta } from './website-seo.data';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  apply(meta: PageSeoMeta, publicSiteUrl: string = APP_CONFIG.publicSiteUrl): void {
    const origin = normalizeSiteOrigin(publicSiteUrl);
    const url = toAbsoluteUrl(origin, meta.path);
    const image = toAbsoluteUrl(origin, meta.ogImagePath ?? DEFAULT_OG_IMAGE_PATH);
    const robots = meta.indexable ? 'index, follow' : 'noindex, nofollow';

    this.title.setTitle(meta.title);
    this.upsertMetaTag({ name: 'description', content: meta.description });
    this.upsertMetaTag({ name: 'robots', content: robots });

    this.upsertMetaTag({ property: 'og:title', content: meta.title });
    this.upsertMetaTag({ property: 'og:description', content: meta.description });
    this.upsertMetaTag({ property: 'og:url', content: url });
    this.upsertMetaTag({ property: 'og:type', content: 'website' });
    this.upsertMetaTag({ property: 'og:image', content: image });
    this.upsertMetaTag({ property: 'og:site_name', content: 'PCmazing' });

    this.upsertMetaTag({ name: 'twitter:card', content: 'summary' });
    this.upsertMetaTag({ name: 'twitter:title', content: meta.title });
    this.upsertMetaTag({ name: 'twitter:description', content: meta.description });
    this.upsertMetaTag({ name: 'twitter:image', content: image });

    this.setCanonical(url);
  }

  private upsertMetaTag(tag: { name?: string; property?: string; content: string }): void {
    const selector =
      tag.property != null
        ? `property="${tag.property}"`
        : tag.name != null
          ? `name="${tag.name}"`
          : null;
    if (!selector) {
      return;
    }
    if (this.meta.getTag(selector)) {
      this.meta.updateTag(tag, selector);
    } else {
      this.meta.addTag(tag);
    }
  }

  private setCanonical(url: string): void {
    let link = this.document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
