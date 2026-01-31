import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { GuestLoginDto } from './dto/guest-login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async guestLogin(dto: GuestLoginDto) {
    const user = await this.prisma.user.create({
      data: {
        username: dto.username || `游客${Math.floor(1000 + Math.random() * 9000)}`,
        avatar: dto.avatar || null,
        accountType: 'guest',
        accountRole: 'user',
      },
    });

    const payload = { sub: user.id, username: user.username, role: user.accountRole };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user,
    };
  }

  async validateUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }
}
