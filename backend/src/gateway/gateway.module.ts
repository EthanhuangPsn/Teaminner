import { Module, forwardRef } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { AppGateway } from './app.gateway';
import { AuthModule } from '../auth/auth.module';
import { RoomsModule } from '../rooms/rooms.module';
import { TeamsModule } from '../teams/teams.module';
import { AudioModule } from '../audio/audio.module';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => RoomsModule),
    forwardRef(() => TeamsModule),
    forwardRef(() => AudioModule),
  ],
  providers: [GatewayService, AppGateway],
  exports: [GatewayService],
})
export class GatewayModule {}
