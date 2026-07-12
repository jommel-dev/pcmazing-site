import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { heroFeatures } from '../../data/site.data';

@Component({
  selector: 'app-site-hero',
  imports: [RouterLink],
  templateUrl: './site-hero.component.html',
})
export class SiteHeroComponent {
  readonly features = heroFeatures;
}
