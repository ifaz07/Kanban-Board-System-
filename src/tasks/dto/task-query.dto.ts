import { ApiProperty } from '@nestjs/swagger';
import { Priority } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class TaskQueryDto {
  @ApiProperty({ required: false, description: 'Case-insensitive match against the task title' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ enum: Priority, required: false })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiProperty({ required: false, example: '2026-07-10', description: 'Matches tasks due on this day' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
