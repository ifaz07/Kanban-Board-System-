import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { ColumnForbiddenException, ColumnNotFoundException } from '../exceptions/column.exceptions';
import { getRouteParam } from '../utils/get-route-param';

// Guards the :id param as a column id. Ownership lives on the parent board,
// so this hops up one relation to check it.
@Injectable()
export class ColumnOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const columnId = getRouteParam(request.params.id, 'id');

    const column = await this.prisma.column.findUnique({
      where: { id: columnId },
      include: { board: true },
    });

    if (!column || column.board.deletedAt) {
      throw new ColumnNotFoundException();
    }

    if (column.board.ownerId !== request.user.userId) {
      throw new ColumnForbiddenException();
    }

    return true;
  }
}
