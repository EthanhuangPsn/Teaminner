import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { GuestLoginDto } from './dto/guest-login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AuthService {
  private adminConfig: any = null;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    this.loadAdminConfig();
  }

  private loadAdminConfig() {
    try {
      const configPath = path.resolve(process.cwd(), 'admin-config.json');
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        this.adminConfig = JSON.parse(content);
        this.logger.log('Admin configuration loaded.');
      }
    } catch (error) {
      this.logger.error('Failed to load admin-config.json:', error.message);
    }
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { username: dto.username },
    });

    if (existingUser) {
      throw new ConflictException('用户名已存在');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        password: hashedPassword,
        avatar: dto.avatar || null,
        accountType: 'registered',
        accountRole: 'user',
      },
    });

    return this.generateToken(user);
  }

  async login(dto: LoginDto, ip?: string, fingerprint?: string) {
    // 1. Check Admin Config
    if (this.adminConfig && this.adminConfig.admin) {
      if (dto.username === this.adminConfig.admin.username && dto.password === this.adminConfig.admin.password) {
        // Find or create admin in DB to get a consistent ID
        let adminUser = await this.prisma.user.findFirst({
          where: { username: dto.username, accountType: 'registered', accountRole: 'admin' },
        });

        if (!adminUser) {
          adminUser = await this.prisma.user.create({
            data: {
              username: dto.username,
              accountType: 'registered',
              accountRole: 'admin',
              roomRole: 'room_admin',
            },
          });
        }
        return this.generateToken(adminUser);
      }
    }

    // 2. Normal User Login
    const user = await this.prisma.user.findFirst({
      where: { username: dto.username },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // Update IP binding
    if (ip) {
      await this.updateIpBinding(user.id, ip, fingerprint);
    }

    return this.generateToken(user);
  }

  async guestLogin(dto: GuestLoginDto, ip?: string, fingerprint?: string) {
    // 1. Try to find existing guest by username if provided
    let user: any = null;
    if (dto.username) {
      user = await this.prisma.user.findFirst({
        where: { 
          username: dto.username,
          accountType: 'guest'
        }
      });
    }

    // 2. If no username or not found, try IP auto-login if no username was explicitly given
    if (!user && ip && !dto.username) {
      const binding = await this.prisma.ipBinding.findUnique({
        where: { ip },
      });

      if (binding) {
        // Simple security check: IP + Fingerprint (if fingerprint matches or is not provided)
        if (!fingerprint || !binding.deviceFingerprint || binding.deviceFingerprint === fingerprint) {
          user = await this.prisma.user.findUnique({
            where: { id: binding.userId },
          });
        }
      }
    }

    // 3. Create new guest if still no user
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          username: dto.username || `游客${Math.floor(1000 + Math.random() * 9000)}`,
          avatar: null,
          accountType: 'guest',
          accountRole: 'user',
        },
      });
    }

    // 4. Update tracking info
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastIp: ip,
        deviceFingerprint: fingerprint,
        lastActiveAt: new Date(),
      },
    });

    if (ip) {
      await this.updateIpBinding(user.id, ip, fingerprint);
    }

    return this.generateToken(user);
  }

  async autoLoginByIp(ip: string, fingerprint?: string) {
    const binding = await this.prisma.ipBinding.findUnique({
      where: { ip },
    });

    if (!binding) return null;

    // Security check
    if (fingerprint && binding.deviceFingerprint && binding.deviceFingerprint !== fingerprint) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: binding.userId },
    });

    if (!user) return null;

    return this.generateToken(user);
  }

  async getProfileByToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) return null;
      return {
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          accountType: user.accountType,
          accountRole: user.accountRole,
        }
      };
    } catch (e) {
      return null;
    }
  }

  private async updateIpBinding(userId: string, ip: string, fingerprint?: string) {
    await this.prisma.ipBinding.upsert({
      where: { ip },
      update: {
        userId,
        deviceFingerprint: fingerprint,
        lastActiveAt: new Date(),
      },
      create: {
        ip,
        userId,
        deviceFingerprint: fingerprint,
        lastActiveAt: new Date(),
      },
    });
  }

  async purgeAndBackupData() {
    this.logger.log('Starting full data purge and backup...');

    // 1. Prepare Backup Data
    const backupData = {
      timestamp: new Date().toISOString(),
      users: await this.prisma.user.findMany(),
      rooms: await this.prisma.room.findMany(),
      teams: await this.prisma.team.findMany(),
      ipBindings: await this.prisma.ipBinding.findMany(),
    };

    // 2. Save to Local File
    const backupDir = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    const fileName = `full-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filePath = path.join(backupDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
    this.logger.log(`Backup saved to: ${filePath}`);

    // 3. Purge Data in correct order to avoid FK issues
    // Using a transaction to ensure atomic operation
    await this.prisma.$transaction([
      this.prisma.ipBinding.deleteMany(),
      this.prisma.user.deleteMany(),
      this.prisma.team.deleteMany(),
      this.prisma.room.deleteMany(),
    ]);

    // 4. Re-create default room so the system isn't empty
    await this.prisma.room.create({
      data: {
        roomName: '默认攻坚房间',
        maxUsers: 20,
        teams: {
          create: [
            { teamColor: 'red' },
            { teamColor: 'yellow' },
            { teamColor: 'green' },
          ],
        },
      },
    });

    this.logger.log('All data purged and default room recreated.');

    return {
      message: '数据已备份并清理完成',
      backupFile: fileName,
      purgedCounts: {
        users: backupData.users.length,
        rooms: backupData.rooms.length,
        teams: backupData.teams.length,
        ipBindings: backupData.ipBindings.length,
      }
    };
  }

  private async generateToken(user: any) {
    const payload = { sub: user.id, username: user.username, role: user.accountRole };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        accountType: user.accountType,
        accountRole: user.accountRole,
      },
    };
  }

  async validateUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (user) {
      // Update last active
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() },
      });
    }
    return user;
  }
}
