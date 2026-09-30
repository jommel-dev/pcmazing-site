### Task 5: Compact clock on employee workspace + verify

**Files:**
- Modify: `frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.ts`
- Modify: `frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.html`
- Modify: `docs/superpowers/specs/2026-09-23-portal-time-clock-design.md` (Status â†’ Implemented)

- [ ] **Step 1: Embed compact clock**

At top of dashboard template (before KPI cards / after error banners):

```html
<app-portal-time-clock mode="compact" (punched)="onTimeClockPunched()" />
```

Import component; add:

```typescript
async onTimeClockPunched(): Promise<void> {
  await this.loadDashboard(); // existing reload method name â€” use whatever loads getEmployeeWorkspaceDashboard
}
```

- [ ] **Step 2: Manual verification checklist**

1. Portal login as payroll-enabled employee â†’ role home shows compact clock; status without username search.  
2. Time in with Office + selfie; today cards update.  
3. Open `/admin/time-clock` full page; time out with selfie.  
4. Unauthenticated `GET /admin/employee-workspace/time-clock/status` â†’ 401.  
5. `GET /payroll/time-clock/status` â†’ 404.  
6. Visit `/time-clock` â†’ login with returnUrl; after login land on Time Clock.  
7. Hub no longer shows Time Clock tile.  
8. Payroll copy-link opens loginâ†’time-clock path.

- [ ] **Step 3: Mark spec Implemented + commit**

```bash
git add frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.ts frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.html docs/superpowers/specs/2026-09-23-portal-time-clock-design.md
git commit -m "Embed compact portal time clock on employee workspace."
```

---
