import * as mediasoupClient from 'mediasoup-client';
import { Socket } from 'socket.io-client';

export class WebRTCManager {
  private device: mediasoupClient.types.Device | null = null;
  private sendTransport: mediasoupClient.types.Transport | null = null;
  private recvTransport: mediasoupClient.types.Transport | null = null;
  private producer: mediasoupClient.types.Producer | null = null;
  private consumers: Map<string, mediasoupClient.types.Consumer> = new Map();
  private socket: Socket;
  private roomId: string;
  private userId: string;

  private isReconnecting = false;
  private onConnectionStateChange?: (state: { send: string, recv: string }) => void;

  constructor(socket: Socket, roomId: string, userId: string, onConnectionStateChange?: (state: { send: string, recv: string }) => void) {
    this.socket = socket;
    this.roomId = roomId;
    this.userId = userId;
    this.onConnectionStateChange = onConnectionStateChange;
  }

  public getIceState() {
    return {
      send: this.sendTransport?.connectionState || 'none',
      recv: this.recvTransport?.connectionState || 'none'
    };
  }

  private triggerStateChange() {
    if (this.onConnectionStateChange) {
      this.onConnectionStateChange(this.getIceState());
    }
  }

  async init() {
    try {
      // 1. Get router RTP capabilities
      const routerRtpCapabilities = await this.emitPromise('getRouterRtpCapabilities', this.roomId);

      // 2. Load device
      if (!this.device) {
        this.device = new mediasoupClient.Device();
        await this.device.load({ routerRtpCapabilities });
      }

      console.log('Device loaded', this.device.handlerName);

      // 3. Create transports
      await this.createSendTransport();
      await this.createRecvTransport();

      this.triggerStateChange();
      return true;
    } catch (error) {
      console.error('WebRTC init failed:', error);
      return false;
    }
  }

  private async reconnect() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;
    console.log('[WebRTC] Connection lost, attempting self-healing in 2s...');
    
    // Notify UI (via state change)
    this.triggerStateChange();

    await new Promise(r => setTimeout(r, 2000));

    try {
      // 1. Cleanup old state but keep the device
      const oldProducerTrack = this.producer?.track;
      this.close(true); // Close but keep device

      // 2. Re-init
      const success = await this.init();
      
      if (success && oldProducerTrack) {
        // 3. If we were producing, try to resume
        console.log('[WebRTC] Re-init success, resuming production...');
        await this.startProducing(oldProducerTrack);
      }
      
      console.log('[WebRTC] Self-healing completed.');
    } catch (err) {
      console.error('[WebRTC] Self-healing failed:', err);
    } finally {
      this.isReconnecting = false;
      this.triggerStateChange();
    }
  }

  private async createSendTransport() {
    const data = await this.emitPromise('createWebRtcTransport', this.roomId);
    
    this.sendTransport = this.device!.createSendTransport({
      ...data,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await this.emitPromise('connectWebRtcTransport', { transportId: this.sendTransport!.id, dtlsParameters });
        callback();
      } catch (error: any) {
        errback(error);
      }
    });

    this.sendTransport.on('connectionstatechange', (state) => {
      console.log('[WebRTC] Send transport state:', state);
      this.triggerStateChange();
      if (state === 'failed' || state === 'disconnected') {
        this.reconnect();
      }
    });

    this.sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
      try {
        const { id } = await this.emitPromise('produce', {
          transportId: this.sendTransport!.id,
          kind,
          rtpParameters,
          userId: this.userId,
          roomId: this.roomId,
        });
        callback({ id });
      } catch (error: any) {
        errback(error);
      }
    });
  }

  private async createRecvTransport() {
    const data = await this.emitPromise('createWebRtcTransport', this.roomId);
    
    this.recvTransport = this.device!.createRecvTransport({
      ...data,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await this.emitPromise('connectWebRtcTransport', { transportId: this.recvTransport!.id, dtlsParameters });
        callback();
      } catch (error: any) {
        errback(error);
      }
    });

    this.recvTransport.on('connectionstatechange', (state) => {
      console.log('[WebRTC] Recv transport state:', state);
      this.triggerStateChange();
      if (state === 'failed' || state === 'disconnected') {
        this.reconnect();
      }
    });
  }

  async startProducing(track: MediaStreamTrack) {
    if (!this.sendTransport) return;
    
    // If already producing, close old producer
    if (this.producer) {
      this.producer.close();
    }
    
    console.log(`Starting to produce track: ${track.kind}, id: ${track.id}, enabled: ${track.enabled}, state: ${track.readyState}`);
    
    this.producer = await this.sendTransport.produce({ track });
    
    this.producer.on('transportclose', () => {
      console.log('Producer transport closed');
    });

    this.producer.on('trackended', () => {
      console.log('Producer track ended');
    });

    return this.producer;
  }

  async consume(producerUserId: string) {
    if (!this.recvTransport || !this.device) return;

    try {
      const data = await this.emitPromise('consume', {
        roomId: this.roomId,
        transportId: this.recvTransport.id,
        producerUserId,
        rtpCapabilities: this.device.rtpCapabilities,
        userId: this.userId,
      });

      const consumer = await this.recvTransport.consume(data);
      this.consumers.set(producerUserId, consumer);

      consumer.on('transportclose', () => {
        this.consumers.delete(producerUserId);
      });

      // Notify server to resume
      await this.emitPromise('resumeConsumer', { userId: this.userId, producerId: consumer.producerId });

      return consumer;
    } catch (err) {
      console.error(`[WebRTC] Consume failed for ${producerUserId}:`, err);
      return null;
    }
  }

  private emitPromise(event: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket.emit(event, data, (response: any) => {
        if (response && response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });
  }

  close(keepDevice = false) {
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.producer?.close();
    this.consumers.forEach(c => c.close());
    this.consumers.clear();
    
    this.sendTransport = null;
    this.recvTransport = null;
    this.producer = null;

    if (!keepDevice) {
      this.device = null;
    }
  }
}
