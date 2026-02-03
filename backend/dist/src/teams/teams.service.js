"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const gateway_service_1 = require("../gateway/gateway.service");
const audio_service_1 = require("../audio/audio.service");
let TeamsService = class TeamsService {
    prisma;
    gatewayService;
    audioService;
    constructor(prisma, gatewayService, audioService) {
        this.prisma = prisma;
        this.gatewayService = gatewayService;
        this.audioService = audioService;
    }
    async joinTeam(teamId, userId) {
        const team = await this.prisma.team.findUnique({
            where: { id: teamId },
            include: { members: true },
        });
        if (!team)
            throw new common_1.NotFoundException('Team not found');
        if (!team.isEnabled)
            throw new common_1.BadRequestException('Team is disabled');
        if (team.members.length >= 5)
            throw new common_1.BadRequestException('Team is full');
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.roomId !== team.roomId) {
            throw new common_1.BadRequestException('User is not in the room');
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
    async assignUserToTeam(teamId, targetUserId, commanderId) {
        const team = await this.prisma.team.findUnique({
            where: { id: teamId },
            include: {
                room: true,
                members: true
            },
        });
        if (!team || !team.room)
            throw new common_1.NotFoundException('Team or Room not found');
        if (team.room.leaderId !== commanderId) {
            throw new common_1.BadRequestException('只有指挥官有权指派队员');
        }
        if (!team.isEnabled)
            throw new common_1.BadRequestException('该小队当前未启用');
        if (team.members.length >= 5)
            throw new common_1.BadRequestException('该小队人数已满');
        const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
        if (!targetUser || targetUser.roomId !== team.roomId) {
            throw new common_1.BadRequestException('目标用户不在当前房间');
        }
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
    async unassignUser(targetUserId, commanderId) {
        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
            include: { room: true }
        });
        if (!targetUser || !targetUser.roomId || !targetUser.room)
            throw new common_1.NotFoundException('User or Room not found');
        if (targetUser.room.leaderId !== commanderId) {
            throw new common_1.BadRequestException('只有指挥官有权解除分队');
        }
        const oldTeamId = targetUser.teamId;
        const updatedUser = await this.prisma.user.update({
            where: { id: targetUserId },
            data: {
                teamId: null,
                roomRole: 'member',
            },
        });
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
    async leaveTeam(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.teamId)
            return;
        const teamId = user.teamId;
        const roomId = user.roomId;
        const room = roomId ? await this.prisma.room.findUnique({ where: { id: roomId } }) : null;
        const isLeader = room?.leaderId === userId;
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                teamId: null,
                roomRole: 'member',
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
        if (roomId)
            await this.notifyRoomUpdate(roomId);
    }
    async setCaptain(teamId, targetUserId, commanderId) {
        const team = await this.prisma.team.findUnique({
            where: { id: teamId },
            include: { room: true }
        });
        if (!team || !team.room)
            throw new common_1.NotFoundException('Team or Room not found');
        if (team.room.leaderId !== commanderId) {
            throw new common_1.BadRequestException('只有指挥官有权任命队长');
        }
        const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
        if (!targetUser || targetUser.teamId !== teamId) {
            throw new common_1.BadRequestException('目标用户不在该小队中');
        }
        await this.prisma.user.updateMany({
            where: { teamId, roomRole: 'captain' },
            data: { roomRole: 'member' },
        });
        const updatedUser = await this.prisma.user.update({
            where: { id: targetUserId },
            data: { roomRole: 'captain' },
        });
        await this.notifyRoomUpdate(team.roomId);
        return updatedUser;
    }
    async enableTeam(teamId, enabled) {
        const team = await this.prisma.team.update({
            where: { id: teamId },
            data: { isEnabled: enabled }
        });
        await this.notifyRoomUpdate(team.roomId);
        return team;
    }
    async notifyRoomUpdate(roomId) {
        this.gatewayService.server.to(roomId).emit('room-state-changed');
        await this.audioService.updateRouting(roomId);
    }
};
exports.TeamsService = TeamsService;
exports.TeamsService = TeamsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => gateway_service_1.GatewayService))),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => audio_service_1.AudioService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        gateway_service_1.GatewayService,
        audio_service_1.AudioService])
], TeamsService);
//# sourceMappingURL=teams.service.js.map