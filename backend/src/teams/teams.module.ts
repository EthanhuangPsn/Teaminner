import { Module, forwardRef } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { GatewayModule } from '../gateway/gateway.module';
import { AudioModule } from '../audio/audio.module';

@Module({
  imports: [
    forwardRef(() => GatewayModule),
    forwardRef(() => AudioModule),
  ],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
