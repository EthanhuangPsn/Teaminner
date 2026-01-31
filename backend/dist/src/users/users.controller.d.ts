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
