# Task 1 review package
Base: 317ce0a
Head: 811149c

## Commits
811149c Add session-bound portal time-clock API; remove public punches.

## Stat
 backend/src/admin/admin.module.ts                  |   2 -
 .../employee-workspace.controller.ts               |  57 ++++++++
 .../employee-workspace.service.ts                  |  59 +++++++-
 backend/src/admin/payroll/payroll.service.ts       |  53 +++++++
 backend/src/admin/payroll/time-clock.controller.ts | 153 ---------------------
 5 files changed, 164 insertions(+), 160 deletions(-)

## Diff
diff --git a/backend/src/admin/admin.module.ts b/backend/src/admin/admin.module.ts
index 09c2d4f..96632e0 100644
--- a/backend/src/admin/admin.module.ts
+++ b/backend/src/admin/admin.module.ts
@@ -32,21 +32,20 @@ import { RbacService } from './rbac/rbac.service';
 import { RolesGuard } from './rbac/roles.guard';
 import { UsersController } from './users/users.controller';
 import { UsersService } from './users/users.service';
 import { MarketingTeamsController } from './marketing/marketing-teams.controller';
 import { MarketingTeamsService } from './marketing/marketing-teams.service';
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
 import { PartsPriceSearchService } from './parts-price-search/parts-price-search.service';
 
 @Module({
   imports: [DatabaseModule, AuthModule, PayrollModule, ProjectsModule],
   controllers: [
@@ -57,21 +56,20 @@ import { PartsPriceSearchService } from './parts-price-search/parts-price-search
     InventoryController,
     InventoryServicesController,
     SalesOrdersController,
     ServiceTypesController,
     PurchaseController,
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
     PrintingTemplatesController,
     CompanyExpensesController,
   ],
   providers: [
     DashboardService,
diff --git a/backend/src/admin/employee-workspace/employee-workspace.controller.ts b/backend/src/admin/employee-workspace/employee-workspace.controller.ts
index 1cd660b..2c85ea0 100644
--- a/backend/src/admin/employee-workspace/employee-workspace.controller.ts
+++ b/backend/src/admin/employee-workspace/employee-workspace.controller.ts
@@ -49,20 +49,77 @@ export class EmployeeWorkspaceController {
   @Get('dashboard')
   async dashboard(
     @Req() req: Request & { user?: AdminJwtPayload },
     @Query('month') month?: string,
   ) {
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
     const { userId, source } = this.actor(req);
     const data = await this.workspaceService.getPayslipDetail(userId, source, id);
     return { success: true, data };
   }
 
diff --git a/backend/src/admin/employee-workspace/employee-workspace.service.ts b/backend/src/admin/employee-workspace/employee-workspace.service.ts
index 070dd8e..94b98e9 100644
--- a/backend/src/admin/employee-workspace/employee-workspace.service.ts
+++ b/backend/src/admin/employee-workspace/employee-workspace.service.ts
@@ -1,19 +1,19 @@
 import {
   BadRequestException,
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
   UpdateTodoDto,
   UpsertDayOffDto,
 } from './dto/employee-workspace.dto';
 
 type UserSource = 'tblusers' | 'pcmazing_admin_users';
@@ -30,26 +30,75 @@ export class EmployeeWorkspaceService {
   async ensureReady(): Promise<void> {
     if (this.ready) {
       return;
     }
     await ensureEmployeeWorkspaceTables(this.databaseService);
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
     monthRaw?: string,
   ) {
     await this.ensureReady();
     const settings = await this.payrollService.getSettings();
     const workDate = manilaWorkDate();
diff --git a/backend/src/admin/payroll/payroll.service.ts b/backend/src/admin/payroll/payroll.service.ts
index d13e99c..40aa29e 100644
--- a/backend/src/admin/payroll/payroll.service.ts
+++ b/backend/src/admin/payroll/payroll.service.ts
@@ -2444,20 +2444,73 @@ export class PayrollService {
     if (!punched) {
       throw new BadRequestException('Unable to record time out.');
     }
 
     await this.syncOvertimeAfterTimeOut(punched.id, punched.time_in, punched.time_out);
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
     await this.ensureReady();
 
     if (!Number.isFinite(attendanceId) || attendanceId <= 0) {
       throw new BadRequestException('Invalid attendance id.');
     }
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

