import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class StaffAccessDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  passcode!: string;
}
