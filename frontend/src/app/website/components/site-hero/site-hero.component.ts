import { Component } from '@angular/core';
import { heroFeatures } from '../../data/site.data';

@Component({
  selector: 'app-site-hero',
  templateUrl: './site-hero.component.html',
})
export class SiteHeroComponent {
  readonly features = heroFeatures;
}
