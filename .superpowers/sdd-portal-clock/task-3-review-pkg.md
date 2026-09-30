diff --git a/frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.html b/frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.html
new file mode 100644
index 0000000..705f61b
--- /dev/null
+++ b/frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.html
@@ -0,0 +1,275 @@
+<section
+  class="w-full rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
+  [class.p-4]="mode() === 'compact'"
+  [class.p-6]="mode() === 'full'"
+>
+  <div class="text-center" [class.mb-4]="mode() === 'compact'" [class.mb-6]="mode() === 'full'">
+    <p class="text-xs font-bold uppercase tracking-[0.2em] text-pcmazing-500">Time Clock</p>
+    <h2
+      class="mt-1 font-extrabold text-slate-900 dark:text-white"
+      [class.text-xl]="mode() === 'compact'"
+      [class.text-2xl]="mode() === 'full'"
+    >
+      {{ displayName() }}
+    </h2>
+    @if (mode() === 'full') {
+      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
+        Take a selfie, then time in or out. Identity comes from your signed-in session.
+      </p>
+    } @else {
+      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Selfie required ┬╖ session-bound</p>
+    }
+    <p class="mt-2 font-mono text-sm text-slate-600 dark:text-slate-300">{{ nowLabel() }}</p>
+    <p class="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Server time ┬╖ Asia/Manila</p>
+  </div>
+
+  @if (loading()) {
+    <div class="flex items-center justify-center py-8 text-sm text-slate-500">Loading status...</div>
+  }
+
+  @if (error()) {
+    <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
+      {{ error() }}
+    </div>
+  }
+  @if (success()) {
+    <div
+      class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
+      [class.mt-3]="!!error()"
+    >
+      {{ success() }}
+    </div>
+  }
+
+  @if (status(); as current) {
+    <div
+      class="rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
+      [class.mt-4]="mode() === 'compact'"
+      [class.mt-6]="mode() === 'full'"
+      [class.p-3]="mode() === 'compact'"
+      [class.p-4]="mode() === 'full'"
+    >
+      @if (current.employeeCode) {
+        <p class="text-xs text-slate-500 dark:text-slate-400">Employee code: {{ current.employeeCode }}</p>
+      }
+      <p class="text-sm text-slate-600 dark:text-slate-300" [class.mt-1]="!!current.employeeCode">{{ current.message }}</p>
+
+      @if (current.expectedLocation) {
+        <p
+          class="mt-3 rounded-xl px-3 py-2 text-xs font-semibold"
+          [class]="
+            current.expectedLocation === 'off'
+              ? 'border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
+              : current.expectedLocation === 'wfh'
+                ? 'border border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200'
+                : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
+          "
+        >
+          Today: {{ expectedLocationLabel(current.expectedLocation) }}
+          @if (current.expectedLocation === 'off') {
+            <span class="mt-1 block font-medium">Scheduled day off ΓÇö punch is still allowed.</span>
+          }
+        </p>
+      }
+
+      @if (current.canTimeIn) {
+        <div class="mt-3">
+          <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Working from</p>
+          <div class="mt-2 grid grid-cols-2 gap-2">
+            <button
+              type="button"
+              [class]="
+                pickedLocation() === 'office'
+                  ? 'rounded-xl border border-pcmazing-500 bg-pcmazing-500 px-3 py-2.5 text-sm font-bold text-white'
+                  : 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
+              "
+              (click)="pickedLocation.set('office')"
+            >
+              Office
+            </button>
+            <button
+              type="button"
+              [class]="
+                pickedLocation() === 'wfh'
+                  ? 'rounded-xl border border-pcmazing-500 bg-pcmazing-500 px-3 py-2.5 text-sm font-bold text-white'
+                  : 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
+              "
+              (click)="pickedLocation.set('wfh'); requestGeolocation()"
+            >
+              WFH
+            </button>
+          </div>
+          @if (current.expectedLocation === 'off') {
+            <p class="mt-2 text-xs text-amber-800 dark:text-amber-200">
+              Scheduled day off ΓÇö choose Office or WFH if you still need to clock in.
+            </p>
+          }
+        </div>
+      }
+
+      @if (current.canTimeIn && pickedLocation() === 'wfh') {
+        <div class="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900">
+          <label class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">Location label (optional)</label>
+          <input
+            type="text"
+            maxlength="200"
+            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
+            placeholder="e.g. Home ΓÇô Cabanatuan"
+            [ngModel]="locationLabel()"
+            (ngModelChange)="locationLabel.set($event)"
+          />
+          <p class="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
+            {{ locationStatus() || 'Location will be captured for WFH days.' }}
+          </p>
+          <button
+            type="button"
+            class="mt-2 text-xs font-bold text-pcmazing-500 hover:text-pcmazing-600"
+            [disabled]="requestingLocation()"
+            (click)="requestGeolocation()"
+          >
+            @if (requestingLocation()) {
+              Getting GPS...
+            } @else {
+              Refresh GPS
+            }
+          </button>
+        </div>
+      }
+
+      @if (current.canTimeOut && (current.undertimeGraceMinutes ?? 0) > 0 && mode() === 'full') {
+        <p class="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
+          Need to leave a little early (emergency, appointment, or event)? Clock out as usual. Up to
+          {{ current.undertimeGraceMinutes }} minutes before 9 hours still counts as a full paid day.
+        </p>
+      }
+
+      <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
+        <div class="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-900">
+          <p class="text-xs font-bold uppercase text-slate-400">Time in</p>
+          <p class="mt-1 font-semibold text-slate-900 dark:text-white">{{ formatPunch(current.timeIn) }}</p>
+        </div>
+        <div class="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-900">
+          <p class="text-xs font-bold uppercase text-slate-400">Time out</p>
+          <p class="mt-1 font-semibold text-slate-900 dark:text-white">{{ formatPunch(current.timeOut) }}</p>
+        </div>
+      </div>
+    </div>
+
+    @if (needsSelfie()) {
+      <div
+        class="rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
+        [class.mt-4]="mode() === 'compact'"
+        [class.mt-5]="mode() === 'full'"
+        [class.p-3]="mode() === 'compact'"
+        [class.p-4]="mode() === 'full'"
+      >
+        <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">Selfie proof required</p>
+        @if (mode() === 'full') {
+          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Capture a clear face photo before submitting your punch.</p>
+        }
+
+        @if (cameraError()) {
+          <div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
+            {{ cameraError() }}
+            <button type="button" class="ml-2 font-bold underline" (click)="startCamera()">Retry camera</button>
+          </div>
+        }
+
+        @if (selfiePreviewUrl(); as preview) {
+          <img
+            [src]="preview"
+            alt="Selfie preview"
+            class="mt-3 aspect-square w-full rounded-2xl border border-slate-200 object-cover dark:border-slate-600"
+          />
+          <button
+            type="button"
+            class="mt-3 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-slate-600 dark:text-slate-200"
+            (click)="retakeSelfie()"
+            [disabled]="submitting()"
+          >
+            Retake selfie
+          </button>
+        } @else {
+          <div class="relative mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-black dark:border-slate-600">
+            <video
+              #cameraVideo
+              class="aspect-square w-full scale-x-[-1] object-cover"
+              autoplay
+              playsinline
+              muted
+            ></video>
+            @if (cameraStarting() || !cameraReady()) {
+              <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/70 text-sm text-white">
+                <span class="size-8 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
+                <span>Opening camera...</span>
+              </div>
+            }
+          </div>
+          <button
+            type="button"
+            class="mt-3 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 ring-1 ring-slate-300 disabled:opacity-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600"
+            [disabled]="!cameraReady() || cameraStarting() || submitting()"
+            (click)="captureSelfie()"
+          >
+            @if (cameraStarting()) {
+              Waiting for camera...
+            } @else {
+              Capture selfie
+            }
+          </button>
+        }
+      </div>
+    }
+
+    <div class="grid gap-3" [class.mt-4]="mode() === 'compact'" [class.mt-5]="mode() === 'full'">
+      @if (current.canTimeIn) {
+        <button
+          type="button"
+          class="w-full rounded-2xl bg-pcmazing-500 font-bold text-white hover:bg-pcmazing-600 disabled:opacity-50"
+          [class.px-4]="true"
+          [class.py-3]="mode() === 'compact'"
+          [class.py-4]="mode() === 'full'"
+          [class.text-sm]="mode() === 'compact'"
+          [class.text-base]="mode() === 'full'"
+          [disabled]="submitting() || !selfieBlob() || !pickedLocation()"
+          (click)="punchIn()"
+        >
+          @if (submitting()) {
+            Recording...
+          } @else {
+            Time In
+          }
+        </button>
+      } @else if (current.canTimeOut) {
+        <button
+          type="button"
+          class="w-full rounded-2xl bg-slate-900 font-bold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
+          [class.px-4]="true"
+          [class.py-3]="mode() === 'compact'"
+          [class.py-4]="mode() === 'full'"
+          [class.text-sm]="mode() === 'compact'"
+          [class.text-base]="mode() === 'full'"
+          [disabled]="submitting() || !selfieBlob()"
+          (click)="punchOut()"
+        >
+          @if (submitting()) {
+            Recording...
+          } @else {
+            Time Out
+          }
+        </button>
+      } @else if (current.status === 'completed') {
+        <div
+          class="rounded-2xl border border-emerald-200 bg-emerald-50 text-center font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
+          [class.px-4]="true"
+          [class.py-3]="mode() === 'compact'"
+          [class.py-4]="mode() === 'full'"
+          [class.text-xs]="mode() === 'compact'"
+          [class.text-sm]="mode() === 'full'"
+        >
+          Done for today
+        </div>
+      }
+    </div>
+  }
+</section>
diff --git a/frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.ts b/frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.ts
new file mode 100644
index 0000000..e60e906
--- /dev/null
+++ b/frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.ts
@@ -0,0 +1,486 @@
+import {
+  Component,
+  effect,
+  ElementRef,
+  inject,
+  input,
+  OnDestroy,
+  OnInit,
+  output,
+  signal,
+  viewChild,
+} from '@angular/core';
+import { FormsModule } from '@angular/forms';
+import { firstValueFrom } from 'rxjs';
+import { AdminApiService, TimeClockStatus } from '../../services/admin-api.service';
+import { AdminAuthService } from '../../services/admin-auth.service';
+
+@Component({
+  selector: 'app-portal-time-clock',
+  imports: [FormsModule],
+  templateUrl: './portal-time-clock.component.html',
+})
+export class PortalTimeClockComponent implements OnInit, OnDestroy {
+  private readonly adminApi = inject(AdminApiService);
+  private readonly adminAuth = inject(AdminAuthService);
+  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('cameraVideo');
+
+  readonly mode = input<'compact' | 'full'>('full');
+  readonly punched = output<void>();
+
+  readonly status = signal<TimeClockStatus | null>(null);
+  readonly loading = signal(false);
+  readonly submitting = signal(false);
+  readonly error = signal('');
+  readonly success = signal('');
+  readonly nowLabel = signal('');
+  readonly cameraStarting = signal(false);
+  readonly cameraReady = signal(false);
+  readonly cameraError = signal('');
+  readonly selfiePreviewUrl = signal<string | null>(null);
+  readonly selfieBlob = signal<Blob | null>(null);
+  readonly locationLabel = signal('');
+  readonly locationCoords = signal<{ lat: number; lng: number } | null>(null);
+  readonly locationStatus = signal('');
+  readonly requestingLocation = signal(false);
+  readonly pickedLocation = signal<'office' | 'wfh' | null>(null);
+
+  private mediaStream: MediaStream | null = null;
+  private clockTimer: ReturnType<typeof setInterval> | null = null;
+  private serverSyncTimer: ReturnType<typeof setInterval> | null = null;
+  private cameraRequestId = 0;
+  /** serverNow - Date.now() when last synced; display uses Date.now() + offset. */
+  private serverOffsetMs = 0;
+  private hasServerSync = false;
+
+  constructor() {
+    effect(() => {
+      const video = this.videoRef()?.nativeElement;
+      if (!video || !this.mediaStream || this.selfiePreviewUrl()) {
+        return;
+      }
+
+      if (video.srcObject !== this.mediaStream) {
+        video.srcObject = this.mediaStream;
+        video.onloadedmetadata = () => {
+          void video.play().then(() => {
+            this.cameraReady.set(true);
+            this.cameraStarting.set(false);
+          }).catch(() => {
+            this.cameraReady.set(true);
+            this.cameraStarting.set(false);
+          });
+        };
+      }
+    });
+  }
+
+  ngOnInit(): void {
+    this.tickClock();
+    this.clockTimer = setInterval(() => this.tickClock(), 1000);
+    void this.loadStatus();
+    this.serverSyncTimer = setInterval(() => void this.syncServerClock(), 60_000);
+  }
+
+  ngOnDestroy(): void {
+    if (this.clockTimer) {
+      clearInterval(this.clockTimer);
+    }
+    if (this.serverSyncTimer) {
+      clearInterval(this.serverSyncTimer);
+    }
+    this.stopCamera();
+    this.clearSelfie();
+  }
+
+  displayName(): string {
+    const current = this.status();
+    if (current?.fullName?.trim()) {
+      return current.fullName.trim();
+    }
+    if (current?.username?.trim()) {
+      return current.username.trim();
+    }
+    const stored = this.adminAuth.getStoredUser();
+    return stored?.fullName?.trim() || stored?.username?.trim() || 'ΓÇö';
+  }
+
+  private applyServerNow(serverNow: string | undefined | null): void {
+    if (!serverNow) {
+      return;
+    }
+    const parsed = Date.parse(serverNow);
+    if (Number.isNaN(parsed)) {
+      return;
+    }
+    this.serverOffsetMs = parsed - Date.now();
+    this.hasServerSync = true;
+    this.tickClock();
+  }
+
+  /** Refresh offset only ΓÇö does not reset punch UI / selfie. */
+  private async syncServerClock(): Promise<void> {
+    try {
+      const response = await firstValueFrom(this.adminApi.getPortalTimeClockStatus());
+      this.applyServerNow(response.data.serverNow);
+    } catch {
+      // Keep last known offset; never fall back to trusting device for punches.
+    }
+  }
+
+  private tickClock(): void {
+    const source = this.hasServerSync
+      ? new Date(Date.now() + this.serverOffsetMs)
+      : null;
+
+    if (!source) {
+      this.nowLabel.set('Syncing server timeΓÇª');
+      return;
+    }
+
+    this.nowLabel.set(
+      source.toLocaleString('en-PH', {
+        timeZone: 'Asia/Manila',
+        weekday: 'short',
+        year: 'numeric',
+        month: 'short',
+        day: 'numeric',
+        hour: '2-digit',
+        minute: '2-digit',
+        second: '2-digit',
+      }),
+    );
+  }
+
+  async loadStatus(options?: { preserveMessages?: boolean }): Promise<void> {
+    this.loading.set(true);
+    if (!options?.preserveMessages) {
+      this.error.set('');
+      this.success.set('');
+    }
+    this.clearSelfie();
+    this.stopCamera();
+
+    try {
+      const response = await firstValueFrom(this.adminApi.getPortalTimeClockStatus());
+      this.applyStatus(response.data);
+    } catch {
+      if (!options?.preserveMessages) {
+        this.error.set('Unable to load time clock status.');
+      }
+      this.status.set(null);
+    } finally {
+      this.loading.set(false);
+    }
+  }
+
+  private applyStatus(data: TimeClockStatus): void {
+    this.status.set(data);
+    this.applyServerNow(data.serverNow);
+    this.locationLabel.set(data.locationLabel ?? '');
+    this.locationCoords.set(
+      data.locationLat != null && data.locationLng != null
+        ? { lat: data.locationLat, lng: data.locationLng }
+        : null,
+    );
+    this.locationStatus.set('');
+
+    const expected = data.expectedLocation;
+    if (expected === 'office' || expected === 'wfh') {
+      this.pickedLocation.set(expected);
+    } else {
+      this.pickedLocation.set(null);
+    }
+
+    if (data.canTimeIn && this.pickedLocation() === 'wfh') {
+      void this.requestGeolocation();
+    }
+
+    if (data.canTimeIn || data.canTimeOut) {
+      void this.startCamera();
+    }
+  }
+
+  async startCamera(): Promise<void> {
+    this.cameraError.set('');
+    this.cameraReady.set(false);
+    this.cameraStarting.set(true);
+
+    if (!navigator.mediaDevices?.getUserMedia) {
+      this.cameraError.set('Camera is not supported on this device/browser.');
+      this.cameraStarting.set(false);
+      return;
+    }
+
+    if (this.mediaStream && this.mediaStream.active) {
+      this.cameraStarting.set(false);
+      this.cameraReady.set(true);
+      return;
+    }
+
+    this.stopCameraTracksOnly();
+    const requestId = ++this.cameraRequestId;
+
+    try {
+      const stream = await navigator.mediaDevices.getUserMedia({
+        audio: false,
+        video: {
+          facingMode: 'user',
+          width: { ideal: 480 },
+          height: { ideal: 480 },
+          frameRate: { ideal: 24, max: 30 },
+        },
+      });
+
+      if (requestId !== this.cameraRequestId) {
+        for (const track of stream.getTracks()) {
+          track.stop();
+        }
+        return;
+      }
+
+      this.mediaStream = stream;
+      if (this.videoRef()?.nativeElement) {
+        const video = this.videoRef()!.nativeElement;
+        video.srcObject = stream;
+        video.onloadedmetadata = () => {
+          void video.play().finally(() => {
+            this.cameraReady.set(true);
+            this.cameraStarting.set(false);
+          });
+        };
+      }
+    } catch {
+      if (requestId !== this.cameraRequestId) {
+        return;
+      }
+      this.cameraError.set('Unable to access camera. Allow camera permission and try again.');
+      this.mediaStream = null;
+      this.cameraStarting.set(false);
+      this.cameraReady.set(false);
+    }
+  }
+
+  stopCamera(): void {
+    this.cameraRequestId += 1;
+    this.cameraStarting.set(false);
+    this.cameraReady.set(false);
+    this.stopCameraTracksOnly();
+
+    const video = this.videoRef()?.nativeElement;
+    if (video) {
+      video.srcObject = null;
+      video.onloadedmetadata = null;
+    }
+  }
+
+  private stopCameraTracksOnly(): void {
+    if (this.mediaStream) {
+      for (const track of this.mediaStream.getTracks()) {
+        track.stop();
+      }
+      this.mediaStream = null;
+    }
+  }
+
+  async captureSelfie(): Promise<void> {
+    const video = this.videoRef()?.nativeElement;
+    if (!video || !this.cameraReady()) {
+      this.error.set('Camera is not ready yet.');
+      return;
+    }
+
+    const width = video.videoWidth || 480;
+    const height = video.videoHeight || 480;
+    const canvas = document.createElement('canvas');
+    canvas.width = width;
+    canvas.height = height;
+    const context = canvas.getContext('2d');
+    if (!context) {
+      this.error.set('Unable to capture selfie.');
+      return;
+    }
+
+    context.translate(width, 0);
+    context.scale(-1, 1);
+    context.drawImage(video, 0, 0, width, height);
+
+    const blob = await new Promise<Blob | null>((resolve) => {
+      canvas.toBlob((value) => resolve(value), 'image/jpeg', 0.8);
+    });
+
+    if (!blob) {
+      this.error.set('Unable to capture selfie.');
+      return;
+    }
+
+    this.clearSelfiePreviewOnly();
+    this.selfieBlob.set(blob);
+    this.selfiePreviewUrl.set(URL.createObjectURL(blob));
+    this.error.set('');
+  }
+
+  retakeSelfie(): void {
+    this.clearSelfiePreviewOnly();
+    if (this.mediaStream?.active) {
+      this.cameraReady.set(false);
+      this.cameraStarting.set(true);
+      return;
+    }
+
+    void this.startCamera();
+  }
+
+  async punchIn(): Promise<void> {
+    await this.punch('in');
+  }
+
+  async punchOut(): Promise<void> {
+    await this.punch('out');
+  }
+
+  private async punch(kind: 'in' | 'out'): Promise<void> {
+    const selfie = this.selfieBlob();
+    if (!selfie) {
+      this.error.set('Take a selfie first before submitting.');
+      return;
+    }
+
+    const pick = this.pickedLocation();
+    if (kind === 'in' && pick == null) {
+      this.error.set('Choose Office or Work from home before time in.');
+      return;
+    }
+
+    this.submitting.set(true);
+    this.error.set('');
+    this.success.set('');
+
+    let location =
+      kind === 'in' && pick === 'wfh'
+        ? {
+            locationLat: this.locationCoords()?.lat ?? null,
+            locationLng: this.locationCoords()?.lng ?? null,
+            locationLabel: this.locationLabel().trim() || null,
+          }
+        : null;
+
+    if (kind === 'in' && pick === 'wfh' && !this.locationCoords() && !this.requestingLocation()) {
+      await this.requestGeolocation();
+      location = {
+        locationLat: this.locationCoords()?.lat ?? null,
+        locationLng: this.locationCoords()?.lng ?? null,
+        locationLabel: this.locationLabel().trim() || null,
+      };
+    }
+
+    try {
+      const response = await firstValueFrom(
+        kind === 'in'
+          ? this.adminApi.portalTimeIn(selfie, pick!, location)
+          : this.adminApi.portalTimeOut(selfie),
+      );
+      this.status.set(response.data);
+      this.applyServerNow(response.data.serverNow);
+      this.success.set(response.message);
+      this.clearSelfiePreviewOnly();
+      this.stopCamera();
+      this.punched.emit();
+
+      if (response.data.canTimeOut) {
+        void this.startCamera();
+      }
+    } catch (err: unknown) {
+      const message =
+        typeof err === 'object' &&
+        err !== null &&
+        'error' in err &&
+        typeof (err as { error?: { message?: string } }).error?.message === 'string'
+          ? (err as { error: { message: string } }).error.message
+          : kind === 'in'
+            ? 'Unable to record time in.'
+            : 'Unable to record time out.';
+      this.error.set(message);
+      await this.loadStatus({ preserveMessages: true });
+    } finally {
+      this.submitting.set(false);
+    }
+  }
+
+  expectedLocationLabel(value: string | null | undefined): string {
+    switch (value) {
+      case 'wfh':
+        return 'Work from home';
+      case 'off':
+        return 'Day off';
+      case 'office':
+        return 'Office';
+      default:
+        return 'Office';
+    }
+  }
+
+  async requestGeolocation(): Promise<void> {
+    if (!navigator.geolocation) {
+      this.locationStatus.set('Location is not available on this device. You can still time in.');
+      this.locationCoords.set(null);
+      return;
+    }
+
+    this.requestingLocation.set(true);
+    this.locationStatus.set('Getting your locationΓÇª');
+
+    try {
+      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
+        navigator.geolocation.getCurrentPosition(resolve, reject, {
+          enableHighAccuracy: true,
+          timeout: 12_000,
+          maximumAge: 60_000,
+        });
+      });
+      this.locationCoords.set({
+        lat: position.coords.latitude,
+        lng: position.coords.longitude,
+      });
+      this.locationStatus.set(
+        `GPS captured (┬▒${Math.round(position.coords.accuracy || 0)} m). You can add an optional label.`,
+      );
+    } catch {
+      this.locationCoords.set(null);
+      this.locationStatus.set('GPS unavailable. You can still time in with an optional label.');
+    } finally {
+      this.requestingLocation.set(false);
+    }
+  }
+
+  formatPunch(value: string | null): string {
+    if (!value) {
+      return 'ΓÇö';
+    }
+
+    return new Date(value).toLocaleTimeString('en-PH', {
+      timeZone: 'Asia/Manila',
+      hour: '2-digit',
+      minute: '2-digit',
+      second: '2-digit',
+    });
+  }
+
+  needsSelfie(): boolean {
+    const current = this.status();
+    return Boolean(current?.canTimeIn || current?.canTimeOut);
+  }
+
+  private clearSelfiePreviewOnly(): void {
+    const preview = this.selfiePreviewUrl();
+    if (preview?.startsWith('blob:')) {
+      URL.revokeObjectURL(preview);
+    }
+    this.selfiePreviewUrl.set(null);
+    this.selfieBlob.set(null);
+  }
+
+  private clearSelfie(): void {
+    this.clearSelfiePreviewOnly();
+  }
+}
