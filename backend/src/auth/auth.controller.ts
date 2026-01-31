import { Controller, Post, Body, Ip, Headers, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GuestLoginDto } from './dto/guest-login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  login(
    @Body() loginDto: LoginDto,
    @Ip() ip: string,
    @Headers('x-device-fingerprint') fingerprint?: string,
  ) {
    return this.authService.login(loginDto, ip, fingerprint);
  }

  @Post('guest')
  guestLogin(
    @Body() dto: GuestLoginDto,
    @Ip() ip: string,
    @Headers('x-device-fingerprint') fingerprint?: string,
  ) {
    return this.authService.guestLogin(dto, ip, fingerprint);
  }

  @Post('auto-login')
  autoLogin(
    @Ip() ip: string,
    @Headers('x-device-fingerprint') fingerprint?: string,
  ) {
    return this.authService.autoLoginByIp(ip, fingerprint);
  }

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Headers('Authorization') auth: string) {
    // JwtAuthGuard 会自动把用户信息放入 request.user (由 JwtStrategy 处理)
    // 这里我们直接从 guard 处理后的 request 中拿数据，或者通过 AuthService 重新查询
    return this.authService.getProfileByToken(auth.replace('Bearer ', ''));
  }

  @Post('purge-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  purgeData() {
    return this.authService.purgeAndBackupData();
  }
}
