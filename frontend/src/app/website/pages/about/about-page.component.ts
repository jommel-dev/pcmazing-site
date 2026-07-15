import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { aboutContent, TeamMember } from '../../data/pages.data';

@Component({
  selector: 'app-about-page',
  imports: [PageHeroComponent, RouterLink],
  templateUrl: './about-page.component.html',
})
export class AboutPageComponent {
  readonly about = aboutContent;

  memberInitials(member: TeamMember): string {
    if (member.name.trim().toUpperCase() === 'TBA') {
      return '?';
    }

    return member.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
}
