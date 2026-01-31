"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AudioService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioService = void 0;
const common_1 = require("@nestjs/common");
const mediasoup = __importStar(require("mediasoup"));
const mediasoup_config_1 = require("./mediasoup-config");
const rooms_service_1 = require("../rooms/rooms.service");
const gateway_service_1 = require("../gateway/gateway.service");
let AudioService = AudioService_1 = class AudioService {
    roomsService;
    gatewayService;
    worker;
    routers = new Map();
    audioLevelObservers = new Map();
    transports = new Map();
    producers = new Map();
    consumers = new Map();
    logger = new common_1.Logger(AudioService_1.name);
    constructor(roomsService, gatewayService) {
        this.roomsService = roomsService;
        this.gatewayService = gatewayService;
    }
    async onModuleInit() {
        await this.createWorker();
    }
    async createWorker() {
        this.worker = await mediasoup.createWorker(mediasoup_config_1.config.worker);
        this.worker.on('died', () => {
            this.logger.error('mediasoup worker died, exiting in 2 seconds...');
            setTimeout(() => process.exit(1), 2000);
        });
        this.logger.log('mediasoup worker created');
    }
    async getOrCreateRouter(roomId) {
        let router = this.routers.get(roomId);
        if (!router) {
            router = await this.worker.createRouter(mediasoup_config_1.config.router);
            this.routers.set(roomId, router);
            const audioLevelObserver = await router.createAudioLevelObserver({
                interval: 300,
                threshold: -60,
            });
            audioLevelObserver.on('volumes', (volumes) => {
                const { producer, volume } = volumes[0];
                for (const [userId, p] of this.producers.entries()) {
                    if (p.id === producer.id) {
                        this.gatewayService.broadcastUserSpeaking(roomId, userId, true);
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
    async createWebRtcTransport(roomId) {
        const router = await this.getOrCreateRouter(roomId);
        const transport = await router.createWebRtcTransport(mediasoup_config_1.config.webRtcTransport);
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
    async connectTransport(transportId, dtlsParameters) {
        const transport = this.transports.get(transportId);
        if (!transport)
            throw new Error(`Transport ${transportId} not found`);
        await transport.connect({ dtlsParameters });
    }
    async createProducer(transportId, kind, rtpParameters, userId, roomId) {
        const transport = this.transports.get(transportId);
        if (!transport)
            throw new Error(`Transport ${transportId} not found`);
        const producer = await transport.produce({ kind, rtpParameters });
        this.producers.set(userId, producer);
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
    async createConsumer(roomId, transportId, producerUserId, rtpCapabilities, userId) {
        const router = await this.getOrCreateRouter(roomId);
        const producer = this.producers.get(producerUserId);
        if (!producer)
            throw new Error(`Producer for user ${producerUserId} not found`);
        if (!router.canConsume({ producerId: producer.id, rtpCapabilities })) {
            throw new Error('cannot consume');
        }
        const transport = this.transports.get(transportId);
        if (!transport)
            throw new Error(`Transport ${transportId} not found`);
        const consumer = await transport.consume({
            producerId: producer.id,
            rtpCapabilities,
            paused: true,
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
    async resumeConsumer(userId, producerId) {
        const consumer = this.consumers.get(userId)?.get(producerId);
        if (consumer) {
            await consumer.resume();
        }
    }
    async pauseConsumer(userId, producerId) {
        const consumer = this.consumers.get(userId)?.get(producerId);
        if (consumer) {
            await consumer.pause();
        }
    }
    async updateRouting(roomId) {
        const room = await this.roomsService.findOne(roomId);
        if (!room)
            return;
        const users = room.users;
        for (const userA of users) {
            const userAConsumers = this.consumers.get(userA.id);
            if (!userAConsumers)
                continue;
            for (const userB of users) {
                if (userA.id === userB.id)
                    continue;
                const producerB = this.producers.get(userB.id);
                if (!producerB)
                    continue;
                const consumer = userAConsumers.get(producerB.id);
                if (!consumer)
                    continue;
                const canCommunicate = this.checkCommunication(userA, userB, room.status);
                if (canCommunicate) {
                    await consumer.resume();
                }
                else {
                    await consumer.pause();
                }
            }
        }
    }
    checkCommunication(userA, userB, roomStatus) {
        if (roomStatus === 'preparing')
            return true;
        if (!userA.teamId && userA.roomRole !== 'leader')
            return false;
        if (!userB.teamId && userB.roomRole !== 'leader')
            return false;
        if (userA.roomRole === 'leader' && userB.roomRole === 'captain')
            return true;
        if (userB.roomRole === 'leader' && userA.roomRole === 'captain')
            return true;
        if (userA.roomRole === 'captain' && userB.roomRole === 'captain')
            return true;
        if (userA.roomRole === 'captain' && userB.teamId === userA.teamId)
            return true;
        if (userB.roomRole === 'captain' && userA.teamId === userB.teamId)
            return true;
        if (userA.teamId === userB.teamId && userA.teamId !== null)
            return true;
        if (userA.roomRole === 'leader' && userA.teamId && userB.teamId === userA.teamId)
            return true;
        if (userB.roomRole === 'leader' && userB.teamId && userA.teamId === userB.teamId)
            return true;
        return false;
    }
};
exports.AudioService = AudioService;
exports.AudioService = AudioService = AudioService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => rooms_service_1.RoomsService))),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => gateway_service_1.GatewayService))),
    __metadata("design:paramtypes", [rooms_service_1.RoomsService,
        gateway_service_1.GatewayService])
], AudioService);
//# sourceMappingURL=audio.service.js.map