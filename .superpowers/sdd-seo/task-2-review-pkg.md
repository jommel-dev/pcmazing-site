BASE: d8fa110
HEAD: 1c29a5a39c64c9457168c487266ea0c522fe4d88

1c29a5a Apply SEO meta on navigation and inject LocalBusiness JSON-LD.
 frontend/src/app/app.ts                            | 26 +++++++++++++++++--
 .../app/website/layout/website-layout.component.ts | 30 ++++++++++++++++++++--
 2 files changed, 52 insertions(+), 4 deletions(-)

## Diff

diff --git a/frontend/src/app/app.ts b/frontend/src/app/app.ts
index 8d183fa..4d4c670 100644
--- a/frontend/src/app/app.ts
+++ b/frontend/src/app/app.ts
@@ -1,19 +1,41 @@
-import { Component, inject, OnInit } from '@angular/core';
-import { RouterOutlet } from '@angular/router';
+import { Component, DestroyRef, inject, OnInit } from '@angular/core';
+import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
+import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
+import { filter } from 'rxjs';
 import { AppUpdateService } from './core/services/app-update.service';
 import { PwaInstallService } from './core/services/pwa-install.service';
+import { SeoService } from './website/seo/seo.service';
+import { resolvePageSeo } from './website/seo/website-seo.data';
 
 @Component({
   selector: 'app-root',
   imports: [RouterOutlet],
   template: '<router-outlet />',
 })
 export class App implements OnInit {
   private readonly appUpdate = inject(AppUpdateService);
   private readonly pwaInstall = inject(PwaInstallService);
+  private readonly router = inject(Router);
+  private readonly seo = inject(SeoService);
+  private readonly destroyRef = inject(DestroyRef);
 
   ngOnInit(): void {
     this.pwaInstall.start();
     this.appUpdate.start();
+
+    this.router.events
+      .pipe(
+        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
+        takeUntilDestroyed(this.destroyRef),
+      )
+      .subscribe((e) => this.applySeo(e.urlAfterRedirects || e.url));
+
+    // Initial route (NavigationEnd may fire after this; the subscription above handles it).
+    this.applySeo(this.router.url);
+  }
+
+  private applySeo(url: string): void {
+    const path = url.split('?')[0].split('#')[0] || '/';
+    this.seo.apply(resolvePageSeo(path));
   }
 }
diff --git a/frontend/src/app/website/layout/website-layout.component.ts b/frontend/src/app/website/layout/website-layout.component.ts
index c42dc1c..9b0b7b1 100644
--- a/frontend/src/app/website/layout/website-layout.component.ts
+++ b/frontend/src/app/website/layout/website-layout.component.ts
@@ -1,11 +1,37 @@
-import { Component } from '@angular/core';
+import { DOCUMENT } from '@angular/common';
+import { Component, inject, OnDestroy, OnInit } from '@angular/core';
 import { RouterOutlet } from '@angular/router';
+import { APP_CONFIG } from '../../core/config/app-config';
 import { SiteHeaderComponent } from '../components/site-header/site-header.component';
 import { SiteFooterComponent } from '../components/site-footer/site-footer.component';
+import { buildLocalBusinessJsonLd } from '../seo/json-ld.util';
+import { normalizeSiteOrigin } from '../seo/seo-url.util';
+
+const JSON_LD_ID = 'pcmazing-jsonld';
 
 @Component({
   selector: 'app-website-layout',
   imports: [RouterOutlet, SiteHeaderComponent, SiteFooterComponent],
   templateUrl: './website-layout.component.html',
 })
-export class WebsiteLayoutComponent {}
+export class WebsiteLayoutComponent implements OnInit, OnDestroy {
+  private readonly document = inject(DOCUMENT);
+
+  ngOnInit(): void {
+    this.removeJsonLd();
+    const origin = normalizeSiteOrigin(APP_CONFIG.publicSiteUrl);
+    const script = this.document.createElement('script');
+    script.type = 'application/ld+json';
+    script.id = JSON_LD_ID;
+    script.text = JSON.stringify(buildLocalBusinessJsonLd(origin));
+    this.document.head.appendChild(script);
+  }
+
+  ngOnDestroy(): void {
+    this.removeJsonLd();
+  }
+
+  private removeJsonLd(): void {
+    this.document.getElementById(JSON_LD_ID)?.remove();
+  }
+}
