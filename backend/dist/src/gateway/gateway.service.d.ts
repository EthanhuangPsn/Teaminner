import { Server } from 'socket.io';
export declare class GatewayService {
    server: Server;
    broadcastRoomUpdate(roomId: string, data: any): void;
    broadcastUserSpeaking(roomId: string, userId: string | null, isSpeaking: boolean): void;
    sendAudioRoutingUpdate(userId: string, allowedUserIds: string[]): void;
}
