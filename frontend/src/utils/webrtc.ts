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

  constructor(socket: Socket, roomId: string, userId: string) {
    this.socket = socket;
    this.roomId = roomId;
    this.userId = userId;
  }

  public getIceState() {
    return {
      send: this.sendTransport?.connectionState || 'none',
      recv: this.recvTransport?.connectionState || 'none'
    };
  }

  async init() {
    try {
      // 1. Get router RTP capabilities
      const routerRtpCapabilities = await this.emitPromise('getRouterRtpCapabilities', this.roomId);

      // 2. Load device
      this.device = new mediasoupClient.Device();
      await this.device.load({ routerRtpCapabilities });

      console.log('Device loaded', this.device.handlerName);

      // 3. Create transports
      await this.createSendTransport();
      await this.createRecvTransport();

      return true;
    } catch (error) {
      console.error('WebRTC init failed:', error);
      return false;
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
      // console.log('Send transport connection state:', state);
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
      // console.log('Recv transport connection state:', state);
    });
  }

  async startProducing(track: MediaStreamTrack) {
    if (!this.sendTransport) return;
    
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

  close() {
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.producer?.close();
    this.consumers.forEach(c => c.close());
    this.consumers.clear();
  }
}
