import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsBoolean()
  micEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  speakerEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isSpeaking?: boolean;
}
