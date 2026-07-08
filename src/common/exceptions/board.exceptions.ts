import { ForbiddenException, NotFoundException } from '@nestjs/common';

export class BoardNotFoundException extends NotFoundException {
  constructor(message = 'Board not found') {
    super(message);
  }
}

export class BoardForbiddenException extends ForbiddenException {
  constructor(message = 'You do not own this board') {
    super(message);
  }
}
