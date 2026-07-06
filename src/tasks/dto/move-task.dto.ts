import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class MoveTaskDto {
  @ApiProperty({ description: 'Column to move the task into' })
  @IsString()
  columnId: string;

  @ApiProperty({ required: false, description: 'Id of the task this should land directly before' })
  @IsOptional()
  @IsString()
  beforeTaskId?: string;

  @ApiProperty({ required: false, description: 'Id of the task this should land directly after' })
  @IsOptional()
  @IsString()
  afterTaskId?: string;
}
