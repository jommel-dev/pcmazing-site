import { IsIn, IsInt, IsOptional } from 'class-validator';

export class AddTeamMemberDto {
  @IsInt()
  userId!: number;

  @IsOptional()
  @IsIn(['lead_marketing', 'sub_marketing', 'member'])
  memberRole?: 'lead_marketing' | 'sub_marketing' | 'member';
}
