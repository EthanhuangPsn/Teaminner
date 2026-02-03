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
    handleSubscribeRoom(client: Socket, roomId: string): void;
    handleUnsubscribeRoom(client: Socket, roomId: string): void;
    handleGetRouterRtpCapabilities(client: Socket, roomId: string): Promise<import("mediasoup/types").RtpCapabilities>;
    handleCreateWebRtcTransport(client: Socket, roomId: string): Promise<{
        id: string;
        iceParameters: import("mediasoup/types").IceParameters;
        iceCandidates: import("mediasoup/types").IceCandidate[];
        dtlsParameters: import("mediasoup/types").DtlsParameters;
    }>;
    handleConnectWebRtcTransport(client: Socket, data: {
        transportId: string;
        dtlsParameters: any;
    }): Promise<{
        success: boolean;
    }>;
    handleProduce(client: Socket, data: {
        transportId: string;
        kind: 'audio';
        rtpParameters: any;
        userId: string;
        roomId: string;
    }): Promise<{
        id: string;
    }>;
    handleConsume(client: Socket, data: {
        roomId: string;
        transportId: string;
        producerUserId: string;
        rtpCapabilities: any;
        userId: string;
    }): Promise<{
        id: string;
        producerId: string;
        kind: import("mediasoup/types").MediaKind;
        rtpParameters: import("mediasoup/types").RtpParameters;
    }>;
    handleResumeConsumer(client: Socket, data: {
        userId: string;
        producerId: string;
    }): Promise<{
        success: boolean;
    }>;
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
