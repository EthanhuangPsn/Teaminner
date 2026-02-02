"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const bcrypt = __importStar(require("bcryptjs"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let AuthService = AuthService_1 = class AuthService {
    prisma;
    jwtService;
    adminConfig = null;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.loadAdminConfig();
    }
    loadAdminConfig() {
        try {
            const configPath = path.resolve(process.cwd(), 'admin-config.json');
            if (fs.existsSync(configPath)) {
                const content = fs.readFileSync(configPath, 'utf8');
                this.adminConfig = JSON.parse(content);
                this.logger.log('Admin configuration loaded.');
            }
        }
        catch (error) {
            this.logger.error('Failed to load admin-config.json:', error.message);
        }
    }
    async register(dto) {
        const existingUser = await this.prisma.user.findFirst({
            where: { username: dto.username },
        });
        if (existingUser) {
            throw new common_1.ConflictException('用户名已存在');
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
    async login(dto, ip, fingerprint) {
        if (this.adminConfig && this.adminConfig.admin) {
            if (dto.username === this.adminConfig.admin.username && dto.password === this.adminConfig.admin.password) {
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
        const user = await this.prisma.user.findFirst({
            where: { username: dto.username },
        });
        if (!user || !user.password) {
            throw new common_1.UnauthorizedException('用户名或密码错误');
        }
        const isPasswordValid = await bcrypt.compare(dto.password, user.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('用户名或密码错误');
        }
        if (ip) {
            await this.updateIpBinding(user.id, ip, fingerprint);
        }
        return this.generateToken(user);
    }
    async guestLogin(dto, ip, fingerprint) {
        let user = null;
        if (dto.username) {
            user = await this.prisma.user.findFirst({
                where: {
                    username: dto.username,
                    accountType: 'guest'
                }
            });
        }
        if (!user && ip && fingerprint && !dto.username) {
            const binding = await this.prisma.ipBinding.findUnique({
                where: {
                    ip_deviceFingerprint: { ip, deviceFingerprint: fingerprint }
                },
            });
            if (binding) {
                user = await this.prisma.user.findUnique({
                    where: { id: binding.userId },
                });
            }
        }
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
    async autoLoginByIp(ip, fingerprint) {
        if (!fingerprint)
            return null;
        const binding = await this.prisma.ipBinding.findUnique({
            where: {
                ip_deviceFingerprint: { ip, deviceFingerprint: fingerprint }
            },
        });
        if (!binding)
            return null;
        const user = await this.prisma.user.findUnique({
            where: { id: binding.userId },
        });
        if (!user)
            return null;
        return this.generateToken(user);
    }
    async getProfileByToken(token) {
        try {
            const payload = await this.jwtService.verifyAsync(token);
            const user = await this.prisma.user.findUnique({
                where: { id: payload.sub },
            });
            if (!user)
                return null;
            return {
                user: {
                    id: user.id,
                    username: user.username,
                    avatar: user.avatar,
                    accountType: user.accountType,
                    accountRole: user.accountRole,
                }
            };
        }
        catch (e) {
            return null;
        }
    }
    async updateIpBinding(userId, ip, fingerprint) {
        if (!fingerprint)
            return;
        await this.prisma.ipBinding.upsert({
            where: {
                ip_deviceFingerprint: { ip, deviceFingerprint: fingerprint }
            },
            update: {
                userId,
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
        const backupData = {
            timestamp: new Date().toISOString(),
            users: await this.prisma.user.findMany(),
            rooms: await this.prisma.room.findMany(),
            teams: await this.prisma.team.findMany(),
            ipBindings: await this.prisma.ipBinding.findMany(),
        };
        const backupDir = path.resolve(process.cwd(), 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }
        const fileName = `full-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const filePath = path.join(backupDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
        this.logger.log(`Backup saved to: ${filePath}`);
        await this.prisma.$transaction([
            this.prisma.ipBinding.deleteMany(),
            this.prisma.user.deleteMany(),
            this.prisma.team.deleteMany(),
            this.prisma.room.deleteMany(),
        ]);
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
    async generateToken(user) {
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
    async validateUserById(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (user) {
            await this.prisma.user.update({
                where: { id: userId },
                data: { lastActiveAt: new Date() },
            });
        }
        return user;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map