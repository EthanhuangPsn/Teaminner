import { OnModuleInit } from '@nestjs/common';
import * as mediasoup from 'mediasoup';
import { RoomsService } from '../rooms/rooms.service';
import { GatewayService } from '../gateway/gateway.service';
export declare class AudioService implements OnModuleInit {
    private roomsService;
    private gatewayService;
    private worker;
    private routers;
    private audioLevelObservers;
    private transports;
    private producers;
    private consumers;
    private readonly logger;
    constructor(roomsService: RoomsService, gatewayService: GatewayService);
    onModuleInit(): Promise<void>;
    private createWorker;
    getOrCreateRouter(roomId: string): Promise<mediasoup.types.Router>;
    createWebRtcTransport(roomId: string): Promise<{
        id: string;
        iceParameters: mediasoup.types.IceParameters;
        iceCandidates: mediasoup.types.IceCandidate[];
        dtlsParameters: mediasoup.types.DtlsParameters;
    }>;
    connectTransport(transportId: string, dtlsParameters: any): Promise<void>;
    createProducer(transportId: string, kind: 'audio' | 'video', rtpParameters: any, userId: string, roomId: string): Promise<{
        id: string;
    }>;
    createConsumer(roomId: string, transportId: string, producerUserId: string, rtpCapabilities: any, userId: string): Promise<{
        id: string;
        producerId: string;
        kind: mediasoup.types.MediaKind;
        rtpParameters: mediasoup.types.RtpParameters;
    }>;
    resumeConsumer(userId: string, producerId: string): Promise<void>;
    pauseConsumer(userId: string, producerId: string): Promise<void>;
    updateRouting(roomId: string): Promise<void>;
    private checkCommunication;
}
