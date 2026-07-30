import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

export type PortalHubAppId = 'admin' | 'people' | 'time-clock';

@Component({
  selector: 'app-portal-hub-page',
  imports: [RouterLink],
  templateUrl: './portal-hub-page.component.html',
})
export class PortalHubPageComponent {
  readonly apps: Array<{
    id: PortalHubAppId;
    title: string;
    description: string;
    path: string;
  }> = [
    {
      id: 'admin',
      title: 'Admin Portal',
      description: 'Staff access and administrative tools.',
      path: '/admin/access',
    },
    {
      id: 'people',
      title: 'MyPeoplePortal',
      description: 'Team sign-in for Marketing, Sales, and Development.',
      path: '/user/login',
    },
    {
      id: 'time-clock',
      title: 'Time Clock',
      description: 'Clock in and out with attendance selfies.',
      path: '/time-clock',
    },
  ];
}
