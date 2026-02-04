import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';

export class AgoraManager {
  private client: IAgoraRTCClient;
  private localAudioTrack: IMicrophoneAudioTrack | null = null;
  private appId: string;
  private channelName: string;
  private uid: string | number;
  private token: string;
  
  // 存储远程用户的音频轨道
  private remoteTracks: Map<string, IRemoteAudioTrack> = new Map();
  // 当前被允许收听的用户 ID 列表
  private allowedUserIds: Set<string> = new Set();

  constructor(appId: string, channelName: string, uid: string | number, token: string) {
    this.appId = appId;
    this.channelName = channelName;
    this.uid = uid;
    this.token = token;
    
    console.log(`[AgoraManager] Initializing with UID: ${uid} (type: ${typeof uid})`);
    
    this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    
    // 监听远程用户发布
    this.client.on('user-published', async (user, mediaType) => {
      console.log(`[AgoraManager] Remote user ${user.uid} published ${mediaType}`);
      if (mediaType === 'audio') {
        const track = await this.client.subscribe(user, mediaType);
        const uidStr = user.uid.toString();
        this.remoteTracks.set(uidStr, track);
        
        // 核心修复：当用户新上线时，必须严防死守名单
        if (this.allowedUserIds.has(uidStr)) {
          console.log(`[AgoraManager] UID ${uidStr} is in ALLOWED list, starting playback.`);
          track.play();
        } else {
          console.log(`[AgoraManager] UID ${uidStr} is NOT in allowed list, keeping MUTE.`);
          // 确保停止任何可能的播放
          track.stop();
        }
      }
    });

    this.client.on('user-unpublished', (user) => {
      this.remoteTracks.delete(user.uid.toString());
    });
  }

  async join() {
    try {
      await this.client.join(this.appId, this.channelName, this.token, this.uid);
    } catch (err: any) {
      if (err.code === 'UID_CONFLICT') {
        // 如果已经加入，则不再尝试
        return;
      }
      throw err;
    }
  }

  async publish() {
    if (!this.localAudioTrack) {
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        ANS: true,
        AGC: true,
      });
    }
    await this.client.publish(this.localAudioTrack);
  }

  async unpublish() {
    if (this.localAudioTrack) {
      await this.client.unpublish(this.localAudioTrack);
      this.localAudioTrack.stop();
      this.localAudioTrack.close();
      this.localAudioTrack = null;
    }
  }

  async leave() {
    await this.unpublish();
    await this.client.leave();
  }

  // 核心路由控制：更新允许收听的列表
  updateAllowedUsers(allowedUserIds: string[]) {
    // 强制转换为字符串 Set 确保匹配稳定
    this.allowedUserIds = new Set(allowedUserIds.map(id => id.toString()));
    console.log('[AgoraManager] Internal allowed list updated:', Array.from(this.allowedUserIds));
    
    // 对已经存在的音轨进行播放/停止控制
    this.remoteTracks.forEach((track, uid) => {
      const uidStr = uid.toString();
      if (this.allowedUserIds.has(uidStr)) {
        // 在名单中 -> 播放
        console.log(`[AgoraManager] Routing: ENABLE audio for ${uidStr}`);
        track.play();
      } else {
        // 不在名单中 -> 强制停止播放
        console.log(`[AgoraManager] Routing: MUTE audio for ${uidStr} (not in allowed list)`);
        track.stop();
      }
    });
  }

  setVolume(volume: number) {
    this.remoteTracks.forEach(track => {
      track.setVolume(volume);
    });
  }

  getInternalClient() {
    return this.client;
  }

  getUid() {
    return this.uid;
  }
}
