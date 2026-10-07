import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AppUpdateService } from './core/services/app-update.service';
import { PwaInstallService } from './core/services/pwa-install.service';
import { SeoService } from './website/seo/seo.service';
import { resolvePageSeo } from './website/seo/website-seo.data';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App implements OnInit {
  private readonly appUpdate = inject(AppUpdateService);
  private readonly pwaInstall = inject(PwaInstallService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.pwaInstall.start();
    this.appUpdate.start();

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => this.applySeo(e.urlAfterRedirects || e.url));

    // Initial route (NavigationEnd may fire after this; the subscription above handles it).
    this.applySeo(this.router.url);
  }

  private applySeo(url: string): void {
    const path = url.split('?')[0].split('#')[0] || '/';
    this.seo.apply(resolvePageSeo(path));
  }
}
