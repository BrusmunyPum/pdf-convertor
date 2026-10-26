import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { FORMATS } from '../../../common/constants';
import { PaginationQuery } from '../../../common/dto/pagination.dto';

export class ConvertDto {
  @IsIn(FORMATS as unknown as string[]) targetFormat: string;
  @IsOptional() @IsIn(['flow', 'exact']) mode?: 'flow' | 'exact';
  @IsOptional() @IsIn(['auto', 'force', 'off']) ocr?: 'auto' | 'force' | 'off';
  @IsOptional() @IsString() @MaxLength(200) password?: string;
}

export class ListConversionsQuery extends PaginationQuery {
  @IsOptional() @IsIn(['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']) status?: string;
  @IsOptional() @IsIn(FORMATS as unknown as string[]) format?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}

/** ?ids=a,b,c — several finished conversions downloaded as one ZIP. */
export class ArchiveQuery {
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  ids: string[];
}
