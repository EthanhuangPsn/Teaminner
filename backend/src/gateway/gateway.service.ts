import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class GatewayService {
  public server: Server;

  broadcastRoomUpdate(roomId: string, data: any) {
    if (this.server) {
      this.server.to(roomId).emit('room-updated', data);
    }
  }

  broadcastUserSpeaking(roomId: string, userId: string | null, isSpeaking: boolean) {
    if (this.server) {
      this.server.to(roomId).emit('user-speaking', { userId, isSpeaking });
    }
  }

  sendAudioRoutingUpdate(userId: string, allowedUserIds: string[]) {
    if (this.server) {
      this.server.to(userId).emit('audio-routing-update', { allowedUserIds });
    }
  }
}
