import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import {
  EmailAlreadyRegisteredException,
  InvalidCredentialsException,
  InvalidRefreshTokenException,
} from '../common/exceptions/auth.exceptions';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const SALT_ROUNDS = 10;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<TokenPair> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new EmailAlreadyRegisteredException();
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
    });

    return this.issueTokens(user.id, user.email);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.usersService.findByEmail(dto.email);
    const passwordMatches = user ? await bcrypt.compare(dto.password, user.password) : false;

    if (!user || !passwordMatches) {
      throw new InvalidCredentialsException();
    }

    return this.issueTokens(user.id, user.email);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
    });

    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId: payload.sub, expiresAt: { gt: new Date() } },
    });

    const matchingToken = await this.findMatchingToken(candidates, refreshToken);
    if (!matchingToken) {
      throw new InvalidRefreshTokenException();
    }

    // Refresh tokens are single-use: the old one is deleted the moment it's redeemed.
    await this.prisma.refreshToken.delete({ where: { id: matchingToken.id } });

    return this.issueTokens(payload.sub, payload.email);
  }

  private async findMatchingToken(
    candidates: { id: string; tokenHash: string }[],
    refreshToken: string,
  ): Promise<{ id: string; tokenHash: string } | null> {
    for (const candidate of candidates) {
      if (await bcrypt.compare(refreshToken, candidate.tokenHash)) {
        return candidate;
      }
    }
    return null;
  }

  private async issueTokens(userId: string, email: string): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, email };
    const accessExpirySeconds = this.parseDurationToSeconds(
      this.configService.get<string>('jwt.accessExpiry') ?? '15m',
    );
    const refreshExpirySeconds = this.parseDurationToSeconds(
      this.configService.get<string>('jwt.refreshExpiry') ?? '7d',
    );

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: accessExpirySeconds,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: refreshExpirySeconds,
    });

    const tokenHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + refreshExpirySeconds * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  // Converts values like "15m" or "7d" into seconds. @nestjs/jwt's types want
  // expiresIn as a number or a narrowly-typed string literal, so a plain
  // string from ConfigService doesn't satisfy them - seconds sidesteps that.
  private parseDurationToSeconds(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) {
      return 7 * 24 * 60 * 60;
    }

    const unitSeconds: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return Number(match[1]) * unitSeconds[match[2]];
  }
}
