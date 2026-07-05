import { Module } from '@nestjs/common';
import { BoardOwnerGuard } from '../common/guards/board-owner.guard';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';

@Module({
  controllers: [BoardsController],
  providers: [BoardsService, BoardOwnerGuard],
})
export class BoardsModule {}
