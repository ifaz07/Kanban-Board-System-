import { Injectable } from '@nestjs/common';
import { Board } from '@prisma/client';
import { BoardNotFoundException } from '../common/exceptions/board.exceptions';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBoardDto } from './dto/create-board.dto';

@Injectable()
export class BoardsService {
  constructor(private readonly prisma: PrismaService) {}

  create(ownerId: string, dto: CreateBoardDto): Promise<Board> {
    return this.prisma.board.create({ data: { title: dto.title, ownerId } });
  }

  findAllForUser(ownerId: string): Promise<Board[]> {
    return this.prisma.board.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneWithDetails(boardId: string) {
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, deletedAt: null },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            tasks: {
              where: { deletedAt: null },
              orderBy: { position: 'asc' },
              include: { labels: true, attachments: true },
            },
          },
        },
      },
    });

    if (!board) {
      throw new BoardNotFoundException();
    }

    return board;
  }

  async softDelete(boardId: string): Promise<void> {
    await this.prisma.board.update({
      where: { id: boardId },
      data: { deletedAt: new Date() },
    });
  }
}
