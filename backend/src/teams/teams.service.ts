import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GatewayService } from '../gateway/gateway.service';
import { AudioService } from '../audio/audio.service';

@Injectable()
export class TeamsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => GatewayService))
    private gatewayService: GatewayService,
    @Inject(forwardRef(() => AudioService))
    private audioService: AudioService,
  ) {}

  async joinTeam(teamId: string, userId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });

    if (!team) throw new NotFoundException('Team not found');
    if (!team.isEnabled) throw new BadRequestException('Team is disabled');
    if (team.members.length >= 5) throw new BadRequestException('Team is full');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.roomId !== team.roomId) {
      throw new BadRequestException('User is not in the room');
    }

    const isFirstMember = team.members.length === 0;
    const newRole = (isFirstMember && user.roomRole === 'member') ? 'captain' : user.roomRole;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        teamId,
        roomRole: newRole,
      },
    });

    await this.notifyRoomUpdate(team.roomId);
    return updatedUser;
  }

  async leaveTeam(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.teamId) return;

    const teamId = user.teamId;
    const roomId = user.roomId;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        teamId: null,
        roomRole: user.roomRole === 'captain' ? 'member' : user.roomRole,
      },
    });

    if (user.roomRole === 'captain') {
      const nextMember = await this.prisma.user.findFirst({
        where: { teamId, roomRole: 'member' },
      });
      if (nextMember) {
        await this.prisma.user.update({
          where: { id: nextMember.id },
          data: { roomRole: 'captain' },
        });
      }
    }

    if (roomId) await this.notifyRoomUpdate(roomId);
  }

  async setCaptain(teamId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.teamId !== teamId) {
      throw new BadRequestException('User is not in the team');
    }

    if (user.roomRole === 'leader') {
        return user;
    }

    await this.prisma.user.updateMany({
      where: { teamId, roomRole: 'captain' },
      data: { roomRole: 'member' },
    });

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { roomRole: 'captain' },
    });

    if (user.roomId) await this.notifyRoomUpdate(user.roomId);
    return updatedUser;
  }

  async enableTeam(teamId: string, enabled: boolean) {
      const team = await this.prisma.team.update({
          where: { id: teamId },
          data: { isEnabled: enabled }
      });
      await this.notifyRoomUpdate(team.roomId);
      return team;
  }

  private async notifyRoomUpdate(roomId: string) {
      this.gatewayService.server.to(roomId).emit('room-state-changed');
      await this.audioService.updateRouting(roomId);
  }
}
