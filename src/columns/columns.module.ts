import { Module } from '@nestjs/common';
import { BoardOwnerGuard } from '../common/guards/board-owner.guard';
import { ColumnOwnerGuard } from '../common/guards/column-owner.guard';
import { ColumnsController } from './columns.controller';
import { ColumnsService } from './columns.service';

@Module({
  controllers: [ColumnsController],
  providers: [ColumnsService, BoardOwnerGuard, ColumnOwnerGuard],
})
export class ColumnsModule {}
