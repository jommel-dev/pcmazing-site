import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class UpdatePrintingSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  storeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  storeAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  storePhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  storeCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  workstationNo?: string;

  @IsOptional()
  @IsString()
  @IsIn(['A4', 'Letter', 'Receipt80', 'Receipt58'])
  paperSize?: 'A4' | 'Letter' | 'Receipt80' | 'Receipt58';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  marginTopMm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  marginRightMm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  marginBottomMm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  marginLeftMm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultTemplateId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fontFamily?: string;

  @IsOptional()
  @IsBoolean()
  showPageNumbers?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['direct', 'network', 'bluetooth'])
  printerConnectionType?: 'direct' | 'network' | 'bluetooth';

  @IsOptional()
  @IsString()
  @MaxLength(180)
  printerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  printerHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  printerPort?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  printerBluetoothDeviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  printerBluetoothDeviceName?: string;

  @IsOptional()
  @IsBoolean()
  printerAutoPrint?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  warrantyPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  footerNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  thanksMessage?: string;
}

export class TestPrinterConnectionDto {
  @IsOptional()
  @IsString()
  @IsIn(['direct', 'network', 'bluetooth'])
  printerConnectionType?: 'direct' | 'network' | 'bluetooth';

  @IsOptional()
  @IsString()
  @MaxLength(180)
  printerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  printerHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  printerPort?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  printerBluetoothDeviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  printerBluetoothDeviceName?: string;
}

function roundMm(value: unknown, decimals = 2): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const factor = 10 ** decimals;
  return Math.round(numeric * factor) / factor;
}

class PrintLayoutElementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  id!: string;

  @IsString()
  @IsIn(['text', 'field', 'image', 'line', 'table'])
  type!: 'text' | 'field' | 'image' | 'line' | 'table';

  @Type(() => Number)
  @Transform(({ value }) => roundMm(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  x!: number;

  @Type(() => Number)
  @Transform(({ value }) => roundMm(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000)
  y!: number;

  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => roundMm(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1000)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => roundMm(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1000)
  height?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fieldKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  content?: string;

  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => roundMm(value, 1))
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(6)
  @Max(72)
  fontSize?: number;

  @IsOptional()
  @IsString()
  @IsIn(['normal', 'bold'])
  fontWeight?: 'normal' | 'bold';

  @IsOptional()
  @IsString()
  @IsIn(['left', 'center', 'right'])
  textAlign?: 'left' | 'center' | 'right';
}

class PrintLayoutDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PrintLayoutElementDto)
  elements!: PrintLayoutElementDto[];
}

export class CreatePrintingTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn(['sales_receipt', 'quotation', 'invoice', 'custom'])
  documentType?: 'sales_receipt' | 'quotation' | 'invoice' | 'custom';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(40)
  @Max(500)
  paperWidthMm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(40)
  @Max(500)
  paperHeightMm?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PrintLayoutDto)
  layout?: PrintLayoutDto;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePrintingTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['sales_receipt', 'quotation', 'invoice', 'custom'])
  documentType?: 'sales_receipt' | 'quotation' | 'invoice' | 'custom';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(40)
  @Max(500)
  paperWidthMm?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(40)
  @Max(500)
  paperHeightMm?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PrintLayoutDto)
  layout?: PrintLayoutDto;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
