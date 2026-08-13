import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { connect as netConnect, Socket } from 'node:net';
import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';
import { TestPrinterConnectionDto, UpdatePrintingSettingsDto } from './dto/printing.dto';

export type PrinterConnectionType = 'direct' | 'network' | 'bluetooth';
export type PrinterTestStatus = 'never' | 'ok' | 'failed';

export interface PrintingSettingsItem {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeCode: string;
  workstationNo: string;
  paperSize: 'A4' | 'Letter' | 'Receipt80' | 'Receipt58';
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  defaultTemplateId: number | null;
  fontFamily: string;
  showPageNumbers: boolean;
  printerConnectionType: PrinterConnectionType;
  printerName: string;
  printerHost: string;
  printerPort: number;
  printerBluetoothDeviceId: string;
  printerBluetoothDeviceName: string;
  printerAutoPrint: boolean;
  printerLastTestedAt: string | null;
  printerLastTestStatus: PrinterTestStatus;
  printerLastTestMessage: string;
  warrantyPolicy: string;
  footerNote: string;
  thanksMessage: string;
  updatedAt: string | null;
}

export interface PrinterConnectionTestResult {
  ok: boolean;
  status: PrinterTestStatus;
  message: string;
  testedAt: string;
  settings: PrintingSettingsItem;
}

type SettingsRow = {
  store_name: string;
  store_address: string;
  store_phone: string;
  store_code: string;
  workstation_no: string;
  paper_size: string;
  margin_top_mm: string;
  margin_right_mm: string;
  margin_bottom_mm: string;
  margin_left_mm: string;
  default_template_id: number | null;
  font_family: string;
  show_page_numbers: boolean;
  printer_connection_type: string | null;
  printer_name: string | null;
  printer_host: string | null;
  printer_port: number | string | null;
  printer_bluetooth_device_id: string | null;
  printer_bluetooth_device_name: string | null;
  printer_auto_print: boolean | null;
  printer_last_tested_at: string | null;
  printer_last_test_status: string | null;
  printer_last_test_message: string | null;
  warranty_policy: string | null;
  footer_note: string | null;
  thanks_message: string | null;
  updated_at: string | null;
};

