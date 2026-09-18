import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export type SendMailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;
  private warnedMissingConfig = false;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST')?.trim() || 'smtp.gmail.com';
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER')?.trim() || '';
    // Gmail App Passwords are often copied with spaces (xxxx xxxx xxxx xxxx).
    const pass = (this.config.get<string>('SMTP_PASS') ?? '').replace(/\s+/g, '').trim();
    this.from =
      this.config.get<string>('MAIL_FROM')?.trim() ||
      (user ? `PCMazing <${user}>` : 'PCMazing <noreply@localhost>');

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        host,
        port: Number.isFinite(port) ? port : 587,
        secure: false,
        auth: { user, pass },
      });
    } else {
      this.transporter = null;
    }
  }

  isConfigured(): boolean {
    return this.transporter != null;
  }

  async send(input: SendMailInput): Promise<boolean> {
    if (!this.transporter) {
      if (!this.warnedMissingConfig) {
        this.logger.warn(
          'SMTP is not configured — email sending is disabled. Set SMTP_USER and SMTP_PASS (Gmail App Password) to enable.',
        );
        this.warnedMissingConfig = true;
      }
      return false;
    }

    const to = (Array.isArray(input.to) ? input.to : [input.to])
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);
    if (!to.length) {
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      this.logger.log(
        `Email sent to ${to.join(', ')} — ${input.subject}` +
          (info.messageId ? ` (${info.messageId})` : ''),
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`SMTP send failed: ${message}`);
      return false;
    }
  }
}
