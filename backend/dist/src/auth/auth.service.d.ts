import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { GuestLoginDto } from './dto/guest-login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private prisma;
    private jwtService;
    private adminConfig;
    private readonly logger;
    constructor(prisma: PrismaService, jwtService: JwtService);
    private loadAdminConfig;
    register(dto: RegisterDto): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            avatar: any;
            accountType: any;
            accountRole: any;
        };
    }>;
    login(dto: LoginDto, ip?: string, fingerprint?: string): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            avatar: any;
            accountType: any;
            accountRole: any;
        };
    }>;
    guestLogin(dto: GuestLoginDto, ip?: string, fingerprint?: string): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            avatar: any;
            accountType: any;
            accountRole: any;
        };
    }>;
    autoLoginByIp(ip: string, fingerprint?: string): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            avatar: any;
            accountType: any;
            accountRole: any;
        };
    } | null>;
    getProfileByToken(token: string): Promise<{
        user: {
            id: string;
            username: string;
            avatar: string | null;
            accountType: string;
            accountRole: string;
        };
    } | null>;
    private updateIpBinding;
    purgeAndBackupData(): Promise<{
        message: string;
        backupFile: string;
        purgedCounts: {
            users: number;
            rooms: number;
            teams: number;
            ipBindings: number;
        };
    }>;
    private generateToken;
    validateUserById(userId: string): Promise<{
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
    } | null>;
}
