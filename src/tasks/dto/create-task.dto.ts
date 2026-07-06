import { ApiProperty } from '@nestjs/swagger';
import { Priority } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Fix login redirect bug' })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: Priority, required: false, default: Priority.MEDIUM })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiProperty({ required: false, example: '2026-07-10' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ required: false, description: 'User id of whoever this task is assigned to' })
  @IsOptional()
  @IsString()
  assigneeId?: string;
}
