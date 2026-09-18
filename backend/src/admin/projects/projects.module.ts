import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MailModule } from '../../mail/mail.module';
import { ProjectTaskNotificationService } from './project-task-notification.service';
import { ProjectsService } from './projects.service';

@Module({
  imports: [DatabaseModule, MailModule],
  providers: [ProjectsService, ProjectTaskNotificationService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
