### Task 3: Shared PortalTimeClockComponent (compact + full)

**Files:**
- Create: `frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.ts`
- Create: `frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.html` (optional if inline template preferred â€” follow sibling components; use separate HTML if large)

**Interfaces:**
- Consumes: `AdminApiService.getPortalTimeClockStatus` / `portalTimeIn` / `portalTimeOut`; `AdminAuthService.getStoredUser()` for display name fallback
- Produces: `@Input() mode: 'compact' | 'full'`; `@Output() punched` EventEmitter after successful in/out (dashboard listens to reload)

- [ ] **Step 1: Create component**

Port camera / selfie / Office-WFH / GPS behavior from `frontend/src/app/website/pages/time-clock/time-clock-page.component.ts`, with these changes:

- No `username` signal or Check/lookup UI
- On init: `getPortalTimeClockStatus()` only
- Submit: `portalTimeIn` / `portalTimeOut` (no username)
- Pre-select `pickedLocation` from `status.expectedLocation` when `office`|`wfh`
- Off schedule: soft warning banner (copy from public page)
- `mode` input: compact = denser padding / shorter help; full = current public-page density
- Emit `punched` after success

Keep server clock offset display pattern from the public page.

- [ ] **Step 2: Smoke build**

Run: `cd frontend; npx ng build --configuration=development`  
Expected: success (or at least component compiles; fix template errors)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/components/portal-time-clock
git commit -m "Add shared portal time-clock component without username search."
```

---
