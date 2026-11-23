import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

/** Body for POST /downloads/apk. The serial is checked on the server. */
export class DownloadApkDto {
  @IsIn(['portal'])
  app!: 'portal';

  @IsString()
  @MinLength(4)
  @MaxLength(80)
  serial!: string;
}
