import { CurrencyPipe, DatePipe, NgClass } from '@angular/common';
import { Component, computed, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  CompanyExpense,
  CompanyExpenseAttachment,
  CompanyExpenseCalendar,
  CompanyExpenseCategorySuggestion,
  CompanyExpensePaymentMethod,
  CompanyExpenseStatus,
} from '../../services/admin-api.service';
import {
  addPendingExpenseAttachments,
  dataTransferHasOsFiles,
  extractFilesFromDataTransfer,
  extractImageFilesFromClipboard,
  PendingExpenseAttachment,
  removePendingExpenseAttachment,
  revokePendingExpenseAttachments,
} from './company-expense-attachments.util';

export const EXPENSE_CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'salary', label: 'Salary' },
  { value: 'rent', label: 'Rent' },
  { value: 'electric_bill', label: 'Electric Bill' },
  { value: 'water_bill', label: 'Water Bill' },
  { value: 'internet_bill', label: 'Internet Bill' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'maintenance', label: 'Maintenance' },
];

export const EXPENSE_PAYMENT_OPTIONS: Array<{ value: CompanyExpensePaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

@Component({
  selector: 'app-company-expenses-page',
  imports: [CurrencyPipe, DatePipe, FormsModule, NgClass],
  templateUrl: './company-expenses-page.component.html',
})
export class CompanyExpensesPageComponent implements OnInit, OnDestroy {
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly month = signal(this.currentMonth());
  readonly selectedDate = signal(this.todayIso());
  readonly calendar = signal<CompanyExpenseCalendar | null>(null);
  readonly formOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly deletingId = signal<number | null>(null);

  readonly title = signal('');
  readonly amount = signal<number | null>(null);
  readonly expenseDate = signal(this.todayIso());
  readonly categoryInput = signal('Salary');
  readonly categoryMenuOpen = signal(false);
  readonly categorySuggestions = signal<CompanyExpenseCategorySuggestion[]>(
    EXPENSE_CATEGORY_OPTIONS.map((option) => ({
      key: option.value,
      label: option.label,
      source: 'preset' as const,
    })),
  );
  readonly vendor = signal('');
  readonly paymentMethod = signal<CompanyExpensePaymentMethod>('cash');
  readonly status = signal<CompanyExpenseStatus>('paid');
  readonly notes = signal('');

  readonly existingAttachments = signal<CompanyExpenseAttachment[]>([]);
  readonly pendingAttachments = signal<PendingExpenseAttachment[]>([]);
  readonly attachmentError = signal('');
  readonly attachmentDropActive = signal(false);
  readonly deletingAttachmentId = signal<number | null>(null);

  readonly galleryOpen = signal(false);
  readonly galleryTitle = signal('');
  readonly galleryImages = signal<CompanyExpenseAttachment[]>([]);
  readonly galleryIndex = signal(0);

  readonly paymentOptions = EXPENSE_PAYMENT_OPTIONS;

  readonly monthLabel = computed(() => {
    const [year, mon] = this.month().split('-').map(Number);
    return new Date(year, mon - 1, 1).toLocaleDateString('en-PH', {
      month: 'long',
      year: 'numeric',
    });
  });

  readonly calendarDays = computed(() => this.buildCalendar(this.month(), this.calendar()));

  readonly selectedDayExpenses = computed(() => {
    const date = this.selectedDate();
    return (this.calendar()?.items ?? []).filter((item) => item.expenseDate === date);
  });

  readonly selectedDayTotal = computed(() =>
    this.selectedDayExpenses().reduce((sum, item) => sum + item.amount, 0),
  );

  readonly isEditing = computed(() => this.editingId() !== null);

  readonly galleryCurrent = computed(() => {
    const images = this.galleryImages();
    const index = this.galleryIndex();
    return images[index] ?? null;
  });

  readonly galleryHasPrev = computed(() => this.galleryIndex() > 0);
  readonly galleryHasNext = computed(
    () => this.galleryIndex() < this.galleryImages().length - 1,
  );

  readonly filteredCategorySuggestions = computed(() => {
    const query = this.categoryInput().trim().toLowerCase();
    const suggestions = this.categorySuggestions();
    if (!query) {
      return suggestions.slice(0, 12);
    }
    return suggestions
      .filter(
        (item) =>
          item.label.toLowerCase().includes(query) || item.key.toLowerCase().includes(query),
      )
      .slice(0, 12);
  });

  readonly showCreateCategoryOption = computed(() => {
    const query = this.categoryInput().trim();
    if (!query) {
      return false;
    }
    const lowered = query.toLowerCase();
    return !this.categorySuggestions().some(
      (item) => item.label.toLowerCase() === lowered || item.key.toLowerCase() === lowered,
    );
  });

  ngOnInit(): void {
    void this.load();
    void this.loadCategorySuggestions();
  }

  ngOnDestroy(): void {
    this.clearPendingAttachments();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const { from, to } = this.monthBounds(this.month());
    try {
      const response = await firstValueFrom(
        this.adminApi.listCompanyExpenses({ from, to }),
      );
      this.calendar.set(response.data);
    } catch {
      this.calendar.set(null);
      this.error.set('Unable to load company expenses.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadCategorySuggestions(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.adminApi.listCompanyExpenseCategorySuggestions(),
      );
      if (response.data?.length) {
        this.categorySuggestions.set(response.data);
      }
    } catch {
      // Keep preset fallbacks.
    }
  }

  changeMonth(delta: number): void {
    const [year, mon] = this.month().split('-').map(Number);
    const next = new Date(year, mon - 1 + delta, 1);
    this.month.set(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
    const selected = this.selectedDate();
    if (!selected.startsWith(this.month())) {
      this.selectedDate.set(`${this.month()}-01`);
    }
    void this.load();
  }

  goToToday(): void {
    const today = this.todayIso();
    this.month.set(today.slice(0, 7));
    this.selectedDate.set(today);
    void this.load();
  }

  selectDate(isoDate: string): void {
    this.selectedDate.set(isoDate);
  }

  openCreate(date = this.selectedDate()): void {
    this.editingId.set(null);
    this.formError.set('');
    this.title.set('');
    this.amount.set(null);
    this.expenseDate.set(date);
    this.categoryInput.set('Salary');
    this.categoryMenuOpen.set(false);
    this.vendor.set('');
    this.paymentMethod.set('cash');
    this.status.set('paid');
    this.notes.set('');
    this.existingAttachments.set([]);
    this.clearPendingAttachments();
    this.attachmentError.set('');
    this.formOpen.set(true);
  }

  async openEdit(item: CompanyExpense): Promise<void> {
    this.editingId.set(item.id);
    this.formError.set('');
    this.title.set(item.title);
    this.amount.set(item.amount);
    this.expenseDate.set(item.expenseDate);
    this.categoryInput.set(item.categoryLabel || item.category);
    this.categoryMenuOpen.set(false);
    this.vendor.set(item.vendor ?? '');
    this.paymentMethod.set(item.paymentMethod);
    this.status.set(item.status);
    this.notes.set(item.notes ?? '');
    this.clearPendingAttachments();
    this.attachmentError.set('');
    this.existingAttachments.set(item.attachments ?? []);
    this.formOpen.set(true);

    try {
      const response = await firstValueFrom(this.adminApi.getCompanyExpense(item.id));
      this.existingAttachments.set(response.data.attachments ?? []);
    } catch {
      // Keep calendar row data if detail fetch fails.
    }
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
    this.formError.set('');
    this.categoryMenuOpen.set(false);
    this.clearPendingAttachments();
    this.existingAttachments.set([]);
    this.attachmentError.set('');
  }

  onCategoryInput(value: string): void {
    this.categoryInput.set(value);
    this.categoryMenuOpen.set(true);
  }

  openCategoryMenu(): void {
    this.categoryMenuOpen.set(true);
  }

  closeCategoryMenuSoon(): void {
    window.setTimeout(() => this.categoryMenuOpen.set(false), 150);
  }

  pickCategory(suggestion: CompanyExpenseCategorySuggestion): void {
    this.categoryInput.set(suggestion.label);
    this.categoryMenuOpen.set(false);
  }

  useTypedCategory(): void {
    this.categoryMenuOpen.set(false);
  }

  attachmentUrl(fileUrl: string): string | null {
    return this.adminApi.resolveCompanyExpenseUploadUrl(fileUrl);
  }

  isImageAttachment(attachment: CompanyExpenseAttachment): boolean {
    return attachment.kind === 'receipt' || attachment.mimeType.startsWith('image/');
  }

  imageAttachments(item: CompanyExpense): CompanyExpenseAttachment[] {
    return (item.attachments ?? []).filter((attachment) => this.isImageAttachment(attachment));
  }

  stackedPreviewImages(item: CompanyExpense): CompanyExpenseAttachment[] {
    return this.imageAttachments(item).slice(0, 3);
  }

  openGallery(item: CompanyExpense, startIndex = 0): void {
    const images = this.imageAttachments(item);
    if (!images.length) {
      return;
    }
    this.galleryTitle.set(item.title);
    this.galleryImages.set(images);
    this.galleryIndex.set(Math.min(Math.max(startIndex, 0), images.length - 1));
    this.galleryOpen.set(true);
  }

  closeGallery(): void {
    this.galleryOpen.set(false);
    this.galleryImages.set([]);
    this.galleryIndex.set(0);
    this.galleryTitle.set('');
  }

  galleryPrev(): void {
    if (!this.galleryHasPrev()) {
      return;
    }
    this.galleryIndex.update((index) => index - 1);
  }

  galleryNext(): void {
    if (!this.galleryHasNext()) {
      return;
    }
    this.galleryIndex.update((index) => index + 1);
  }

  onGalleryKeydown(event: KeyboardEvent): void {
    if (!this.galleryOpen()) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeGallery();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.galleryPrev();
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.galleryNext();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    this.onGalleryKeydown(event);
  }

  onAttachmentsSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    this.queueAttachments(files);
  }

  onFormPaste(event: ClipboardEvent): void {
    const files = extractImageFilesFromClipboard(event);
    if (!files.length) {
      return;
    }
    event.preventDefault();
    this.queueAttachments(files);
  }

  onAttachmentDropZoneDragOver(event: DragEvent): void {
    if (this.saving()) {
      return;
    }
    if (!dataTransferHasOsFiles(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.attachmentDropActive.set(true);
  }

  onAttachmentDropZoneDragLeave(event: DragEvent): void {
    const current = event.currentTarget as HTMLElement | null;
    const related = event.relatedTarget as Node | null;
    if (current && related && current.contains(related)) {
      return;
    }
    this.attachmentDropActive.set(false);
  }

  onAttachmentDropZoneDrop(event: DragEvent): void {
    if (this.saving()) {
      return;
    }
    if (!dataTransferHasOsFiles(event.dataTransfer)) {
      this.attachmentDropActive.set(false);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.attachmentDropActive.set(false);
    const files = extractFilesFromDataTransfer(event.dataTransfer);
    if (!files.length) {
      this.attachmentError.set('Drop JPEG, PNG, WebP, GIF, or PDF files only.');
      return;
    }
    this.queueAttachments(files);
  }

  removePendingAttachment(id: string): void {
    this.pendingAttachments.update((items) => removePendingExpenseAttachment(items, id));
  }

  async removeExistingAttachment(attachment: CompanyExpenseAttachment): Promise<void> {
    const expenseId = this.editingId();
    if (expenseId == null) {
      return;
    }
    if (!confirm(`Remove “${attachment.fileName}”?`)) {
      return;
    }
    this.deletingAttachmentId.set(attachment.id);
    this.attachmentError.set('');
    try {
      await firstValueFrom(
        this.adminApi.deleteCompanyExpenseAttachment(expenseId, attachment.id),
      );
      this.existingAttachments.update((items) =>
        items.filter((item) => item.id !== attachment.id),
      );
    } catch {
      this.attachmentError.set('Unable to remove this attachment.');
    } finally {
      this.deletingAttachmentId.set(null);
    }
  }

  async save(): Promise<void> {
    const title = this.title().trim();
    const amount = Number(this.amount());
    const expenseDate = this.expenseDate();
    const category = this.categoryInput().trim();
    if (!title) {
      this.formError.set('Enter an expense title.');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      this.formError.set('Enter a valid amount.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      this.formError.set('Choose an expense date.');
      return;
    }
    if (!category) {
      this.formError.set('Enter or choose a category.');
      return;
    }

    this.saving.set(true);
    this.formError.set('');
    const payload = {
      title,
      amount,
      expenseDate,
      category,
      vendor: this.vendor().trim(),
      paymentMethod: this.paymentMethod(),
      status: this.status(),
      notes: this.notes().trim(),
    };

    try {
      const editingId = this.editingId();
      const pending = [...this.pendingAttachments()];
      let expenseId = editingId;

      if (editingId != null) {
        await firstValueFrom(this.adminApi.updateCompanyExpense(editingId, payload));
      } else {
        const created = await firstValueFrom(this.adminApi.createCompanyExpense(payload));
        expenseId = created.data.id;
      }

      let failedUploads = 0;
      if (expenseId != null && pending.length) {
        for (const item of pending) {
          try {
            await firstValueFrom(
              this.adminApi.uploadCompanyExpenseAttachment(expenseId, item.file),
            );
          } catch {
            failedUploads += 1;
          }
        }
      }

      this.selectedDate.set(expenseDate);
      this.month.set(expenseDate.slice(0, 7));
      this.closeForm();
      await Promise.all([this.load(), this.loadCategorySuggestions()]);

      if (failedUploads > 0) {
        this.error.set(
          `Expense saved, but ${failedUploads} of ${pending.length} attachment(s) failed to upload.`,
        );
      }
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'error' in error
          ? (error as { error?: { message?: string } }).error?.message
          : null;
      this.formError.set(message || 'Unable to save this expense.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(item: CompanyExpense): Promise<void> {
    if (!confirm(`Remove “${item.title}”? This cannot be undone.`)) {
      return;
    }
    this.deletingId.set(item.id);
    this.error.set('');
    try {
      await firstValueFrom(this.adminApi.deleteCompanyExpense(item.id));
      await this.load();
    } catch {
      this.error.set('Unable to remove this expense.');
    } finally {
      this.deletingId.set(null);
    }
  }

  formatCompact(value: number): string {
    if (value >= 1000) {
      return `₱${Math.round(value).toLocaleString('en-PH')}`;
    }
    return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  private queueAttachments(files: File[]): void {
    const result = addPendingExpenseAttachments(this.pendingAttachments(), files);
    this.pendingAttachments.set(result.items);
    this.attachmentError.set(result.errors[0] ?? '');
  }

  private clearPendingAttachments(): void {
    revokePendingExpenseAttachments(this.pendingAttachments());
    this.pendingAttachments.set([]);
    this.attachmentDropActive.set(false);
  }

  private currentMonth(): string {
    return this.todayIso().slice(0, 7);
  }

  private todayIso(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  }

  private monthBounds(month: string): { from: string; to: string } {
    const [year, mon] = month.split('-').map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    return {
      from: `${month}-01`,
      to: `${month}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  private buildCalendar(
    month: string,
    data: CompanyExpenseCalendar | null,
  ): Array<{
    isoDate: string;
    day: number;
    inMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    total: number;
    count: number;
    colors: string[];
  }> {
    const [year, mon] = month.split('-').map(Number);
    const first = new Date(Date.UTC(year, mon - 1, 1));
    const startWeekday = (first.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const today = this.todayIso();
    const selected = this.selectedDate();
    const byDate = new Map<string, CompanyExpense[]>();
    for (const item of data?.items ?? []) {
      const list = byDate.get(item.expenseDate) ?? [];
      list.push(item);
      byDate.set(item.expenseDate, list);
    }

    const colorByCategory = new Map(
      (data?.categories ?? []).map((item) => [item.key, item.color] as const),
    );

    const cells: Array<{
      isoDate: string;
      day: number;
      inMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      total: number;
      count: number;
      colors: string[];
    }> = [];

    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startWeekday + 1;
      const date = new Date(Date.UTC(year, mon - 1, dayNum));
      const isoDate = date.toISOString().slice(0, 10);
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
      const dayItems = inMonth ? (byDate.get(isoDate) ?? []) : [];
      const colors = [...new Set(dayItems.map((item) => colorByCategory.get(item.category) ?? '#94a3b8'))].slice(
        0,
        3,
      );
      cells.push({
        isoDate,
        day: date.getUTCDate(),
        inMonth,
        isToday: isoDate === today,
        isSelected: isoDate === selected,
        total: dayItems.reduce((sum, item) => sum + item.amount, 0),
        count: dayItems.length,
        colors,
      });
    }

    return cells;
  }
}
