import { AuthService } from './auth.service';
import { GuestLoginDto } from './dto/guest-login.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
}
