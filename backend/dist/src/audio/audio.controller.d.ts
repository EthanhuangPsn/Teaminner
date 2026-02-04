import { AgoraService } from './agora.service';
import { AudioService } from './audio.service';
export declare class AudioController {
    private readonly agoraService;
    private readonly audioService;
    constructor(agoraService: AgoraService, audioService: AudioService);
    getToken(channelName: string, req: any): Promise<{
        token: string;
        appId: string;
        uid: number;
    }>;
}
