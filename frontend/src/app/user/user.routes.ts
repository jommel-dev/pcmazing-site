import { Routes } from '@angular/router';
import { portalGuestGuard } from './guards/portal-auth.guards';
import { PortalHubPageComponent } from './pages/portal-hub-page.component';
import { PortalLoginPageComponent } from './pages/portal-login-page.component';

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
  },
  {
    path: 'login',
    component: PortalLoginPageComponent,
    title: 'MyPeoplePortal | PCMazing',
    canActivate: [portalGuestGuard],
  },
];
