import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const USER_SOURCES = ['pcmazing_admin_users', 'tblusers'] as const;

export class ProjectUserRefDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;

  @IsIn(USER_SOURCES)
  source!: (typeof USER_SOURCES)[number];
}

export class CreateProjectDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  prospectId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ValidateNested()
  @Type(() => ProjectUserRefDto)
  projectManager!: ProjectUserRefDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProjectUserRefDto)
  teamMembers!: ProjectUserRefDto[];
}
