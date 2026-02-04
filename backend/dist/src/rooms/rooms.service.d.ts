import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { GatewayService } from '../gateway/gateway.service';
import { AudioService } from '../audio/audio.service';
export declare class RoomsService {
    private prisma;
    private gatewayService;
    private audioService;
    constructor(prisma: PrismaService, gatewayService: GatewayService, audioService: AudioService);
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
            roomId: string | null;
            password: string | null;
            accountType: string;
            accountRole: string;
            roomRole: string | null;
            lastIp: string | null;
            deviceFingerprint: string | null;
            lastActiveAt: Date;
            isOnline: boolean;
            teamId: string | null;
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
                roomId: string | null;
                password: string | null;
                accountType: string;
                accountRole: string;
                roomRole: string | null;
                lastIp: string | null;
                deviceFingerprint: string | null;
                lastActiveAt: Date;
                isOnline: boolean;
                teamId: string | null;
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
    muteAllUsers(roomId: string): Promise<void>;
    clearAllUserStatuses(): Promise<void>;
    joinRoom(roomId: string, userId: string): Promise<{
        users: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            username: string;
            avatar: string | null;
            micEnabled: boolean;
            speakerEnabled: boolean;
            isSpeaking: boolean;
            roomId: string | null;
            password: string | null;
            accountType: string;
            accountRole: string;
            roomRole: string | null;
            lastIp: string | null;
            deviceFingerprint: string | null;
            lastActiveAt: Date;
            isOnline: boolean;
            teamId: string | null;
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
                roomId: string | null;
                password: string | null;
                accountType: string;
                accountRole: string;
                roomRole: string | null;
                lastIp: string | null;
                deviceFingerprint: string | null;
                lastActiveAt: Date;
                isOnline: boolean;
                teamId: string | null;
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
    leaveRoom(userId: string): Promise<{
        success: boolean;
    } | undefined>;
    toggleStatus(roomId: string, status: 'preparing' | 'assaulting'): Promise<{
        id: string;
        roomName: string;
        status: string;
        maxUsers: number;
        isEnabled: boolean;
        leaderId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    transferLeader(roomId: string, targetUserId: string): Promise<{
        success: boolean;
    }>;
}
