export declare class AgoraService {
    private readonly appId;
    private readonly appCertificate;
    generateToken(channelName: string, uid: string, role?: number): string;
    getNumericUid(uid: string): number;
    private stringToUid;
    getAppId(): string;
    updateRouting(roomId: string): Promise<void>;
}
