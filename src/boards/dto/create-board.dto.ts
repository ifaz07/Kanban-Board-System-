import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateBoardDto {
  @ApiProperty({ example: 'Sprint 12' })
  @IsString()
  @MinLength(1)
  title: string;
}
