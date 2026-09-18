import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../../mail/mail.service';
import { actorDisplayName, statusLabel } from './project-task-activity.util';
import type {
  ProjectActor,
  ProjectDetail,
  ProjectTaskItem,
  ProjectUserSummary,
} from './projects.service';

@Injectable()
export class ProjectTaskNotificationService {
  private readonly logger = new Logger(ProjectTaskNotificationService.name);

  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async notifyTaskAssigned(input: {
    project: ProjectDetail;
    task: ProjectTaskItem;
    actor?: ProjectActor | null;
  }): Promise<void> {
    try {
      const assignee = input.task.assignee;
      if (!assignee?.email?.trim()) {
        return;
      }
      if (this.isSameUser(assignee, input.actor)) {
        return;
      }

      const actorName = actorDisplayName(input.actor ?? null) || 'A teammate';
      const boardUrl = this.boardUrl(input.project.id);
      const subject = `New task assigned: ${input.task.title}`;
      const lines = [
        `Hi ${assignee.fullName || assignee.username},`,
        '',
        `${actorName} assigned you a new task on “${input.project.name}”.`,
        '',
        `Task: ${input.task.title}`,
        `Status: ${statusLabel(input.task.status)}`,
        `Priority: ${input.task.priority}`,
        input.task.dueDate ? `Due: ${input.task.dueDate}` : null,
        boardUrl ? `Open board: ${boardUrl}` : null,
        '',
        '— PCMazing Projects',
      ].filter((line): line is string => line != null);

      const text = lines.join('\n');
      const html = this.toHtml(lines);

      const sent = await this.mail.send({
        to: assignee.email.trim(),
        subject,
        text,
        html,
      });
      if (sent) {
        this.logger.log(
          `Assignment email sent for task ${input.task.id} to ${assignee.email}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`notifyTaskAssigned failed for task ${input.task.id}: ${message}`);
    }
  }

  async notifyTaskStatusChanged(input: {
    project: ProjectDetail;
    task: ProjectTaskItem;
    fromStatus: string;
    toStatus: string;
    actor?: ProjectActor | null;
  }): Promise<void> {
    try {
      if (input.fromStatus === input.toStatus) {
        return;
      }

      const recipients = this.projectRecipients(input.project, input.actor);
      if (!recipients.length) {
        return;
      }

      const actorName = actorDisplayName(input.actor ?? null) || 'A teammate';
      const boardUrl = this.boardUrl(input.project.id);
      const fromLabel = statusLabel(input.fromStatus);
      const toLabel = statusLabel(input.toStatus);
      const subject = `${input.task.title} moved to ${toLabel}`;

      await Promise.all(
        recipients.map(async (user) => {
          const lines = [
            `Hi ${user.fullName || user.username},`,
            '',
            `${actorName} moved a task on “${input.project.name}”.`,
            '',
            `Task: ${input.task.title}`,
            `Status: ${fromLabel} → ${toLabel}`,
            input.task.assignee
              ? `Assignee: ${input.task.assignee.fullName || input.task.assignee.username}`
              : 'Assignee: Unassigned',
            boardUrl ? `Open board: ${boardUrl}` : null,
            '',
            '— PCMazing Projects',
          ].filter((line): line is string => line != null);

          const text = lines.join('\n');
          const html = this.toHtml(lines);
          const sent = await this.mail.send({
            to: user.email!.trim(),
            subject,
            text,
            html,
          });
          if (sent) {
            this.logger.log(
              `Status email sent for task ${input.task.id} to ${user.email}`,
            );
          }
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `notifyTaskStatusChanged failed for task ${input.task.id}: ${message}`,
      );
    }
  }

  private projectRecipients(
    project: ProjectDetail,
    actor?: ProjectActor | null,
  ): ProjectUserSummary[] {
    const people = [
      project.projectManager,
      ...(project.teamMembers ?? []),
    ].filter((user): user is ProjectUserSummary => Boolean(user));

    const seen = new Set<string>();
    const recipients: ProjectUserSummary[] = [];

    for (const user of people) {
      const key = `${user.source}:${user.id}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      if (!user.email?.trim()) {
        continue;
      }
      if (this.isSameUser(user, actor)) {
        continue;
      }
      recipients.push(user);
    }

    return recipients;
  }

  private isSameUser(
    user: Pick<ProjectUserSummary, 'id' | 'source'>,
    actor?: ProjectActor | null,
  ): boolean {
    if (!actor) {
      return false;
    }
    return user.id === actor.userId && user.source === actor.source;
  }

  private boardUrl(projectId: number): string | null {
    const base = this.config.get<string>('APP_ADMIN_URL')?.trim().replace(/\/$/, '');
    if (!base) {
      return null;
    }
    return `${base}/admin/projects/${projectId}/tasks`;
  }

  private toHtml(lines: string[]): string {
    const body = lines
      .map((line) => {
        if (!line) {
          return '<br />';
        }
        const escaped = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const withLinks = escaped.replace(
          /(https?:\/\/[^\s]+)/g,
          '<a href="$1">$1</a>',
        );
        return `<p style="margin:0 0 8px;font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#0f172a;">${withLinks}</p>`;
      })
      .join('');

    return `<div style="max-width:560px;margin:0 auto;padding:16px;">${body}</div>`;
  }
}
