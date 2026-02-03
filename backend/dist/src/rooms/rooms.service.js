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
exports.RoomsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const gateway_service_1 = require("../gateway/gateway.service");
const audio_service_1 = require("../audio/audio.service");
let RoomsService = class RoomsService {
    prisma;
    gatewayService;
    audioService;
    constructor(prisma, gatewayService, audioService) {
        this.prisma = prisma;
        this.gatewayService = gatewayService;
        this.audioService = audioService;
    }
    async create(createRoomDto) {
        return this.prisma.room.create({
            data: {
                roomName: createRoomDto.roomName,
                maxUsers: createRoomDto.maxUsers || 20,
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
    async findOne(id) {
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
            throw new common_1.NotFoundException(`Room with ID ${id} not found`);
        }
        return room;
    }
    async muteAllUsers(roomId) {
        const room = await this.findOne(roomId);
        if (!room)
            return;
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
        await this.prisma.user.updateMany({
            data: {
                roomId: null,
                teamId: null,
                roomRole: null,
                micEnabled: false,
                speakerEnabled: true,
            },
        });
        await this.prisma.room.updateMany({
            data: {
                leaderId: null,
                status: 'preparing',
            },
        });
    }
    async joinRoom(roomId, userId) {
        const room = await this.prisma.room.findUnique({
            where: { id: roomId },
            include: {
                users: true,
            },
        });
        if (!room) {
            throw new common_1.NotFoundException('Room not found');
        }
        if (room.users.length >= room.maxUsers) {
            throw new common_1.BadRequestException('Room is full');
        }
        const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!userExists) {
            throw new common_1.UnauthorizedException('用户信息已失效，请重新登录');
        }
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
                roomId,
                micEnabled: false,
                speakerEnabled: true
            },
        });
        if (!room.leaderId) {
            await this.prisma.room.update({
                where: { id: roomId },
                data: { leaderId: userId },
            });
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: { roomRole: 'member' },
        });
        const updatedRoom = await this.findOne(roomId);
        this.gatewayService.broadcastRoomUpdate(roomId, updatedRoom);
        await this.audioService.updateRouting(roomId);
        return updatedRoom;
    }
    async leaveRoom(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user || !user.roomId)
            return;
        const roomId = user.roomId;
        await this.prisma.user.update({
            where: { id: userId },
            data: { roomId: null, teamId: null, roomRole: null },
        });
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
    async toggleStatus(roomId, status) {
        const room = await this.prisma.room.update({
            where: { id: roomId },
            data: { status },
        });
        const updatedRoom = await this.findOne(roomId);
        this.gatewayService.broadcastRoomUpdate(roomId, updatedRoom);
        await this.audioService.updateRouting(roomId);
        return room;
    }
    async transferLeader(roomId, targetUserId) {
        const room = await this.prisma.room.findUnique({
            where: { id: roomId },
        });
        if (!room)
            throw new common_1.NotFoundException('Room not found');
        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetUserId },
        });
        if (!targetUser || targetUser.roomId !== roomId) {
            throw new common_1.BadRequestException('Target user is not in the room');
        }
        await this.prisma.room.update({
            where: { id: roomId },
            data: { leaderId: targetUserId },
        });
        const updatedRoom = await this.findOne(roomId);
        this.gatewayService.broadcastRoomUpdate(roomId, updatedRoom);
        await this.audioService.updateRouting(roomId);
        return { success: true };
    }
};
exports.RoomsService = RoomsService;
exports.RoomsService = RoomsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => gateway_service_1.GatewayService))),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => audio_service_1.AudioService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        gateway_service_1.GatewayService,
        audio_service_1.AudioService])
], RoomsService);
//# sourceMappingURL=rooms.service.js.map