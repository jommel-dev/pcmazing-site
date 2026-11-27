import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PortalIconComponent } from '../ui/portal-icon.component';

/**
 * Temporary landing for portal screens that are still being rebuilt. Route data supplies the
 * title and, when one exists, the older workspace page that does the same job today.
 */
@Component({
  selector: 'app-portal-placeholder-page',
  standalone: true,
  imports: [RouterLink, PortalIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-6 pt-[calc(1rem+env(safe-area-inset-top))] pb-6">
      @if (!isTab()) {
        <a routerLink="/user/home" class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-portal-blue">
          <span class="rotate-180"><app-portal-icon name="chevron" [size]="14" /></span>
          Home
        </a>
      }
      <h1 class="mt-3 text-[28px] leading-tight font-bold tracking-[-0.6px] text-portal-ink">{{ title() }}</h1>
      <div class="mt-5 rounded-[20px] border border-portal-line bg-white p-5">
        <p class="text-sm text-portal-muted">This screen is being rebuilt to match the app.</p>
        @if (legacyRoute(); as legacy) {
          <a
            [routerLink]="legacy"
            class="mt-4 inline-flex h-11 items-center rounded-xl bg-portal-blue px-5 text-sm font-semibold text-white"
          >
            Open it in the current workspace
          </a>
        }
      </div>
    </div>
  `,
})
export class PortalPlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly title = computed(() => String(this.route.snapshot.data['title'] ?? ''));
  protected readonly legacyRoute = computed<string | null>(
    () => (this.route.snapshot.data['legacyRoute'] as string | undefined) ?? null,
  );
  protected readonly isTab = computed(() => this.route.snapshot.data['bar'] !== false);
}
