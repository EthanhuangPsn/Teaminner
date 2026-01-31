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
var CleanupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleanupService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const rooms_service_1 = require("../rooms/rooms.service");
let CleanupService = CleanupService_1 = class CleanupService {
    prisma;
    roomsService;
    logger = new common_1.Logger(CleanupService_1.name);
    constructor(prisma, roomsService) {
        this.prisma = prisma;
        this.roomsService = roomsService;
    }
    async handleCleanup() {
        this.logger.log('Starting daily cleanup of expired guests and IP records...');
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const expiredGuests = await this.prisma.user.findMany({
            where: {
                accountType: 'guest',
                lastActiveAt: { lt: oneDayAgo },
            },
        });
        this.logger.log(`Found ${expiredGuests.length} expired guest users.`);
        for (const guest of expiredGuests) {
            try {
                if (guest.roomId) {
                    await this.roomsService.leaveRoom(guest.id);
                }
                await this.prisma.user.delete({ where: { id: guest.id } });
            }
            catch (error) {
                this.logger.error(`Failed to clean up guest ${guest.id}: ${error.message}`);
            }
        }
        const deletedBindings = await this.prisma.ipBinding.deleteMany({
            where: {
                lastActiveAt: { lt: oneDayAgo },
            },
        });
        this.logger.log(`Deleted ${deletedBindings.count} expired IP binding records.`);
        this.logger.log('Daily cleanup completed.');
    }
};
exports.CleanupService = CleanupService;
exports.CleanupService = CleanupService = CleanupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        rooms_service_1.RoomsService])
], CleanupService);
//# sourceMappingURL=cleanup.service.js.map