import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { getRouteParam } from '../utils/get-route-param';

// Guards the :id param as a task id. Ownership lives two hops up: task ->
// column -> board.
@Injectable()
export class TaskOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const taskId = getRouteParam(request.params.id, 'id');

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      include: { column: { include: { board: true } } },
    });

    if (!task || task.column.board.deletedAt) {
      throw new NotFoundException('Task not found');
    }

    if (task.column.board.ownerId !== request.user.userId) {
      throw new ForbiddenException('You do not own this task');
    }

    return true;
  }
}
