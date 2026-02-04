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
  async handleSubscribeRoom(client: Socket, data: { roomId: string, userId: string }) {
    const { roomId, userId } = data;
    // 核心修复：让该用户的 Socket 加入以其用户 ID 命名的私有房间
    // 这样后端执行 .to(userId).emit('audio-routing-update') 时，前端才能收到
    client.join(userId);
    client.join(roomId);
    this.logger.log(`Client ${client.id} (User: ${userId}) subscribed to personal and room: ${roomId}`);
    
    // 立即触发初始路由
    await this.audioService.updateRouting(roomId);
  }

  @SubscribeMessage('unsubscribe-room')
  handleUnsubscribeRoom(client: Socket, roomId: string) {
    client.leave(roomId);
    this.logger.log(`Client ${client.id} unsubscribed from room ${roomId}`);
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
