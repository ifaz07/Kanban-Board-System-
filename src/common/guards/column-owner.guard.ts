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
      throw new NotFoundException('Column not found');
    }

    if (column.board.ownerId !== request.user.userId) {
      throw new ForbiddenException('You do not own this column');
    }

    return true;
  }
}
