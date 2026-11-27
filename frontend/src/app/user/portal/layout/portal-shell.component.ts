import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { PortalWorkspaceService } from '../core/portal-workspace.service';
import { PortalIconComponent } from '../ui/portal-icon.component';

/**
 * App-style frame for the employee portal: a phone-width column (centered on wide screens)
 * with the bottom tab bar. Detail screens set `data: { bar: false }` to hide the bar.
 */
@Component({
  selector: 'app-portal-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PortalIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-shell.component.html',
})
export class PortalShellComponent implements OnInit {
  private readonly router = inject(Router);
  protected readonly workspace = inject(PortalWorkspaceService);

  protected readonly showBar = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let current: ActivatedRouteSnapshot = this.router.routerState.snapshot.root;
        while (current.firstChild) {
          current = current.firstChild;
        }
        return current.data['bar'] !== false;
      }),
    ),
    { initialValue: true },
  );

  constructor() {
    // The page scrolls on <body> (global overflow-x rule), so reset it on every screen change.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
      });
  }

  ngOnInit(): void {
    void this.workspace.start();
  }
}
