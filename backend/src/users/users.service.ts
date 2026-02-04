import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { GatewayService } from '../gateway/gateway.service';
import { AudioService } from '../audio/audio.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private gatewayService: GatewayService,
    @Inject(forwardRef(() => AudioService))
    private audioService: AudioService,
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
      // 1. 广播房间状态更新（UI 同步）
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

      // 2. 核心修正：触发音频路由更新（服务端暂停/恢复 Consumer）
      // 只有当麦克风或收听状态改变时才需要更新路由
      if (updateUserDto.micEnabled !== undefined || updateUserDto.speakerEnabled !== undefined) {
        await this.audioService.updateRouting(user.roomId);
      }
    }

    return user;
  }
}
