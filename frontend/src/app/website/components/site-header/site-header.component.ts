import { isPlatformBrowser } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { navLinks } from '../../data/site.data';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink],
  templateUrl: './site-header.component.html',
})
export class SiteHeaderComponent implements OnInit, OnDestroy {
  readonly navLinks = navLinks;
  readonly mobileMenuOpen = signal(false);
  readonly activeHref = signal('#home');
  readonly isHomePage = signal(true);
  readonly currentPath = signal('/');

  private observer?: IntersectionObserver;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.updateRouteState(this.router.url);
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => this.updateRouteState((event as NavigationEnd).urlAfterRedirects));

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.setupScrollSpy();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  isRouteLink(href: string): boolean {
    return href.startsWith('/');
  }

  isActive(href: string): boolean {
    if (this.isRouteLink(href)) {
      return this.currentPath() === href || this.currentPath().startsWith(`${href}/`);
    }

    return this.isHomePage() && this.activeHref() === href;
  }

  setActiveLink(href: string): void {
    if (!this.isRouteLink(href)) {
      this.activeHref.set(href);
    }

    this.closeMobileMenu();
  }

  navFragment(href: string): string | undefined {
    return href.startsWith('#') ? href.slice(1) : undefined;
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  private updateRouteState(url: string): void {
    const path = url.split(/[?#]/)[0] || '/';
    this.currentPath.set(path);

    const onHome = path === '/';
    this.isHomePage.set(onHome);

    if (onHome && isPlatformBrowser(this.platformId)) {
      queueMicrotask(() => this.setupScrollSpy());
    } else {
      this.observer?.disconnect();
    }
  }

  private setupScrollSpy(): void {
    this.observer?.disconnect();

    const sections = this.navLinks
      .filter((link) => link.href.startsWith('#'))
      .map((link) => document.getElementById(link.href.slice(1)))
      .filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          this.activeHref.set(`#${visible[0].target.id}`);
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.1, 0.5, 1] },
    );

    sections.forEach((section) => this.observer?.observe(section));
  }
}
