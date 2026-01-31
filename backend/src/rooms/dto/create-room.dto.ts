import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  roomName: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(50)
  maxUsers?: number;
}
