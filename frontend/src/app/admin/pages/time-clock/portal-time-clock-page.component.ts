import { Component } from '@angular/core';
import { PortalTimeClockComponent } from '../../components/portal-time-clock/portal-time-clock.component';

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
