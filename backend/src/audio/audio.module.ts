import { Module, forwardRef } from '@nestjs/common';
import { AudioService } from './audio.service';
import { RoomsModule } from '../rooms/rooms.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    forwardRef(() => RoomsModule),
    forwardRef(() => GatewayModule),
  ],
  providers: [AudioService],
  exports: [AudioService],
})
export class AudioModule {}
