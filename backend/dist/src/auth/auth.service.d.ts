import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { GuestLoginDto } from './dto/guest-login.dto';
export declare class AuthService {
    private prisma;
    private jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    guestLogin(dto: GuestLoginDto): Promise<{
        access_token: string;
        user: {
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
        };
    }>;
    validateUserById(userId: string): Promise<{
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
    } | null>;
}
