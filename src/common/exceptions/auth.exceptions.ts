import { ConflictException, UnauthorizedException } from '@nestjs/common';

export class EmailAlreadyRegisteredException extends ConflictException {
  constructor() {
    super('Email is already registered');
  }
}

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super('Invalid credentials');
  }
}

export class InvalidRefreshTokenException extends UnauthorizedException {
  constructor() {
    super('Refresh token is invalid or has expired');
  }
}
