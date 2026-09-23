### Task 1: Backend time-in accepts pick + stores it

**Files:**
- Modify: `backend/src/admin/payroll/payroll.service.ts`
- Modify: `backend/src/admin/payroll/time-clock.controller.ts`

**Interfaces:**
- `TimeClockLocationInput` gains optional `workLocationType?: 'office' | 'wfh' | null` **or** pass pick as separate arg to `timeIn` — prefer separate required arg:
  - `timeIn(username, selfie, workLocationType: 'office' | 'wfh', location?: TimeClockLocationInput | null)`
- `resolvePunchLocation(picked: 'office' | 'wfh', location?)` — **no longer takes expected schedule for type/mismatch**

- [ ] **Step 1: Update `resolvePunchLocation`**

```typescript
private resolvePunchLocation(
  picked: 'office' | 'wfh',
  location?: TimeClockLocationInput | null,
): {
  workLocationType: 'office' | 'wfh';
  locationLat: number | null;
  locationLng: number | null;
  locationLabel: string | null;
  locationMismatch: boolean;
} {
  const label = location?.locationLabel?.trim() || null;
  const lat = this.toNullableNumber(location?.locationLat ?? null);
  const lng = this.toNullableNumber(location?.locationLng ?? null);
  const storeCoords = picked === 'wfh';

  return {
    workLocationType: picked,
    locationLat: storeCoords ? lat : null,
    locationLng: storeCoords ? lng : null,
    locationLabel: storeCoords ? (label ? label.slice(0, 200) : null) : null,
    locationMismatch: false,
  };
}
```

- [ ] **Step 2: Update `timeIn` signature and call**

- Parse/validate pick: only `office` | `wfh`; else `BadRequestException('Choose Office or Work from home before time in.')`.
- Call `resolvePunchLocation(picked, location)`.
- Keep INSERT columns as today.

- [ ] **Step 3: Status empty / ready mismatch**

In `getTimeClockStatus` and empty status in controller: set `locationMismatch: false` always (remove `expectedLocation === 'off'` mismatch). Keep Off soft message text when `expectedLocation === 'off'`.

- [ ] **Step 4: Controller**

```typescript
timeIn(
  @Body('username') username: string,
  @Body('workLocationType') workLocationType?: string,
  @Body('locationLat') locationLat?: string,
  @Body('locationLng') locationLng?: string,
  @Body('locationLabel') locationLabel?: string,
  @UploadedFile() selfie?: Express.Multer.File,
) {
  // validate username + selfie as today
  const picked = (workLocationType ?? '').trim().toLowerCase();
  if (picked !== 'office' && picked !== 'wfh') {
    throw new BadRequestException('Choose Office or Work from home before time in.');
  }
  return this.payrollService
    .timeIn(value, selfie, picked, this.parseLocation(locationLat, locationLng, locationLabel))
    .then(...)
}
```

- [ ] **Step 5: Typecheck**

Run: `cd backend; npx tsc --noEmit -p tsconfig.build.json`  
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add backend/src/admin/payroll/payroll.service.ts backend/src/admin/payroll/time-clock.controller.ts
git commit -m "Accept Office/WFH pick on time-in and store on attendance."
```

---
