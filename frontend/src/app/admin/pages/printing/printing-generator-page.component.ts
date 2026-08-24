import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminApiService } from '../../services/admin-api.service';
import { fieldsForDocument } from './printing-fields.data';
import { PrintingTemplateCanvasComponent } from './printing-template-canvas.component';
import {
  PAPER_SIZE_PRESETS,
  PrintDocumentType,
  PrintLayoutElement,
  PrinterConnectionType,
  PrinterTestStatus,
  PrintingSettings,
  PrintingTemplate,
  createElementId,
  jobOrderSalesReceiptLayout,
  roundMm,
  sanitizeLayoutElement,
  sanitizeLayoutElements,
} from './printing.types';
import {
  DEFAULT_FOOTER_NOTE,
  DEFAULT_THANKS_MESSAGE,
  DEFAULT_WARRANTY_POLICY,
} from './printing-receipt-content.defaults';
import {
  applyLiveReceiptContentLayout,
  layoutBottomMm,
} from './printing-receipt-content.util';

type TabKey = 'settings' | 'content' | 'templates';

type BluetoothNavigator = Navigator & {
  bluetooth?: {
    requestDevice: (options: {
      acceptAllDevices?: boolean;
      optionalServices?: string[];
      filters?: Array<{ namePrefix?: string; services?: string[] }>;
    }) => Promise<{ id: string; name?: string }>;
  };
};

