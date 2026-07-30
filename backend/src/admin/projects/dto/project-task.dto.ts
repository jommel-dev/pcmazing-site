import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProjectUserRefDto } from './create-project.dto';

export const PROJECT_TASK_STATUSES = [
  'backlog',
  'todo',
  'in_progress',
  'in_review',
  'done',
] as const;

export const PROJECT_TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export class CreateProjectTaskDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsIn(PROJECT_TASK_STATUSES)
  status?: (typeof PROJECT_TASK_STATUSES)[number];

  @IsOptional()
  @IsIn(PROJECT_TASK_PRIORITIES)
  priority?: (typeof PROJECT_TASK_PRIORITIES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  epicId!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectUserRefDto)
  assignee?: ProjectUserRefDto | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateProjectTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsIn(PROJECT_TASK_STATUSES)
  status?: (typeof PROJECT_TASK_STATUSES)[number];

  @IsOptional()
  @IsIn(PROJECT_TASK_PRIORITIES)
  priority?: (typeof PROJECT_TASK_PRIORITIES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  epicId?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectUserRefDto)
  assignee?: ProjectUserRefDto | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class MoveProjectTaskDto {
  @IsIn(PROJECT_TASK_STATUSES)
  status!: (typeof PROJECT_TASK_STATUSES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class MoveProjectEpicDto {
  @IsIn(PROJECT_TASK_STATUSES)
  status!: (typeof PROJECT_TASK_STATUSES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class SetCurrentPhaseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  phaseId!: number;
}
