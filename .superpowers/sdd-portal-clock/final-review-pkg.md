diff --git a/backend/src/admin/admin.module.ts b/backend/src/admin/admin.module.ts
index 09c2d4f..96632e0 100644
--- a/backend/src/admin/admin.module.ts
+++ b/backend/src/admin/admin.module.ts
@@ -37,11 +37,10 @@ import { MarketingTeamsService } from './marketing/marketing-teams.service';
 import { ClientProspectsController } from './marketing/client-prospects.controller';
 import { ClientProspectsService } from './marketing/client-prospects.service';
 import { CurrencyExchangeService } from './marketing/currency-exchange.service';
 import { PayrollController } from './payroll/payroll.controller';
 import { PayrollModule } from './payroll/payroll.module';
-import { TimeClockController } from './payroll/time-clock.controller';
 import { ProjectsController } from './projects/projects.controller';
 import { ProjectsModule } from './projects/projects.module';
 import { CompanyExpensesController } from './company-expenses/company-expenses.controller';
 import { CompanyExpensesService } from './company-expenses/company-expenses.service';
 import { PartsPriceSearchController } from './parts-price-search/parts-price-search.controller';
@@ -62,11 +61,10 @@ import { PartsPriceSearchService } from './parts-price-search/parts-price-search
     QuotationController,
     PublicQuotationsController,
     PartsPriceSearchController,
     UsersController,
     PayrollController,
-    TimeClockController,
     MarketingTeamsController,
     ClientProspectsController,
     ProjectsController,
     EmployeeWorkspaceController,
     PrintingSettingsController,
diff --git a/backend/src/admin/employee-workspace/employee-workspace.controller.ts b/backend/src/admin/employee-workspace/employee-workspace.controller.ts
index 1cd660b..2c85ea0 100644
--- a/backend/src/admin/employee-workspace/employee-workspace.controller.ts
+++ b/backend/src/admin/employee-workspace/employee-workspace.controller.ts
@@ -54,10 +54,67 @@ export class EmployeeWorkspaceController {
     const { userId, source } = this.actor(req);
     const data = await this.workspaceService.getDashboard(userId, source, month);
     return { success: true, data };
   }
 
