import { TeamsService } from './teams.service';
export declare class TeamsController {
    private readonly teamsService;
    constructor(teamsService: TeamsService);
    joinTeam(id: string, user: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        username: string;
        avatar: string | null;
        micEnabled: boolean;
        speakerEnabled: boolean;
        isSpeaking: boolean;
        password: string | null;
        accountType: string;
        accountRole: string;
        roomRole: string | null;
        lastIp: string | null;
        deviceFingerprint: string | null;
        lastActiveAt: Date;
        teamId: string | null;
        isOnline: boolean;
        roomId: string | null;
    }>;
    leaveTeam(user: any): Promise<void>;
    setCaptain(id: string, userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        username: string;
        avatar: string | null;
        micEnabled: boolean;
        speakerEnabled: boolean;
        isSpeaking: boolean;
        password: string | null;
        accountType: string;
        accountRole: string;
        roomRole: string | null;
        lastIp: string | null;
        deviceFingerprint: string | null;
        lastActiveAt: Date;
        teamId: string | null;
        isOnline: boolean;
        roomId: string | null;
    }>;
    enableTeam(id: string, enabled: boolean): Promise<{
        id: string;
        isEnabled: boolean;
        createdAt: Date;
        updatedAt: Date;
        teamColor: string;
        captainId: string | null;
        roomId: string;
    }>;
}
