import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-hero',
  templateUrl: './page-hero.component.html',
})
export class PageHeroComponent {
  readonly eyebrow = input('');
  readonly title = input.required<string>();
  readonly description = input('');
}
