import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BoardOwnerGuard } from '../common/guards/board-owner.guard';
import { ColumnOwnerGuard } from '../common/guards/column-owner.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ColumnsService } from './columns.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';

@ApiTags('columns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ColumnsController {
  constructor(private readonly columnsService: ColumnsService) {}

  @UseGuards(BoardOwnerGuard)
  @Post('boards/:id/columns')
  create(@Param('id') boardId: string, @Body() dto: CreateColumnDto) {
    return this.columnsService.create(boardId, dto);
  }

  @UseGuards(ColumnOwnerGuard)
  @Patch('columns/:id')
  update(@Param('id') id: string, @Body() dto: UpdateColumnDto) {
    return this.columnsService.update(id, dto);
  }

  @UseGuards(ColumnOwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('columns/:id')
  async remove(@Param('id') id: string): Promise<void> {
    await this.columnsService.remove(id);
  }
}
