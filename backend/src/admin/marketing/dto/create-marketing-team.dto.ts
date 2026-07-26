import { IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateMarketingTeamDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsInt()
  parentTeamId?: number;

  @IsOptional()
  @IsInt()
  managerUserId?: number;
}
