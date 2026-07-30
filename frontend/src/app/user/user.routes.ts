import { Routes } from '@angular/router';
import { portalGuestGuard } from './guards/portal-auth.guards';
import { PortalLoginPageComponent } from './pages/portal-login-page.component';

export const userRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'portal',
  },
  {
    path: 'portal',
    component: PortalLoginPageComponent,
    title: 'Team Portal | PCMazing',
    canActivate: [portalGuestGuard],
  },
];
