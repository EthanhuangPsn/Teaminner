import { PrismaService } from '../prisma/prisma.service';
import { RoomsService } from '../rooms/rooms.service';
export declare class CleanupService {
    private prisma;
    private roomsService;
    private readonly logger;
    constructor(prisma: PrismaService, roomsService: RoomsService);
    handleCleanup(): Promise<void>;
}
