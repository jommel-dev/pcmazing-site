import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

type PwaTarget = 'website' | 'admin' | 'time-clock' | 'user';

const MANIFEST_BY_TARGET: Record<PwaTarget, { href: string; title: string }> = {
  website: { href: '/manifest.webmanifest', title: 'PCmazing' },
  admin: { href: '/manifests/admin.webmanifest', title: 'PCmazing Staff' },
  'time-clock': { href: '/manifests/time-clock.webmanifest', title: 'PCmazing Time Clock' },
  user: { href: '/manifests/user.webmanifest', title: 'PCmazing Team Portal' },
};

/**
 * Registers the installable service worker and switches the web app manifest
 * so Chrome can install Staff / Time Clock / Portal as separate standalone apps
 * instead of only creating browser shortcuts.
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
    this.applyForUrl(this.router.url);
    void this.registerServiceWorker();

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.applyForUrl(event.urlAfterRedirects));
  }

  private applyForUrl(url: string): void {
    const path = (url.split('?')[0] || '/').trim() || '/';
    const target = this.resolveTarget(path);
    const config = MANIFEST_BY_TARGET[target];

    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== config.href) {
      link.setAttribute('href', config.href);
    }

    let appleTitle = document.querySelector(
      'meta[name="apple-mobile-web-app-title"]',
    ) as HTMLMetaElement | null;
    if (!appleTitle) {
      appleTitle = document.createElement('meta');
      appleTitle.name = 'apple-mobile-web-app-title';
      document.head.appendChild(appleTitle);
    }
    appleTitle.content = config.title;
  }

  private resolveTarget(path: string): PwaTarget {
    if (path === '/admin' || path.startsWith('/admin/')) {
      return 'admin';
    }
    if (path === '/time-clock' || path.startsWith('/time-clock/')) {
      return 'time-clock';
    }
    if (path === '/user' || path.startsWith('/user/')) {
      return 'user';
    }
    return 'website';
  }

  private async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Dev server still benefits from installability testing on LAN/HTTPS tunnels.
    try {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch {
      // Ignore registration failures (mixed content / unsupported context).
    }
  }
}
