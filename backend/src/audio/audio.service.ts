import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import { RoomsService } from '../rooms/rooms.service';
import { GatewayService } from '../gateway/gateway.service';
import { AgoraService } from './agora.service';

/**
 * 战术语音路由服务
 * 职责：根据业务规则（指挥官、分队）计算每个人的“可收听名单”，并下发信令指令
 */
@Injectable()
export class AudioService implements OnModuleInit {
  private forceCallRooms: Set<string> = new Set(); // roomId -> isForceCall
  private readonly logger = new Logger(AudioService.name);

  constructor(
    @Inject(forwardRef(() => RoomsService))
    private roomsService: RoomsService,
    @Inject(forwardRef(() => GatewayService))
    private gatewayService: GatewayService,
    private agoraService: AgoraService,
  ) {}

  async onModuleInit() {
    await this.clearUserStatuses();
  }

  private async clearUserStatuses() {
    try {
      await this.roomsService.clearAllUserStatuses();
      this.logger.log('All user statuses cleared on startup');
    } catch (error) {
      this.logger.error('Failed to clear user statuses on startup', error);
    }
  }

  async setForceCall(roomId: string, enabled: boolean) {
    if (enabled) this.forceCallRooms.add(roomId);
    else this.forceCallRooms.delete(roomId);
    this.logger.log(`Force call ${enabled ? 'enabled' : 'disabled'} for room ${roomId}`);
    await this.updateRouting(roomId);
  }

  async updateRouting(roomId: string) {
    const room = await this.roomsService.findOne(roomId);
    if (!room) return;

    const users = room.users;
    this.logger.log(`[Tactical Routing] Updating for room ${roomId}. Users in room: ${users.length}`);
    
    for (const userA of users) {
      const allowedUserIds: string[] = [];

      for (const userB of users) {
        if (userA.id === userB.id) continue;

        // 判定 A 是否能听到 B
        const canCommunicate = userA.speakerEnabled && this.checkCommunication(userA, userB, room);
        
        if (canCommunicate) {
          const numericUid = this.agoraService.getNumericUid(userB.id);
          allowedUserIds.push(numericUid.toString());
        }
      }

      this.gatewayService.sendAudioRoutingUpdate(userA.id, allowedUserIds);
    }
  }

  private checkCommunication(userA: any, userB: any, room: any): boolean {
    // 1. 强呼模式
    if (this.forceCallRooms.has(room.id)) return true;

    // 2. 备战模式
    if (room.status === 'preparing') return true;
    
    // 3. 攻坚模式 (战术逻辑)
    const leaderId = room.leaderId;
    const isALeader = userA.id === leaderId;
    const isBLeader = userB.id === leaderId;

    // A. 团长与队长的关系 (双向)
    if (isALeader && userB.roomRole === 'captain') return true;
    if (isBLeader && userA.roomRole === 'captain') return true;

    // B. 队长与队长的关系
    if (userA.roomRole === 'captain' && userB.roomRole === 'captain') return true;
    
    // C. 队内关系 (队员之间，队长与队员)
    // 强制判定：必须都在某个队内，且 teamId 相同
    if (userA.teamId && userA.teamId === userB.teamId) {
      return true;
    }

    return false;
  }
}
