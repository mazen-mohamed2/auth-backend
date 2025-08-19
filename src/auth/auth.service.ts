import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  async signup(email: string, name: string, password: string) {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new BadRequestException('Email already registered');
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await this.users.create({ email, name, passwordHash });
    const tokens = await this.generateTokens(user._id.toString(), user.email, user.name);
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 12);
    await this.users.setRefreshToken(user._id.toString(), refreshTokenHash);
    return { user: { id: user._id, email: user.email, name: user.name }, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async signin(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const tokens = await this.generateTokens(user._id.toString(), user.email, user.name);
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 12);
    await this.users.setRefreshToken(user._id.toString(), refreshTokenHash);
    return { user: { id: user._id, email: user.email, name: user.name }, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  async logout(userId: string) {
    await this.users.setRefreshToken(userId, null);
    return { success: true };
  }

  async refresh(userId: string, presentedToken: string) {
    const user = await this.users.findById(userId);
    if (!user || !user.refreshTokenHash) throw new UnauthorizedException();
    const valid = await bcrypt.compare(presentedToken, user.refreshTokenHash);
    if (!valid) throw new UnauthorizedException();
    const tokens = await this.generateTokens(user._id.toString(), user.email, user.name);
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 12);
    await this.users.setRefreshToken(user._id.toString(), refreshTokenHash);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  private async generateTokens(sub: string, email: string, name: string) {
    const accessToken = await this.jwt.signAsync(
      { sub, email, name },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub, email, name },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' },
    );
    return { accessToken, refreshToken };
  }
}