@Injectable()
export class PrintingSettingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  private async ensureTable(): Promise<void> {
    if (!(await tableExists(this.databaseService, 'pcmazing_printing_settings'))) {
      throw new ServiceUnavailableException(
        'Printing settings table is not available. Apply migration 042_printing.sql.',
      );
    }
  }

  private async ensurePrinterColumns(): Promise<void> {
    await this.ensureTable();

    const result = await this.databaseService.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'pcmazing_printing_settings'
           AND column_name = 'printer_connection_type'
       ) AS exists`,
    );

    if (!result.rows[0]?.exists) {
      throw new ServiceUnavailableException(
        'Printer connection columns are missing. Apply migration 043_printing_printer_connection.sql.',
      );
    }
  }

  async get(): Promise<PrintingSettingsItem> {
    await this.ensurePrinterColumns();

    const result = await this.databaseService.query<SettingsRow>(
      `SELECT
         store_name,
         store_address,
         store_phone,
         store_code,
         workstation_no,
         paper_size,
         margin_top_mm::text,
         margin_right_mm::text,
         margin_bottom_mm::text,
         margin_left_mm::text,
         default_template_id,
         font_family,
         show_page_numbers,
         printer_connection_type,
         printer_name,
         printer_host,
         printer_port,
         printer_bluetooth_device_id,
         printer_bluetooth_device_name,
         printer_auto_print,
         printer_last_tested_at::text,
         printer_last_test_status,
         printer_last_test_message,
         warranty_policy,
         footer_note,
         thanks_message,
         updated_at::text
       FROM pcmazing_printing_settings
       WHERE id = 1
       LIMIT 1`,
    );

    const row = result.rows[0];
    if (!row) {
      throw new ServiceUnavailableException('Printing settings row is missing.');
    }

    return this.mapRow(row);
  }

  async update(dto: UpdatePrintingSettingsDto): Promise<PrintingSettingsItem> {
    await this.ensurePrinterColumns();

    if (dto.defaultTemplateId != null) {
      const hasTemplates = await tableExists(this.databaseService, 'pcmazing_printing_templates');
      if (hasTemplates) {
        const template = await this.databaseService.query<{ id: number }>(
          `SELECT id
           FROM pcmazing_printing_templates
           WHERE id = $1 AND deleted_at IS NULL
           LIMIT 1`,
          [dto.defaultTemplateId],
        );
        if (!template.rows[0]) {
          throw new BadRequestException(`Template ${dto.defaultTemplateId} was not found.`);
        }
      }
    }

    if (dto.printerConnectionType === 'network') {
      const host = (dto.printerHost ?? '').trim();
      if (host && !this.isValidHost(host)) {
        throw new BadRequestException('Printer host must be a valid IP address or hostname.');
      }
    }

    await this.databaseService.query(
      `UPDATE pcmazing_printing_settings
       SET store_name = COALESCE($1, store_name),
           store_address = COALESCE($2, store_address),
           store_phone = COALESCE($3, store_phone),
           store_code = COALESCE($4, store_code),
           workstation_no = COALESCE($5, workstation_no),
           paper_size = COALESCE($6, paper_size),
           margin_top_mm = COALESCE($7, margin_top_mm),
           margin_right_mm = COALESCE($8, margin_right_mm),
           margin_bottom_mm = COALESCE($9, margin_bottom_mm),
           margin_left_mm = COALESCE($10, margin_left_mm),
           default_template_id = CASE
             WHEN $11::boolean THEN $12
             ELSE default_template_id
           END,
           font_family = COALESCE($13, font_family),
           show_page_numbers = COALESCE($14, show_page_numbers),
           printer_connection_type = COALESCE($15, printer_connection_type),
           printer_name = COALESCE($16, printer_name),
           printer_host = COALESCE($17, printer_host),
           printer_port = COALESCE($18, printer_port),
           printer_bluetooth_device_id = COALESCE($19, printer_bluetooth_device_id),
           printer_bluetooth_device_name = COALESCE($20, printer_bluetooth_device_name),
           printer_auto_print = COALESCE($21, printer_auto_print),
           warranty_policy = COALESCE($22, warranty_policy),
           footer_note = COALESCE($23, footer_note),
           thanks_message = COALESCE($24, thanks_message),
           updated_at = NOW()
       WHERE id = 1`,
      [
        dto.storeName?.trim() ?? null,
        dto.storeAddress?.trim() ?? null,
        dto.storePhone?.trim() ?? null,
        dto.storeCode?.trim() ?? null,
        dto.workstationNo?.trim() ?? null,
        dto.paperSize ?? null,
        dto.marginTopMm ?? null,
        dto.marginRightMm ?? null,
        dto.marginBottomMm ?? null,
        dto.marginLeftMm ?? null,
        dto.defaultTemplateId !== undefined,
        dto.defaultTemplateId ?? null,
        dto.fontFamily?.trim() ?? null,
        dto.showPageNumbers ?? null,
        dto.printerConnectionType ?? null,
        dto.printerName?.trim() ?? null,
        dto.printerHost?.trim() ?? null,
        dto.printerPort ?? null,
        dto.printerBluetoothDeviceId?.trim() ?? null,
        dto.printerBluetoothDeviceName?.trim() ?? null,
        dto.printerAutoPrint ?? null,
        dto.warrantyPolicy ?? null,
        dto.footerNote?.trim() ?? null,
        dto.thanksMessage?.trim() ?? null,
      ],
    );

    return this.get();
  }

  async testConnection(dto: TestPrinterConnectionDto = {}): Promise<PrinterConnectionTestResult> {
    const current = await this.get();
    const connectionType = dto.printerConnectionType ?? current.printerConnectionType;
    const printerName = (dto.printerName ?? current.printerName).trim();
    const printerHost = (dto.printerHost ?? current.printerHost).trim();
    const printerPort = dto.printerPort ?? current.printerPort;
    const bluetoothId = (
      dto.printerBluetoothDeviceId ?? current.printerBluetoothDeviceId
    ).trim();
    const bluetoothName = (
      dto.printerBluetoothDeviceName ?? current.printerBluetoothDeviceName
    ).trim();

    let ok = false;
    let message = '';

    if (connectionType === 'direct') {
      ok = true;
      message = printerName
        ? `Direct printing will use the browser/system dialog. Preferred printer label: "${printerName}".`
        : 'Direct printing will use the browser/system print dialog on this workstation.';
    } else if (connectionType === 'bluetooth') {
      if (!bluetoothId && !bluetoothName) {
        ok = false;
        message =
          'No Bluetooth printer paired yet. Use Pair Bluetooth printer in the admin UI (Chrome/Edge required).';
      } else {
        ok = true;
        message = bluetoothName
          ? `Bluetooth printer "${bluetoothName}" is saved. Pairing/session is handled in the browser.`
          : `Bluetooth printer ID "${bluetoothId}" is saved. Pairing/session is handled in the browser.`;
      }
    } else if (connectionType === 'network') {
      if (!printerHost) {
        throw new BadRequestException('Printer host/IP is required for network printers.');
      }
      if (!this.isValidHost(printerHost)) {
        throw new BadRequestException('Printer host must be a valid IP address or hostname.');
      }

      const probe = await this.probeTcpHost(printerHost, printerPort);
      ok = probe.ok;
      message = probe.message;
    } else {
      throw new BadRequestException('Unsupported printer connection type.');
    }

    const status: PrinterTestStatus = ok ? 'ok' : 'failed';
    const testedAt = new Date().toISOString();

    await this.databaseService.query(
      `UPDATE pcmazing_printing_settings
       SET printer_last_tested_at = $1::timestamptz,
           printer_last_test_status = $2,
           printer_last_test_message = $3,
           updated_at = NOW()
       WHERE id = 1`,
      [testedAt, status, message.slice(0, 500)],
    );

    const settings = await this.get();
    return { ok, status, message, testedAt, settings };
  }

  private isValidHost(host: string): boolean {
    const value = host.trim();
    if (!value || value.includes(' ') || value.includes('/')) {
      return false;
    }
    // Basic IPv4 / hostname validation (no protocol, no path).
    return /^(?:(?:\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/.test(
      value,
    );
  }

  private probeTcpHost(
    host: string,
    port: number,
  ): Promise<{ ok: boolean; message: string }> {
    return new Promise((resolve) => {
      const socket: Socket = netConnect({ host, port, timeout: 4000 });
      let settled = false;

      const finish = (ok: boolean, message: string) => {
        if (settled) {
          return;
        }
        settled = true;
        socket.destroy();
        resolve({ ok, message });
      };

      socket.once('connect', () => {
        finish(true, `Connected to ${host}:${port}. Network printer port is reachable.`);
      });

      socket.once('timeout', () => {
        finish(false, `Timed out connecting to ${host}:${port}. Check IP, port, and firewall.`);
      });

      socket.once('error', (error: NodeJS.ErrnoException) => {
        const detail = error.code ? `${error.code}: ${error.message}` : error.message;
        finish(false, `Unable to reach ${host}:${port}. ${detail}`);
      });
    });
  }

  private mapRow(row: SettingsRow): PrintingSettingsItem {
    return {
      storeName: row.store_name,
      storeAddress: row.store_address,
      storePhone: row.store_phone,
      storeCode: row.store_code,
      workstationNo: row.workstation_no,
      paperSize: row.paper_size as PrintingSettingsItem['paperSize'],
      marginTopMm: Number(row.margin_top_mm ?? 0),
      marginRightMm: Number(row.margin_right_mm ?? 0),
      marginBottomMm: Number(row.margin_bottom_mm ?? 0),
      marginLeftMm: Number(row.margin_left_mm ?? 0),
      defaultTemplateId: row.default_template_id ?? null,
      fontFamily: row.font_family,
      showPageNumbers: row.show_page_numbers,
      printerConnectionType: (row.printer_connection_type ||
        'direct') as PrinterConnectionType,
      printerName: row.printer_name ?? '',
      printerHost: row.printer_host ?? '',
      printerPort: Number(row.printer_port ?? 9100) || 9100,
      printerBluetoothDeviceId: row.printer_bluetooth_device_id ?? '',
      printerBluetoothDeviceName: row.printer_bluetooth_device_name ?? '',
      printerAutoPrint: Boolean(row.printer_auto_print),
      printerLastTestedAt: row.printer_last_tested_at,
      printerLastTestStatus: (row.printer_last_test_status ||
        'never') as PrinterTestStatus,
      printerLastTestMessage: row.printer_last_test_message ?? '',
      warrantyPolicy: row.warranty_policy ?? '',
      footerNote: row.footer_note ?? '',
      thanksMessage: row.thanks_message ?? '',
      updatedAt: row.updated_at,
    };
  }
}
