diff --git a/frontend/src/app/admin/services/admin-api.service.ts b/frontend/src/app/admin/services/admin-api.service.ts
index bd7016f..b0247ee 100644
--- a/frontend/src/app/admin/services/admin-api.service.ts
+++ b/frontend/src/app/admin/services/admin-api.service.ts
@@ -1,13 +1,19 @@
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
 } from '../data/dashboard.types';
 import { AdminAuthService } from './admin-auth.service';
 
 export interface PaginationMeta {
   page: number;
@@ -2906,20 +2912,55 @@ export class AdminApiService {
     let params = new HttpParams();
     if (month?.trim()) {
       params = params.set('month', month.trim());
     }
     return this.http.get<ItemResponse<EmployeeWorkspaceDashboard>>(
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
         overtimeHours: number;
         overtimeStatus: PayrollOvertimeStatus;
         message: string;
       }> & { message?: string }
     >(
@@ -3146,14 +3187,32 @@ export class AdminApiService {
   }
 
   private listParams(page: number, limit: number, search: string): HttpParams {
     let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
     if (search.trim()) {
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
