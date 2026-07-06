import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ColumnOwnerGuard } from '../common/guards/column-owner.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TaskOwnerGuard } from '../common/guards/task-owner.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @UseGuards(ColumnOwnerGuard)
  @Post('columns/:id/tasks')
  create(@Param('id') columnId: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(columnId, dto);
  }

  @Get('tasks')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: TaskQueryDto) {
    return this.tasksService.findAllForUser(user.userId, query);
  }

  @UseGuards(TaskOwnerGuard)
  @Patch('tasks/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, dto, user.userId);
  }

  @UseGuards(TaskOwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('tasks/:id')
  async remove(@Param('id') id: string): Promise<void> {
    await this.tasksService.softDelete(id);
  }

  @UseGuards(TaskOwnerGuard)
  @Patch('tasks/:id/position')
  move(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: MoveTaskDto) {
    return this.tasksService.move(id, dto, user.userId);
  }
}
