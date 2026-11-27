import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type PortalPromptTone = 'success' | 'warning' | 'error';

/**
 * Inline status card used for success, warning, and error feedback.
 * Pale wash, round status icon, title, optional detail, optional action.
 */
@Component({
  selector: 'app-portal-prompt',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="flex items-center gap-3 rounded-xl border px-3 py-2.5"
      [class]="shellClass()"
      [attr.role]="tone() === 'error' ? 'alert' : 'status'"
    >
      <span
        class="flex size-[22px] shrink-0 items-center justify-center rounded-full text-white"
        [class]="iconClass()"
      >
        @switch (tone()) {
          @case ('success') {
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M2.4 6.2 4.8 8.6 9.6 3.5"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          }
          @case ('warning') {
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M6 3.1v3.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
              <circle cx="6" cy="8.8" r="0.75" fill="currentColor" />
            </svg>
          }
          @case ('error') {
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M3.3 3.3 8.7 8.7M8.7 3.3 3.3 8.7"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
              />
            </svg>
          }
        }
      </span>
      <span class="min-w-0 flex-1 text-left">
        <span class="block text-[13px] leading-5 font-semibold" [class]="titleClass()">{{ title() }}</span>
        @if (message()) {
          <span class="mt-0.5 block text-xs leading-4 text-portal-muted">{{ message() }}</span>
        }
      </span>
      @if (actionLabel()) {
        <button
          type="button"
          class="shrink-0 rounded-lg bg-portal-blue px-2.5 py-1 text-xs font-semibold text-white"
          (click)="action.emit()"
        >
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
})
export class PortalPromptComponent {
  readonly tone = input.required<PortalPromptTone>();
  readonly title = input.required<string>();
  readonly message = input<string | null>(null);
  readonly actionLabel = input<string | null>(null);
  readonly action = output<void>();

  protected shellClass(): string {
    switch (this.tone()) {
      case 'success':
        return 'border-[#bbf7d0] bg-[#ecfdf3]';
      case 'warning':
        return 'border-[#fed7aa] bg-[#fff7ed]';
      default:
        return 'border-[#fecdd3] bg-[#fff1f2]';
    }
  }

  protected iconClass(): string {
    switch (this.tone()) {
      case 'success':
        return 'bg-[#059669]';
      case 'warning':
        return 'bg-[#d97706]';
      default:
        return 'bg-[#e11d48]';
    }
  }

  protected titleClass(): string {
    switch (this.tone()) {
      case 'success':
        return 'text-[#047857]';
      case 'warning':
        return 'text-[#c2410c]';
      default:
        return 'text-[#be123c]';
    }
  }
}
