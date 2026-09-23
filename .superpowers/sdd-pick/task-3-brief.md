### Task 3: Time-clock frontend picker

**Files:**
- Modify: `frontend/src/app/core/services/time-clock-api.service.ts`
- Modify: `frontend/src/app/website/pages/time-clock/time-clock-page.component.ts`
- Modify: `frontend/src/app/website/pages/time-clock/time-clock-page.component.html`

- [ ] **Step 1: API**

```typescript
timeIn(
  username: string,
  selfie: Blob,
  workLocationType: 'office' | 'wfh',
  location?: TimeClockLocationPayload | null,
) {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('selfie', selfie, 'time-in-selfie.jpg');
  formData.append('workLocationType', workLocationType);
  this.appendLocation(formData, location);
  // post as today
}
```

- [ ] **Step 2: Component state**

- `pickedLocation = signal<'office' | 'wfh' | null>(null)`
- On successful `lookup` / status ready:
  - if `expectedLocation === 'office' | 'wfh'` → set `pickedLocation` to that
  - if `expectedLocation === 'off'` or missing → set `null`
- When `pickedLocation() === 'wfh'` and can time in → request geolocation (reuse existing)
- `punch('in')`: if `pickedLocation()` is null → error `Choose Office or Work from home before time in.`; pass pick to API; only attach GPS payload when pick is `wfh`

- [ ] **Step 3: Template**

When `current.canTimeIn`, above selfie / Time In button:

```html
<div class="mt-3 ...">
  <p class="text-xs font-bold uppercase ...">Working from</p>
  <div class="mt-2 grid grid-cols-2 gap-2">
    <button type="button" ... [class]="pickedLocation() === 'office' ? 'selected' : ''" (click)="pickedLocation.set('office')">Office</button>
    <button type="button" ... [class]="pickedLocation() === 'wfh' ? 'selected' : ''" (click)="pickedLocation.set('wfh'); requestGeolocation()">WFH</button>
  </div>
  @if (current.expectedLocation === 'off') {
    <p class="mt-2 text-xs text-amber-800">Scheduled day off — choose Office or WFH if you still need to clock in.</p>
  }
</div>
```

Show existing WFH GPS/label block when `pickedLocation() === 'wfh'` (not only when `expectedLocation === 'wfh'`).

Disable Time In when `!pickedLocation()` or `!selfieBlob()`.

Match existing Tailwind/styles on the page (no new design system).

- [ ] **Step 4: Frontend build**

Run: `cd frontend; npx ng build --configuration=development`  
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/services/time-clock-api.service.ts frontend/src/app/website/pages/time-clock/time-clock-page.component.ts frontend/src/app/website/pages/time-clock/time-clock-page.component.html
git commit -m "Add Office/WFH picker on time clock before time in."
```

---
