import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

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

const PUBLIC_TIME_CLOCK_REMOVED =
  'Public /payroll/time-clock API was removed. Use AdminApiService portal time-clock methods.';

/**
 * Types for portal time clock live here. Public HTTP methods are intentionally
 * disabled — punches go through authenticated employee-workspace APIs only.
 */
@Injectable({ providedIn: 'root' })
export class TimeClockApiService {
  getServerClock(): Observable<{ success: boolean; data: ServerClock }> {
    throw new Error(PUBLIC_TIME_CLOCK_REMOVED);
  }

  getStatus(_username: string): Observable<{ success: boolean; data: TimeClockStatus }> {
    throw new Error(PUBLIC_TIME_CLOCK_REMOVED);
  }

  timeIn(
    _username: string,
    _selfie: Blob,
    _workLocationType: 'office' | 'wfh',
    _location?: TimeClockLocationPayload | null,
  ): Observable<{ success: boolean; message: string; data: TimeClockStatus }> {
    throw new Error(PUBLIC_TIME_CLOCK_REMOVED);
  }

  timeOut(
    _username: string,
    _selfie: Blob,
    _location?: TimeClockLocationPayload | null,
  ): Observable<{ success: boolean; message: string; data: TimeClockStatus }> {
    throw new Error(PUBLIC_TIME_CLOCK_REMOVED);
  }
}
