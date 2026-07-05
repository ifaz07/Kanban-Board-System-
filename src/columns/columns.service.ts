import { Injectable } from '@nestjs/common';
import { Column } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';

@Injectable()
export class ColumnsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(boardId: string, dto: CreateColumnDto): Promise<Column> {
    const order = dto.order ?? (await this.prisma.column.count({ where: { boardId } }));
    return this.prisma.column.create({ data: { title: dto.title, boardId, order } });
  }

  update(id: string, dto: UpdateColumnDto): Promise<Column> {
    // Prisma omits undefined keys from the generated UPDATE, so this stays
    // a partial update even when only one of title/order is sent.
    return this.prisma.column.update({
      where: { id },
      data: { title: dto.title, order: dto.order },
    });
  }

  // Columns have no deletedAt in the schema - only tasks and boards need
  // soft delete per the brief - so this is a real delete, cascading to
  // the column's tasks via the FK relation.
  async remove(id: string): Promise<void> {
    await this.prisma.column.delete({ where: { id } });
  }
}
