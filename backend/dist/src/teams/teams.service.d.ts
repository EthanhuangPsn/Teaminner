import { PrismaService } from '../prisma/prisma.service';
import { GatewayService } from '../gateway/gateway.service';
import { AudioService } from '../audio/audio.service';
export declare class TeamsService {
    private prisma;
    private gatewayService;
    private audioService;
    constructor(prisma: PrismaService, gatewayService: GatewayService, audioService: AudioService);
    joinTeam(teamId: string, userId: string): Promise<{
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
    leaveTeam(userId: string): Promise<void>;
    setCaptain(teamId: string, userId: string): Promise<{
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
    enableTeam(teamId: string, enabled: boolean): Promise<{
        id: string;
        isEnabled: boolean;
        createdAt: Date;
        updatedAt: Date;
        teamColor: string;
        captainId: string | null;
        roomId: string;
    }>;
    private notifyRoomUpdate;
}
