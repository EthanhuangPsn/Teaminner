import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findOne(id: string): Promise<{
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
    }>;
}
