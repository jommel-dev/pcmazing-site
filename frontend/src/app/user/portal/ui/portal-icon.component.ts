import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PORTAL_ICONS, PortalIconName, PortalIconShape } from './portal-icons.data';

/** Stroke icon from the MyPeoplePortal app set; inherits the current text colour. */
@Component({
  selector: 'app-portal-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0', '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  template: `
    <svg
      [attr.viewBox]="shape().viewBox"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      stroke-linejoin="round"
    >
      @for (p of shape().paths; track $index) {
        <path
          [attr.d]="p.d"
          [attr.fill]="p.fill"
          [attr.stroke]="p.stroke"
          [attr.stroke-width]="p.width ?? null"
          [attr.stroke-linecap]="p.cap ?? null"
          [attr.stroke-linejoin]="p.join ?? null"
        />
      }
    </svg>
  `,
})
export class PortalIconComponent {
  readonly name = input.required<PortalIconName>();
  readonly size = input(20);

  protected readonly shape = computed<PortalIconShape>(() => PORTAL_ICONS[this.name()]);
}
