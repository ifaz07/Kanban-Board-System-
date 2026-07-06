import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class TaskLabelInputDto {
  @ApiProperty({ example: 'bug' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: '#e53935' })
  @IsString()
  color: string;
}
