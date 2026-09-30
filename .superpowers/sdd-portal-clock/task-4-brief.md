### Task 4: Full page, nav, login returnUrl, remove public entry points

**Files:**
- Create: `frontend/src/app/admin/pages/time-clock/portal-time-clock-page.component.ts`
- Modify: `frontend/src/app/admin/admin.routes.ts`
- Modify: `frontend/src/app/admin/data/admin-modules.data.ts`
- Modify: `frontend/src/app/admin/rbac/admin-roles.ts` (`AdminModuleKey` + `getAllowedModuleKeys`)
- Modify: `frontend/src/app/app.routes.ts`
- Modify: `frontend/src/app/user/pages/portal-hub-page.component.ts` (+ html if needed)
- Modify: `frontend/src/app/user/pages/portal-login-page.component.ts`
- Modify: `frontend/src/app/admin/pages/payroll/payroll-page.component.ts`
- Delete or gut: `frontend/src/app/website/pages/time-clock/time-clock-page.component.ts` (+ html) after redirect replaces it

- [ ] **Step 1: Full page wrapper**

```typescript
@Component({
  selector: 'app-portal-time-clock-page',
  imports: [PortalTimeClockComponent],
  template: `
    <div class="mx-auto max-w-lg space-y-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Time Clock</h2>
        <p class="mt-1 text-sm text-slate-500">Clock in and out with a selfie. Your account is already signed in.</p>
      </div>
      <app-portal-time-clock mode="full" />
    </div>
  `,
})
export class PortalTimeClockPageComponent {}
```

- [ ] **Step 2: Route + module + RBAC**

- Add module item `time_clock` â†’ `/admin/time-clock` in `ADMIN_MODULES` (and MyPortal / System Management section as fits existing nav grouping â€” place near profile / role home).
- Extend `AdminModuleKey` with `'time_clock'`.
- Add `'time_clock'` to allowed sets for marketing, sales, operations, developers/PMs (everyone who uses employee workspace / portal login roles). Super admin gets `all`.
- Register route under admin children with `canActivate: [adminRoleGuard]`, `data: { module: 'time_clock' }`.

- [ ] **Step 3: Public redirect + hub + login returnUrl**

Replace `app.routes.ts` time-clock route with a tiny redirect component or guard:

```typescript
{
  path: 'time-clock',
  redirectTo: '/user/login',
  pathMatch: 'full',
}
```

Angular `redirectTo` cannot append query easily â€” use a one-line component:

```typescript
@Component({
  standalone: true,
  template: '',
})
export class TimeClockRedirectComponent implements OnInit {
  private readonly router = inject(Router);
  ngOnInit() {
    void this.router.navigate(['/user/login'], {
      queryParams: { returnUrl: '/admin/time-clock' },
    });
  }
}
```

Portal login: after successful login, if `returnUrl` query is a safe relative path starting with `/admin/`, navigate there instead of `getRoleHomeRoute`.

Hub: remove the `time-clock` app entry from `portal-hub-page.component.ts` `apps` array.

Payroll page: change `timeClockUrl` to  
`${publicSiteUrl}/user/login?returnUrl=${encodeURIComponent('/admin/time-clock')}`  
and update copy from â€œpublic time clockâ€ to â€œportal time clockâ€ / â€œemployee time clock linkâ€.

- [ ] **Step 4: Remove old public page files** if unused; delete imports.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin frontend/src/app/app.routes.ts frontend/src/app/user frontend/src/app/website/pages/time-clock
git commit -m "Add portal Time Clock page; redirect public clock to login."
```

---
