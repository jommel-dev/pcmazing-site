import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  EmployeeMemoDetail,
  TimeClockStatus,
} from '../../../admin/services/admin-api.service';
import { formatCoordinates, formatManilaDateTime, formatManilaTime } from '../core/portal-format';
import { portalErrorMessage, PortalWorkspaceService } from '../core/portal-workspace.service';
import { PortalIconComponent } from '../ui/portal-icon.component';
import { PortalPromptComponent } from '../ui/portal-prompt.component';

type PunchKind = 'in' | 'out' | 'lunch_in';
type WorkingFrom = 'office' | 'wfh';

/**
 * Employee time clock (selfie, Office/WFH, GPS, lunch, end of day).
 * Same rules and endpoints as the admin time clock, in the MyPeoplePortal layout.
 */
@Component({
  selector: 'app-portal-clock-page',
  standalone: true,
  imports: [FormsModule, RouterLink, PortalIconComponent, PortalPromptComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-clock-page.component.html',
})
export class PortalClockPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(AdminApiService);
  private readonly workspace = inject(PortalWorkspaceService);
  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('cameraVideo');

  protected readonly formatTime = formatManilaTime;
  protected readonly formatDateTime = formatManilaDateTime;
  protected readonly formatCoordinates = formatCoordinates;

  protected readonly status = signal<TimeClockStatus | null>(null);
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly nowLabel = signal('');

  protected readonly cameraStarting = signal(false);
  protected readonly cameraReady = signal(false);
  protected readonly cameraError = signal('');
  protected readonly selfiePreviewUrl = signal<string | null>(null);
  protected readonly selfieBlob = signal<Blob | null>(null);

  protected readonly picked = signal<WorkingFrom | null>(null);
  protected readonly locationLabel = signal('');
  protected readonly locationCoords = signal<{ lat: number; lng: number } | null>(null);
  protected readonly locationStatus = signal('');
  protected readonly requestingLocation = signal(false);

  protected readonly lunchConfirmOpen = signal(false);
  protected readonly pendingMemos = signal<EmployeeMemoDetail[]>([]);
  protected readonly activeMemo = signal<EmployeeMemoDetail | null>(null);
  protected readonly acknowledgingMemo = signal(false);

  protected readonly needsSelfie = computed(() => {
    const s = this.status();
    return Boolean(s?.canTimeIn || s?.canTimeOut || s?.canLunchIn);
  });
  /** GPS is saved with time in (office or home) and again on time out. */
  protected readonly capturesLocation = computed(() => {
    const s = this.status();
    if (!s || s.canLunchIn) {
      return false;
    }
    if (s.canTimeOut) {
      return true;
    }
    return Boolean(s.canTimeIn && this.picked());
  });
  protected readonly displayName = computed(
    () => this.status()?.fullName?.trim() || this.workspace.displayName(),
  );
  protected selfieSrc(path: string | null | undefined): string | null {
    return this.api.resolveAttendanceSelfieUrl(path);
  }

  protected readonly todayLocation = computed(() => {
    switch (this.status()?.expectedLocation) {
      case 'wfh':
        return 'Work from home';
      case 'off':
        return 'Day off';
      case 'office':
        return 'Office';
      default:
        return null;
    }
  });

  private mediaStream: MediaStream | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private serverSyncTimer: ReturnType<typeof setInterval> | null = null;
  private cameraRequestId = 0;
  /** serverNow - Date.now() at last sync; the clock face uses Date.now() + offset. */
  private serverOffsetMs = 0;
  private hasServerSync = false;

  constructor() {
    effect(() => {
      const video = this.videoRef()?.nativeElement;
      if (!video || !this.mediaStream || this.selfiePreviewUrl()) {
        return;
      }
      if (video.srcObject !== this.mediaStream) {
        this.attachStream(video, this.mediaStream);
      }
    });
  }

  ngOnInit(): void {
    this.tickClock();
    this.clockTimer = setInterval(() => this.tickClock(), 1000);
    this.serverSyncTimer = setInterval(() => void this.syncServerClock(), 60_000);
    void this.loadStatus();
    void this.loadPendingMemos();
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
    if (this.serverSyncTimer) {
      clearInterval(this.serverSyncTimer);
    }
    this.stopCamera();
    this.clearSelfiePreview();
  }

  // ---- Status -------------------------------------------------------------------------

  protected async loadStatus(options?: { keepMessages?: boolean }): Promise<void> {
    this.loading.set(true);
    if (!options?.keepMessages) {
      this.error.set('');
      this.success.set('');
    }
    this.clearSelfiePreview();
    this.stopCamera();

    try {
      const response = await firstValueFrom(this.api.getPortalTimeClockStatus());
      this.applyStatus(response.data);
    } catch (error) {
      this.status.set(null);
      if (!options?.keepMessages) {
        this.error.set(portalErrorMessage(error, 'Unable to load time clock status.'));
      }
    } finally {
      this.loading.set(false);
    }
  }

  private applyStatus(data: TimeClockStatus): void {
    this.status.set(data);
    this.workspace.clock.set(data);
    this.applyServerNow(data.serverNow);
    this.locationLabel.set('');
    this.locationCoords.set(null);
    this.locationStatus.set('');

    const expected = data.expectedLocation;
    this.picked.set(expected === 'office' || expected === 'wfh' ? expected : null);

    if (data.canTimeOut || (data.canTimeIn && this.picked())) {
      void this.requestGeolocation();
    }
    if (data.canTimeIn || data.canTimeOut || data.canLunchIn) {
      void this.startCamera();
    }
  }

  // ---- Server clock -------------------------------------------------------------------

  private applyServerNow(serverNow: string | null | undefined): void {
    const parsed = serverNow ? Date.parse(serverNow) : NaN;
    if (Number.isNaN(parsed)) {
      return;
    }
    this.serverOffsetMs = parsed - Date.now();
    this.hasServerSync = true;
    this.tickClock();
  }

  private async syncServerClock(): Promise<void> {
    try {
      const response = await firstValueFrom(this.api.getPortalTimeClockStatus());
      this.applyServerNow(response.data.serverNow);
    } catch {
      // Keep the last offset; punches never trust the device clock.
    }
  }

  private tickClock(): void {
    if (!this.hasServerSync) {
      this.nowLabel.set('Syncing server time…');
      return;
    }
    this.nowLabel.set(
      new Date(Date.now() + this.serverOffsetMs).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
  }

  // ---- Camera -------------------------------------------------------------------------

  protected async startCamera(): Promise<void> {
    this.cameraError.set('');
    this.cameraReady.set(false);
    this.cameraStarting.set(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError.set('Camera is not supported on this device or browser (it needs HTTPS).');
      this.cameraStarting.set(false);
      return;
    }

    if (this.mediaStream?.active) {
      this.cameraStarting.set(false);
      this.cameraReady.set(true);
      return;
    }

    this.stopTracks();
    const requestId = ++this.cameraRequestId;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 30 },
        },
      });

      if (requestId !== this.cameraRequestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      this.mediaStream = stream;
      const video = this.videoRef()?.nativeElement;
      if (video) {
        this.attachStream(video, stream);
      }
    } catch {
      if (requestId !== this.cameraRequestId) {
        return;
      }
      this.cameraError.set('Unable to access the camera. Allow camera permission and try again.');
      this.mediaStream = null;
      this.cameraStarting.set(false);
      this.cameraReady.set(false);
    }
  }

  private attachStream(video: HTMLVideoElement, stream: MediaStream): void {
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      void video.play().finally(() => {
        this.cameraReady.set(true);
        this.cameraStarting.set(false);
      });
    };
  }

  private stopCamera(): void {
    this.cameraRequestId += 1;
    this.cameraStarting.set(false);
    this.cameraReady.set(false);
    this.stopTracks();
    const video = this.videoRef()?.nativeElement;
    if (video) {
      video.srcObject = null;
      video.onloadedmetadata = null;
    }
  }

  private stopTracks(): void {
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
  }

  protected async captureSelfie(): Promise<void> {
    const video = this.videoRef()?.nativeElement;
    if (!video || !this.cameraReady()) {
      this.error.set('Camera is not ready yet.');
      return;
    }

    const width = video.videoWidth || 480;
    const height = video.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      this.error.set('Unable to capture the selfie.');
      return;
    }
    // The preview is mirrored, so mirror the saved frame to match what the user saw.
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.8),
    );
    if (!blob) {
      this.error.set('Unable to capture the selfie.');
      return;
    }

    this.clearSelfiePreview();
    this.selfieBlob.set(blob);
    this.selfiePreviewUrl.set(URL.createObjectURL(blob));
    this.error.set('');
  }

  protected retakeSelfie(): void {
    this.clearSelfiePreview();
    if (this.mediaStream?.active) {
      this.cameraReady.set(false);
      this.cameraStarting.set(true);
      return;
    }
    void this.startCamera();
  }

  private async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as {
        locality?: string;
        city?: string;
        principalSubdivision?: string;
      };
      const city = data.city?.trim() || '';
      const locality = data.locality?.trim() || '';
      const region = data.principalSubdivision?.trim() || '';
      const parts = [locality && locality !== city ? locality : '', city || region].filter(Boolean);
      return parts.join(', ') || null;
    } catch {
      return null;
    }
  }

  private clearSelfiePreview(): void {
    const preview = this.selfiePreviewUrl();
    if (preview?.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    this.selfiePreviewUrl.set(null);
    this.selfieBlob.set(null);
  }

  // ---- Location -----------------------------------------------------------------------

  protected pickLocation(value: WorkingFrom): void {
    this.picked.set(value);
    void this.requestGeolocation();
  }

  protected async requestGeolocation(): Promise<void> {
    if (!navigator.geolocation) {
      this.locationStatus.set('Location is not available on this device. You can still time in.');
      this.locationCoords.set(null);
      return;
    }

    this.requestingLocation.set(true);
    this.locationStatus.set('Getting your location…');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12_000,
          maximumAge: 60_000,
        }),
      );
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      this.locationCoords.set({ lat, lng });
      const address = await this.reverseGeocode(lat, lng);
      if (address && !this.locationLabel().trim()) {
        this.locationLabel.set(address);
      }
      this.locationStatus.set(
        `GPS captured (±${Math.round(position.coords.accuracy || 0)} m). The address is saved with your selfie.`,
      );
    } catch {
      this.locationCoords.set(null);
      this.locationStatus.set('GPS unavailable. You can still time in with an optional label.');
    } finally {
      this.requestingLocation.set(false);
    }
  }

  // ---- Punching -----------------------------------------------------------------------

  protected punchIn(): Promise<void> {
    return this.punch('in');
  }

  protected punchLunchIn(): Promise<void> {
    return this.punch('lunch_in');
  }

  protected async punchOut(): Promise<void> {
    if (this.status()?.punchOutRequiresIntent) {
      this.lunchConfirmOpen.set(true);
      return;
    }
    await this.punch('out', 'end_of_day');
  }

  protected async confirmPunchOutIntent(intent: 'lunch' | 'end_of_day'): Promise<void> {
    this.lunchConfirmOpen.set(false);
    await this.punch('out', intent);
  }

  protected cancelLunchConfirm(): void {
    this.lunchConfirmOpen.set(false);
  }

  private async punch(kind: PunchKind, intent?: 'lunch' | 'end_of_day' | null): Promise<void> {
    const selfie = this.selfieBlob();
    if (!selfie) {
      this.error.set('Take a selfie first before submitting.');
      return;
    }
    const pick = this.picked();
    if (kind === 'in' && pick == null) {
      this.error.set('Choose Office or Work from home before time in.');
      return;
    }

    this.submitting.set(true);
    this.error.set('');
    this.success.set('');

    const needsLocation = kind === 'in' || (kind === 'out' && intent !== 'lunch');
    if (needsLocation && !this.locationCoords() && !this.requestingLocation()) {
      await this.requestGeolocation();
    }
    const location = needsLocation
      ? {
          locationLat: this.locationCoords()?.lat ?? null,
          locationLng: this.locationCoords()?.lng ?? null,
          locationLabel: this.locationLabel().trim() || null,
        }
      : null;

    try {
      const response = await firstValueFrom(
        kind === 'out'
          ? this.api.portalTimeOut(selfie, intent ?? null, location)
          : this.api.portalTimeIn(selfie, kind === 'lunch_in' ? 'office' : pick!, location),
      );
      this.status.set(response.data);
      this.workspace.clock.set(response.data);
      this.applyServerNow(response.data.serverNow);
      this.success.set(response.message);
      this.clearSelfiePreview();
      this.stopCamera();
      void this.workspace.reloadDashboard().catch(() => undefined);

      if (response.data.canTimeOut || response.data.canLunchIn) {
        void this.startCamera();
      }
    } catch (error) {
      this.error.set(
        portalErrorMessage(
          error,
          kind === 'out' ? 'Unable to record time out.' : 'Unable to record time in.',
        ),
      );
      await this.loadStatus({ keepMessages: true });
    } finally {
      this.submitting.set(false);
    }
  }

  // ---- Memos (must be acknowledged, same as the admin clock) ---------------------------

  private async loadPendingMemos(): Promise<void> {
    try {
      const pending = (await firstValueFrom(this.api.listPendingEmployeeMemos())).data ?? [];
      this.pendingMemos.set(pending);
      if (!this.activeMemo() && pending.length > 0) {
        this.activeMemo.set(pending[0]);
      }
    } catch {
      // Memos are optional if that table is not ready.
    }
  }

  protected async acknowledgeActiveMemo(): Promise<void> {
    const memo = this.activeMemo();
    if (!memo || this.acknowledgingMemo()) {
      return;
    }
    this.acknowledgingMemo.set(true);
    try {
      await firstValueFrom(this.api.acknowledgeEmployeeMemo(memo.id));
      const remaining = this.pendingMemos().filter((item) => item.id !== memo.id);
      this.pendingMemos.set(remaining);
      this.activeMemo.set(remaining[0] ?? null);
      void this.workspace.refresh();
    } catch {
      this.error.set('Unable to acknowledge the memo. Please try again.');
    } finally {
      this.acknowledgingMemo.set(false);
    }
  }
}
