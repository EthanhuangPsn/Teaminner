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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const gateway_service_1 = require("./gateway.service");
const audio_service_1 = require("../audio/audio.service");
let AppGateway = class AppGateway {
    gatewayService;
    audioService;
    server;
    logger = new common_1.Logger('AppGateway');
    constructor(gatewayService, audioService) {
        this.gatewayService = gatewayService;
        this.audioService = audioService;
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
    handleSubscribeRoom(client, roomId) {
        client.join(roomId);
        this.logger.log(`Client ${client.id} subscribed to room ${roomId}`);
    }
    handleUnsubscribeRoom(client, roomId) {
        client.leave(roomId);
        this.logger.log(`Client ${client.id} unsubscribed from room ${roomId}`);
    }
    async handleGetRouterRtpCapabilities(client, roomId) {
        const router = await this.audioService.getOrCreateRouter(roomId);
        return router.rtpCapabilities;
    }
    async handleCreateWebRtcTransport(client, roomId) {
        return this.audioService.createWebRtcTransport(roomId);
    }
    async handleConnectWebRtcTransport(client, data) {
        await this.audioService.connectTransport(data.transportId, data.dtlsParameters);
        return { success: true };
    }
    async handleProduce(client, data) {
        const { id } = await this.audioService.createProducer(data.transportId, data.kind, data.rtpParameters, data.userId, data.roomId);
        return { id };
    }
    async handleConsume(client, data) {
        return this.audioService.createConsumer(data.roomId, data.transportId, data.producerUserId, data.rtpCapabilities, data.userId);
    }
    async handleResumeConsumer(client, data) {
        await this.audioService.resumeConsumer(data.userId, data.producerId);
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
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleSubscribeRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('unsubscribe-room'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], AppGateway.prototype, "handleUnsubscribeRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('getRouterRtpCapabilities'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], AppGateway.prototype, "handleGetRouterRtpCapabilities", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('createWebRtcTransport'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], AppGateway.prototype, "handleCreateWebRtcTransport", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('connectWebRtcTransport'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], AppGateway.prototype, "handleConnectWebRtcTransport", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('produce'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], AppGateway.prototype, "handleProduce", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('consume'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], AppGateway.prototype, "handleConsume", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('resumeConsumer'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], AppGateway.prototype, "handleResumeConsumer", null);
exports.AppGateway = AppGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [gateway_service_1.GatewayService,
        audio_service_1.AudioService])
], AppGateway);
//# sourceMappingURL=app.gateway.js.map