+  @Get('time-clock/status')
+  async timeClockStatus(@Req() req: Request & { user?: AdminJwtPayload }) {
+    const { userId, source } = this.actor(req);
+    const data = await this.workspaceService.getTimeClockStatus(userId, source);
+    return { success: true, data };
+  }
+
+  @Post('time-clock/time-in')
+  @UseInterceptors(
+    FileInterceptor('selfie', {
+      storage: memoryStorage(),
+      limits: { fileSize: 2 * 1024 * 1024 },
+    }),
+  )
+  async timeClockTimeIn(
+    @Req() req: Request & { user?: AdminJwtPayload },
+    @Body('workLocationType') workLocationType?: string,
+    @Body('locationLat') locationLat?: string,
+    @Body('locationLng') locationLng?: string,
+    @Body('locationLabel') locationLabel?: string,
+    @UploadedFile() selfie?: Express.Multer.File,
+  ) {
+    const { userId, source } = this.actor(req);
+    if (!selfie) {
+      throw new BadRequestException('Selfie photo is required before time in.');
+    }
+    const picked = (workLocationType ?? '').trim().toLowerCase();
+    if (picked !== 'office' && picked !== 'wfh') {
+      throw new BadRequestException('Choose Office or Work from home before time in.');
+    }
+    const data = await this.workspaceService.timeIn(userId, source, selfie, picked, {
+      locationLat,
+      locationLng,
+      locationLabel,
+    });
+    return { success: true, message: 'Time in recorded.', data };
+  }
+
+  @Post('time-clock/time-out')
+  @UseInterceptors(
+    FileInterceptor('selfie', {
+      storage: memoryStorage(),
+      limits: { fileSize: 2 * 1024 * 1024 },
+    }),
+  )
+  async timeClockTimeOut(
+    @Req() req: Request & { user?: AdminJwtPayload },
+    @UploadedFile() selfie?: Express.Multer.File,
+  ) {
+    const { userId, source } = this.actor(req);
+    if (!selfie) {
+      throw new BadRequestException('Selfie photo is required before time out.');
+    }
+    const data = await this.workspaceService.timeOut(userId, source, selfie);
+    return { success: true, message: 'Time out recorded.', data };
+  }
+
   @Get('payslips/:id')
   async payslipDetail(
     @Req() req: Request & { user?: AdminJwtPayload },
     @Param('id', ParseIntPipe) id: number,
   ) {
diff --git a/backend/src/admin/employee-workspace/employee-workspace.service.ts b/backend/src/admin/employee-workspace/employee-workspace.service.ts
index 070dd8e..94b98e9 100644
--- a/backend/src/admin/employee-workspace/employee-workspace.service.ts
+++ b/backend/src/admin/employee-workspace/employee-workspace.service.ts
@@ -3,12 +3,12 @@ import {
   ForbiddenException,
   Injectable,
   NotFoundException,
 } from '@nestjs/common';
 import { DatabaseService } from '../../database/database.service';
-import { isSalesRestrictedInventory, isSuperAdmin } from '../rbac/admin-roles.util';
-import { PayrollService } from '../payroll/payroll.service';
+import { canUsePortalLogin, isSuperAdmin } from '../rbac/admin-roles.util';
+import { PayrollService, TimeClockLocationInput } from '../payroll/payroll.service';
 import { manilaWorkDate } from '../payroll/payroll.schema';
 import { ensureEmployeeWorkspaceTables } from './employee-workspace.schema';
 import {
   CreateActivityDto,
   CreateTodoDto,
@@ -35,16 +35,65 @@ export class EmployeeWorkspaceService {
     await this.payrollService.ensureReady();
     this.ready = true;
   }
 
   assertSalesWorkspaceAccess(role?: string | null): void {
-    if (isSuperAdmin(role)) {
+    if (isSuperAdmin(role) || canUsePortalLogin(role)) {
       return;
     }
-    if (!isSalesRestrictedInventory(role)) {
-      throw new ForbiddenException('Employee workspace is available for Sales Manager roles.');
+    throw new ForbiddenException('Employee workspace is not available for this role.');
+  }
+
+  async getTimeClockStatus(userId: number, source: UserSource) {
+    await this.ensureReady();
+    return this.payrollService.getTimeClockStatusForUser(userId, source);
+  }
+
+  async timeIn(
+    userId: number,
+    source: UserSource,
+    selfie: Express.Multer.File,
+    workLocationType: 'office' | 'wfh',
+    location?: {
+      locationLat?: string;
+      locationLng?: string;
+      locationLabel?: string;
+    } | null,
+  ) {
+    await this.ensureReady();
+    return this.payrollService.timeInForUser(
+      userId,
+      source,
+      selfie,
+      workLocationType,
+      this.parseLocation(location?.locationLat, location?.locationLng, location?.locationLabel),
+    );
+  }
+
+  async timeOut(userId: number, source: UserSource, selfie: Express.Multer.File) {
+    await this.ensureReady();
+    return this.payrollService.timeOutForUser(userId, source, selfie);
+  }
+
+  private parseLocation(
+    locationLat?: string,
+    locationLng?: string,
+    locationLabel?: string,
+  ): TimeClockLocationInput | null {
+    const latRaw = locationLat?.trim();
+    const lngRaw = locationLng?.trim();
+    const label = locationLabel?.trim() || null;
+    const lat = latRaw ? Number(latRaw) : null;
+    const lng = lngRaw ? Number(lngRaw) : null;
+    if (lat == null && lng == null && !label) {
+      return null;
     }
+    return {
+      locationLat: lat != null && Number.isFinite(lat) ? lat : null,
+      locationLng: lng != null && Number.isFinite(lng) ? lng : null,
+      locationLabel: label,
+    };
   }
 
   async getDashboard(
     userId: number,
     source: UserSource,
diff --git a/backend/src/admin/payroll/payroll.service.ts b/backend/src/admin/payroll/payroll.service.ts
index d13e99c..40aa29e 100644
--- a/backend/src/admin/payroll/payroll.service.ts
+++ b/backend/src/admin/payroll/payroll.service.ts
@@ -2449,10 +2449,63 @@ export class PayrollService {
     await this.clearPendingAdjustment(punched.id);
 
     return this.getTimeClockStatus(user.username);
   }
 
+  async getTimeClockStatusForUser(
+    userId: number,
+    source: 'tblusers' | 'pcmazing_admin_users',
+  ): Promise<TimeClockStatus> {
+    const identity = await this.resolveUserIdentity(userId, source);
+    if (!identity) {
+      const clock = await this.getServerClock();
+      const settings = await this.getSettings();
+      return {
+        username: '',
+        fullName: '',
+        employeeCode: null,
+        workDate: clock.workDate,
+        timeIn: null,
+        timeOut: null,
+        canTimeIn: false,
+        canTimeOut: false,
+        status: 'not_found',
+        message: 'Account not found.',
+        serverNow: clock.serverNow,
+        undertimeGraceMinutes: settings.undertimeGraceMinutes,
+        ...this.emptyTimeClockLocationFields(clock.workDate, settings.workWeek),
+      };
+    }
+    return this.getTimeClockStatus(identity.username);
+  }
+
+  async timeInForUser(
+    userId: number,
+    source: 'tblusers' | 'pcmazing_admin_users',
+    selfie: Express.Multer.File,
+    workLocationType: 'office' | 'wfh',
+    location?: TimeClockLocationInput | null,
+  ): Promise<TimeClockStatus> {
+    const identity = await this.resolveUserIdentity(userId, source);
+    if (!identity) {
+      throw new NotFoundException('Account not found.');
+    }
+    return this.timeIn(identity.username, selfie, workLocationType, location);
+  }
+
+  async timeOutForUser(
+    userId: number,
+    source: 'tblusers' | 'pcmazing_admin_users',
+    selfie: Express.Multer.File,
+  ): Promise<TimeClockStatus> {
+    const identity = await this.resolveUserIdentity(userId, source);
+    if (!identity) {
+      throw new NotFoundException('Account not found.');
+    }
+    return this.timeOut(identity.username, selfie);
+  }
+
   async requestOvertime(
     userId: number,
     userSource: AdminUserRecord['source'],
     attendanceId: number,
   ) {
diff --git a/backend/src/admin/payroll/time-clock.controller.ts b/backend/src/admin/payroll/time-clock.controller.ts
deleted file mode 100644
index 416804d..0000000
--- a/backend/src/admin/payroll/time-clock.controller.ts
+++ /dev/null
@@ -1,153 +0,0 @@
-import {
-  BadRequestException,
-  Body,
-  Controller,
-  Get,
-  Post,
-  Query,
-  UploadedFile,
-  UseInterceptors,
-} from '@nestjs/common';
-import { FileInterceptor } from '@nestjs/platform-express';
-import { memoryStorage } from 'multer';
-import { PayrollService, TimeClockLocationInput } from './payroll.service';
-import { resolveExpectedLocation } from './work-location.util';
-
-/** Public time clock ΓÇö no admin auth. Punches use database NOW(), never device time. */
-@Controller('payroll/time-clock')
-export class TimeClockController {
-  constructor(private readonly payrollService: PayrollService) {}
-
-  @Get('now')
-  now() {
-    return this.payrollService.getServerClock().then((data) => ({
-      success: true,
-      data,
-    }));
-  }
-
-  @Get('status')
-  async status(@Query('username') username?: string) {
-    const value = username?.trim();
-    if (!value) {
-      const clock = await this.payrollService.getServerClock();
-      const settings = await this.payrollService.getSettings();
-      const expectedLocation = resolveExpectedLocation(null, settings.workWeek, clock.workDate);
-      return {
-        success: true,
-        data: {
-          username: '',
-          fullName: '',
-          employeeCode: null,
-          workDate: clock.workDate,
-          timeIn: null,
-          timeOut: null,
-          canTimeIn: false,
-          canTimeOut: false,
-          status: 'not_found',
-          message: 'Enter a username to continue.',
-          serverNow: clock.serverNow,
-          undertimeGraceMinutes: settings.undertimeGraceMinutes,
-          expectedLocation,
-          locationLabel: null,
-          locationLat: null,
-          locationLng: null,
-          locationMismatch: false,
-        },
-      };
-    }
-
-    return this.payrollService.getTimeClockStatus(value).then((data) => ({
-      success: true,
-      data,
-    }));
-  }
-
-  @Post('time-in')
-  @UseInterceptors(
-    FileInterceptor('selfie', {
-      storage: memoryStorage(),
-      limits: { fileSize: 2 * 1024 * 1024 },
-    }),
-  )
-  timeIn(
-    @Body('username') username: string,
-    @Body('workLocationType') workLocationType?: string,
-    @Body('locationLat') locationLat?: string,
-    @Body('locationLng') locationLng?: string,
-    @Body('locationLabel') locationLabel?: string,
-    @UploadedFile() selfie?: Express.Multer.File,
-  ) {
-    const value = username?.trim();
-    if (!value) {
-      throw new BadRequestException('Username is required.');
-    }
-    if (!selfie) {
-      throw new BadRequestException('Selfie photo is required before time in.');
-    }
-
-    const picked = (workLocationType ?? '').trim().toLowerCase();
-    if (picked !== 'office' && picked !== 'wfh') {
-      throw new BadRequestException('Choose Office or Work from home before time in.');
-    }
-
-    return this.payrollService
-      .timeIn(value, selfie, picked, this.parseLocation(locationLat, locationLng, locationLabel))
-      .then((data) => ({
-        success: true,
-        message: 'Time in recorded.',
-        data,
-      }));
-  }
-
-  @Post('time-out')
-  @UseInterceptors(
-    FileInterceptor('selfie', {
-      storage: memoryStorage(),
-      limits: { fileSize: 2 * 1024 * 1024 },
-    }),
-  )
-  timeOut(
-    @Body('username') username: string,
-    @Body('locationLat') locationLat?: string,
-    @Body('locationLng') locationLng?: string,
-    @Body('locationLabel') locationLabel?: string,
-    @UploadedFile() selfie?: Express.Multer.File,
-  ) {
-    const value = username?.trim();
-    if (!value) {
-      throw new BadRequestException('Username is required.');
-    }
-    if (!selfie) {
-      throw new BadRequestException('Selfie photo is required before time out.');
-    }
-
-    return this.payrollService
-      .timeOut(value, selfie, this.parseLocation(locationLat, locationLng, locationLabel))
-      .then((data) => ({
-        success: true,
-        message: 'Time out recorded.',
-        data,
-      }));
-  }
-
-  private parseLocation(
-    locationLat?: string,
-    locationLng?: string,
-    locationLabel?: string,
-  ): TimeClockLocationInput | null {
-    const latRaw = locationLat?.trim();
-    const lngRaw = locationLng?.trim();
-    const label = locationLabel?.trim() || null;
-    const lat = latRaw ? Number(latRaw) : null;
-    const lng = lngRaw ? Number(lngRaw) : null;
-    if (lat == null && lng == null && !label) {
-      return null;
-    }
-    return {
-      locationLat: lat != null && Number.isFinite(lat) ? lat : null,
-      locationLng: lng != null && Number.isFinite(lng) ? lng : null,
-      locationLabel: label,
-    };
-  }
-}
diff --git a/docs/superpowers/specs/2026-09-23-portal-time-clock-design.md b/docs/superpowers/specs/2026-09-23-portal-time-clock-design.md
index fea1ba6..a1a0593 100644
--- a/docs/superpowers/specs/2026-09-23-portal-time-clock-design.md
+++ b/docs/superpowers/specs/2026-09-23-portal-time-clock-design.md
@@ -1,9 +1,9 @@
 # Portal Time Clock (Session-Bound, No Public Search)
 
 **Date:** 2026-09-23  
-**Status:** Approved design ΓÇö pending implementation  
+**Status:** Implemented  
 **Approach:** Session-bound employee-workspace APIs + shared portal UI (dashboard compact + full page); remove public `/time-clock`
 
 ## Goal
 
 Move clock-in / clock-out into each employeeΓÇÖs logged-in portal so they never type or search a username. Punch rules stay the same (selfie, Office/WFH pick, WFH GPS); identity comes from the portal JWT.
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
diff --git a/frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.html b/frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.html
new file mode 100644
index 0000000..705f61b
--- /dev/null
+++ b/frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.html
@@ -0,0 +1,275 @@
+<section
+  class="w-full rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
+  [class.p-4]="mode() === 'compact'"
+  [class.p-6]="mode() === 'full'"
+>
+  <div class="text-center" [class.mb-4]="mode() === 'compact'" [class.mb-6]="mode() === 'full'">
+    <p class="text-xs font-bold uppercase tracking-[0.2em] text-pcmazing-500">Time Clock</p>
+    <h2
+      class="mt-1 font-extrabold text-slate-900 dark:text-white"
+      [class.text-xl]="mode() === 'compact'"
+      [class.text-2xl]="mode() === 'full'"
+    >
+      {{ displayName() }}
+    </h2>
+    @if (mode() === 'full') {
+      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
+        Take a selfie, then time in or out. Identity comes from your signed-in session.
+      </p>
+    } @else {
+      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Selfie required ┬╖ session-bound</p>
+    }
+    <p class="mt-2 font-mono text-sm text-slate-600 dark:text-slate-300">{{ nowLabel() }}</p>
+    <p class="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Server time ┬╖ Asia/Manila</p>
+  </div>
+
+  @if (loading()) {
+    <div class="flex items-center justify-center py-8 text-sm text-slate-500">Loading status...</div>
+  }
+
+  @if (error()) {
+    <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
+      {{ error() }}
+    </div>
+  }
+  @if (success()) {
+    <div
+      class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
+      [class.mt-3]="!!error()"
+    >
+      {{ success() }}
+    </div>
+  }
+
+  @if (status(); as current) {
+    <div
+      class="rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
+      [class.mt-4]="mode() === 'compact'"
+      [class.mt-6]="mode() === 'full'"
+      [class.p-3]="mode() === 'compact'"
+      [class.p-4]="mode() === 'full'"
+    >
+      @if (current.employeeCode) {
+        <p class="text-xs text-slate-500 dark:text-slate-400">Employee code: {{ current.employeeCode }}</p>
+      }
+      <p class="text-sm text-slate-600 dark:text-slate-300" [class.mt-1]="!!current.employeeCode">{{ current.message }}</p>
+
+      @if (current.expectedLocation) {
+        <p
+          class="mt-3 rounded-xl px-3 py-2 text-xs font-semibold"
+          [class]="
+            current.expectedLocation === 'off'
+              ? 'border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
+              : current.expectedLocation === 'wfh'
+                ? 'border border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200'
+                : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
+          "
+        >
+          Today: {{ expectedLocationLabel(current.expectedLocation) }}
+          @if (current.expectedLocation === 'off') {
+            <span class="mt-1 block font-medium">Scheduled day off ΓÇö punch is still allowed.</span>
+          }
+        </p>
+      }
+
+      @if (current.canTimeIn) {
+        <div class="mt-3">
+          <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Working from</p>
+          <div class="mt-2 grid grid-cols-2 gap-2">
+            <button
+              type="button"
+              [class]="
+                pickedLocation() === 'office'
+                  ? 'rounded-xl border border-pcmazing-500 bg-pcmazing-500 px-3 py-2.5 text-sm font-bold text-white'
+                  : 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
+              "
+              (click)="pickedLocation.set('office')"
+            >
+              Office
+            </button>
+            <button
+              type="button"
+              [class]="
+                pickedLocation() === 'wfh'
+                  ? 'rounded-xl border border-pcmazing-500 bg-pcmazing-500 px-3 py-2.5 text-sm font-bold text-white'
+                  : 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
+              "
+              (click)="pickedLocation.set('wfh'); requestGeolocation()"
+            >
+              WFH
+            </button>
+          </div>
+          @if (current.expectedLocation === 'off') {
+            <p class="mt-2 text-xs text-amber-800 dark:text-amber-200">
+              Scheduled day off ΓÇö choose Office or WFH if you still need to clock in.
+            </p>
+          }
+        </div>
+      }
+
+      @if (current.canTimeIn && pickedLocation() === 'wfh') {
+        <div class="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900">
+          <label class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">Location label (optional)</label>
+          <input
+            type="text"
+            maxlength="200"
+            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
+            placeholder="e.g. Home ΓÇô Cabanatuan"
+            [ngModel]="locationLabel()"
+            (ngModelChange)="locationLabel.set($event)"
+          />
+          <p class="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
+            {{ locationStatus() || 'Location will be captured for WFH days.' }}
+          </p>
+          <button
+            type="button"
+            class="mt-2 text-xs font-bold text-pcmazing-500 hover:text-pcmazing-600"
+            [disabled]="requestingLocation()"
+            (click)="requestGeolocation()"
+          >
+            @if (requestingLocation()) {
+              Getting GPS...
+            } @else {
+              Refresh GPS
+            }
+          </button>
+        </div>
+      }
+
+      @if (current.canTimeOut && (current.undertimeGraceMinutes ?? 0) > 0 && mode() === 'full') {
+        <p class="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
+          Need to leave a little early (emergency, appointment, or event)? Clock out as usual. Up to
+          {{ current.undertimeGraceMinutes }} minutes before 9 hours still counts as a full paid day.
+        </p>
+      }
+
+      <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
+        <div class="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-900">
+          <p class="text-xs font-bold uppercase text-slate-400">Time in</p>
+          <p class="mt-1 font-semibold text-slate-900 dark:text-white">{{ formatPunch(current.timeIn) }}</p>
+        </div>
+        <div class="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-900">
+          <p class="text-xs font-bold uppercase text-slate-400">Time out</p>
+          <p class="mt-1 font-semibold text-slate-900 dark:text-white">{{ formatPunch(current.timeOut) }}</p>
+        </div>
+      </div>
+    </div>
+
+    @if (needsSelfie()) {
+      <div
+        class="rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
+        [class.mt-4]="mode() === 'compact'"
+        [class.mt-5]="mode() === 'full'"
+        [class.p-3]="mode() === 'compact'"
+        [class.p-4]="mode() === 'full'"
+      >
+        <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">Selfie proof required</p>
+        @if (mode() === 'full') {
+          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Capture a clear face photo before submitting your punch.</p>
+        }
+
+        @if (cameraError()) {
+          <div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
+            {{ cameraError() }}
+            <button type="button" class="ml-2 font-bold underline" (click)="startCamera()">Retry camera</button>
+          </div>
+        }
+
+        @if (selfiePreviewUrl(); as preview) {
+          <img
+            [src]="preview"
+            alt="Selfie preview"
+            class="mt-3 aspect-square w-full rounded-2xl border border-slate-200 object-cover dark:border-slate-600"
+          />
+          <button
+            type="button"
+            class="mt-3 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200"
+            (click)="retakeSelfie()"
+            [disabled]="submitting()"
+          >
+            Retake selfie
+          </button>
+        } @else {
+          <div class="relative mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-black dark:border-slate-600">
+            <video
+              #cameraVideo
+              class="aspect-square w-full scale-x-[-1] object-cover"
+              autoplay
+              playsinline
+              muted
+            ></video>
+            @if (cameraStarting() || !cameraReady()) {
+              <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/70 text-sm text-white">
+                <span class="size-8 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
+                <span>Opening camera...</span>
+              </div>
+            }
+          </div>
+          <button
+            type="button"
+            class="mt-3 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 ring-1 ring-slate-300 disabled:opacity-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600"
+            [disabled]="!cameraReady() || cameraStarting() || submitting()"
+            (click)="captureSelfie()"
+          >
+            @if (cameraStarting()) {
+              Waiting for camera...
+            } @else {
+              Capture selfie
+            }
+          </button>
+        }
+      </div>
+    }
+
+    <div class="grid gap-3" [class.mt-4]="mode() === 'compact'" [class.mt-5]="mode() === 'full'">
+      @if (current.canTimeIn) {
+        <button
+          type="button"
+          class="w-full rounded-2xl bg-pcmazing-500 font-bold text-white hover:bg-pcmazing-600 disabled:opacity-50"
+          [class.px-4]="true"
+          [class.py-3]="mode() === 'compact'"
+          [class.py-4]="mode() === 'full'"
+          [class.text-sm]="mode() === 'compact'"
+          [class.text-base]="mode() === 'full'"
+          [disabled]="submitting() || !selfieBlob() || !pickedLocation()"
+          (click)="punchIn()"
+        >
+          @if (submitting()) {
+            Recording...
+          } @else {
+            Time In
+          }
+        </button>
+      } @else if (current.canTimeOut) {
+        <button
+          type="button"
+          class="w-full rounded-2xl bg-slate-900 font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
+          [class.px-4]="true"
+          [class.py-3]="mode() === 'compact'"
+          [class.py-4]="mode() === 'full'"
+          [class.text-sm]="mode() === 'compact'"
+          [class.text-base]="mode() === 'full'"
+          [disabled]="submitting() || !selfieBlob()"
+          (click)="punchOut()"
+        >
+          @if (submitting()) {
+            Recording...
+          } @else {
+            Time Out
+          }
+        </button>
+      } @else if (current.status === 'completed') {
+        <div
+          class="rounded-2xl border border-emerald-200 bg-emerald-50 text-center font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
+          [class.px-4]="true"
+          [class.py-3]="mode() === 'compact'"
+          [class.py-4]="mode() === 'full'"
+          [class.text-xs]="mode() === 'compact'"
+          [class.text-sm]="mode() === 'full'"
+        >
+          Done for today
+        </div>
+      }
+    </div>
+  }
+</section>
diff --git a/frontend/src/app/website/pages/time-clock/time-clock-page.component.ts b/frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.ts
similarity index 82%
rename from frontend/src/app/website/pages/time-clock/time-clock-page.component.ts
rename to frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.ts
index 372df8d..e60e906 100644
--- a/frontend/src/app/website/pages/time-clock/time-clock-page.component.ts
+++ b/frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.ts
@@ -1,30 +1,35 @@
 import {
   Component,
   effect,
   ElementRef,
   inject,
+  input,
   OnDestroy,
   OnInit,
+  output,
   signal,
   viewChild,
 } from '@angular/core';
 import { FormsModule } from '@angular/forms';
-import { RouterLink } from '@angular/router';
 import { firstValueFrom } from 'rxjs';
-import { TimeClockApiService, TimeClockStatus } from '../../../core/services/time-clock-api.service';
+import { AdminApiService, TimeClockStatus } from '../../services/admin-api.service';
+import { AdminAuthService } from '../../services/admin-auth.service';
 
 @Component({
-  selector: 'app-time-clock-page',
-  imports: [FormsModule, RouterLink],
-  templateUrl: './time-clock-page.component.html',
+  selector: 'app-portal-time-clock',
+  imports: [FormsModule],
+  templateUrl: './portal-time-clock.component.html',
 })
-export class TimeClockPageComponent implements OnInit, OnDestroy {
-  private readonly timeClockApi = inject(TimeClockApiService);
+export class PortalTimeClockComponent implements OnInit, OnDestroy {
+  private readonly adminApi = inject(AdminApiService);
+  private readonly adminAuth = inject(AdminAuthService);
   private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('cameraVideo');
 
-  readonly username = signal('');
+  readonly mode = input<'compact' | 'full'>('full');
+  readonly punched = output<void>();
+
   readonly status = signal<TimeClockStatus | null>(null);
   readonly loading = signal(false);
   readonly submitting = signal(false);
   readonly error = signal('');
   readonly success = signal('');
@@ -71,11 +76,11 @@ export class TimeClockPageComponent implements OnInit, OnDestroy {
   }
 
   ngOnInit(): void {
     this.tickClock();
     this.clockTimer = setInterval(() => this.tickClock(), 1000);
-    void this.syncServerClock();
+    void this.loadStatus();
     this.serverSyncTimer = setInterval(() => void this.syncServerClock(), 60_000);
   }
 
   ngOnDestroy(): void {
     if (this.clockTimer) {
@@ -86,10 +91,22 @@ export class TimeClockPageComponent implements OnInit, OnDestroy {
     }
     this.stopCamera();
     this.clearSelfie();
   }
 
+  displayName(): string {
+    const current = this.status();
+    if (current?.fullName?.trim()) {
+      return current.fullName.trim();
+    }
+    if (current?.username?.trim()) {
+      return current.username.trim();
+    }
+    const stored = this.adminAuth.getStoredUser();
+    return stored?.fullName?.trim() || stored?.username?.trim() || 'ΓÇö';
+  }
+
   private applyServerNow(serverNow: string | undefined | null): void {
     if (!serverNow) {
       return;
     }
     const parsed = Date.parse(serverNow);
@@ -99,13 +116,14 @@ export class TimeClockPageComponent implements OnInit, OnDestroy {
     this.serverOffsetMs = parsed - Date.now();
     this.hasServerSync = true;
     this.tickClock();
   }
 
+  /** Refresh offset only ΓÇö does not reset punch UI / selfie. */
   private async syncServerClock(): Promise<void> {
     try {
-      const response = await firstValueFrom(this.timeClockApi.getServerClock());
+      const response = await firstValueFrom(this.adminApi.getPortalTimeClockStatus());
       this.applyServerNow(response.data.serverNow);
     } catch {
       // Keep last known offset; never fall back to trusting device for punches.
     }
   }
@@ -132,60 +150,59 @@ export class TimeClockPageComponent implements OnInit, OnDestroy {
         second: '2-digit',
       }),
     );
   }
 
-  async lookup(): Promise<void> {
-    const value = this.username().trim();
-    if (!value) {
-      this.error.set('Enter your username.');
-      this.status.set(null);
-      return;
-    }
-
+  async loadStatus(options?: { preserveMessages?: boolean }): Promise<void> {
     this.loading.set(true);
-    this.error.set('');
-    this.success.set('');
+    if (!options?.preserveMessages) {
+      this.error.set('');
+      this.success.set('');
+    }
     this.clearSelfie();
     this.stopCamera();
 
     try {
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
+      const response = await firstValueFrom(this.adminApi.getPortalTimeClockStatus());
+      this.applyStatus(response.data);
     } catch {
-      this.error.set('Unable to look up username.');
+      if (!options?.preserveMessages) {
+        this.error.set('Unable to load time clock status.');
+      }
       this.status.set(null);
     } finally {
       this.loading.set(false);
     }
   }
 
+  private applyStatus(data: TimeClockStatus): void {
+    this.status.set(data);
+    this.applyServerNow(data.serverNow);
+    this.locationLabel.set(data.locationLabel ?? '');
+    this.locationCoords.set(
+      data.locationLat != null && data.locationLng != null
+        ? { lat: data.locationLat, lng: data.locationLng }
+        : null,
+    );
+    this.locationStatus.set('');
+
+    const expected = data.expectedLocation;
+    if (expected === 'office' || expected === 'wfh') {
+      this.pickedLocation.set(expected);
+    } else {
+      this.pickedLocation.set(null);
+    }
+
+    if (data.canTimeIn && this.pickedLocation() === 'wfh') {
+      void this.requestGeolocation();
+    }
+
+    if (data.canTimeIn || data.canTimeOut) {
+      void this.startCamera();
+    }
+  }
+
   async startCamera(): Promise<void> {
     this.cameraError.set('');
     this.cameraReady.set(false);
     this.cameraStarting.set(true);
 
@@ -193,11 +210,10 @@ export class TimeClockPageComponent implements OnInit, OnDestroy {
       this.cameraError.set('Camera is not supported on this device/browser.');
       this.cameraStarting.set(false);
       return;
     }
 
-    // Reuse an already-open stream when possible (faster retake).
     if (this.mediaStream && this.mediaStream.active) {
       this.cameraStarting.set(false);
       this.cameraReady.set(true);
       return;
     }
@@ -222,11 +238,10 @@ export class TimeClockPageComponent implements OnInit, OnDestroy {
         }
         return;
       }
 
       this.mediaStream = stream;
-      // Effect attaches stream once the <video> exists.
       if (this.videoRef()?.nativeElement) {
         const video = this.videoRef()!.nativeElement;
         video.srcObject = stream;
         video.onloadedmetadata = () => {
           void video.play().finally(() => {
@@ -305,15 +320,13 @@ export class TimeClockPageComponent implements OnInit, OnDestroy {
     this.error.set('');
   }
 
   retakeSelfie(): void {
     this.clearSelfiePreviewOnly();
-    // Keep the existing stream ΓÇö avoids another slow getUserMedia round-trip.
     if (this.mediaStream?.active) {
       this.cameraReady.set(false);
       this.cameraStarting.set(true);
-      // <video> remounts after preview clears; effect re-attaches the stream.
       return;
     }
 
     void this.startCamera();
   }
@@ -325,16 +338,10 @@ export class TimeClockPageComponent implements OnInit, OnDestroy {
   async punchOut(): Promise<void> {
     await this.punch('out');
   }
 
   private async punch(kind: 'in' | 'out'): Promise<void> {
-    const value = this.username().trim();
-    if (!value) {
-      this.error.set('Enter your username.');
-      return;
-    }
-
     const selfie = this.selfieBlob();
     if (!selfie) {
       this.error.set('Take a selfie first before submitting.');
       return;
     }
@@ -368,18 +375,19 @@ export class TimeClockPageComponent implements OnInit, OnDestroy {
     }
 
     try {
       const response = await firstValueFrom(
         kind === 'in'
-          ? this.timeClockApi.timeIn(value, selfie, pick!, location)
-          : this.timeClockApi.timeOut(value, selfie),
+          ? this.adminApi.portalTimeIn(selfie, pick!, location)
+          : this.adminApi.portalTimeOut(selfie),
       );
       this.status.set(response.data);
       this.applyServerNow(response.data.serverNow);
       this.success.set(response.message);
       this.clearSelfiePreviewOnly();
       this.stopCamera();
+      this.punched.emit();
 
       if (response.data.canTimeOut) {
         void this.startCamera();
       }
     } catch (err: unknown) {
@@ -391,11 +399,11 @@ export class TimeClockPageComponent implements OnInit, OnDestroy {
           ? (err as { error: { message: string } }).error.message
           : kind === 'in'
             ? 'Unable to record time in.'
             : 'Unable to record time out.';
       this.error.set(message);
-      await this.lookup();
+      await this.loadStatus({ preserveMessages: true });
     } finally {
       this.submitting.set(false);
     }
   }
 
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
diff --git a/frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.html b/frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.html
index d8a06cd..ad9f84f 100644
--- a/frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.html
+++ b/frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.html
@@ -20,10 +20,12 @@
       <div class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
         {{ adjustmentMessage() }}
       </div>
     }
 
+    <app-portal-time-clock mode="compact" (punched)="onTimeClockPunched()" />
+
     @if (data.adjustmentNotice?.message; as adjustmentNoticeMessage) {
       <div class="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 dark:border-sky-900 dark:bg-sky-950/40">
         <p class="text-sm font-bold text-sky-900 dark:text-sky-100">Missed time out</p>
         <p class="mt-1 text-sm text-sky-800 dark:text-sky-200">{{ adjustmentNoticeMessage }}</p>
         @if (incompletePunchDays().length > 0) {
diff --git a/frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.ts b/frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.ts
index fec5a03..25cfaab 100644
--- a/frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.ts
+++ b/frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.ts
@@ -1,9 +1,10 @@
 import { NgClass } from '@angular/common';
 import { Component, computed, inject, OnInit, signal } from '@angular/core';
 import { FormsModule } from '@angular/forms';
 import { firstValueFrom } from 'rxjs';
+import { PortalTimeClockComponent } from '../../components/portal-time-clock/portal-time-clock.component';
 import {
   AdminApiService,
   EmployeeActivityItem,
   EmployeeDayOffItem,
   EmployeePayslipDetail,
@@ -11,11 +12,11 @@ import {
   EmployeeWorkspaceDashboard,
 } from '../../services/admin-api.service';
 
 @Component({
   selector: 'app-sales-employee-dashboard',
-  imports: [FormsModule, NgClass],
+  imports: [FormsModule, NgClass, PortalTimeClockComponent],
   templateUrl: './sales-employee-dashboard.component.html',
 })
 export class SalesEmployeeDashboardComponent implements OnInit {
   private readonly adminApi = inject(AdminApiService);
 
@@ -95,10 +96,14 @@ export class SalesEmployeeDashboardComponent implements OnInit {
     } finally {
       this.loading.set(false);
     }
   }
 
+  async onTimeClockPunched(): Promise<void> {
+    await this.load();
+  }
+
   async requestOvertime(attendanceId: number | null | undefined): Promise<void> {
     if (attendanceId == null || this.requestingOvertimeId() != null) {
       return;
     }
 
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
 
diff --git a/frontend/src/app/admin/services/admin-api.service.ts b/frontend/src/app/admin/services/admin-api.service.ts
index bd7016f..b0247ee 100644
--- a/frontend/src/app/admin/services/admin-api.service.ts
+++ b/frontend/src/app/admin/services/admin-api.service.ts
@@ -1,8 +1,14 @@
 import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
 import { inject, Injectable } from '@angular/core';
 import { APP_CONFIG } from '../../core/config/app-config';
+import {
+  TimeClockLocationPayload,
+  TimeClockStatus,
+} from '../../core/services/time-clock-api.service';
+
+export type { TimeClockStatus } from '../../core/services/time-clock-api.service';
 import {
   DashboardDetailMetric,
   DashboardDetails,
   DashboardOverview,
   DashboardPeriod,
@@ -2911,10 +2917,45 @@ export class AdminApiService {
       `${APP_CONFIG.apiUrl}/admin/employee-workspace/dashboard`,
       { headers: this.headers(), params },
     );
   }
 
+  getPortalTimeClockStatus() {
+    return this.http.get<{ success: boolean; data: TimeClockStatus }>(
+      `${APP_CONFIG.apiUrl}/admin/employee-workspace/time-clock/status`,
+      { headers: this.headers() },
+    );
+  }
+
+  portalTimeIn(
+    selfie: Blob,
+    workLocationType: 'office' | 'wfh',
+    location?: TimeClockLocationPayload | null,
+  ) {
+    const formData = new FormData();
+    formData.append('selfie', selfie, 'time-in-selfie.jpg');
+    formData.append('workLocationType', workLocationType);
+    this.appendPortalTimeClockLocation(formData, location);
+
+    return this.http.post<{ success: boolean; message: string; data: TimeClockStatus }>(
+      `${APP_CONFIG.apiUrl}/admin/employee-workspace/time-clock/time-in`,
+      formData,
+      { headers: this.headers() },
+    );
+  }
+
+  portalTimeOut(selfie: Blob) {
+    const formData = new FormData();
+    formData.append('selfie', selfie, 'time-out-selfie.jpg');
+
+    return this.http.post<{ success: boolean; message: string; data: TimeClockStatus }>(
+      `${APP_CONFIG.apiUrl}/admin/employee-workspace/time-clock/time-out`,
+      formData,
+      { headers: this.headers() },
+    );
+  }
+
   requestEmployeeOvertime(attendanceId: number) {
     return this.http.post<
       ItemResponse<{
         id: number;
         workDate: string;
@@ -3151,9 +3192,27 @@ export class AdminApiService {
       params = params.set('search', search.trim());
     }
     return params;
   }
 
+  private appendPortalTimeClockLocation(
+    formData: FormData,
+    location?: TimeClockLocationPayload | null,
+  ): void {
+    if (!location) {
+      return;
+    }
+    if (location.locationLat != null) {
+      formData.append('locationLat', String(location.locationLat));
+    }
+    if (location.locationLng != null) {
+      formData.append('locationLng', String(location.locationLng));
+    }
+    if (location.locationLabel?.trim()) {
+      formData.append('locationLabel', location.locationLabel.trim());
+    }
+  }
+
   private headers(): HttpHeaders {
     return this.adminAuth.buildAuthHeaders();
   }
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
