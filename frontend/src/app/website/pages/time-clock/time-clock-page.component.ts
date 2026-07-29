import {
  Component,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TimeClockApiService, TimeClockStatus } from '../../../core/services/time-clock-api.service';

@Component({
  selector: 'app-time-clock-page',
  imports: [FormsModule],
  templateUrl: './time-clock-page.component.html',
})
export class TimeClockPageComponent implements OnInit, OnDestroy {
  private readonly timeClockApi = inject(TimeClockApiService);
  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('cameraVideo');

  readonly username = signal('');
  readonly status = signal<TimeClockStatus | null>(null);
  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly nowLabel = signal('');
  readonly cameraStarting = signal(false);
  readonly cameraReady = signal(false);
  readonly cameraError = signal('');
  readonly selfiePreviewUrl = signal<string | null>(null);
  readonly selfieBlob = signal<Blob | null>(null);

  private mediaStream: MediaStream | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private serverSyncTimer: ReturnType<typeof setInterval> | null = null;
  private cameraRequestId = 0;
  /** serverNow - Date.now() when last synced; display uses Date.now() + offset. */
  private serverOffsetMs = 0;
  private hasServerSync = false;

  constructor() {
    effect(() => {
      const video = this.videoRef()?.nativeElement;
      if (!video || !this.mediaStream || this.selfiePreviewUrl()) {
        return;
      }

      if (video.srcObject !== this.mediaStream) {
        video.srcObject = this.mediaStream;
        video.onloadedmetadata = () => {
          void video.play().then(() => {
            this.cameraReady.set(true);
            this.cameraStarting.set(false);
          }).catch(() => {
            this.cameraReady.set(true);
            this.cameraStarting.set(false);
          });
        };
      }
    });
  }

  ngOnInit(): void {
    this.tickClock();
    this.clockTimer = setInterval(() => this.tickClock(), 1000);
    void this.syncServerClock();
    this.serverSyncTimer = setInterval(() => void this.syncServerClock(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
    if (this.serverSyncTimer) {
      clearInterval(this.serverSyncTimer);
    }
    this.stopCamera();
    this.clearSelfie();
  }

  private applyServerNow(serverNow: string | undefined | null): void {
    if (!serverNow) {
      return;
    }
    const parsed = Date.parse(serverNow);
    if (Number.isNaN(parsed)) {
      return;
    }
    this.serverOffsetMs = parsed - Date.now();
    this.hasServerSync = true;
    this.tickClock();
  }

  private async syncServerClock(): Promise<void> {
    try {
      const response = await firstValueFrom(this.timeClockApi.getServerClock());
      this.applyServerNow(response.data.serverNow);
    } catch {
      // Keep last known offset; never fall back to trusting device for punches.
    }
  }

  private tickClock(): void {
    const source = this.hasServerSync
      ? new Date(Date.now() + this.serverOffsetMs)
      : null;

    if (!source) {
      this.nowLabel.set('Syncing server time…');
      return;
    }

    this.nowLabel.set(
      source.toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
  }

  async lookup(): Promise<void> {
    const value = this.username().trim();
    if (!value) {
      this.error.set('Enter your username.');
      this.status.set(null);
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    this.clearSelfie();
    this.stopCamera();

    try {
      const response = await firstValueFrom(this.timeClockApi.getStatus(value));
      this.status.set(response.data);
      this.applyServerNow(response.data.serverNow);
      this.username.set(response.data.username || value);

      // Don't block the Check button on camera warmup.
      if (response.data.canTimeIn || response.data.canTimeOut) {
        void this.startCamera();
      }
    } catch {
      this.error.set('Unable to look up username.');
      this.status.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async startCamera(): Promise<void> {
    this.cameraError.set('');
    this.cameraReady.set(false);
    this.cameraStarting.set(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError.set('Camera is not supported on this device/browser.');
      this.cameraStarting.set(false);
      return;
    }

    // Reuse an already-open stream when possible (faster retake).
    if (this.mediaStream && this.mediaStream.active) {
      this.cameraStarting.set(false);
      this.cameraReady.set(true);
      return;
    }

    this.stopCameraTracksOnly();
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
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }

      this.mediaStream = stream;
      // Effect attaches stream once the <video> exists.
      if (this.videoRef()?.nativeElement) {
        const video = this.videoRef()!.nativeElement;
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          void video.play().finally(() => {
            this.cameraReady.set(true);
            this.cameraStarting.set(false);
          });
        };
      }
    } catch {
      if (requestId !== this.cameraRequestId) {
        return;
      }
      this.cameraError.set('Unable to access camera. Allow camera permission and try again.');
      this.mediaStream = null;
      this.cameraStarting.set(false);
      this.cameraReady.set(false);
    }
  }

  stopCamera(): void {
    this.cameraRequestId += 1;
    this.cameraStarting.set(false);
    this.cameraReady.set(false);
    this.stopCameraTracksOnly();

    const video = this.videoRef()?.nativeElement;
    if (video) {
      video.srcObject = null;
      video.onloadedmetadata = null;
    }
  }

  private stopCameraTracksOnly(): void {
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
  }

  async captureSelfie(): Promise<void> {
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
      this.error.set('Unable to capture selfie.');
      return;
    }

    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.8);
    });

