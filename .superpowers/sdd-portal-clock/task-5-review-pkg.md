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
 
