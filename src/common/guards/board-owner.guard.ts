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

// Guards the :id param as a board id. Used both on board routes directly and
// on the "create column under a board" route, which takes a board id too.
@Injectable()
export class BoardOwnerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const boardId = getRouteParam(request.params.id, 'id');

    const board = await this.prisma.board.findFirst({
      where: { id: boardId, deletedAt: null },
    });

    if (!board) {
      throw new NotFoundException('Board not found');
    }

    if (board.ownerId !== request.user.userId) {
      throw new ForbiddenException('You do not own this board');
    }

    return true;
  }
}
