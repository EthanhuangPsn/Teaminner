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
var AudioService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioService = void 0;
const common_1 = require("@nestjs/common");
const rooms_service_1 = require("../rooms/rooms.service");
const gateway_service_1 = require("../gateway/gateway.service");
const agora_service_1 = require("./agora.service");
let AudioService = AudioService_1 = class AudioService {
    roomsService;
    gatewayService;
    agoraService;
    forceCallRooms = new Set();
    logger = new common_1.Logger(AudioService_1.name);
    constructor(roomsService, gatewayService, agoraService) {
        this.roomsService = roomsService;
        this.gatewayService = gatewayService;
        this.agoraService = agoraService;
    }
    async onModuleInit() {
        await this.clearUserStatuses();
    }
    async clearUserStatuses() {
        try {
            await this.roomsService.clearAllUserStatuses();
            this.logger.log('All user statuses cleared on startup');
        }
        catch (error) {
            this.logger.error('Failed to clear user statuses on startup', error);
        }
    }
    async setForceCall(roomId, enabled) {
        if (enabled)
            this.forceCallRooms.add(roomId);
        else
            this.forceCallRooms.delete(roomId);
        this.logger.log(`Force call ${enabled ? 'enabled' : 'disabled'} for room ${roomId}`);
        await this.updateRouting(roomId);
    }
    async updateRouting(roomId) {
        const room = await this.roomsService.findOne(roomId);
        if (!room)
            return;
        const users = room.users;
        this.logger.log(`[Tactical Routing] Updating for room ${roomId}. Users in room: ${users.length}`);
        for (const userA of users) {
            const allowedUserIds = [];
            for (const userB of users) {
                if (userA.id === userB.id)
                    continue;
                const canCommunicate = userA.speakerEnabled && this.checkCommunication(userA, userB, room);
                if (canCommunicate) {
                    const numericUid = this.agoraService.getNumericUid(userB.id);
                    allowedUserIds.push(numericUid.toString());
                }
            }
            this.gatewayService.sendAudioRoutingUpdate(userA.id, allowedUserIds);
        }
    }
    checkCommunication(userA, userB, room) {
        if (this.forceCallRooms.has(room.id))
            return true;
        if (room.status === 'preparing')
            return true;
        const leaderId = room.leaderId;
        const isALeader = userA.id === leaderId;
        const isBLeader = userB.id === leaderId;
        if (isALeader && userB.roomRole === 'captain')
            return true;
        if (isBLeader && userA.roomRole === 'captain')
            return true;
        if (userA.roomRole === 'captain' && userB.roomRole === 'captain')
            return true;
        if (userA.teamId && userA.teamId === userB.teamId) {
            return true;
        }
        return false;
    }
};
exports.AudioService = AudioService;
exports.AudioService = AudioService = AudioService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => rooms_service_1.RoomsService))),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => gateway_service_1.GatewayService))),
    __metadata("design:paramtypes", [rooms_service_1.RoomsService,
        gateway_service_1.GatewayService,
        agora_service_1.AgoraService])
], AudioService);
//# sourceMappingURL=audio.service.js.map