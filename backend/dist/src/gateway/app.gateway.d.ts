import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GatewayService } from './gateway.service';
import { AudioService } from '../audio/audio.service';
import { RoomsService } from '../rooms/rooms.service';
export declare class AppGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private gatewayService;
    private audioService;
    private roomsService;
    server: Server;
    private logger;
    constructor(gatewayService: GatewayService, audioService: AudioService, roomsService: RoomsService);
    afterInit(server: Server): void;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleSubscribeRoom(client: Socket, data: {
        roomId: string;
        userId: string;
    }): Promise<void>;
    handleUnsubscribeRoom(client: Socket, roomId: string): void;
    handleForceCall(client: Socket, data: {
        roomId: string;
        enabled: boolean;
    }): Promise<{
        success: boolean;
    }>;
    handleMuteAll(client: Socket, roomId: string): Promise<{
        success: boolean;
    }>;
}
