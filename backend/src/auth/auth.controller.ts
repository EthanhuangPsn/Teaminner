import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GuestLoginDto } from './dto/guest-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('guest')
  guestLogin(@Body() dto: GuestLoginDto) {
    return this.authService.guestLogin(dto);
  }
}
