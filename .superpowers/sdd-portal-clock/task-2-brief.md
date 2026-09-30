### Task 2: Frontend portal time-clock API client

**Files:**
- Modify: `frontend/src/app/admin/services/admin-api.service.ts`
- Optionally deprecate usage of `frontend/src/app/core/services/time-clock-api.service.ts` (leave file until public page removed, or point methods at new URLs â€” prefer new methods on `AdminApiService` only)

**Interfaces:**
- Consumes: Task 1 HTTP routes + `AdminAuthService` headers via existing `headers()`
- Produces:
  - `getPortalTimeClockStatus()`
  - `portalTimeIn(selfie, workLocationType, location?)`
  - `portalTimeOut(selfie)`
  - Reuse / export `TimeClockStatus` type (import from core service or duplicate minimal interface in admin-api)

- [ ] **Step 1: Add types + methods to AdminApiService**

```typescript
getPortalTimeClockStatus() {
  return this.http.get<{ success: boolean; data: TimeClockStatus }>(
    `${APP_CONFIG.apiUrl}/admin/employee-workspace/time-clock/status`,
    { headers: this.headers() },
  );
}

portalTimeIn(
  selfie: Blob,
  workLocationType: 'office' | 'wfh',
  location?: { locationLat?: number | null; locationLng?: number | null; locationLabel?: string | null } | null,
) {
  const formData = new FormData();
  formData.append('selfie', selfie, 'time-in-selfie.jpg');
  formData.append('workLocationType', workLocationType);
  // append location fields same as TimeClockApiService.appendLocation
  return this.http.post<{ success: boolean; message: string; data: TimeClockStatus }>(
    `${APP_CONFIG.apiUrl}/admin/employee-workspace/time-clock/time-in`,
    formData,
    { headers: this.headers() },
  );
}

portalTimeOut(selfie: Blob) {
  const formData = new FormData();
  formData.append('selfie', selfie, 'time-out-selfie.jpg');
  return this.http.post<{ success: boolean; message: string; data: TimeClockStatus }>(
    `${APP_CONFIG.apiUrl}/admin/employee-workspace/time-clock/time-out`,
    formData,
    { headers: this.headers() },
  );
}
```

Import `TimeClockStatus` from `../../../core/services/time-clock-api.service` (or move shared types to a small `time-clock.types.ts` if import path is awkward).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/admin/services/admin-api.service.ts
git commit -m "Add authenticated portal time-clock API client methods."
```

---
