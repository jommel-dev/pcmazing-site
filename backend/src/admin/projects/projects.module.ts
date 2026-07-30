import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ProjectsService } from './projects.service';

@Module({
  imports: [DatabaseModule],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
