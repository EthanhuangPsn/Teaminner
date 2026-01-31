import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { GatewayService } from '../gateway/gateway.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private gatewayService: GatewayService,
  ) {}

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });

    if (user.roomId) {
      // Broadcast room update so everyone sees the new mic/speaker status
      const room = await this.prisma.room.findUnique({
        where: { id: user.roomId },
        include: {
          users: true,
          teams: {
            include: { members: true },
          },
        },
      });
      if (room) {
        this.gatewayService.broadcastRoomUpdate(user.roomId, room);
      }
    }

    return user;
  }
}
