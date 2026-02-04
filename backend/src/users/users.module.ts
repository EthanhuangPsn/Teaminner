import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { GatewayModule } from '../gateway/gateway.module';
import { AudioModule } from '../audio/audio.module';

@Module({
  imports: [
    GatewayModule,
    forwardRef(() => AudioModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
