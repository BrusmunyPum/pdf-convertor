import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, NotEquals } from 'class-validator';
import { PaginationQuery } from '../../../common/dto/pagination.dto';
import { AppSettings } from '../../settings/settings.types';

export class AdminListQuery extends PaginationQuery {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() @MaxLength(20) status?: string;
  @IsOptional() @IsString() @MaxLength(10) format?: string;
  @IsOptional() @IsString() @MaxLength(40) userId?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsIn(['USER', 'ADMIN']) role?: Role;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AdjustCreditsDto {
  @Type(() => Number) @IsInt() @Min(-100000) @Max(100000) @NotEquals(0) amount: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class ReviewRequestDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) amount?: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class UpdateSettingsDto implements Partial<AppSettings> {
  @IsOptional() @IsInt() @Min(0) @Max(1000) guestCredits?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100000) signupCredits?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10000) guestIpDailyCap?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) creditCost?: number;
  @IsOptional() @IsInt() @Min(1) @Max(60) maxFileMb?: number;
  @IsOptional() @IsInt() @Min(1) @Max(2000) maxPages?: number;
  @IsOptional() @IsInt() @Min(1) @Max(50) maxFilesPerBatch?: number;
  @IsOptional() @IsInt() @Min(1) @Max(24 * 90) guestFileTtlHours?: number;
  @IsOptional() @IsInt() @Min(1) @Max(24 * 365) userFileTtlHours?: number;
  @IsOptional() @IsString() @MaxLength(64) telegramUsername?: string;
  @IsOptional() @IsBoolean() registrationOpen?: boolean;
  @IsOptional() @IsString() @MaxLength(500) announcement?: string;
}
