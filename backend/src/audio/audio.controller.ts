import { Controller, Get, Query, UseGuards, Req, Inject, forwardRef } from '@nestjs/common';
import { AgoraService } from './agora.service';
import { AudioService } from './audio.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('audio')
export class AudioController {
  constructor(
    private readonly agoraService: AgoraService,
    @Inject(forwardRef(() => AudioService))
    private readonly audioService: AudioService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('token')
  async getToken(@Query('channelName') channelName: string, @Req() req: any) {
    // 增加详细日志排查 req.user 结构
    console.log('[Audio] Token request for user:', JSON.stringify(req.user));
    
    // 兼容多种可能的 ID 字段名
    const userId = req.user.userId || req.user.id || req.user.sub;
    
    if (!userId) {
      console.error('[Audio] No userId found in req.user:', req.user);
      throw new Error('User identity not found in request');
    }

    const token = this.agoraService.generateToken(channelName, userId);
    const numericUid = this.agoraService.getNumericUid(userId);
    
    console.log(`[Audio] Generated token for user ${userId} (numericUid: ${numericUid})`);
    
    // 强制触发一次路由更新，确保新加入的用户能立刻拿到允许名单
    const roomId = channelName || req.user.roomId;
    if (roomId) {
      // 异步执行，不阻塞 Token 返回
      this.audioService.updateRouting(roomId).catch(err => 
        console.error('[Audio] Auto routing update failed:', err)
      );
    }
    
    return {
      token,
      appId: this.agoraService.getAppId(),
      uid: numericUid
    };
  }
}
