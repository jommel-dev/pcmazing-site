import { Component } from '@angular/core';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { ReviewFormComponent } from '../../components/review-form/review-form.component';

@Component({
  selector: 'app-leave-review-page',
  imports: [PageHeroComponent, ReviewFormComponent],
  templateUrl: './leave-review-page.component.html',
})
export class LeaveReviewPageComponent {}
