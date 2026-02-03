import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { AudioService } from '../audio/audio.service';
import { RoomsService } from '../rooms/rooms.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AppGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('AppGateway');

  constructor(
    private gatewayService: GatewayService,
    private audioService: AudioService,
    @Inject(forwardRef(() => RoomsService))
    private roomsService: RoomsService,
  ) {}

  afterInit(server: Server) {
    this.gatewayService.server = server;
    this.logger.log('WebSocket Gateway Initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe-room')
  handleSubscribeRoom(client: Socket, roomId: string) {
    client.join(roomId);
    this.logger.log(`Client ${client.id} subscribed to room ${roomId}`);
  }

  @SubscribeMessage('unsubscribe-room')
  handleUnsubscribeRoom(client: Socket, roomId: string) {
    client.leave(roomId);
    this.logger.log(`Client ${client.id} unsubscribed from room ${roomId}`);
  }

  // Mediasoup Signaling
  @SubscribeMessage('getRouterRtpCapabilities')
  async handleGetRouterRtpCapabilities(client: Socket, roomId: string) {
    const router = await this.audioService.getOrCreateRouter(roomId);
    return router.rtpCapabilities;
  }

  @SubscribeMessage('createWebRtcTransport')
  async handleCreateWebRtcTransport(client: Socket, roomId: string) {
    return this.audioService.createWebRtcTransport(roomId);
  }

  @SubscribeMessage('connectWebRtcTransport')
  async handleConnectWebRtcTransport(client: Socket, data: { transportId: string, dtlsParameters: any }) {
    await this.audioService.connectTransport(data.transportId, data.dtlsParameters);
    return { success: true };
  }

  @SubscribeMessage('produce')
  async handleProduce(client: Socket, data: { transportId: string, kind: 'audio', rtpParameters: any, userId: string, roomId: string }) {
    const { id } = await this.audioService.createProducer(data.transportId, data.kind, data.rtpParameters, data.userId, data.roomId);
    return { id };
  }

  @SubscribeMessage('consume')
  async handleConsume(client: Socket, data: { roomId: string, transportId: string, producerUserId: string, rtpCapabilities: any, userId: string }) {
    return this.audioService.createConsumer(data.roomId, data.transportId, data.producerUserId, data.rtpCapabilities, data.userId);
  }

  @SubscribeMessage('resumeConsumer')
  async handleResumeConsumer(client: Socket, data: { userId: string, producerId: string }) {
    await this.audioService.resumeConsumer(data.userId, data.producerId);
    return { success: true };
  }

  // Commander Management
  @SubscribeMessage('leader:force-call')
  async handleForceCall(client: Socket, data: { roomId: string, enabled: boolean }) {
    await this.audioService.setForceCall(data.roomId, data.enabled);
    this.server.to(data.roomId).emit('force-call-status', { enabled: data.enabled });
    return { success: true };
  }

  @SubscribeMessage('leader:mute-all')
  async handleMuteAll(client: Socket, roomId: string) {
    await this.roomsService.muteAllUsers(roomId);
    this.server.to(roomId).emit('force-mute-all');
    this.logger.log(`Leader in room ${roomId} executed Mute All`);
    return { success: true };
  }
}
