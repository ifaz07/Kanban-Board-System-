import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateColumnDto {
  @ApiProperty({ example: 'Backlog' })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({ example: 0, required: false, description: 'Defaults to the next open slot' })
  @IsOptional()
  @IsInt()
  order?: number;
}
