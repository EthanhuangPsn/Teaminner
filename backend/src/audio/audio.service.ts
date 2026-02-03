import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import * as mediasoup from 'mediasoup';
import { config } from './mediasoup-config';
import { RoomsService } from '../rooms/rooms.service';
import { GatewayService } from '../gateway/gateway.service';

@Injectable()
export class AudioService implements OnModuleInit {
  private worker: mediasoup.types.Worker;
  private routers: Map<string, mediasoup.types.Router> = new Map(); // roomId -> Router
  private audioLevelObservers: Map<string, mediasoup.types.AudioLevelObserver> = new Map(); // roomId -> Observer
  private transports: Map<string, mediasoup.types.WebRtcTransport> = new Map(); // transportId -> Transport
  private producers: Map<string, mediasoup.types.Producer> = new Map(); // userId -> Producer
  private consumers: Map<string, Map<string, mediasoup.types.Consumer>> = new Map(); // userId -> (producerId -> Consumer)
  private forceCallRooms: Set<string> = new Set(); // roomId -> isForceCall

  private readonly logger = new Logger(AudioService.name);

  constructor(
    @Inject(forwardRef(() => RoomsService))
    private roomsService: RoomsService,
    @Inject(forwardRef(() => GatewayService))
    private gatewayService: GatewayService,
  ) {}

  async onModuleInit() {
    await this.createWorker();
    await this.clearUserStatuses();
  }

  private async clearUserStatuses() {
    try {
      // 启动时清除所有用户的房间状态和麦克风状态，防止数据库残留导致逻辑错误
      await this.roomsService.clearAllUserStatuses();
      this.logger.log('All user statuses cleared on startup');
    } catch (error) {
      this.logger.error('Failed to clear user statuses on startup', error);
    }
  }

  private async createWorker() {
    this.worker = await mediasoup.createWorker(config.worker);

    this.worker.on('died', () => {
      this.logger.error('mediasoup worker died, exiting in 2 seconds...');
      setTimeout(() => process.exit(1), 2000);
    });

    this.logger.log('mediasoup worker created');
  }

  async getOrCreateRouter(roomId: string): Promise<mediasoup.types.Router> {
    let router = this.routers.get(roomId);
    if (!router) {
      router = await this.worker.createRouter(config.router);
      this.routers.set(roomId, router);

      // 为每个房间创建音量观察器
      const audioLevelObserver = await router.createAudioLevelObserver({
        interval: 300, // 每 300ms 检测一次
        threshold: -60, // 恢复正常阈值
      });

      audioLevelObserver.on('volumes', (volumes) => {
        if (volumes.length === 0) return;
        
        for (const volumeInfo of volumes) {
          const { producer, volume } = volumeInfo;
          // 恢复正常判断阈值
          if (volume > -60) { 
            for (const [userId, p] of this.producers.entries()) {
              if (p.id === producer.id) {
                this.gatewayService.broadcastUserSpeaking(roomId, userId, true);
              }
            }
          }
        }
      });

      audioLevelObserver.on('silence', () => {
        this.gatewayService.broadcastUserSpeaking(roomId, null, false);
      });

      this.audioLevelObservers.set(roomId, audioLevelObserver);
      this.logger.log(`Router and AudioLevelObserver created for room ${roomId}`);
    }
    return router;
  }

