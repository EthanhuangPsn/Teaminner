import { Injectable } from '@nestjs/common';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

@Injectable()
export class AgoraService {
  // 注意：在实际生产中，这些应该从环境变量或配置文件加载
  private readonly appId = 'bf9228d5a3f4461281a8093d60214c0a'.trim();
  private readonly appCertificate = '43c0a854276c426ead446845ea2a1f29'.trim();

  generateToken(channelName: string, uid: string, role: number = RtcRole.PUBLISHER): string {
    const expire = 3600;
    const numericUid = this.stringToUid(uid);
    
    // 增加调试日志
    console.log(`[AgoraService] Generating token for channel: ${channelName}, numericUid: ${numericUid}, role: ${role}`);

    const token = RtcTokenBuilder.buildTokenWithUid(
      this.appId,
      this.appCertificate,
      channelName,
      numericUid,
      role,
      expire,
      expire
    );
    return token;
  }

  getNumericUid(uid: string): number {
    return this.stringToUid(uid);
  }

  // 辅助方法：将 UUID 字符串安全转换为 32 位正整数 (取 UUID 最后 8 位)
  private stringToUid(str: string): number {
    if (!str || typeof str !== 'string') {
      console.warn('[AgoraService] Invalid UID string provided:', str);
      return 0;
    }
    // 去掉连字符
    const cleanStr = str.replace(/-/g, '');
    // 取最后 8 位十六进制字符并转换为整数
    // 这样可以确保得到一个稳定的、32位范围内的正整数
    const hex = cleanStr.slice(-8);
    const uid = parseInt(hex, 16);
    return uid || 12345; // 兜底，不返回 0
  }

  getAppId(): string {
    return this.appId;
  }

  // 桥接方法，调用 AudioService 的 updateRouting
  async updateRouting(roomId: string) {
    // 注入 AudioService 可能导致循环依赖，所以我们通过注入的实例调用
    // 这里我们先在 AudioService 中实现
  }
}
