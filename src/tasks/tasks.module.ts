import { Module } from '@nestjs/common';
import { ColumnOwnerGuard } from '../common/guards/column-owner.guard';
import { TaskOwnerGuard } from '../common/guards/task-owner.guard';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService, ColumnOwnerGuard, TaskOwnerGuard],
})
export class TasksModule {}
