import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

const HUB_MANIFEST = {
  href: '/manifests/user.webmanifest',
  title: 'PCmazing Apps',
};

/**
 * Registers the installable service worker and keeps a single PWA identity
 * (portal hub) so Admin, MyPeoplePortal, and Time Clock stay one installed app.
 */
@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private readonly router = inject(Router);
  private started = false;

  start(): void {
    if (this.started || typeof document === 'undefined') {
      return;
    }

    this.started = true;
    this.applyHubManifest();
    void this.registerServiceWorker();

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.applyHubManifest());
  }

  private applyHubManifest(): void {
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== HUB_MANIFEST.href) {
      link.setAttribute('href', HUB_MANIFEST.href);
    }

    let appleTitle = document.querySelector(
      'meta[name="apple-mobile-web-app-title"]',
    ) as HTMLMetaElement | null;
    if (!appleTitle) {
      appleTitle = document.createElement('meta');
      appleTitle.name = 'apple-mobile-web-app-title';
      document.head.appendChild(appleTitle);
    }
    appleTitle.content = HUB_MANIFEST.title;
  }

  private async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch {
      // Ignore registration failures (mixed content / unsupported context).
    }
  }
}
