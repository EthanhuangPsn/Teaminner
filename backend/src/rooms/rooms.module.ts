import { Module, forwardRef } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { GatewayModule } from '../gateway/gateway.module';
import { AudioModule } from '../audio/audio.module';

@Module({
  imports: [
    forwardRef(() => GatewayModule),
    forwardRef(() => AudioModule),
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
