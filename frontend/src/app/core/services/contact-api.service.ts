import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';

export interface ContactInquiryPayload {
  name: string;
  email: string;
  phone?: string;
  inquiry: string;
  message: string;
}

export interface ContactInquiryResponse {
  success: boolean;
  message: string;
  data?: {
    id: number;
    created_at: string;
  };
}

@Injectable({ providedIn: 'root' })
export class ContactApiService {
  private readonly http = inject(HttpClient);

  submitInquiry(payload: ContactInquiryPayload) {
    return this.http.post<ContactInquiryResponse>(`${APP_CONFIG.apiUrl}/contact`, payload);
  }
}
