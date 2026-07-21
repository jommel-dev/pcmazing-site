import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';

export interface PublishedReview {
  id: number;
  fullName: string;
  company: string | null;
  rating: number;
  title: string | null;
  message: string;
  publishedAt: string;
}

@Injectable({ providedIn: 'root' })
export class ReviewsApiService {
  private readonly http = inject(HttpClient);

  listPublished(limit = 12) {
    return this.http.get<{ success: boolean; data: PublishedReview[] }>(
      `${APP_CONFIG.apiUrl}/reviews/published`,
      { params: { limit: String(limit) } },
    );
  }

  submitReview(payload: {
    name: string;
    email?: string;
    company?: string;
    rating?: number;
    title?: string;
    message: string;
  }) {
    return this.http.post<{ success: boolean; message: string }>(
      `${APP_CONFIG.apiUrl}/reviews`,
      payload,
    );
  }
}

@Injectable({ providedIn: 'root' })
export class DemoApiService {
  private readonly http = inject(HttpClient);

  submitDemoRequest(payload: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    serviceInterest?: string;
    preferredDate?: string;
    preferredTime?: string;
    message?: string;
  }) {
    return this.http.post<{ success: boolean; message: string }>(
      `${APP_CONFIG.apiUrl}/demo`,
      payload,
    );
  }
}
