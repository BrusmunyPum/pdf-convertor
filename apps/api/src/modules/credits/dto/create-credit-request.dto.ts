import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateCreditRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
