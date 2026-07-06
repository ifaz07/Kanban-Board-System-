import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Task } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const POSITION_GAP = 1000;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(columnId: string, dto: CreateTaskDto): Promise<Task> {
    const lastTask = await this.prisma.task.findFirst({
      where: { columnId, deletedAt: null },
      orderBy: { position: 'desc' },
    });

    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assigneeId: dto.assigneeId,
        columnId,
        position: lastTask ? lastTask.position + POSITION_GAP : POSITION_GAP,
      },
    });
  }

  findAllForUser(ownerId: string, query: TaskQueryDto) {
    return this.prisma.task.findMany({
      where: {
        deletedAt: null,
        column: { board: { ownerId, deletedAt: null } },
        ...(query.search && { title: { contains: query.search, mode: 'insensitive' } }),
        ...(query.priority && { priority: query.priority }),
        ...(query.dueDate && {
          dueDate: {
            gte: new Date(`${query.dueDate}T00:00:00.000Z`),
            lt: new Date(`${query.dueDate}T23:59:59.999Z`),
          },
        }),
      },
      include: { labels: true },
      orderBy: { position: 'asc' },
    });
  }

  async update(id: string, dto: UpdateTaskDto, ownerId: string): Promise<Task> {
    if (dto.columnId) {
      await this.assertOwnsColumn(dto.columnId, ownerId);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.labels) {
        await tx.taskLabel.deleteMany({ where: { taskId: id } });
      }

      return tx.task.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          assigneeId: dto.assigneeId,
          columnId: dto.columnId,
          labels: dto.labels
            ? { create: dto.labels.map((label) => ({ name: label.name, color: label.color })) }
            : undefined,
        },
        include: { labels: true },
      });
    });
  }

  async move(taskId: string, dto: MoveTaskDto, ownerId: string): Promise<Task> {
    await this.assertOwnsColumn(dto.columnId, ownerId);

    return this.prisma.$transaction(async (tx) => {
      let siblings = await this.loadSiblings(tx, dto.columnId, taskId);
      let newPosition = this.computePosition(siblings, dto.beforeTaskId, dto.afterTaskId);

      // If the computed slot collides with an existing position (or falls
      // at/below zero), the gaps in this column have run out - rebalance
      // everything to clean multiples of the gap and recompute once.
      const collides = newPosition <= 0 || siblings.some((task) => task.position === newPosition);
      if (collides) {
        siblings = await this.rebalanceColumn(tx, dto.columnId, siblings);
        newPosition = this.computePosition(siblings, dto.beforeTaskId, dto.afterTaskId);
      }

      const task = await tx.task.update({
        where: { id: taskId },
        data: { columnId: dto.columnId, position: newPosition },
      });

      await tx.activityLog.create({
        data: {
          taskId,
          userId: ownerId,
          action: `Moved to column ${dto.columnId}`,
        },
      });

      return task;
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async assertOwnsColumn(columnId: string, ownerId: string): Promise<void> {
    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      include: { board: true },
    });

    if (!column || column.board.deletedAt) {
      throw new NotFoundException('Target column not found');
    }

    if (column.board.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own the target column');
    }
  }

  private loadSiblings(
    tx: Prisma.TransactionClient,
    columnId: string,
    excludeTaskId: string,
  ): Promise<Task[]> {
    return tx.task.findMany({
      where: { columnId, deletedAt: null, id: { not: excludeTaskId } },
      orderBy: { position: 'asc' },
    });
  }

  private computePosition(siblings: Task[], beforeTaskId?: string, afterTaskId?: string): number {
    const beforeTask = beforeTaskId ? siblings.find((task) => task.id === beforeTaskId) : undefined;
    const afterTask = afterTaskId ? siblings.find((task) => task.id === afterTaskId) : undefined;

    if (afterTask && beforeTask) {
      return Math.floor((afterTask.position + beforeTask.position) / 2);
    }
    if (afterTask) {
      return afterTask.position + POSITION_GAP;
    }
    if (beforeTask) {
      return beforeTask.position - POSITION_GAP;
    }

    const lastTask = siblings.at(-1);
    return lastTask ? lastTask.position + POSITION_GAP : POSITION_GAP;
  }

  private async rebalanceColumn(
    tx: Prisma.TransactionClient,
    columnId: string,
    siblings: Task[],
  ): Promise<Task[]> {
    await Promise.all(
      siblings.map((task, index) =>
        tx.task.update({ where: { id: task.id }, data: { position: (index + 1) * POSITION_GAP } }),
      ),
    );

    return tx.task.findMany({ where: { columnId, deletedAt: null }, orderBy: { position: 'asc' } });
  }
}
