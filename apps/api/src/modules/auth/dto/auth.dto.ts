import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @Transform(lower) @IsEmail() @MaxLength(160) email: string;
  @IsString() @MinLength(8) @MaxLength(128) password: string;
}

export class LoginDto {
  @Transform(lower) @IsEmail() email: string;
  @IsString() @MaxLength(128) password: string;
}
