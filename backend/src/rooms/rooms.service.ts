import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { GatewayService } from '../gateway/gateway.service';
import { AudioService } from '../audio/audio.service';

@Injectable()
export class RoomsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => GatewayService))
    private gatewayService: GatewayService,
    @Inject(forwardRef(() => AudioService))
    private audioService: AudioService,
  ) {}

  async create(createRoomDto: CreateRoomDto) {
    return this.prisma.room.create({
      data: {
        roomName: createRoomDto.roomName,
        maxUsers: createRoomDto.maxUsers || 20,
        // Default teams
        teams: {
          create: [
            { teamColor: 'red' },
            { teamColor: 'yellow' },
            { teamColor: 'green' },
          ],
        },
      },
    });
  }

  async findAll() {
    return this.prisma.room.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        users: true,
        teams: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    return room;
  }

  async muteAllUsers(roomId: string) {
    // 1. 在数据库中重置所有用户的麦克风状态（除了团长）
    const room = await this.findOne(roomId);
    if (!room) return;

    await this.prisma.user.updateMany({
      where: { 
        roomId,
        ...(room.leaderId ? { NOT: { id: room.leaderId } } : {})
      },
      data: { micEnabled: false }
    });

    const updatedRoom = await this.findOne(roomId);
    this.gatewayService.broadcastRoomUpdate(roomId, updatedRoom);
    await this.audioService.updateRouting(roomId);
  }

  async clearAllUserStatuses() {
    // 重置所有用户的房间、角色和麦克风状态
    await this.prisma.user.updateMany({
      data: {
        roomId: null,
        teamId: null,
        roomRole: null,
        micEnabled: false,
        speakerEnabled: true,
      },
    });
    // 重置所有房间的团长
    await this.prisma.room.updateMany({
      data: {
        leaderId: null,
        status: 'preparing',
      },
    });
  }

  async joinRoom(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        users: true,
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.users.length >= room.maxUsers) {
      throw new BadRequestException('Room is full');
    }

    // Update user's room
    const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      throw new UnauthorizedException('用户信息已失效，请重新登录');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { 
        roomId,
        micEnabled: false,      // 重置麦克风状态
        speakerEnabled: true    // 默认开启收听
      },
    });

    // If no leader, set as leader
    if (!room.leaderId) {
      await this.prisma.room.update({
        where: { id: roomId },
        data: { leaderId: userId },
      });
    }
    
    // 所有人加入房间时，战术角色默认为 member
    // 团长身份由 room.leaderId 独立标识
    await this.prisma.user.update({
      where: { id: userId },
      data: { roomRole: 'member' },
    });

    const updatedRoom = await this.findOne(roomId);
    this.gatewayService.broadcastRoomUpdate(roomId, updatedRoom);
    await this.audioService.updateRouting(roomId);
    return updatedRoom;
  }

  async leaveRoom(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.roomId) return;

    const roomId = user.roomId;

    // Remove from team if any
    await this.prisma.user.update({
      where: { id: userId },
      data: { roomId: null, teamId: null, roomRole: null },
    });

    // Check if was leader, if so, reassing leader
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { users: true },
    });

    if (room && room.leaderId === userId) {
      const nextLeader = room.users[0];
      await this.prisma.room.update({
        where: { id: roomId },
        data: { leaderId: nextLeader ? nextLeader.id : null },
      });
      if (nextLeader) {
        await this.prisma.user.update({
          where: { id: nextLeader.id },
          data: { roomRole: 'leader' },
        });
      }
    }

    const updatedRoom = await this.findOne(roomId);
    this.gatewayService.broadcastRoomUpdate(roomId, updatedRoom);

    return { success: true };
  }

  async toggleStatus(roomId: string, status: 'preparing' | 'assaulting') {
    const room = await this.prisma.room.update({
      where: { id: roomId },
      data: { status },
    });
    const updatedRoom = await this.findOne(roomId);
    this.gatewayService.broadcastRoomUpdate(roomId, updatedRoom);
    await this.audioService.updateRouting(roomId);
    return room;
  }

  async transferLeader(roomId: string, targetUserId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) throw new NotFoundException('Room not found');

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser || targetUser.roomId !== roomId) {
      throw new BadRequestException('Target user is not in the room');
    }

    // Update room leader
    await this.prisma.room.update({
      where: { id: roomId },
      data: { leaderId: targetUserId },
    });

    const updatedRoom = await this.findOne(roomId);
    this.gatewayService.broadcastRoomUpdate(roomId, updatedRoom);
    await this.audioService.updateRouting(roomId);

    return { success: true };
  }
}
