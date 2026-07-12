import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { projects } from '../../data/pages.data';

@Component({
  selector: 'app-our-work-page',
  imports: [PageHeroComponent, RouterLink],
  templateUrl: './our-work-page.component.html',
})
export class OurWorkPageComponent {
  readonly projects = projects;
}
