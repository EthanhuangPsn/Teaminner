import { AuthService } from './auth.service';
import { GuestLoginDto } from './dto/guest-login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(registerDto: RegisterDto): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            avatar: any;
            accountType: any;
            accountRole: any;
        };
    }>;
    login(loginDto: LoginDto, ip: string, fingerprint?: string): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            avatar: any;
            accountType: any;
            accountRole: any;
        };
    }>;
    guestLogin(dto: GuestLoginDto, ip: string, fingerprint?: string): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            avatar: any;
            accountType: any;
            accountRole: any;
        };
    }>;
    autoLogin(ip: string, fingerprint?: string): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            avatar: any;
            accountType: any;
            accountRole: any;
        };
    } | null>;
    getProfile(auth: string): Promise<{
        user: {
            id: string;
            username: string;
            avatar: string | null;
            accountType: string;
            accountRole: string;
        };
    } | null>;
    purgeData(): Promise<{
        message: string;
        backupFile: string;
        purgedCounts: {
            users: number;
            rooms: number;
            teams: number;
            ipBindings: number;
        };
    }>;
}
