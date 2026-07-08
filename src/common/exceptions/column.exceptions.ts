import { ForbiddenException, NotFoundException } from '@nestjs/common';

export class ColumnNotFoundException extends NotFoundException {
  constructor(message = 'Column not found') {
    super(message);
  }
}

export class ColumnForbiddenException extends ForbiddenException {
  constructor(message = 'You do not own this column') {
    super(message);
  }
}
