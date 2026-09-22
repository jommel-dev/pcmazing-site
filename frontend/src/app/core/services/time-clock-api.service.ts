import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';

export type WorkLocationType = 'office' | 'wfh' | 'off';

export interface TimeClockStatus {
  username: string;
  fullName: string;
  employeeCode: string | null;
  workDate: string;
  timeIn: string | null;
  timeOut: string | null;
  canTimeIn: boolean;
  canTimeOut: boolean;
  status: 'ready' | 'timed_in' | 'completed' | 'not_enrolled' | 'not_found' | 'inactive';
  message: string;
  /** Authoritative server/DB timestamp (ISO). */
  serverNow: string;
  undertimeGraceMinutes?: number;
  expectedLocation?: WorkLocationType;
  locationLabel?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  locationMismatch?: boolean;
}

export interface ServerClock {
  serverNow: string;
  workDate: string;
}

export interface TimeClockLocationPayload {
  locationLat?: number | null;
  locationLng?: number | null;
  locationLabel?: string | null;
}

@Injectable({ providedIn: 'root' })
export class TimeClockApiService {
  private readonly http = inject(HttpClient);

  getServerClock() {
    return this.http.get<{ success: boolean; data: ServerClock }>(
      `${APP_CONFIG.apiUrl}/payroll/time-clock/now`,
    );
  }

  getStatus(username: string) {
    return this.http.get<{ success: boolean; data: TimeClockStatus }>(
      `${APP_CONFIG.apiUrl}/payroll/time-clock/status`,
      { params: { username } },
    );
  }

  timeIn(username: string, selfie: Blob, location?: TimeClockLocationPayload | null) {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('selfie', selfie, 'time-in-selfie.jpg');
    this.appendLocation(formData, location);

    return this.http.post<{ success: boolean; message: string; data: TimeClockStatus }>(
      `${APP_CONFIG.apiUrl}/payroll/time-clock/time-in`,
      formData,
    );
  }

  timeOut(username: string, selfie: Blob, location?: TimeClockLocationPayload | null) {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('selfie', selfie, 'time-out-selfie.jpg');
    this.appendLocation(formData, location);

    return this.http.post<{ success: boolean; message: string; data: TimeClockStatus }>(
      `${APP_CONFIG.apiUrl}/payroll/time-clock/time-out`,
      formData,
    );
  }

  private appendLocation(formData: FormData, location?: TimeClockLocationPayload | null): void {
    if (!location) {
      return;
    }
    if (location.locationLat != null) {
      formData.append('locationLat', String(location.locationLat));
    }
    if (location.locationLng != null) {
      formData.append('locationLng', String(location.locationLng));
    }
    if (location.locationLabel?.trim()) {
      formData.append('locationLabel', location.locationLabel.trim());
    }
  }
}
