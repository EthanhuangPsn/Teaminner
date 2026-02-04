import { OnModuleInit } from '@nestjs/common';
import { RoomsService } from '../rooms/rooms.service';
import { GatewayService } from '../gateway/gateway.service';
import { AgoraService } from './agora.service';
export declare class AudioService implements OnModuleInit {
    private roomsService;
    private gatewayService;
    private agoraService;
    private forceCallRooms;
    private readonly logger;
    constructor(roomsService: RoomsService, gatewayService: GatewayService, agoraService: AgoraService);
    onModuleInit(): Promise<void>;
    private clearUserStatuses;
    setForceCall(roomId: string, enabled: boolean): Promise<void>;
    updateRouting(roomId: string): Promise<void>;
    private checkCommunication;
}
