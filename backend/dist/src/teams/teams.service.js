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
    async leaveTeam(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.teamId)
            return;
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
        if (roomId)
            await this.notifyRoomUpdate(roomId);
    }
    async setCaptain(teamId, userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.teamId !== teamId) {
            throw new common_1.BadRequestException('User is not in the team');
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
        if (user.roomId)
            await this.notifyRoomUpdate(user.roomId);
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