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
exports.AppGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const gateway_service_1 = require("./gateway.service");
const audio_service_1 = require("../audio/audio.service");
const rooms_service_1 = require("../rooms/rooms.service");
let AppGateway = class AppGateway {
    gatewayService;
    audioService;
    roomsService;
    server;
    logger = new common_1.Logger('AppGateway');
    constructor(gatewayService, audioService, roomsService) {
        this.gatewayService = gatewayService;
        this.audioService = audioService;
        this.roomsService = roomsService;
    }
    afterInit(server) {
        this.gatewayService.server = server;
        this.logger.log('WebSocket Gateway Initialized');
    }
    handleConnection(client) {
        this.logger.log(`Client connected: ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    async handleSubscribeRoom(client, data) {
        const { roomId, userId } = data;
        client.join(userId);
        client.join(roomId);
        this.logger.log(`Client ${client.id} (User: ${userId}) subscribed to personal and room: ${roomId}`);
        await this.audioService.updateRouting(roomId);
    }
    handleUnsubscribeRoom(client, roomId) {
        client.leave(roomId);
        this.logger.log(`Client ${client.id} unsubscribed from room ${roomId}`);
    }
    async handleForceCall(client, data) {
        await this.audioService.setForceCall(data.roomId, data.enabled);
        this.server.to(data.roomId).emit('force-call-status', { enabled: data.enabled });
        return { success: true };
    }
    async handleMuteAll(client, roomId) {
        await this.roomsService.muteAllUsers(roomId);
        this.server.to(roomId).emit('force-mute-all');
        this.logger.log(`Leader in room ${roomId} executed Mute All`);
        return { success: true };
    }
};
exports.AppGateway = AppGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], AppGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('subscribe-room'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], AppGateway.prototype, "handleSubscribeRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('unsubscribe-room'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleUnsubscribeRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leader:force-call'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], AppGateway.prototype, "handleForceCall", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leader:mute-all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], AppGateway.prototype, "handleMuteAll", null);
exports.AppGateway = AppGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => rooms_service_1.RoomsService))),
    __metadata("design:paramtypes", [gateway_service_1.GatewayService,
        audio_service_1.AudioService,
        rooms_service_1.RoomsService])
], AppGateway);
//# sourceMappingURL=app.gateway.js.map