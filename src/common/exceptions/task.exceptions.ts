import { ForbiddenException, NotFoundException } from '@nestjs/common';

export class TaskNotFoundException extends NotFoundException {
  constructor(message = 'Task not found') {
    super(message);
  }
}

export class TaskForbiddenException extends ForbiddenException {
  constructor(message = 'You do not own this task') {
    super(message);
  }
}
