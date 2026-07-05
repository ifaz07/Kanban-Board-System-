import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { BoardOwnerGuard } from '../common/guards/board-owner.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';

@ApiTags('boards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBoardDto) {
    return this.boardsService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.boardsService.findAllForUser(user.userId);
  }

  @UseGuards(BoardOwnerGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.boardsService.findOneWithDetails(id);
  }

  @UseGuards(BoardOwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    await this.boardsService.softDelete(id);
  }
}
