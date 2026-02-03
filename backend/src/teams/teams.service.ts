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
    const newRole = isFirstMember ? 'captain' : 'member';

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

  async assignUserToTeam(teamId: string, targetUserId: string, commanderId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { 
        room: true,
        members: true
      },
    });

    if (!team || !team.room) throw new NotFoundException('Team or Room not found');
    
    // 权限校验：只有房间团长有权指派
    if (team.room.leaderId !== commanderId) {
      throw new BadRequestException('只有指挥官有权指派队员');
    }

    if (!team.isEnabled) throw new BadRequestException('该小队当前未启用');
    if (team.members.length >= 5) throw new BadRequestException('该小队人数已满');

    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser || targetUser.roomId !== team.roomId) {
      throw new BadRequestException('目标用户不在当前房间');
    }

    // 执行加入逻辑
    const isFirstMember = team.members.length === 0;
    const newRole = isFirstMember ? 'captain' : 'member';

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        teamId,
        roomRole: newRole,
      },
    });

    await this.notifyRoomUpdate(team.roomId);
    return updatedUser;
  }

  async unassignUser(targetUserId: string, commanderId: string) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { room: true }
    });

    if (!targetUser || !targetUser.roomId || !targetUser.room) throw new NotFoundException('User or Room not found');
    
    // 权限校验
    if (targetUser.room.leaderId !== commanderId) {
      throw new BadRequestException('只有指挥官有权解除分队');
    }

    const oldTeamId = targetUser.teamId;

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        teamId: null,
        roomRole: 'member', // 离开小队后，战术角色统一回归为普通成员
      },
    });

    // 如果之前是队长，尝试指派新队长
    if (targetUser.roomRole === 'captain' && oldTeamId) {
      const nextMember = await this.prisma.user.findFirst({
        where: { teamId: oldTeamId, roomRole: 'member' },
      });
      if (nextMember) {
        await this.prisma.user.update({
          where: { id: nextMember.id },
          data: { roomRole: 'captain' },
        });
      }
    }

    await this.notifyRoomUpdate(targetUser.roomId);
    return updatedUser;
  }

  async leaveTeam(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.teamId) return;

    const teamId = user.teamId;
    const roomId = user.roomId;
    
    // Check if they are the leader of the room
    const room = roomId ? await this.prisma.room.findUnique({ where: { id: roomId } }) : null;
    const isLeader = room?.leaderId === userId;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        teamId: null,
        roomRole: 'member', // 离开小队后回归普通成员角色
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

  async setCaptain(teamId: string, targetUserId: string, commanderId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { room: true }
    });

    if (!team || !team.room) throw new NotFoundException('Team or Room not found');
    
    // 权限校验：只有房间团长有权任命队长
    if (team.room.leaderId !== commanderId) {
      throw new BadRequestException('只有指挥官有权任命队长');
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser || targetUser.teamId !== teamId) {
      throw new BadRequestException('目标用户不在该小队中');
    }

    // 1. 将该队原队长降级为普通成员
    await this.prisma.user.updateMany({
      where: { teamId, roomRole: 'captain' },
      data: { roomRole: 'member' },
    });

    // 2. 提升目标用户为队长
    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { roomRole: 'captain' },
    });

    await this.notifyRoomUpdate(team.roomId);
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
