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

  private readonly logger = new Logger(AudioService.name);

  constructor(
    @Inject(forwardRef(() => RoomsService))
    private roomsService: RoomsService,
    @Inject(forwardRef(() => GatewayService))
    private gatewayService: GatewayService,
  ) {}

  async onModuleInit() {
    await this.createWorker();
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
        threshold: -60, // 音量阈值（dB）
      });

      audioLevelObserver.on('volumes', (volumes) => {
        const { producer, volume } = volumes[0];
        // 找到该 producer 对应的用户
        for (const [userId, p] of this.producers.entries()) {
          if (p.id === producer.id) {
            // 广播该用户正在说话
            this.gatewayService.broadcastUserSpeaking(roomId, userId, true);
          }
        }
      });

      audioLevelObserver.on('silence', () => {
        // 全员静音通知（或根据需要细化）
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

    // 将新 Producer 加入音量观察器
    const observer = this.audioLevelObservers.get(roomId);
    if (observer && kind === 'audio') {
      await observer.addProducer({ producerId: producer.id });
    }

    producer.on('transportclose', () => {
      producer.close();
      this.producers.delete(userId);
    });

    return { id: producer.id };
  }

  async createConsumer(roomId: string, transportId: string, producerUserId: string, rtpCapabilities: any, userId: string) {
    const router = await this.getOrCreateRouter(roomId);
    const producer = this.producers.get(producerUserId);

    if (!producer) throw new Error(`Producer for user ${producerUserId} not found`);

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

    consumer.on('transportclose', () => {
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
    const consumer = this.consumers.get(userId)?.get(producerId);
    if (consumer) {
      await consumer.resume();
    }
  }

  async pauseConsumer(userId: string, producerId: string) {
    const consumer = this.consumers.get(userId)?.get(producerId);
    if (consumer) {
      await consumer.pause();
    }
  }

  async updateRouting(roomId: string) {
    const room = await this.roomsService.findOne(roomId);
    if (!room) return;

    const users = room.users;
    
    for (const userA of users) {
      const userAConsumers = this.consumers.get(userA.id);
      if (!userAConsumers) continue;

      for (const userB of users) {
        if (userA.id === userB.id) continue;

        const producerB = this.producers.get(userB.id);
        if (!producerB) continue;

        const consumer = userAConsumers.get(producerB.id);
        if (!consumer) continue;

        const canCommunicate = this.checkCommunication(userA, userB, room.status);
        if (canCommunicate) {
          await consumer.resume();
        } else {
          await consumer.pause();
        }
      }
    }
  }

  private checkCommunication(userA: any, userB: any, roomStatus: string): boolean {
    if (roomStatus === 'preparing') return true;
    
    // Unassigned users in assault mode cannot communicate
    if (!userA.teamId && userA.roomRole !== 'leader') return false;
    if (!userB.teamId && userB.roomRole !== 'leader') return false;

    // Assault mode rules (Dual-way)
    
    // Leader <-> All Captains
    if (userA.roomRole === 'leader' && userB.roomRole === 'captain') return true;
    if (userB.roomRole === 'leader' && userA.roomRole === 'captain') return true;
    
    // Captain <-> Captain
    if (userA.roomRole === 'captain' && userB.roomRole === 'captain') return true;
    
    // Captain <-> Team Members (same team)
    if (userA.roomRole === 'captain' && userB.teamId === userA.teamId) return true;
    if (userB.roomRole === 'captain' && userA.teamId === userB.teamId) return true;
    
    // Member <-> Member (same team)
    if (userA.teamId === userB.teamId && userA.teamId !== null) return true;

    // Leader <-> Team Members (same team)
    if (userA.roomRole === 'leader' && userA.teamId && userB.teamId === userA.teamId) return true;
    if (userB.roomRole === 'leader' && userB.teamId && userA.teamId === userB.teamId) return true;

    return false;
  }
}
