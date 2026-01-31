import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { GatewayService } from '../gateway/gateway.service';
export declare class UsersService {
    private prisma;
    private gatewayService;
    constructor(prisma: PrismaService, gatewayService: GatewayService);
    findOne(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        username: string;
        avatar: string | null;
        micEnabled: boolean;
        speakerEnabled: boolean;
        isSpeaking: boolean;
        accountType: string;
        accountRole: string;
        roomRole: string | null;
        teamId: string | null;
        isOnline: boolean;
        roomId: string | null;
    }>;
    update(id: string, updateUserDto: UpdateUserDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        username: string;
        avatar: string | null;
        micEnabled: boolean;
        speakerEnabled: boolean;
        isSpeaking: boolean;
        accountType: string;
        accountRole: string;
        roomRole: string | null;
        teamId: string | null;
        isOnline: boolean;
        roomId: string | null;
    }>;
}
