import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-time-clock-redirect',
  template: '',
})
export class TimeClockRedirectComponent implements OnInit {
  private readonly router = inject(Router);

  ngOnInit(): void {
    void this.router.navigate(['/user/login'], {
      queryParams: { returnUrl: '/admin/time-clock' },
    });
  }
}
