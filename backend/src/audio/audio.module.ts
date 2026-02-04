import { Module, forwardRef } from '@nestjs/common';
import { AudioService } from './audio.service';
import { AgoraService } from './agora.service';
import { AudioController } from './audio.controller';
import { RoomsModule } from '../rooms/rooms.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    forwardRef(() => RoomsModule),
    forwardRef(() => GatewayModule),
  ],
  controllers: [AudioController],
  providers: [AudioService, AgoraService],
  exports: [AudioService, AgoraService],
})
export class AudioModule {}
