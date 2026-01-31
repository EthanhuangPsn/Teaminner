import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
export declare class RoomsController {
    private readonly roomsService;
    constructor(roomsService: RoomsService);
    create(createRoomDto: CreateRoomDto): Promise<{
        id: string;
        roomName: string;
        status: string;
        maxUsers: number;
        isEnabled: boolean;
        leaderId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(): Promise<({
        _count: {
            users: number;
        };
    } & {
        id: string;
        roomName: string;
        status: string;
        maxUsers: number;
        isEnabled: boolean;
        leaderId: string | null;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    findOne(id: string): Promise<{
        users: {
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
        }[];
        teams: ({
            members: {
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
            }[];
        } & {
            id: string;
            isEnabled: boolean;
            createdAt: Date;
            updatedAt: Date;
            teamColor: string;
            captainId: string | null;
            roomId: string;
        })[];
    } & {
        id: string;
        roomName: string;
        status: string;
        maxUsers: number;
        isEnabled: boolean;
        leaderId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    joinRoom(id: string, user: any): Promise<{
        users: {
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
        }[];
        teams: ({
            members: {
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
            }[];
        } & {
            id: string;
            isEnabled: boolean;
            createdAt: Date;
            updatedAt: Date;
            teamColor: string;
            captainId: string | null;
            roomId: string;
        })[];
    } & {
        id: string;
        roomName: string;
        status: string;
        maxUsers: number;
        isEnabled: boolean;
        leaderId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    leaveRoom(user: any): Promise<{
        success: boolean;
    } | undefined>;
    toggleStatus(id: string, status: 'preparing' | 'assaulting'): Promise<{
        id: string;
        roomName: string;
        status: string;
        maxUsers: number;
        isEnabled: boolean;
        leaderId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    transferLeader(id: string, targetUserId: string): Promise<{
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
}
