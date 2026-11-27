import { Routes } from '@angular/router';
import { portalAuthGuard, portalGuestGuard } from './guards/portal-auth.guards';
import { PortalShellComponent } from './portal/layout/portal-shell.component';
import { PortalAdjustPageComponent } from './portal/pages/portal-adjust-page.component';
import { PortalAttendancePageComponent } from './portal/pages/portal-attendance-page.component';
import { PortalClockPageComponent } from './portal/pages/portal-clock-page.component';
import { PortalDayPageComponent } from './portal/pages/portal-day-page.component';
import { PortalHomePageComponent } from './portal/pages/portal-home-page.component';
import { PortalPayPageComponent } from './portal/pages/portal-pay-page.component';
import { PortalPlaceholderPageComponent } from './portal/pages/portal-placeholder-page.component';
import { PortalProfilePageComponent } from './portal/pages/portal-profile-page.component';
import { PortalWorkPageComponent } from './portal/pages/portal-work-page.component';
import { PortalHubPageComponent } from './pages/portal-hub-page.component';
import { PortalLoginPageComponent } from './pages/portal-login-page.component';

const TITLE_SUFFIX = 'MyPeoplePortal | PCMazing';

export const userRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'portal',
  },
  {
    path: 'portal',
    component: PortalHubPageComponent,
    title: 'PCmazing Apps',
    canActivate: [portalGuestGuard],
  },
  {
    path: 'login',
    component: PortalLoginPageComponent,
    title: TITLE_SUFFIX,
    canActivate: [portalGuestGuard],
  },
  {
    path: '',
    component: PortalShellComponent,
    canActivate: [portalAuthGuard],
    children: [
      { path: 'home', component: PortalHomePageComponent, title: `Home | ${TITLE_SUFFIX}` },
      { path: 'profile', component: PortalProfilePageComponent, title: `Profile | ${TITLE_SUFFIX}` },
      {
        path: 'work',
        component: PortalWorkPageComponent,
        title: `Work | ${TITLE_SUFFIX}`,
      },
      {
        path: 'pay',
        component: PortalPayPageComponent,
        title: `Pay | ${TITLE_SUFFIX}`,
      },
      {
        path: 'attendance',
        component: PortalAttendancePageComponent,
        title: `Attendance | ${TITLE_SUFFIX}`,
      },
      {
        path: 'clock',
        component: PortalClockPageComponent,
        title: `Time clock | ${TITLE_SUFFIX}`,
        data: { bar: false },
      },
      {
        path: 'notifications',
        component: PortalPlaceholderPageComponent,
        title: `Notifications | ${TITLE_SUFFIX}`,
        data: { title: 'Notifications', bar: false },
      },
      {
        path: 'memos',
        component: PortalPlaceholderPageComponent,
        title: `Memos | ${TITLE_SUFFIX}`,
        data: { title: 'Memos', bar: false },
      },
      {
        path: 'timesheet',
        component: PortalPlaceholderPageComponent,
        title: `Timesheet | ${TITLE_SUFFIX}`,
        data: { title: 'Timesheet', bar: false },
      },
      {
        path: 'payslip/:id',
        component: PortalPlaceholderPageComponent,
        title: `Payslip | ${TITLE_SUFFIX}`,
        data: { title: 'Payslip', bar: false },
      },
      {
        path: 'day/:date',
        component: PortalDayPageComponent,
        title: `Day | ${TITLE_SUFFIX}`,
        data: { bar: false },
      },
      {
        path: 'adjust/:attendanceId/:workDate',
        component: PortalAdjustPageComponent,
        title: `Attendance correction | ${TITLE_SUFFIX}`,
      },
      {
        path: 'correction/:date',
        component: PortalAdjustPageComponent,
        title: `Attendance correction | ${TITLE_SUFFIX}`,
      },
    ],
  },
];
