import { isPlatformBrowser } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { navLinks } from '../../data/site.data';

@Component({
  selector: 'app-site-header',
  templateUrl: './site-header.component.html',
})
export class SiteHeaderComponent implements OnInit, OnDestroy {
  readonly navLinks = navLinks;
  readonly mobileMenuOpen = signal(false);
  readonly activeHref = signal('#home');

  private observer?: IntersectionObserver;
  private readonly platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const sections = this.navLinks
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

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  isActive(href: string): boolean {
    return this.activeHref() === href;
  }

  setActiveLink(href: string): void {
    this.activeHref.set(href);
    this.closeMobileMenu();
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
