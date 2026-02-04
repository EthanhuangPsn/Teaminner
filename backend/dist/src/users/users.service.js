"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const gateway_service_1 = require("../gateway/gateway.service");
const audio_service_1 = require("../audio/audio.service");
let UsersService = class UsersService {
    prisma;
    gatewayService;
    audioService;
    constructor(prisma, gatewayService, audioService) {
        this.prisma = prisma;
        this.gatewayService = gatewayService;
        this.audioService = audioService;
    }
    async findOne(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async update(id, updateUserDto) {
        const user = await this.prisma.user.update({
            where: { id },
            data: updateUserDto,
        });
        if (user.roomId) {
            const room = await this.prisma.room.findUnique({
                where: { id: user.roomId },
                include: {
                    users: true,
                    teams: {
                        include: { members: true },
                    },
                },
            });
            if (room) {
                this.gatewayService.broadcastRoomUpdate(user.roomId, room);
            }
            if (updateUserDto.micEnabled !== undefined || updateUserDto.speakerEnabled !== undefined) {
                await this.audioService.updateRouting(user.roomId);
            }
        }
        return user;
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => audio_service_1.AudioService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        gateway_service_1.GatewayService,
        audio_service_1.AudioService])
], UsersService);
//# sourceMappingURL=users.service.js.map