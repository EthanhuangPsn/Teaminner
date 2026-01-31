import { IsOptional, IsString } from 'class-validator';

export class GuestLoginDto {
  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  avatar?: string;
}
