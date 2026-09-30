BASE: bdffa534c19bd8fb8719bc8f46f2708e872729ea
HEAD: a64c2ecdb318eba2bc5ab5c08e0410d10a224b4a


## Commits (feature only from plan start 7fea902)

a64c2ec Gate portal login landing on time-clock canTimeIn.

## Stat (7fea902..HEAD)

 ...2026-09-30-clock-gated-portal-landing-design.md |  2 +-
 frontend/src/app/user/guards/portal-auth.guards.ts | 21 +++++++++---
 .../app/user/pages/portal-login-page.component.ts  | 38 ++++++++++++----------
 frontend/src/app/user/portal-post-login-route.ts   | 37 +++++++++++++++++++++
 4 files changed, 75 insertions(+), 23 deletions(-)

## Diff (7fea902..HEAD)

diff --git a/docs/superpowers/specs/2026-09-30-clock-gated-portal-landing-design.md b/docs/superpowers/specs/2026-09-30-clock-gated-portal-landing-design.md
index e23dbab..d199db7 100644
--- a/docs/superpowers/specs/2026-09-30-clock-gated-portal-landing-design.md
+++ b/docs/superpowers/specs/2026-09-30-clock-gated-portal-landing-design.md
@@ -1,14 +1,14 @@
 # Clock-Gated Portal Landing
 
 **Date:** 2026-09-30  
-**Status:** Approved design ΓÇö pending implementation  
+**Status:** Implemented  
 **Approach:** Post-login resolve via portal time-clock status (`canTimeIn`)
 
 ## Goal
 
 After portal login, payroll time-clockΓÇôenabled employees who still need to clock in land on Time Clock first. Once they are clocked in (or have completed the day), login lands on their normal role home (e.g. Sales Dashboard).
 
 ## Decisions locked
 
 | Topic | Choice |
 |-------|--------|
diff --git a/frontend/src/app/user/guards/portal-auth.guards.ts b/frontend/src/app/user/guards/portal-auth.guards.ts
index 0fd8c35..62b8230 100644
--- a/frontend/src/app/user/guards/portal-auth.guards.ts
+++ b/frontend/src/app/user/guards/portal-auth.guards.ts
@@ -1,17 +1,28 @@
 import { inject } from '@angular/core';
 import { CanActivateFn, Router } from '@angular/router';
-import { getRoleHomeRoute } from '../../admin/rbac/admin-roles';
+import { firstValueFrom } from 'rxjs';
+import { AdminApiService } from '../../admin/services/admin-api.service';
 import { AdminAuthService } from '../../admin/services/admin-auth.service';
+import { resolvePortalPostLoginRoute } from '../portal-post-login-route';
 