  async createWebRtcTransport(roomId: string) {
    const router = await this.getOrCreateRouter(roomId);
    const transport = await router.createWebRtcTransport(config.webRtcTransport);

    const listenIp = config.webRtcTransport.listenIps?.[0];
    const announcedIp = typeof listenIp === 'object' ? listenIp.announcedIp : listenIp;
    this.logger.log(`Created WebRtcTransport ${transport.id} for room ${roomId}. Announced IP: ${announcedIp}`);

    this.transports.set(transport.id, transport);

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        transport.close();
      }
    });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectTransport(transportId: string, dtlsParameters: any) {
    const transport = this.transports.get(transportId);
    if (!transport) throw new Error(`Transport ${transportId} not found`);
    await transport.connect({ dtlsParameters });
  }

  async createProducer(transportId: string, kind: 'audio' | 'video', rtpParameters: any, userId: string, roomId: string) {
    const transport = this.transports.get(transportId);
    if (!transport) throw new Error(`Transport ${transportId} not found`);

    const producer = await transport.produce({ kind, rtpParameters });
    this.producers.set(userId, producer);
    this.logger.log(`Producer created for user ${userId} in room ${roomId}`);

    // 将新 Producer 加入音量观察器
    const observer = this.audioLevelObservers.get(roomId);
    if (observer && kind === 'audio') {
      await observer.addProducer({ producerId: producer.id });
    }

    producer.on('transportclose', () => {
      producer.close();
      this.producers.delete(userId);
    });

    // 触发路由更新
    await this.updateRouting(roomId);

    return { id: producer.id };
  }

  async createConsumer(roomId: string, transportId: string, producerUserId: string, rtpCapabilities: any, userId: string) {
    const router = await this.getOrCreateRouter(roomId);
    const producer = this.producers.get(producerUserId);

    if (!producer) {
      this.logger.warn(`createConsumer: Producer for user ${producerUserId} not found. Available users: ${Array.from(this.producers.keys()).join(', ')}`);
      throw new Error(`Producer for user ${producerUserId} not found`);
    }

    if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) {
      throw new Error('cannot consume');
    }

    const transport = this.transports.get(transportId);
    if (!transport) throw new Error(`Transport ${transportId} not found`);

    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: true, // Consumer should be paused initially
    });

    if (!this.consumers.has(userId)) {
      this.consumers.set(userId, new Map());
    }
    const userConsumers = this.consumers.get(userId);
    if (userConsumers) {
      userConsumers.set(producer.id, consumer);
    }

    this.logger.log(`Consumer created: user ${userId} consuming user ${producerUserId}`);

    consumer.on('transportclose', () => {
      this.logger.log(`Consumer closed due to transport close: user ${userId} consuming user ${producerUserId}`);
      consumer.close();
      this.consumers.get(userId)?.delete(producer.id);
    });

    return {
      id: consumer.id,
      producerId: producer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  async resumeConsumer(userId: string, producerId: string) {
    const userConsumers = this.consumers.get(userId);
    if (!userConsumers) {
      this.logger.warn(`resumeConsumer: No consumers found for user ${userId}`);
      return;
    }
    const consumer = userConsumers.get(producerId);
    if (consumer) {
      this.logger.log(`Resuming consumer: user ${userId} consuming producer ${producerId}`);
      await consumer.resume();
      this.logger.log(`Consumer resumed: user ${userId} consuming producer ${producerId}, paused: ${consumer.paused}`);
    } else {
      this.logger.warn(`resumeConsumer: Consumer not found for user ${userId} and producer ${producerId}`);
    }
  }

  async pauseConsumer(userId: string, producerId: string) {
    const consumer = this.consumers.get(userId)?.get(producerId);
    if (consumer) {
      await consumer.pause();
    }
  }

  async setForceCall(roomId: string, enabled: boolean) {
    if (enabled) {
      this.forceCallRooms.add(roomId);
    } else {
      this.forceCallRooms.delete(roomId);
    }
    this.logger.log(`Force call ${enabled ? 'enabled' : 'disabled'} for room ${roomId}`);
    await this.updateRouting(roomId);
  }

  async updateRouting(roomId: string) {
    const room = await this.roomsService.findOne(roomId);
    if (!room) return;

    const users = room.users;
    this.logger.log(`Updating routing for room ${roomId}. Users in room: ${users.length}`);
    
    for (const userA of users) {
      const userAConsumers = this.consumers.get(userA.id);
      if (!userAConsumers) {
        this.logger.debug(`No consumers map for user ${userA.id}, skipping routing update for them`);
        continue;
      }

      for (const userB of users) {
        if (userA.id === userB.id) continue;

        const producerB = this.producers.get(userB.id);
        if (!producerB) continue;

        const consumer = userAConsumers.get(producerB.id);
        if (!consumer) continue;

        const canCommunicate = this.checkCommunication(userA, userB, room);
        if (canCommunicate) {
          if (consumer.paused) {
            this.logger.log(`Resuming consumer for user ${userA.id} from producer of user ${userB.id} (routing update)`);
            await consumer.resume();
          }
        } else {
          if (!consumer.paused) {
            this.logger.log(`Pausing consumer for user ${userA.id} from producer of user ${userB.id} (routing update)`);
            await consumer.pause();
          }
        }
      }
    }
  }

  private checkCommunication(userA: any, userB: any, room: any): boolean {
    // 强制呼叫模式：无视所有规则，所有人互通
    if (this.forceCallRooms.has(userA.roomId)) return true;

    const roomStatus = room.status;
    const leaderId = room.leaderId;

    if (roomStatus === 'preparing') return true;
    
    // 未分队用户在攻坚模式下无法通信 (除非是团长)
    const isALeader = userA.id === leaderId;
    const isBLeader = userB.id === leaderId;

    if (!userA.teamId && !isALeader) return false;
    if (!userB.teamId && !isBLeader) return false;

    // 攻坚模式规则 (双向通信)
    
    // 团长 <-> 所有队长
    if (isALeader && userB.roomRole === 'captain') return true;
    if (isBLeader && userA.roomRole === 'captain') return true;
    
    // 队长 <-> 队长
    if (userA.roomRole === 'captain' && userB.roomRole === 'captain') return true;
    
    // 队长 <-> 同队队员
    if (userA.roomRole === 'captain' && userB.teamId === userA.teamId) return true;
    if (userB.roomRole === 'captain' && userA.teamId === userB.teamId) return true;
    
    // 队员 <-> 队员 (同队)
    if (userA.teamId === userB.teamId && userA.teamId !== null) return true;

    // 团长 <-> 自己所在队的队员
    if (isALeader && userA.teamId && userB.teamId === userA.teamId) return true;
    if (isBLeader && userB.teamId && userA.teamId === userB.teamId) return true;

    return false;
  }
}