@Component({
  selector: 'app-printing-generator-page',
  imports: [ReactiveFormsModule, PrintingTemplateCanvasComponent],
  templateUrl: './printing-generator-page.component.html',
  styleUrl: './printing-generator-page.component.css',
})
export class PrintingGeneratorPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly activeTab = signal<TabKey>('settings');
  readonly loading = signal(true);
  readonly savingSettings = signal(false);
  readonly savingContent = signal(false);
  readonly testingPrinter = signal(false);
  readonly pairingBluetooth = signal(false);
  readonly savingTemplate = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly templates = signal<PrintingTemplate[]>([]);
  readonly selectedTemplateId = signal<number | null>(null);
  readonly selectedElementId = signal<string | null>(null);
  readonly draftElements = signal<PrintLayoutElement[]>([]);
  readonly printerLastTestStatus = signal<PrinterTestStatus>('never');
  readonly printerLastTestMessage = signal('');
  readonly printerLastTestedAt = signal<string | null>(null);

  readonly settingsForm = this.formBuilder.nonNullable.group({
    storeName: ['', [Validators.required, Validators.maxLength(180)]],
    storeAddress: ['', [Validators.maxLength(500)]],
    storePhone: ['', [Validators.maxLength(60)]],
    storeCode: ['1', [Validators.maxLength(30)]],
    workstationNo: ['1', [Validators.maxLength(30)]],
    paperSize: ['A4' as PrintingSettings['paperSize'], [Validators.required]],
    marginTopMm: [0, [Validators.min(0), Validators.max(100)]],
    marginRightMm: [0, [Validators.min(0), Validators.max(100)]],
    marginBottomMm: [0, [Validators.min(0), Validators.max(100)]],
    marginLeftMm: [0, [Validators.min(0), Validators.max(100)]],
    defaultTemplateId: [''],
    fontFamily: ['Times New Roman', [Validators.maxLength(120)]],
    showPageNumbers: [true],
    printerConnectionType: ['direct' as PrinterConnectionType, [Validators.required]],
    printerName: ['', [Validators.maxLength(180)]],
    printerHost: ['', [Validators.maxLength(255)]],
    printerPort: [9100, [Validators.min(1), Validators.max(65535)]],
    printerBluetoothDeviceId: [''],
    printerBluetoothDeviceName: [''],
    printerAutoPrint: [false],
  });

  readonly contentForm = this.formBuilder.nonNullable.group({
    warrantyPolicy: [DEFAULT_WARRANTY_POLICY, [Validators.maxLength(8000)]],
    footerNote: [DEFAULT_FOOTER_NOTE, [Validators.maxLength(500)]],
    thanksMessage: [DEFAULT_THANKS_MESSAGE, [Validators.maxLength(500)]],
  });

  readonly templateForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(180)]],
    documentType: ['sales_receipt' as PrintDocumentType, [Validators.required]],
    paperWidthMm: [210, [Validators.required, Validators.min(40), Validators.max(500)]],
    paperHeightMm: [297, [Validators.required, Validators.min(40), Validators.max(2000)]],
    isDefault: [false],
    isActive: [true],
  });

  readonly selectedTemplate = computed(() =>
    this.templates().find((template) => template.id === this.selectedTemplateId()) ?? null,
  );

  readonly availableFields = computed(() =>
    fieldsForDocument(this.templateForm.controls.documentType.value as PrintDocumentType),
  );

  readonly selectedElement = computed(() =>
    this.draftElements().find((element) => element.id === this.selectedElementId()) ?? null,
  );

  readonly fieldPreview = signal({
    warrantyPolicy: DEFAULT_WARRANTY_POLICY,
    footerNote: DEFAULT_FOOTER_NOTE,
    thanksMessage: DEFAULT_THANKS_MESSAGE,
  });

  constructor() {
    this.contentForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.syncContentPreview();
    });
  }

  readonly paperPresetOptions = Object.entries(PAPER_SIZE_PRESETS).map(([key, value]) => ({
    key: key as PrintingSettings['paperSize'],
    label: value.label,
  }));

  readonly bluetoothSupported =
    typeof navigator !== 'undefined' && !!(navigator as BluetoothNavigator).bluetooth;

  ngOnInit(): void {
    void this.initialize();
  }

  async initialize(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const [settingsResponse, templatesResponse] = await Promise.all([
        firstValueFrom(this.adminApi.getPrintingSettings()),
        firstValueFrom(this.adminApi.listPrintingTemplates()),
      ]);

      const settings = settingsResponse.data;
      this.settingsForm.patchValue({
        storeName: settings.storeName,
        storeAddress: settings.storeAddress,
        storePhone: settings.storePhone,
        storeCode: settings.storeCode,
        workstationNo: settings.workstationNo,
        paperSize: settings.paperSize,
        marginTopMm: settings.marginTopMm,
        marginRightMm: settings.marginRightMm,
        marginBottomMm: settings.marginBottomMm,
        marginLeftMm: settings.marginLeftMm,
        defaultTemplateId: settings.defaultTemplateId ? String(settings.defaultTemplateId) : '',
        fontFamily: settings.fontFamily,
        showPageNumbers: settings.showPageNumbers,
        printerConnectionType: settings.printerConnectionType || 'direct',
        printerName: settings.printerName || '',
        printerHost: settings.printerHost || '',
        printerPort: settings.printerPort || 9100,
        printerBluetoothDeviceId: settings.printerBluetoothDeviceId || '',
        printerBluetoothDeviceName: settings.printerBluetoothDeviceName || '',
        printerAutoPrint: settings.printerAutoPrint ?? false,
      });
      this.contentForm.patchValue({
        warrantyPolicy: settings.warrantyPolicy || DEFAULT_WARRANTY_POLICY,
        footerNote: settings.footerNote || DEFAULT_FOOTER_NOTE,
        thanksMessage: settings.thanksMessage || DEFAULT_THANKS_MESSAGE,
      });
      this.syncContentPreview();
      this.applyPrinterTestState(settings);

      this.templates.set(templatesResponse.data);
      if (templatesResponse.data.length) {
        const preferred =
          templatesResponse.data.find((template) => template.isDefault) ??
          templatesResponse.data[0];
        this.selectTemplate(preferred.id);
      } else {
        this.startNewTemplate();
      }
    } catch (err: unknown) {
      this.error.set(
        this.readError(
          err,
          'Unable to load printing settings. Apply migrations 042_printing.sql and 043_printing_printer_connection.sql.',
        ),
      );
    } finally {
      this.loading.set(false);
    }
  }

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
    this.clearMessages();
  }

  applyPaperPresetFromSettings(): void {
    const preset = PAPER_SIZE_PRESETS[this.settingsForm.controls.paperSize.value];
    if (!preset) {
      return;
    }
    this.templateForm.patchValue({
      paperWidthMm: preset.widthMm,
      paperHeightMm: preset.heightMm,
    });
  }

  async saveSettings(): Promise<void> {
    this.clearMessages();
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      this.error.set('Please complete the required printing settings fields.');
      return;
    }

    this.savingSettings.set(true);
    const value = this.settingsForm.getRawValue();

    try {
      const response = await firstValueFrom(
        this.adminApi.updatePrintingSettings({
          storeName: value.storeName.trim(),
          storeAddress: value.storeAddress.trim(),
          storePhone: value.storePhone.trim(),
          storeCode: value.storeCode.trim(),
          workstationNo: value.workstationNo.trim(),
          paperSize: value.paperSize,
          marginTopMm: Number(value.marginTopMm) || 0,
          marginRightMm: Number(value.marginRightMm) || 0,
          marginBottomMm: Number(value.marginBottomMm) || 0,
          marginLeftMm: Number(value.marginLeftMm) || 0,
          defaultTemplateId: value.defaultTemplateId ? Number(value.defaultTemplateId) : null,
          fontFamily: value.fontFamily.trim(),
          showPageNumbers: value.showPageNumbers,
          printerConnectionType: value.printerConnectionType,
          printerName: value.printerName.trim(),
          printerHost: value.printerHost.trim(),
          printerPort: Number(value.printerPort) || 9100,
          printerBluetoothDeviceId: value.printerBluetoothDeviceId.trim(),
          printerBluetoothDeviceName: value.printerBluetoothDeviceName.trim(),
          printerAutoPrint: value.printerAutoPrint,
        }),
      );
      this.settingsForm.patchValue({
        defaultTemplateId: response.data.defaultTemplateId
          ? String(response.data.defaultTemplateId)
          : '',
        printerConnectionType: response.data.printerConnectionType,
        printerName: response.data.printerName,
        printerHost: response.data.printerHost,
        printerPort: response.data.printerPort,
        printerBluetoothDeviceId: response.data.printerBluetoothDeviceId,
        printerBluetoothDeviceName: response.data.printerBluetoothDeviceName,
        printerAutoPrint: response.data.printerAutoPrint,
      });
      this.applyPrinterTestState(response.data);
      this.success.set('Printing settings saved.');
    } catch (err: unknown) {
      this.error.set(this.readError(err, 'Unable to save printing settings.'));
    } finally {
      this.savingSettings.set(false);
    }
  }

  async saveContent(): Promise<void> {
    this.clearMessages();
    if (this.contentForm.invalid) {
      this.contentForm.markAllAsTouched();
      this.error.set('Please check the receipt content fields.');
      return;
    }

    this.savingContent.set(true);
    const value = this.contentForm.getRawValue();

    try {
      await firstValueFrom(
        this.adminApi.updatePrintingSettings({
          warrantyPolicy: value.warrantyPolicy,
          footerNote: value.footerNote.trim(),
          thanksMessage: value.thanksMessage.trim(),
        }),
      );
      const templatesResponse = await firstValueFrom(this.adminApi.listPrintingTemplates());
      this.templates.set(templatesResponse.data);
      const selectedId = this.selectedTemplateId();
      if (selectedId) {
        const refreshed = templatesResponse.data.find((template) => template.id === selectedId);
        if (refreshed) {
          this.setDraftElements(structuredClone(refreshed.layout.elements));
        }
      }
      this.success.set('Receipt content saved and applied to all print templates.');
    } catch (err: unknown) {
      this.error.set(this.readError(err, 'Unable to save receipt content.'));
    } finally {
      this.savingContent.set(false);
    }
  }

  async pairBluetoothPrinter(): Promise<void> {
    this.clearMessages();
    const bluetooth = (navigator as BluetoothNavigator).bluetooth;
    if (!bluetooth) {
      this.error.set(
        'Web Bluetooth is not available in this browser. Use Chrome or Edge over HTTPS/localhost.',
      );
      return;
    }

    this.pairingBluetooth.set(true);
    try {
      const device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // common BLE printer service
          '00001101-0000-1000-8000-00805f9b34fb', // serial port profile UUID used by some stacks
        ],
      });

      this.settingsForm.patchValue({
        printerConnectionType: 'bluetooth',
        printerBluetoothDeviceId: device.id,
        printerBluetoothDeviceName: device.name || 'Bluetooth printer',
        printerName: device.name || this.settingsForm.controls.printerName.value,
      });
      this.success.set(
        `Paired with "${device.name || device.id}". Save settings to keep this printer.`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bluetooth pairing cancelled.';
      if (!/cancel|abort/i.test(message)) {
        this.error.set(message);
      }
    } finally {
      this.pairingBluetooth.set(false);
    }
  }

  clearBluetoothPrinter(): void {
    this.settingsForm.patchValue({
      printerBluetoothDeviceId: '',
      printerBluetoothDeviceName: '',
    });
  }

  async testPrinterConnection(): Promise<void> {
    this.clearMessages();
    this.testingPrinter.set(true);

    const value = this.settingsForm.getRawValue();
    try {
      const response = await firstValueFrom(
        this.adminApi.testPrintingConnection({
          printerConnectionType: value.printerConnectionType,
          printerName: value.printerName.trim(),
          printerHost: value.printerHost.trim(),
          printerPort: Number(value.printerPort) || 9100,
          printerBluetoothDeviceId: value.printerBluetoothDeviceId.trim(),
          printerBluetoothDeviceName: value.printerBluetoothDeviceName.trim(),
        }),
      );

      this.applyPrinterTestState(response.data.settings);
      if (response.data.ok) {
        this.success.set(response.data.message);
      } else {
        this.error.set(response.data.message);
      }
    } catch (err: unknown) {
      this.error.set(this.readError(err, 'Unable to test printer connection.'));
    } finally {
      this.testingPrinter.set(false);
    }
  }

  private applyPrinterTestState(
    settings: Pick<
      PrintingSettings,
      'printerLastTestStatus' | 'printerLastTestMessage' | 'printerLastTestedAt'
    >,
  ): void {
    this.printerLastTestStatus.set(settings.printerLastTestStatus || 'never');
    this.printerLastTestMessage.set(settings.printerLastTestMessage || '');
    this.printerLastTestedAt.set(settings.printerLastTestedAt ?? null);
  }

  selectTemplate(id: number): void {
    const template = this.templates().find((entry) => entry.id === id);
    if (!template) {
      return;
    }

    this.selectedTemplateId.set(id);
    this.selectedElementId.set(null);
    this.templateForm.patchValue({
      name: template.name,
      documentType: template.documentType,
      paperWidthMm: template.paperWidthMm,
      paperHeightMm: template.paperHeightMm,
      isDefault: template.isDefault,
      isActive: template.isActive,
    });
    this.setDraftElements(structuredClone(template.layout.elements));
    this.clearMessages();
  }

  startNewTemplate(): void {
    this.selectedTemplateId.set(null);
    this.selectedElementId.set(null);
    this.templateForm.reset({
      name: 'Job Order Sales Receipt',
      documentType: 'sales_receipt',
      paperWidthMm: PAPER_SIZE_PRESETS.A4.widthMm,
      paperHeightMm: PAPER_SIZE_PRESETS.A4.heightMm,
      isDefault: true,
      isActive: true,
    });
    this.setDraftElements(jobOrderSalesReceiptLayout().elements);
    this.clearMessages();
  }

  loadJobOrderReceiptFormat(): void {
    this.templateForm.patchValue({
      documentType: 'sales_receipt',
      paperWidthMm: PAPER_SIZE_PRESETS.A4.widthMm,
      paperHeightMm: PAPER_SIZE_PRESETS.A4.heightMm,
    });
    if (!this.templateForm.controls.name.value.trim()) {
      this.templateForm.controls.name.setValue('Job Order Sales Receipt');
    }
    this.setDraftElements(jobOrderSalesReceiptLayout().elements);
    this.selectedElementId.set(null);
    this.success.set('Loaded the current Job Order sales receipt layout.');
  }

  onDocumentTypeChange(): void {
    this.templateForm.patchValue({
      paperWidthMm: PAPER_SIZE_PRESETS.A4.widthMm,
      paperHeightMm: PAPER_SIZE_PRESETS.A4.heightMm,
    });
  }

  onCanvasElementsChange(elements: PrintLayoutElement[]): void {
    this.draftElements.set(sanitizeLayoutElements(elements));
  }

  private syncContentPreview(): void {
    const value = this.contentForm.getRawValue();
    const preview = {
      warrantyPolicy: value.warrantyPolicy,
      footerNote: value.footerNote,
      thanksMessage: value.thanksMessage,
    };
    this.fieldPreview.set(preview);
    const current = this.draftElements();
    if (current.length) {
      this.growPaperIfNeeded(applyLiveReceiptContentLayout(current, preview));
    }
  }

  private setDraftElements(elements: PrintLayoutElement[]): void {
    const fitted = applyLiveReceiptContentLayout(elements, this.fieldPreview());
    this.draftElements.set(sanitizeLayoutElements(fitted));
    this.growPaperIfNeeded(fitted);
  }

  private growPaperIfNeeded(elements: PrintLayoutElement[]): void {
    const needed = Math.ceil(layoutBottomMm(elements) + 10);
    const current = Number(this.templateForm.controls.paperHeightMm.value) || 297;
    if (needed > current) {
      this.templateForm.controls.paperHeightMm.setValue(needed);
    }
  }

  addElement(type: PrintLayoutElement['type'], fieldKey?: string): void {
    const field = fieldKey
      ? this.availableFields().find((entry) => entry.key === fieldKey)
      : undefined;

    const element: PrintLayoutElement = {
      id: createElementId(),
      type,
      x: 10,
      y: 10,
      width: type === 'line' ? 50 : type === 'table' ? 60 : 30,
      height: type === 'line' ? 2 : type === 'table' ? 40 : 8,
      label: field?.label ?? (type === 'text' ? 'Static text' : 'Element'),
      fieldKey: field?.key,
      content: type === 'text' ? 'Static text' : undefined,
      fontSize: 11,
      fontWeight: 'normal',
      textAlign: 'left',
    };

    this.draftElements.update((elements) => [...elements, sanitizeLayoutElement(element)]);
    this.selectedElementId.set(element.id);
  }

  updateSelectedElement(patch: Partial<PrintLayoutElement>): void {
    const selectedId = this.selectedElementId();
    if (!selectedId) {
      return;
    }

    const sanitizedPatch = { ...patch };
    if ('x' in patch) {
      sanitizedPatch.x = roundMm(patch.x);
    }
    if ('y' in patch) {
      sanitizedPatch.y = roundMm(patch.y);
    }
    if ('width' in patch) {
      sanitizedPatch.width = roundMm(patch.width);
    }
    if ('height' in patch) {
      sanitizedPatch.height = roundMm(patch.height);
    }
    if ('fontSize' in patch) {
      sanitizedPatch.fontSize = roundMm(patch.fontSize, 1);
    }

    this.draftElements.update((elements) =>
      elements.map((element) =>
        element.id === selectedId ? { ...element, ...sanitizedPatch } : element,
      ),
    );
  }

  removeSelectedElement(): void {
    const selectedId = this.selectedElementId();
    if (!selectedId) {
      return;
    }

    this.draftElements.update((elements) =>
      elements.filter((element) => element.id !== selectedId),
    );
    this.selectedElementId.set(null);
  }

  async saveTemplate(): Promise<void> {
    this.clearMessages();
    if (this.templateForm.invalid) {
      this.templateForm.markAllAsTouched();
      this.error.set('Template name and paper size are required.');
      return;
    }

    this.savingTemplate.set(true);
    const value = this.templateForm.getRawValue();
    const payload = {
      name: value.name.trim(),
      documentType: value.documentType,
      paperWidthMm: Number(value.paperWidthMm),
      paperHeightMm: Number(value.paperHeightMm),
      layout: {
        elements: sanitizeLayoutElements(
          applyLiveReceiptContentLayout(this.draftElements(), this.fieldPreview()),
        ),
      },
      isDefault: value.isDefault,
      isActive: value.isActive,
    };

    try {
      const response = this.selectedTemplateId()
        ? await firstValueFrom(
            this.adminApi.updatePrintingTemplate(this.selectedTemplateId()!, payload),
          )
        : await firstValueFrom(this.adminApi.createPrintingTemplate(payload));

      const saved = response.data;
      this.templates.update((items) => {
        const without = items.filter((item) => item.id !== saved.id);
        return [...without, saved].sort((a, b) => a.name.localeCompare(b.name));
      });

      if (saved.isDefault) {
        this.templates.update((items) =>
          items.map((item) => ({ ...item, isDefault: item.id === saved.id })),
        );
        this.settingsForm.controls.defaultTemplateId.setValue(String(saved.id));
      }

      this.selectTemplate(saved.id);
      this.success.set('Template saved.');
    } catch (err: unknown) {
      this.error.set(this.readError(err, 'Unable to save template.'));
    } finally {
      this.savingTemplate.set(false);
    }
  }

  async duplicateTemplate(): Promise<void> {
    const id = this.selectedTemplateId();
    if (!id) {
      return;
    }

    this.clearMessages();
    try {
      const response = await firstValueFrom(this.adminApi.duplicatePrintingTemplate(id));
      this.templates.update((items) => [...items, response.data]);
      this.selectTemplate(response.data.id);
      this.success.set('Template duplicated.');
    } catch (err: unknown) {
      this.error.set(this.readError(err, 'Unable to duplicate template.'));
    }
  }

  async deleteTemplate(): Promise<void> {
    const id = this.selectedTemplateId();
    if (!id) {
      return;
    }

    if (!window.confirm('Delete this template?')) {
      return;
    }

    this.clearMessages();
    try {
      await firstValueFrom(this.adminApi.deletePrintingTemplate(id));
      const remaining = this.templates().filter((template) => template.id !== id);
      this.templates.set(remaining);
      if (remaining.length) {
        this.selectTemplate(remaining[0].id);
      } else {
        this.startNewTemplate();
      }
      this.success.set('Template deleted.');
    } catch (err: unknown) {
      this.error.set(this.readError(err, 'Unable to delete template.'));
    }
  }

  private clearMessages(): void {
    this.error.set('');
    this.success.set('');
  }

  private readError(err: unknown, fallback: string): string {
    const httpErr = err as { error?: { message?: string | string[] } };
    const msg = httpErr?.error?.message;
    return Array.isArray(msg) ? msg.join(', ') : msg || fallback;
  }
}
