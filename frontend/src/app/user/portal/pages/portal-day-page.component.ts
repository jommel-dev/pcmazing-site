import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AdminApiService } from '../../../admin/services/admin-api.service';
import { formatHours, formatManilaTime, monthTitle } from '../core/portal-format';
import { portalErrorMessage, PortalWorkspaceService } from '../core/portal-workspace.service';
import { PortalIconComponent } from '../ui/portal-icon.component';
import { PortalPromptComponent } from '../ui/portal-prompt.component';

@Component({
  selector: 'app-portal-day-page',
  standalone: true,
  imports: [FormsModule, RouterLink, PortalIconComponent, PortalPromptComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-day-page.component.html',
})
export class PortalDayPageComponent {
  private readonly api = inject(AdminApiService);
  protected readonly workspace = inject(PortalWorkspaceService);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  protected readonly formatTime = formatManilaTime;
  protected readonly reason = signal('');
  protected readonly todoTitle = signal('');
  private syncedFor = '';
  private reasonDirty = false;

  protected readonly date = computed(() => this.params()?.get('date') ?? '');
  protected readonly day = computed(
    () =>
      this.workspace
        .dashboard()
        ?.attendanceDays.find((row) => row.workDate.slice(0, 10) === this.date()) ?? null,
  );
  protected readonly off = computed(
    () =>
      this.workspace.dashboard()?.dayOffs.find((row) => row.dayOffDate.slice(0, 10) === this.date()) ??
      null,
  );
  protected readonly todos = computed(
    () =>
      this.workspace.dashboard()?.todos.filter((row) => row.dueDate.slice(0, 10) === this.date()) ??
      [],
  );
  protected readonly activities = computed(
    () =>
      this.workspace
        .dashboard()
        ?.activities.filter((row) => row.createdAt.slice(0, 10) === this.date()) ?? [],
  );
  protected readonly title = computed(() => {
    const [year, month, day] = this.date().split('-').map(Number);
    if (!year || !month || !day) {
      return 'Day';
    }
    return `${monthTitle(`${year}-${String(month).padStart(2, '0')}`).split(' ')[0]?.slice(0, 3)} ${day}, ${year}`;
  });
  protected readonly subtitle = computed(() => {
    const day = this.day();
    if (!day?.timeIn && !day?.timeOut) {
      return 'No punch';
    }
    const hours = day?.hoursWorked == null ? '' : formatHours(day.hoursWorked);
    const range = day?.timeOut
      ? `${formatManilaTime(day.timeIn)} – ${formatManilaTime(day.timeOut)}`
      : formatManilaTime(day?.timeIn);
    return `${range}  ${hours}`.trim();
  });

  constructor() {
    effect(() => {
      const date = this.date();
      const saved = this.off()?.reason ?? '';
      untracked(() => {
        if (this.syncedFor !== date) {
          this.syncedFor = date;
          this.reasonDirty = false;
          this.reason.set(saved);
        } else if (!this.reasonDirty) {
          this.reason.set(saved);
        }
      });
    });
  }

  protected editReason(value: string): void {
    this.reasonDirty = true;
    this.reason.set(value);
  }

  protected saveDayOff(): void {
    const date = this.date();
    if (!date) {
      return;
    }
    void this.run(async () => {
      await firstValueFrom(this.api.upsertEmployeeDayOff({ dayOffDate: date, reason: this.reason() }));
      this.reasonDirty = false;
      return 'Day off saved.';
    }, 'Could not save the day off.');
  }

  protected removeDayOff(): void {
    const id = this.off()?.id;
    if (id == null) {
      return;
    }
    void this.run(async () => {
      await firstValueFrom(this.api.deleteEmployeeDayOff(id));
      this.reasonDirty = false;
      return 'Day off removed.';
    }, 'Could not remove the day off.');
  }

  protected requestOvertime(): void {
    const id = this.day()?.id;
    if (id == null) {
      return;
    }
    void this.run(async () => {
      const response = await firstValueFrom(this.api.requestEmployeeOvertime(id));
      return response.data?.message || response.message || 'Overtime requested.';
    }, 'Could not request overtime.');
  }

  protected addTodo(): void {
    const title = this.todoTitle().trim();
    const date = this.date();
    if (!title || !date) {
      this.workspace.error.set('Enter a todo.');
      return;
    }
    void this.run(async () => {
      await firstValueFrom(this.api.createEmployeeTodo({ title, dueDate: date }));
      this.todoTitle.set('');
      return 'Todo added.';
    }, 'Could not add the todo.');
  }

  protected toggleTodo(id: number, isDone: boolean): void {
    void this.run(async () => {
      await firstValueFrom(this.api.updateEmployeeTodo(id, { isDone }));
    }, 'Could not update the todo.');
  }

  protected deleteTodo(id: number): void {
    void this.run(async () => {
      await firstValueFrom(this.api.deleteEmployeeTodo(id));
      return 'Todo deleted.';
    }, 'Could not delete the todo.');
  }

  private async run(action: () => Promise<string | void>, fallback: string): Promise<void> {
    this.workspace.busy.set(true);
    this.workspace.error.set(null);
    try {
      const message = await action();
      if (message) {
        this.workspace.notice.set(message);
      }
      await this.workspace.reloadDashboard();
    } catch (error) {
      this.workspace.error.set(portalErrorMessage(error, fallback));
    } finally {
      this.workspace.busy.set(false);
    }
  }
}
