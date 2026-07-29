import { IsString, MaxLength, MinLength } from 'class-validator';

export class TimeClockUsernameDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  username!: string;
}