    if (!blob) {
      this.error.set('Unable to capture selfie.');
      return;
    }

    this.clearSelfiePreviewOnly();
    this.selfieBlob.set(blob);
    this.selfiePreviewUrl.set(URL.createObjectURL(blob));
    this.error.set('');
  }

  retakeSelfie(): void {
    this.clearSelfiePreviewOnly();
    // Keep the existing stream — avoids another slow getUserMedia round-trip.
    if (this.mediaStream?.active) {
      this.cameraReady.set(false);
      this.cameraStarting.set(true);
      // <video> remounts after preview clears; effect re-attaches the stream.
      return;
    }

    void this.startCamera();
  }

  async punchIn(): Promise<void> {
    await this.punch('in');
  }

  async punchOut(): Promise<void> {
    await this.punch('out');
  }

  private async punch(kind: 'in' | 'out'): Promise<void> {
    const value = this.username().trim();
    if (!value) {
      this.error.set('Enter your username.');
      return;
    }

    const selfie = this.selfieBlob();
    if (!selfie) {
      this.error.set('Take a selfie first before submitting.');
      return;
    }

    this.submitting.set(true);
    this.error.set('');
    this.success.set('');

    try {
      const response = await firstValueFrom(
        kind === 'in'
          ? this.timeClockApi.timeIn(value, selfie)
          : this.timeClockApi.timeOut(value, selfie),
      );
      this.status.set(response.data);
      this.applyServerNow(response.data.serverNow);
      this.success.set(response.message);
      this.clearSelfiePreviewOnly();
      this.stopCamera();

      if (response.data.canTimeOut) {
        void this.startCamera();
      }
    } catch (err: unknown) {
      const message =
        typeof err === 'object' &&
        err !== null &&
        'error' in err &&
        typeof (err as { error?: { message?: string } }).error?.message === 'string'
          ? (err as { error: { message: string } }).error.message
          : kind === 'in'
            ? 'Unable to record time in.'
            : 'Unable to record time out.';
      this.error.set(message);
      await this.lookup();
    } finally {
      this.submitting.set(false);
    }
  }

  formatPunch(value: string | null): string {
    if (!value) {
      return '—';
    }

    return new Date(value).toLocaleTimeString('en-PH', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  needsSelfie(): boolean {
    const current = this.status();
    return Boolean(current?.canTimeIn || current?.canTimeOut);
  }

  private clearSelfiePreviewOnly(): void {
    const preview = this.selfiePreviewUrl();
    if (preview?.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    this.selfiePreviewUrl.set(null);
    this.selfieBlob.set(null);
  }

  private clearSelfie(): void {
    this.clearSelfiePreviewOnly();
  }
}
