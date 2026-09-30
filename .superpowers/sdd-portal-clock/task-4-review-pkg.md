diff --git a/frontend/src/app/admin/admin.routes.ts b/frontend/src/app/admin/admin.routes.ts
index c96901c..90a0f9a 100644
--- a/frontend/src/app/admin/admin.routes.ts
+++ b/frontend/src/app/admin/admin.routes.ts
@@ -48,10 +48,11 @@ import { ProjectViewPageComponent } from './pages/projects/project-view-page.com
 import { ProjectTasksPageComponent } from './pages/projects/project-tasks-page.component';
 import { KanbanHubPageComponent } from './pages/projects/kanban-hub-page.component';
 import { AdminModulePlaceholderPageComponent } from './pages/modules/admin-module-placeholder-page.component';
 import { PrintingGeneratorPageComponent } from './pages/printing/printing-generator-page.component';
 import { CompanyExpensesPageComponent } from './pages/company-expenses/company-expenses-page.component';
+import { PortalTimeClockPageComponent } from './pages/time-clock/portal-time-clock-page.component';
 
 export const adminRoutes: Routes = [
   {
     path: '',
     pathMatch: 'full',
@@ -106,10 +107,17 @@ export const adminRoutes: Routes = [
         path: 'profile',
         component: EditProfilePageComponent,
         title: 'Edit Profile | PCMazing Admin',
         data: { module: 'profile' },
       },
+      {
+        path: 'time-clock',
+        component: PortalTimeClockPageComponent,
+        title: 'Time Clock | PCMazing Admin',
+        canActivate: [adminRoleGuard],
+        data: { module: 'time_clock' },
+      },
       {
         path: 'contact-inquiries',
         component: ContactInquiriesPageComponent,
         title: 'Customer Contact Us | PCMazing Admin',
         canActivate: [adminRoleGuard],
diff --git a/frontend/src/app/admin/data/admin-modules.data.ts b/frontend/src/app/admin/data/admin-modules.data.ts
index bdd3e5e..42ef81d 100644
--- a/frontend/src/app/admin/data/admin-modules.data.ts
+++ b/frontend/src/app/admin/data/admin-modules.data.ts
@@ -190,10 +190,17 @@ export const ADMIN_MODULES: AdminModuleItem[] = [
     label: 'Printing Generator',
     route: '/admin/modules/printing-generator',
     description: 'Design printable documents with dynamic, draggable receipt templates.',
     status: 'active',
   },
+  {
+    key: 'time_clock',
+    label: 'Time Clock',
+    route: '/admin/time-clock',
+    description: 'Clock in and out with a selfie using your signed-in portal account.',
+    status: 'active',
+  },
 ];
 
 export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
   {
     key: 'website',
@@ -237,10 +244,15 @@ export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
       ['payroll', 'accounting', 'user_management', 'settings', 'printing_generator'].includes(
         item.key,
       ),
     ),
   },
+  {
+    key: 'my_portal',
+    title: 'My Portal',
+    items: ADMIN_MODULES.filter((item) => item.key === 'time_clock'),
+  },
 ];
 
 export function filterNavSectionsForRole(
   role: string | null | undefined,
   allowed: Set<string> | 'all',
@@ -248,10 +260,15 @@ export function filterNavSectionsForRole(
   const sections: AdminNavSection[] = [];
 
   // Super admin keeps classic top dashboard link via layout; sections as today.
   if (allowed === 'all') {
     return [
+      {
+        key: 'my_portal',
+        title: 'My Portal',
+        items: ADMIN_MODULES.filter((item) => item.key === 'time_clock'),
+      },
       {
         key: 'website',
         title: 'Website',
         items: ADMIN_MODULES.filter((item) =>
           ['contact_inquiries', 'customer_reviews', 'demo_requests'].includes(item.key),
@@ -290,10 +307,17 @@ export function filterNavSectionsForRole(
         ),
       },
     ];
   }
 
+  const myPortalItems = ADMIN_MODULES.filter(
+    (item) => item.key === 'time_clock' && allowed.has(item.key),
+  );
+  if (myPortalItems.length) {
+    sections.push({ key: 'my_portal', title: 'My Portal', items: myPortalItems });
+  }
+
   const marketingItems = ADMIN_MODULES.filter(
     (item) =>
       ['marketing_dashboard', 'lead_generation', 'organization_team'].includes(item.key) &&
       allowed.has(item.key),
   ).map((item) =>
diff --git a/frontend/src/app/admin/pages/payroll/payroll-page.component.html b/frontend/src/app/admin/pages/payroll/payroll-page.component.html
index 1e77b29..ce6d32e 100644
--- a/frontend/src/app/admin/pages/payroll/payroll-page.component.html
+++ b/frontend/src/app/admin/pages/payroll/payroll-page.component.html
@@ -11,16 +11,16 @@
     <button
       type="button"
       class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
       (click)="copyTimeClockLink()"
     >
-      Copy public time clock link
+      Copy employee time clock link
     </button>
   </div>
 
   <div class="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm dark:border-slate-800 dark:bg-slate-900">
-    <p class="font-semibold text-slate-800 dark:text-slate-100">Public time clock</p>
+    <p class="font-semibold text-slate-800 dark:text-slate-100">Portal time clock</p>
     <p class="mt-1 break-all text-slate-500">{{ timeClockUrl }}</p>
     @if (copyMessage()) {
       <p class="mt-2 text-emerald-600 dark:text-emerald-400">{{ copyMessage() }}</p>
     }
   </div>
diff --git a/frontend/src/app/admin/pages/payroll/payroll-page.component.ts b/frontend/src/app/admin/pages/payroll/payroll-page.component.ts
index f17156b..4484148 100644
--- a/frontend/src/app/admin/pages/payroll/payroll-page.component.ts
+++ b/frontend/src/app/admin/pages/payroll/payroll-page.component.ts
@@ -132,11 +132,11 @@ export class PayrollPageComponent implements OnInit {
   readonly adjustmentMeta = signal<PaginationMeta | null>(null);
   readonly adjustmentStatus = signal<PayrollOvertimeStatus>('pending');
   readonly adjustmentPage = signal(1);
   readonly reviewingAdjustmentId = signal<number | null>(null);
 
-  readonly timeClockUrl = `${APP_CONFIG.publicSiteUrl.replace(/\/$/, '')}/time-clock`;
+  readonly timeClockUrl = `${APP_CONFIG.publicSiteUrl.replace(/\/$/, '')}/user/login?returnUrl=${encodeURIComponent('/admin/time-clock')}`;
 
   ngOnInit(): void {
     const today = this.manilaToday();
     this.workDate.set(today);
     void this.bootstrapDates(today);
diff --git a/frontend/src/app/admin/pages/time-clock/portal-time-clock-page.component.ts b/frontend/src/app/admin/pages/time-clock/portal-time-clock-page.component.ts
new file mode 100644
index 0000000..ca50f62
--- /dev/null
+++ b/frontend/src/app/admin/pages/time-clock/portal-time-clock-page.component.ts
@@ -0,0 +1,17 @@
+import { Component } from '@angular/core';
+import { PortalTimeClockComponent } from '../../components/portal-time-clock/portal-time-clock.component';
+
+@Component({
+  selector: 'app-portal-time-clock-page',
+  imports: [PortalTimeClockComponent],
+  template: `
+    <div class="mx-auto max-w-lg space-y-4">
+      <div>
+        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Time Clock</h2>
+        <p class="mt-1 text-sm text-slate-500">Clock in and out with a selfie. Your account is already signed in.</p>
+      </div>
+      <app-portal-time-clock mode="full" />
+    </div>
+  `,
+})
+export class PortalTimeClockPageComponent {}
diff --git a/frontend/src/app/admin/rbac/admin-roles.ts b/frontend/src/app/admin/rbac/admin-roles.ts
index b4da190..10a9ed1 100644
--- a/frontend/src/app/admin/rbac/admin-roles.ts
+++ b/frontend/src/app/admin/rbac/admin-roles.ts
@@ -38,11 +38,12 @@ export type AdminModuleKey =
   | 'payroll'
   | 'accounting'
   | 'user_management'
   | 'settings'
   | 'printing_generator'
-  | 'profile';
+  | 'profile'
+  | 'time_clock';
 
 const SUPER_ADMIN_KEYS = new Set([
   'admin',
   'administrator',
   'superadmin',
@@ -180,15 +181,16 @@ export function getAllowedModuleKeys(role?: string | null): Set<AdminModuleKey>
     return new Set([
       'marketing_dashboard',
       'lead_generation',
       'organization_team',
       'profile',
+      'time_clock',
     ]);
   }
 
   if (isMarketing(role)) {
-    return new Set(['marketing_dashboard', 'lead_generation', 'profile']);
+    return new Set(['marketing_dashboard', 'lead_generation', 'profile', 'time_clock']);
   }
 
   if (isOperationsManager(role) || isSalesRestrictedInventory(role)) {
     return new Set([
       'sales_dashboard',
@@ -198,15 +200,16 @@ export function getAllowedModuleKeys(role?: string | null): Set<AdminModuleKey>
       'job_order',
       'quotation',
       'inventory',
       'company_expenses',
       'profile',
+      'time_clock',
     ]);
   }
 
   if (isDeveloper(role) || isProjectManager(role)) {
-    return new Set(['developers_dashboard', 'projects', 'kanban', 'profile']);
+    return new Set(['developers_dashboard', 'projects', 'kanban', 'profile', 'time_clock']);
   }
 
   return new Set(['profile']);
 }
 
diff --git a/frontend/src/app/app.routes.ts b/frontend/src/app/app.routes.ts
index 0cdf3be..b0bebc1 100644
--- a/frontend/src/app/app.routes.ts
+++ b/frontend/src/app/app.routes.ts
@@ -7,11 +7,11 @@ import { ServiceDetailPageComponent } from './website/pages/service-detail/servi
 import { AboutPageComponent } from './website/pages/about/about-page.component';
 import { ContactPageComponent } from './website/pages/contact/contact-page.component';
 import { ScheduleDemoPageComponent } from './website/pages/schedule-demo/schedule-demo-page.component';
 import { LeaveReviewPageComponent } from './website/pages/leave-review/leave-review-page.component';
 import { SetupPageComponent } from './website/pages/setup/setup-page.component';
-import { TimeClockPageComponent } from './website/pages/time-clock/time-clock-page.component';
+import { TimeClockRedirectComponent } from './website/pages/time-clock/time-clock-redirect.component';
 import { PublicQuotationPageComponent } from './website/pages/public-quotation/public-quotation-page.component';
 import { setupAvailableGuard } from './core/guards/setup-available.guard';
 import { adminRoutes } from './admin/admin.routes';
 import { userRoutes } from './user/user.routes';
 
@@ -24,11 +24,11 @@ export const routes: Routes = [
     path: 'user',
     children: userRoutes,
   },
   {
     path: 'time-clock',
-    component: TimeClockPageComponent,
+    component: TimeClockRedirectComponent,
     title: 'Time Clock | PCmazing',
   },
   {
     path: 'q/:token',
     component: PublicQuotationPageComponent,
diff --git a/frontend/src/app/user/pages/portal-hub-page.component.html b/frontend/src/app/user/pages/portal-hub-page.component.html
index 33c1ac6..a6329bd 100644
--- a/frontend/src/app/user/pages/portal-hub-page.component.html
+++ b/frontend/src/app/user/pages/portal-hub-page.component.html
@@ -47,16 +47,10 @@
                     <path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
                     <circle cx="17" cy="9" r="2.4" />
                     <path d="M14.2 19c.4-2.2 1.8-3.6 3.8-3.6 1.2 0 2.2.4 3 .1.2" />
                   </svg>
                 }
-                @case ('time-clock') {
-                  <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
-                    <circle cx="12" cy="12" r="8.5" />
-                    <path d="M12 7.5V12l3.2 2" />
-                  </svg>
-                }
               }
             </span>
 
             <div class="min-w-0 flex-1">
               <h2 class="text-lg font-bold text-slate-900">{{ app.title }}</h2>
diff --git a/frontend/src/app/user/pages/portal-hub-page.component.ts b/frontend/src/app/user/pages/portal-hub-page.component.ts
index a7b1252..bfd0b7c 100644
--- a/frontend/src/app/user/pages/portal-hub-page.component.ts
+++ b/frontend/src/app/user/pages/portal-hub-page.component.ts
@@ -1,11 +1,11 @@
 import { Component, inject, OnDestroy, OnInit } from '@angular/core';
 import { Router, RouterLink } from '@angular/router';
 import { getRoleHomeRoute } from '../../admin/rbac/admin-roles';
 import { AdminAuthService } from '../../admin/services/admin-auth.service';
 
-export type PortalHubAppId = 'admin' | 'people' | 'time-clock';
+export type PortalHubAppId = 'admin' | 'people';
 
 @Component({
   selector: 'app-portal-hub-page',
   imports: [RouterLink],
   templateUrl: './portal-hub-page.component.html',
@@ -31,16 +31,10 @@ export class PortalHubPageComponent implements OnInit, OnDestroy {
       id: 'people',
       title: 'MyPeoplePortal',
       description: 'Team sign-in for Marketing, Sales, and Development.',
       path: '/user/login',
     },
-    {
-      id: 'time-clock',
-      title: 'Time Clock',
-      description: 'Clock in and out with attendance selfies.',
-      path: '/time-clock',
-    },
   ];
 
   ngOnInit(): void {
     this.redirectIfAuthenticated();
     this.stopAuthWatch = this.adminAuth.onAuthStorageChange(() => this.redirectIfAuthenticated());
diff --git a/frontend/src/app/user/pages/portal-login-page.component.ts b/frontend/src/app/user/pages/portal-login-page.component.ts
index c623bd1..b71334e 100644
--- a/frontend/src/app/user/pages/portal-login-page.component.ts
+++ b/frontend/src/app/user/pages/portal-login-page.component.ts
@@ -1,8 +1,8 @@
 import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
 import { FormsModule } from '@angular/forms';
-import { Router, RouterLink } from '@angular/router';
+import { ActivatedRoute, Router, RouterLink } from '@angular/router';
 import { firstValueFrom } from 'rxjs';
 import { getRoleHomeRoute } from '../../admin/rbac/admin-roles';
 import { AdminAuthService } from '../../admin/services/admin-auth.service';
 
 @Component({
@@ -11,10 +11,11 @@ import { AdminAuthService } from '../../admin/services/admin-auth.service';
   templateUrl: './portal-login-page.component.html',
 })
 export class PortalLoginPageComponent implements OnInit, OnDestroy {
   private readonly adminAuth = inject(AdminAuthService);
   private readonly router = inject(Router);
+  private readonly route = inject(ActivatedRoute);
   private stopAuthWatch: (() => void) | null = null;
 
   readonly username = signal('');
   readonly password = signal('');
   readonly rememberMe = signal(false);
@@ -33,11 +34,11 @@ export class PortalLoginPageComponent implements OnInit, OnDestroy {
 
   private redirectIfAuthenticated(): void {
     if (!this.adminAuth.isAuthenticated()) {
       return;
     }
-    void this.router.navigateByUrl(getRoleHomeRoute(this.adminAuth.getStoredUser()?.role));
+    void this.router.navigateByUrl(this.resolvePostLoginRoute(this.adminAuth.getStoredUser()?.role));
   }
 
   async submit(): Promise<void> {
     if (this.loading()) {
       return;
@@ -55,18 +56,31 @@ export class PortalLoginPageComponent implements OnInit, OnDestroy {
         response.data.accessToken,
         response.data.user,
         this.rememberMe(),
       );
 
-      await this.router.navigateByUrl(getRoleHomeRoute(response.data.user.role));
+      await this.router.navigateByUrl(this.resolvePostLoginRoute(response.data.user.role));
     } catch (error) {
       this.error.set(this.extractLoginError(error));
     } finally {
       this.loading.set(false);
     }
   }
 
+  private resolvePostLoginRoute(role?: string | null): string {
+    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
+    if (returnUrl && this.isSafeAdminReturnUrl(returnUrl)) {
+      return returnUrl;
+    }
+    return getRoleHomeRoute(role);
+  }
+
+  /** Only same-origin relative admin paths ΓÇö blocks open redirects. */
+  private isSafeAdminReturnUrl(url: string): boolean {
+    return url.startsWith('/admin/') && !url.startsWith('//') && !url.includes('://');
+  }
+
   private extractLoginError(error: unknown): string {
     if (error && typeof error === 'object' && 'error' in error) {
       const payload = (error as { error?: { message?: string | string[] } }).error;
 
       if (Array.isArray(payload?.message)) {
diff --git a/frontend/src/app/website/pages/time-clock/time-clock-page.component.html b/frontend/src/app/website/pages/time-clock/time-clock-page.component.html
deleted file mode 100644
index c87fafc..0000000
--- a/frontend/src/app/website/pages/time-clock/time-clock-page.component.html
+++ /dev/null
@@ -1,225 +0,0 @@
-<main class="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100 px-4 py-10 sm:px-6">
-  <div class="mx-auto w-full max-w-md">
-    <a
-      routerLink="/user/portal"
-      class="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-pcmazing-500 hover:text-pcmazing-600"
-    >
-      ΓåÉ Back to portal
-    </a>
-
-    <div class="mb-8 text-center">
-      <p class="text-xs font-bold uppercase tracking-[0.2em] text-pcmazing-500">PCmazing</p>
-      <h1 class="mt-2 text-3xl font-extrabold text-slate-900">Time Clock</h1>
-      <p class="mt-2 text-sm text-slate-500">Enter your username, take a selfie, then time in or out.</p>
-      <p class="mt-3 font-mono text-sm text-slate-600">{{ nowLabel() }}</p>
-      <p class="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Server time ┬╖ Asia/Manila</p>
-    </div>
-
-    <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
-      <label class="mb-1 block text-sm font-semibold text-slate-700">Username</label>
-      <div class="flex gap-2">
-        <input
-          type="text"
-          class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
-          placeholder="e.g. jommel"
-          [ngModel]="username()"
-          (ngModelChange)="username.set($event)"
-          (keyup.enter)="lookup()"
-          autocomplete="username"
-        />
-        <button
-          type="button"
-          class="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
-          [disabled]="loading()"
-          (click)="lookup()"
-        >
-          @if (loading()) { ... } @else { Check }
-        </button>
-      </div>
-
-      @if (error()) {
-        <div class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</div>
-      }
-      @if (success()) {
-        <div class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ success() }}</div>
-      }
-
-      @if (status(); as current) {
-        <div class="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
-          <p class="text-lg font-bold text-slate-900">{{ current.fullName || current.username || 'ΓÇö' }}</p>
-          <p class="text-sm text-slate-500">@{{ current.username || username() }}</p>
-          @if (current.employeeCode) {
-            <p class="mt-1 text-xs text-slate-500">Employee code: {{ current.employeeCode }}</p>
-          }
-          <p class="mt-3 text-sm text-slate-600">{{ current.message }}</p>
-          @if (current.expectedLocation) {
-            <p
-              class="mt-3 rounded-xl px-3 py-2 text-xs font-semibold"
-              [class]="
-                current.expectedLocation === 'off'
-                  ? 'border border-amber-200 bg-amber-50 text-amber-900'
-                  : current.expectedLocation === 'wfh'
-                    ? 'border border-sky-200 bg-sky-50 text-sky-900'
-                    : 'border border-slate-200 bg-white text-slate-700'
-              "
-            >
-              Today: {{ expectedLocationLabel(current.expectedLocation) }}
-              @if (current.expectedLocation === 'off') {
-                <span class="mt-1 block font-medium">Scheduled day off ΓÇö punch is still allowed.</span>
-              }
-            </p>
-          }
-          @if (current.canTimeIn) {
-            <div class="mt-3">
-              <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Working from</p>
-              <div class="mt-2 grid grid-cols-2 gap-2">
-                <button
-                  type="button"
-                  [class]="
-                    pickedLocation() === 'office'
-                      ? 'rounded-xl border border-pcmazing-500 bg-pcmazing-500 px-3 py-2.5 text-sm font-bold text-white'
-                      : 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700'
-                  "
-                  (click)="pickedLocation.set('office')"
-                >
-                  Office
-                </button>
-                <button
-                  type="button"
-                  [class]="
-                    pickedLocation() === 'wfh'
-                      ? 'rounded-xl border border-pcmazing-500 bg-pcmazing-500 px-3 py-2.5 text-sm font-bold text-white'
-                      : 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700'
-                  "
-                  (click)="pickedLocation.set('wfh'); requestGeolocation()"
-                >
-                  WFH
-                </button>
-              </div>
-              @if (current.expectedLocation === 'off') {
-                <p class="mt-2 text-xs text-amber-800">
-                  Scheduled day off ΓÇö choose Office or WFH if you still need to clock in.
-                </p>
-              }
-            </div>
-          }
-          @if (current.canTimeIn && pickedLocation() === 'wfh') {
-            <div class="mt-3 rounded-xl border border-slate-200 bg-white p-3">
-              <label class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">Location label (optional)</label>
-              <input
-                type="text"
-                maxlength="200"
-                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
-                placeholder="e.g. Home ΓÇô Cabanatuan"
-                [ngModel]="locationLabel()"
-                (ngModelChange)="locationLabel.set($event)"
-              />
-              <p class="mt-2 text-[11px] text-slate-500">{{ locationStatus() || 'Location will be captured for WFH days.' }}</p>
-              <button
-                type="button"
-                class="mt-2 text-xs font-bold text-pcmazing-500 hover:text-pcmazing-600"
-                [disabled]="requestingLocation()"
-                (click)="requestGeolocation()"
-              >
-                @if (requestingLocation()) { Getting GPS... } @else { Refresh GPS }
-              </button>
-            </div>
-          }
-          @if (current.canTimeOut && (current.undertimeGraceMinutes ?? 0) > 0) {
-            <p class="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
-              Need to leave a little early (emergency, appointment, or event)? Clock out as usual.
-              Up to {{ current.undertimeGraceMinutes }} minutes before 9 hours still counts as a full paid day.
-            </p>
-          }
-
-          <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
-            <div class="rounded-xl border border-slate-200 bg-white px-3 py-3">
-              <p class="text-xs font-bold uppercase text-slate-400">Time in</p>
-              <p class="mt-1 font-semibold text-slate-900">{{ formatPunch(current.timeIn) }}</p>
-            </div>
-            <div class="rounded-xl border border-slate-200 bg-white px-3 py-3">
-              <p class="text-xs font-bold uppercase text-slate-400">Time out</p>
-              <p class="mt-1 font-semibold text-slate-900">{{ formatPunch(current.timeOut) }}</p>
-            </div>
-          </div>
-        </div>
-
-        @if (needsSelfie()) {
-          <div class="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
-            <p class="text-sm font-semibold text-slate-800">Selfie proof required</p>
-            <p class="mt-1 text-xs text-slate-500">Capture a clear face photo before submitting your punch.</p>
-
-            @if (cameraError()) {
-              <div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
-                {{ cameraError() }}
-                <button type="button" class="ml-2 font-bold underline" (click)="startCamera()">Retry camera</button>
-              </div>
-            }
-
-            @if (selfiePreviewUrl(); as preview) {
-              <img [src]="preview" alt="Selfie preview" class="mt-3 aspect-square w-full rounded-2xl border border-slate-200 object-cover" />
-              <button
-                type="button"
-                class="mt-3 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700"
-                (click)="retakeSelfie()"
-                [disabled]="submitting()"
-              >
-                Retake selfie
-              </button>
-            } @else {
-              <div class="relative mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-black">
-                <video
-                  #cameraVideo
-                  class="aspect-square w-full scale-x-[-1] object-cover"
-                  autoplay
-                  playsinline
-                  muted
-                ></video>
-                @if (cameraStarting() || !cameraReady()) {
-                  <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/70 text-sm text-white">
-                    <span class="size-8 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
-                    <span>Opening camera...</span>
-                  </div>
-                }
-              </div>
-              <button
-                type="button"
-                class="mt-3 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 ring-1 ring-slate-300 disabled:opacity-50"
-                [disabled]="!cameraReady() || cameraStarting() || submitting()"
-                (click)="captureSelfie()"
-              >
-                @if (cameraStarting()) { Waiting for camera... } @else { Capture selfie }
-              </button>
-            }
-          </div>
-        }
-
-        <div class="mt-5 grid gap-3">
-          @if (current.canTimeIn) {
-            <button
-              type="button"
-              class="w-full rounded-2xl bg-pcmazing-500 px-4 py-4 text-base font-bold text-white hover:bg-pcmazing-600 disabled:opacity-50"
-              [disabled]="submitting() || !selfieBlob() || !pickedLocation()"
-              (click)="punchIn()"
-            >
-              @if (submitting()) { Recording... } @else { Time In }
-            </button>
-          } @else if (current.canTimeOut) {
-            <button
-              type="button"
-              class="w-full rounded-2xl bg-slate-900 px-4 py-4 text-base font-bold text-white hover:bg-slate-800 disabled:opacity-50"
-              [disabled]="submitting() || !selfieBlob()"
-              (click)="punchOut()"
-            >
-              @if (submitting()) { Recording... } @else { Time Out }
-            </button>
-          } @else if (current.status === 'completed') {
-            <div class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center text-sm font-semibold text-emerald-800">
-              Done for today
-            </div>
-          }
-        </div>
-      }
-    </section>
-  </div>
-</main>
diff --git a/frontend/src/app/website/pages/time-clock/time-clock-page.component.ts b/frontend/src/app/website/pages/time-clock/time-clock-page.component.ts
deleted file mode 100644
index 372df8d..0000000
--- a/frontend/src/app/website/pages/time-clock/time-clock-page.component.ts
+++ /dev/null
@@ -1,478 +0,0 @@
-import {
-  Component,
-  effect,
-  ElementRef,
-  inject,
-  OnDestroy,
-  OnInit,
-  signal,
-  viewChild,
-} from '@angular/core';
-import { FormsModule } from '@angular/forms';
-import { RouterLink } from '@angular/router';
-import { firstValueFrom } from 'rxjs';
-import { TimeClockApiService, TimeClockStatus } from '../../../core/services/time-clock-api.service';
-
-@Component({
-  selector: 'app-time-clock-page',
-  imports: [FormsModule, RouterLink],
-  templateUrl: './time-clock-page.component.html',
-})
-export class TimeClockPageComponent implements OnInit, OnDestroy {
-  private readonly timeClockApi = inject(TimeClockApiService);
-  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('cameraVideo');
-
-  readonly username = signal('');
-  readonly status = signal<TimeClockStatus | null>(null);
-  readonly loading = signal(false);
-  readonly submitting = signal(false);
-  readonly error = signal('');
-  readonly success = signal('');
-  readonly nowLabel = signal('');
-  readonly cameraStarting = signal(false);
-  readonly cameraReady = signal(false);
-  readonly cameraError = signal('');
-  readonly selfiePreviewUrl = signal<string | null>(null);
-  readonly selfieBlob = signal<Blob | null>(null);
-  readonly locationLabel = signal('');
-  readonly locationCoords = signal<{ lat: number; lng: number } | null>(null);
-  readonly locationStatus = signal('');
-  readonly requestingLocation = signal(false);
-  readonly pickedLocation = signal<'office' | 'wfh' | null>(null);
-
-  private mediaStream: MediaStream | null = null;
-  private clockTimer: ReturnType<typeof setInterval> | null = null;
-  private serverSyncTimer: ReturnType<typeof setInterval> | null = null;
-  private cameraRequestId = 0;
-  /** serverNow - Date.now() when last synced; display uses Date.now() + offset. */
-  private serverOffsetMs = 0;
-  private hasServerSync = false;
-
-  constructor() {
-    effect(() => {
-      const video = this.videoRef()?.nativeElement;
-      if (!video || !this.mediaStream || this.selfiePreviewUrl()) {
-        return;
-      }
-
-      if (video.srcObject !== this.mediaStream) {
-        video.srcObject = this.mediaStream;
-        video.onloadedmetadata = () => {
-          void video.play().then(() => {
-            this.cameraReady.set(true);
-            this.cameraStarting.set(false);
-          }).catch(() => {
-            this.cameraReady.set(true);
-            this.cameraStarting.set(false);
-          });
-        };
-      }
-    });
-  }
-
-  ngOnInit(): void {
-    this.tickClock();
-    this.clockTimer = setInterval(() => this.tickClock(), 1000);
-    void this.syncServerClock();
-    this.serverSyncTimer = setInterval(() => void this.syncServerClock(), 60_000);
-  }
-
-  ngOnDestroy(): void {
-    if (this.clockTimer) {
-      clearInterval(this.clockTimer);
-    }
-    if (this.serverSyncTimer) {
-      clearInterval(this.serverSyncTimer);
-    }
-    this.stopCamera();
-    this.clearSelfie();
-  }
-
-  private applyServerNow(serverNow: string | undefined | null): void {
-    if (!serverNow) {
-      return;
-    }
-    const parsed = Date.parse(serverNow);
-    if (Number.isNaN(parsed)) {
-      return;
-    }
-    this.serverOffsetMs = parsed - Date.now();
-    this.hasServerSync = true;
-    this.tickClock();
-  }
-
-  private async syncServerClock(): Promise<void> {
-    try {
-      const response = await firstValueFrom(this.timeClockApi.getServerClock());
-      this.applyServerNow(response.data.serverNow);
-    } catch {
-      // Keep last known offset; never fall back to trusting device for punches.
-    }
-  }
-
-  private tickClock(): void {
-    const source = this.hasServerSync
-      ? new Date(Date.now() + this.serverOffsetMs)
-      : null;
-
-    if (!source) {
-      this.nowLabel.set('Syncing server timeΓÇª');
-      return;
-    }
-
-    this.nowLabel.set(
-      source.toLocaleString('en-PH', {
-        timeZone: 'Asia/Manila',
-        weekday: 'short',
-        year: 'numeric',
-        month: 'short',
-        day: 'numeric',
-        hour: '2-digit',
-        minute: '2-digit',
-        second: '2-digit',
-      }),
-    );
-  }
-
-  async lookup(): Promise<void> {
-    const value = this.username().trim();
-    if (!value) {
-      this.error.set('Enter your username.');
-      this.status.set(null);
-      return;
-    }
-
-    this.loading.set(true);
-    this.error.set('');
-    this.success.set('');
-    this.clearSelfie();
-    this.stopCamera();
-
-    try {
-      const response = await firstValueFrom(this.timeClockApi.getStatus(value));
-      this.status.set(response.data);
-      this.applyServerNow(response.data.serverNow);
-      this.username.set(response.data.username || value);
-      this.locationLabel.set(response.data.locationLabel ?? '');
-      this.locationCoords.set(
-        response.data.locationLat != null && response.data.locationLng != null
-          ? { lat: response.data.locationLat, lng: response.data.locationLng }
-          : null,
-      );
-      this.locationStatus.set('');
-
-      const expected = response.data.expectedLocation;
-      if (expected === 'office' || expected === 'wfh') {
-        this.pickedLocation.set(expected);
-      } else {
-        this.pickedLocation.set(null);
-      }
-
-      if (response.data.canTimeIn && this.pickedLocation() === 'wfh') {
-        void this.requestGeolocation();
-      }
-
-      // Don't block the Check button on camera warmup.
-      if (response.data.canTimeIn || response.data.canTimeOut) {
-        void this.startCamera();
-      }
-    } catch {
-      this.error.set('Unable to look up username.');
-      this.status.set(null);
-    } finally {
-      this.loading.set(false);
-    }
-  }
-
-  async startCamera(): Promise<void> {
-    this.cameraError.set('');
-    this.cameraReady.set(false);
-    this.cameraStarting.set(true);
-
-    if (!navigator.mediaDevices?.getUserMedia) {
-      this.cameraError.set('Camera is not supported on this device/browser.');
-      this.cameraStarting.set(false);
-      return;
-    }
-
-    // Reuse an already-open stream when possible (faster retake).
-    if (this.mediaStream && this.mediaStream.active) {
-      this.cameraStarting.set(false);
-      this.cameraReady.set(true);
-      return;
-    }
-
-    this.stopCameraTracksOnly();
-    const requestId = ++this.cameraRequestId;
-
-    try {
-      const stream = await navigator.mediaDevices.getUserMedia({
-        audio: false,
-        video: {
-          facingMode: 'user',
-          width: { ideal: 480 },
-          height: { ideal: 480 },
-          frameRate: { ideal: 24, max: 30 },
-        },
-      });
-
-      if (requestId !== this.cameraRequestId) {
-        for (const track of stream.getTracks()) {
-          track.stop();
-        }
-        return;
-      }
-
-      this.mediaStream = stream;
-      // Effect attaches stream once the <video> exists.
-      if (this.videoRef()?.nativeElement) {
-        const video = this.videoRef()!.nativeElement;
-        video.srcObject = stream;
-        video.onloadedmetadata = () => {
-          void video.play().finally(() => {
-            this.cameraReady.set(true);
-            this.cameraStarting.set(false);
-          });
-        };
-      }
-    } catch {
-      if (requestId !== this.cameraRequestId) {
-        return;
-      }
-      this.cameraError.set('Unable to access camera. Allow camera permission and try again.');
-      this.mediaStream = null;
-      this.cameraStarting.set(false);
-      this.cameraReady.set(false);
-    }
-  }
-
-  stopCamera(): void {
-    this.cameraRequestId += 1;
-    this.cameraStarting.set(false);
-    this.cameraReady.set(false);
-    this.stopCameraTracksOnly();
-
-    const video = this.videoRef()?.nativeElement;
-    if (video) {
-      video.srcObject = null;
-      video.onloadedmetadata = null;
-    }
-  }
-
-  private stopCameraTracksOnly(): void {
-    if (this.mediaStream) {
-      for (const track of this.mediaStream.getTracks()) {
-        track.stop();
-      }
-      this.mediaStream = null;
-    }
-  }
-
-  async captureSelfie(): Promise<void> {
-    const video = this.videoRef()?.nativeElement;
-    if (!video || !this.cameraReady()) {
-      this.error.set('Camera is not ready yet.');
-      return;
-    }
-
-    const width = video.videoWidth || 480;
-    const height = video.videoHeight || 480;
-    const canvas = document.createElement('canvas');
-    canvas.width = width;
-    canvas.height = height;
-    const context = canvas.getContext('2d');
-    if (!context) {
-      this.error.set('Unable to capture selfie.');
-      return;
-    }
-
-    context.translate(width, 0);
-    context.scale(-1, 1);
-    context.drawImage(video, 0, 0, width, height);
-
-    const blob = await new Promise<Blob | null>((resolve) => {
-      canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.8);
-    });
-
-    if (!blob) {
-      this.error.set('Unable to capture selfie.');
-      return;
-    }
-
-    this.clearSelfiePreviewOnly();
-    this.selfieBlob.set(blob);
-    this.selfiePreviewUrl.set(URL.createObjectURL(blob));
-    this.error.set('');
-  }
-
-  retakeSelfie(): void {
-    this.clearSelfiePreviewOnly();
-    // Keep the existing stream ΓÇö avoids another slow getUserMedia round-trip.
-    if (this.mediaStream?.active) {
-      this.cameraReady.set(false);
-      this.cameraStarting.set(true);
-      // <video> remounts after preview clears; effect re-attaches the stream.
-      return;
-    }
-
-    void this.startCamera();
-  }
-
-  async punchIn(): Promise<void> {
-    await this.punch('in');
-  }
-
-  async punchOut(): Promise<void> {
-    await this.punch('out');
-  }
-
-  private async punch(kind: 'in' | 'out'): Promise<void> {
-    const value = this.username().trim();
-    if (!value) {
-      this.error.set('Enter your username.');
-      return;
-    }
-
-    const selfie = this.selfieBlob();
-    if (!selfie) {
-      this.error.set('Take a selfie first before submitting.');
-      return;
-    }
-
-    const pick = this.pickedLocation();
-    if (kind === 'in' && pick == null) {
-      this.error.set('Choose Office or Work from home before time in.');
-      return;
-    }
-
-    this.submitting.set(true);
-    this.error.set('');
-    this.success.set('');
-
-    let location =
-      kind === 'in' && pick === 'wfh'
-        ? {
-            locationLat: this.locationCoords()?.lat ?? null,
-            locationLng: this.locationCoords()?.lng ?? null,
-            locationLabel: this.locationLabel().trim() || null,
-          }
-        : null;
-
-    if (kind === 'in' && pick === 'wfh' && !this.locationCoords() && !this.requestingLocation()) {
-      await this.requestGeolocation();
-      location = {
-        locationLat: this.locationCoords()?.lat ?? null,
-        locationLng: this.locationCoords()?.lng ?? null,
-        locationLabel: this.locationLabel().trim() || null,
-      };
-    }
-
-    try {
-      const response = await firstValueFrom(
-        kind === 'in'
-          ? this.timeClockApi.timeIn(value, selfie, pick!, location)
-          : this.timeClockApi.timeOut(value, selfie),
-      );
-      this.status.set(response.data);
-      this.applyServerNow(response.data.serverNow);
-      this.success.set(response.message);
-      this.clearSelfiePreviewOnly();
-      this.stopCamera();
-
-      if (response.data.canTimeOut) {
-        void this.startCamera();
-      }
-    } catch (err: unknown) {
-      const message =
-        typeof err === 'object' &&
-        err !== null &&
-        'error' in err &&
-        typeof (err as { error?: { message?: string } }).error?.message === 'string'
-          ? (err as { error: { message: string } }).error.message
-          : kind === 'in'
-            ? 'Unable to record time in.'
-            : 'Unable to record time out.';
-      this.error.set(message);
-      await this.lookup();
-    } finally {
-      this.submitting.set(false);
-    }
-  }
-
-  expectedLocationLabel(value: string | null | undefined): string {
-    switch (value) {
-      case 'wfh':
-        return 'Work from home';
-      case 'off':
-        return 'Day off';
-      case 'office':
-        return 'Office';
-      default:
-        return 'Office';
-    }
-  }
-
-  async requestGeolocation(): Promise<void> {
-    if (!navigator.geolocation) {
-      this.locationStatus.set('Location is not available on this device. You can still time in.');
-      this.locationCoords.set(null);
-      return;
-    }
-
-    this.requestingLocation.set(true);
-    this.locationStatus.set('Getting your locationΓÇª');
-
-    try {
-      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
-        navigator.geolocation.getCurrentPosition(resolve, reject, {
-          enableHighAccuracy: true,
-          timeout: 12_000,
-          maximumAge: 60_000,
-        });
-      });
-      this.locationCoords.set({
-        lat: position.coords.latitude,
-        lng: position.coords.longitude,
-      });
-      this.locationStatus.set(
-        `GPS captured (┬▒${Math.round(position.coords.accuracy || 0)} m). You can add an optional label.`,
-      );
-    } catch {
-      this.locationCoords.set(null);
-      this.locationStatus.set('GPS unavailable. You can still time in with an optional label.');
-    } finally {
-      this.requestingLocation.set(false);
-    }
-  }
-
-  formatPunch(value: string | null): string {
-    if (!value) {
-      return 'ΓÇö';
-    }
-
-    return new Date(value).toLocaleTimeString('en-PH', {
-      timeZone: 'Asia/Manila',
-      hour: '2-digit',
-      minute: '2-digit',
-      second: '2-digit',
-    });
-  }
-
-  needsSelfie(): boolean {
-    const current = this.status();
-    return Boolean(current?.canTimeIn || current?.canTimeOut);
-  }
-
-  private clearSelfiePreviewOnly(): void {
-    const preview = this.selfiePreviewUrl();
-    if (preview?.startsWith('blob:')) {
-      URL.revokeObjectURL(preview);
-    }
-    this.selfiePreviewUrl.set(null);
-    this.selfieBlob.set(null);
-  }
-
-  private clearSelfie(): void {
-    this.clearSelfiePreviewOnly();
-  }
-}
diff --git a/frontend/src/app/website/pages/time-clock/time-clock-redirect.component.ts b/frontend/src/app/website/pages/time-clock/time-clock-redirect.component.ts
new file mode 100644
index 0000000..edcb454
--- /dev/null
+++ b/frontend/src/app/website/pages/time-clock/time-clock-redirect.component.ts
@@ -0,0 +1,17 @@
+import { Component, OnInit, inject } from '@angular/core';
+import { Router } from '@angular/router';
+
+@Component({
+  standalone: true,
+  selector: 'app-time-clock-redirect',
+  template: '',
+})
+export class TimeClockRedirectComponent implements OnInit {
+  private readonly router = inject(Router);
+
+  ngOnInit(): void {
+    void this.router.navigate(['/user/login'], {
+      queryParams: { returnUrl: '/admin/time-clock' },
+    });
+  }
+}