-/** Guest-only portal login; authenticated users go to their role home. */
-export const portalGuestGuard: CanActivateFn = () => {
+/** Guest-only portal login; authenticated users go to clock-gated landing. */
+export const portalGuestGuard: CanActivateFn = async (route) => {
   const adminAuth = inject(AdminAuthService);
+  const adminApi = inject(AdminApiService);
   const router = inject(Router);
 
   if (!adminAuth.isAuthenticated()) {
     return true;
   }
 
-  const role = adminAuth.getStoredUser()?.role;
-  return router.createUrlTree([getRoleHomeRoute(role)]);
+  const url = await resolvePortalPostLoginRoute({
+    role: adminAuth.getStoredUser()?.role,
+    returnUrl: route.queryParamMap.get('returnUrl'),
+    fetchCanTimeIn: async () => {
+      const status = await firstValueFrom(adminApi.getPortalTimeClockStatus());
+      return Boolean(status?.data?.canTimeIn);
+    },
+  });
+
+  return router.parseUrl(url);
 };
diff --git a/frontend/src/app/user/pages/portal-login-page.component.ts b/frontend/src/app/user/pages/portal-login-page.component.ts
index b71334e..0d4cefd 100644
--- a/frontend/src/app/user/pages/portal-login-page.component.ts
+++ b/frontend/src/app/user/pages/portal-login-page.component.ts
@@ -1,49 +1,54 @@
 import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
 import { FormsModule } from '@angular/forms';
 import { ActivatedRoute, Router, RouterLink } from '@angular/router';
 import { firstValueFrom } from 'rxjs';
-import { getRoleHomeRoute } from '../../admin/rbac/admin-roles';
+import { AdminApiService } from '../../admin/services/admin-api.service';
 import { AdminAuthService } from '../../admin/services/admin-auth.service';
+import { resolvePortalPostLoginRoute } from '../portal-post-login-route';
 
 @Component({
   selector: 'app-portal-login-page',
   imports: [FormsModule, RouterLink],
   templateUrl: './portal-login-page.component.html',
 })
 export class PortalLoginPageComponent implements OnInit, OnDestroy {
   private readonly adminAuth = inject(AdminAuthService);
+  private readonly adminApi = inject(AdminApiService);
   private readonly router = inject(Router);
   private readonly route = inject(ActivatedRoute);
   private stopAuthWatch: (() => void) | null = null;
 
   readonly username = signal('');
   readonly password = signal('');
   readonly rememberMe = signal(false);
   readonly showPassword = signal(false);
   readonly loading = signal(false);
   readonly error = signal('');
 
   ngOnInit(): void {
-    this.redirectIfAuthenticated();
-    this.stopAuthWatch = this.adminAuth.onAuthStorageChange(() => this.redirectIfAuthenticated());
+    void this.redirectIfAuthenticated();
+    this.stopAuthWatch = this.adminAuth.onAuthStorageChange(() => {
+      void this.redirectIfAuthenticated();
+    });
   }
 
   ngOnDestroy(): void {
     this.stopAuthWatch?.();
   }
 
-  private redirectIfAuthenticated(): void {
+  private async redirectIfAuthenticated(): Promise<void> {
     if (!this.adminAuth.isAuthenticated()) {
       return;
     }
-    void this.router.navigateByUrl(this.resolvePostLoginRoute(this.adminAuth.getStoredUser()?.role));
+    const url = await this.resolveLanding(this.adminAuth.getStoredUser()?.role);
+    await this.router.navigateByUrl(url);
   }
 
   async submit(): Promise<void> {
     if (this.loading()) {
       return;
     }
 
     this.loading.set(true);
     this.error.set('');
 
@@ -51,39 +56,38 @@ export class PortalLoginPageComponent implements OnInit, OnDestroy {
       const response = await firstValueFrom(
         this.adminAuth.portalLogin(this.username(), this.password(), this.rememberMe()),
       );
 
       this.adminAuth.saveSession(
         response.data.accessToken,
         response.data.user,
         this.rememberMe(),
       );
 
-      await this.router.navigateByUrl(this.resolvePostLoginRoute(response.data.user.role));
+      const url = await this.resolveLanding(response.data.user.role);
+      await this.router.navigateByUrl(url);
     } catch (error) {
       this.error.set(this.extractLoginError(error));
     } finally {
       this.loading.set(false);
     }
   }
 
-  private resolvePostLoginRoute(role?: string | null): string {
-    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
-    if (returnUrl && this.isSafeAdminReturnUrl(returnUrl)) {
-      return returnUrl;
-    }
-    return getRoleHomeRoute(role);
-  }
-
-  /** Only same-origin relative admin paths ΓÇö blocks open redirects. */
-  private isSafeAdminReturnUrl(url: string): boolean {
-    return url.startsWith('/admin/') && !url.startsWith('//') && !url.includes('://');
+  private resolveLanding(role?: string | null): Promise<string> {
+    return resolvePortalPostLoginRoute({
+      role,
+      returnUrl: this.route.snapshot.queryParamMap.get('returnUrl'),
+      fetchCanTimeIn: async () => {
+        const status = await firstValueFrom(this.adminApi.getPortalTimeClockStatus());
+        return Boolean(status?.data?.canTimeIn);
+      },
+    });
   }
 
   private extractLoginError(error: unknown): string {
     if (error && typeof error === 'object' && 'error' in error) {
       const payload = (error as { error?: { message?: string | string[] } }).error;
 
       if (Array.isArray(payload?.message)) {
         return payload.message.join(', ');
       }
 
diff --git a/frontend/src/app/user/portal-post-login-route.ts b/frontend/src/app/user/portal-post-login-route.ts
new file mode 100644
index 0000000..18e2174
--- /dev/null
+++ b/frontend/src/app/user/portal-post-login-route.ts
@@ -0,0 +1,37 @@
+import { getRoleHomeRoute } from '../admin/rbac/admin-roles';
+
+const TIME_CLOCK_ROUTE = '/admin/time-clock';
+
+export function isSafeAdminReturnUrl(url: string): boolean {
+  return url.startsWith('/admin/') && !url.startsWith('//') && !url.includes('://');
+}
+
+/**
+ * Portal landing after auth:
+ * 1) safe returnUrl
+ * 2) /admin/time-clock when canTimeIn
+ * 3) role home otherwise (including status errors)
+ */
+export async function resolvePortalPostLoginRoute(options: {
+  role?: string | null;
+  returnUrl: string | null | undefined;
+  fetchCanTimeIn: () => Promise<boolean>;
+}): Promise<string> {
+  const returnUrl = (options.returnUrl ?? '').trim();
+  if (returnUrl && isSafeAdminReturnUrl(returnUrl)) {
+    return returnUrl;
+  }
+
+  const roleHome = getRoleHomeRoute(options.role);
+
+  try {
+    const canTimeIn = await options.fetchCanTimeIn();
+    if (canTimeIn === true) {
+      return TIME_CLOCK_ROUTE;
+    }
+  } catch {
+    // Fall through to role home ΓÇö never block login on status failure.
+  }
+
+  return roleHome;
+}
