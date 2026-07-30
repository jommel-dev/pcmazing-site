import { NgClass } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  EmployeeActivityItem,
  EmployeeDayOffItem,
  EmployeeTodoItem,
  EmployeeWorkspaceDashboard,
} from '../../services/admin-api.service';

@Component({
  selector: 'app-sales-employee-dashboard',
  imports: [FormsModule, NgClass],
  templateUrl: './sales-employee-dashboard.component.html',
})
export class SalesEmployeeDashboardComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly month = signal(this.currentMonth());
  readonly selectedDate = signal(this.todayIso());
  readonly dashboard = signal<EmployeeWorkspaceDashboard | null>(null);
  readonly dayOffModalOpen = signal(false);

  readonly todoTitle = signal('');
  readonly dayOffReason = signal('');
  readonly saving = signal(false);

  readonly calendarDays = computed(() => this.buildCalendar(this.month(), this.dashboard()));

  readonly selectedDayTodos = computed(() => {
    const date = this.selectedDate();
    return (this.dashboard()?.todos ?? []).filter((todo) => todo.dueDate === date);
  });

  readonly selectedDayOff = computed(() => {
    const date = this.selectedDate();
    return (this.dashboard()?.dayOffs ?? []).find((item) => item.dayOffDate === date) ?? null;
  });

  readonly selectedAttendance = computed(() => {
    const date = this.selectedDate();
    return (this.dashboard()?.attendanceDays ?? []).find((item) => item.workDate === date) ?? null;
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(
        this.adminApi.getEmployeeWorkspaceDashboard(this.month()),
      );
      this.dashboard.set(response.data);
      if (!this.selectedDate()) {
        this.selectedDate.set(response.data.workDate);
      }
    } catch {
      this.error.set('Unable to load your employee dashboard.');
    } finally {
      this.loading.set(false);
    }
  }

  closeDayOffModal(): void {
    this.dayOffModalOpen.set(false);
  }

  async changeMonth(delta: number): Promise<void> {
    const [year, mon] = this.month().split('-').map(Number);
    const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
    this.month.set(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
    await this.load();
  }

  selectDate(isoDate: string): void {
    this.selectedDate.set(isoDate);
    this.dayOffReason.set('');
    this.dayOffModalOpen.set(true);
  }

  formatPunch(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    return new Date(value).toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    });
  }

  formatHours(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }
    return `${value.toFixed(2)} h`;
  }

  formatMoney(value: number | null | undefined): string {
    if (value == null) {
      return '₱0';
    }
    return `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
  }

  formatActivityTime(value: string): string {
    return new Date(value).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    });
  }

  async saveDayOff(): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.adminApi.upsertEmployeeDayOff({
          dayOffDate: this.selectedDate(),
          reason: this.dayOffReason().trim() || undefined,
        }),
      );
      this.dayOffReason.set('');
      await this.load();
      this.closeDayOffModal();
    } catch {
      this.error.set('Unable to save day off.');
    } finally {
      this.saving.set(false);
    }
  }

  async removeDayOff(item: EmployeeDayOffItem): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(this.adminApi.deleteEmployeeDayOff(item.id));
      await this.load();
      this.closeDayOffModal();
    } catch {
      this.error.set('Unable to remove day off.');
    } finally {
      this.saving.set(false);
    }
  }

  async addTodo(): Promise<void> {
    const title = this.todoTitle().trim();
    if (!title) {
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.adminApi.createEmployeeTodo({
          title,
          dueDate: this.selectedDate(),
        }),
      );
      this.todoTitle.set('');
      await this.load();
    } catch {
      this.error.set('Unable to add todo.');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleTodo(todo: EmployeeTodoItem): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.adminApi.updateEmployeeTodo(todo.id, { isDone: !todo.isDone }),
      );
      await this.load();
    } catch {
      this.error.set('Unable to update todo.');
    } finally {
      this.saving.set(false);
    }
  }

  async removeTodo(todo: EmployeeTodoItem): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(this.adminApi.deleteEmployeeTodo(todo.id));
      await this.load();
    } catch {
      this.error.set('Unable to delete todo.');
    } finally {
      this.saving.set(false);
    }
  }

  activityLabel(item: EmployeeActivityItem): string {
    switch (item.actionType) {
      case 'time_in':
        return 'Time in';
      case 'time_out':
        return 'Time out';
      case 'day_off_plotted':
        return 'Day off';
      case 'day_off_removed':
        return 'Day off removed';
      case 'todo_created':
        return 'To-do added';
      case 'todo_completed':
        return 'To-do done';
      case 'todo_reopened':
        return 'To-do reopened';
      case 'todo_deleted':
        return 'To-do deleted';
      case 'job_order_created':
        return 'Job order created';
      case 'job_order_completed':
        return 'Job order completed';
      case 'print':
        return 'Print';
      case 'cleaning':
        return 'Cleaning';
      case 'note':
        return 'Note';
      default:
        return item.actionType.replace(/_/g, ' ');
    }
  }

  private currentMonth(): string {
    return this.todayIso().slice(0, 7);
  }

  private todayIso(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  }

  private buildCalendar(
    month: string,
    data: EmployeeWorkspaceDashboard | null,
  ): Array<{
    isoDate: string;
    day: number;
    inMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    hasAttendance: boolean;
    hasDayOff: boolean;
    hasTodo: boolean;
  }> {
    const [year, mon] = month.split('-').map(Number);
    const first = new Date(Date.UTC(year, mon - 1, 1));
    const startWeekday = (first.getUTCDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const today = data?.workDate ?? this.todayIso();
    const selected = this.selectedDate();
    const attendanceSet = new Set((data?.attendanceDays ?? []).map((item) => item.workDate));
    const dayOffSet = new Set((data?.dayOffs ?? []).map((item) => item.dayOffDate));
    const todoSet = new Set((data?.todos ?? []).map((item) => item.dueDate));

    const cells: Array<{
      isoDate: string;
      day: number;
      inMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      hasAttendance: boolean;
      hasDayOff: boolean;
      hasTodo: boolean;
    }> = [];

    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startWeekday + 1;
      const date = new Date(Date.UTC(year, mon - 1, dayNum));
      const isoDate = date.toISOString().slice(0, 10);
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
      cells.push({
        isoDate,
        day: date.getUTCDate(),
        inMonth,
        isToday: isoDate === today,
        isSelected: isoDate === selected,
        hasAttendance: attendanceSet.has(isoDate),
        hasDayOff: dayOffSet.has(isoDate),
        hasTodo: todoSet.has(isoDate),
      });
    }

    return cells;
  }
}
