"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioController = void 0;
const common_1 = require("@nestjs/common");
const agora_service_1 = require("./agora.service");
const audio_service_1 = require("./audio.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let AudioController = class AudioController {
    agoraService;
    audioService;
    constructor(agoraService, audioService) {
        this.agoraService = agoraService;
        this.audioService = audioService;
    }
    async getToken(channelName, req) {
        console.log('[Audio] Token request for user:', JSON.stringify(req.user));
        const userId = req.user.userId || req.user.id || req.user.sub;
        if (!userId) {
            console.error('[Audio] No userId found in req.user:', req.user);
            throw new Error('User identity not found in request');
        }
        const token = this.agoraService.generateToken(channelName, userId);
        const numericUid = this.agoraService.getNumericUid(userId);
        console.log(`[Audio] Generated token for user ${userId} (numericUid: ${numericUid})`);
        const roomId = channelName || req.user.roomId;
        if (roomId) {
            this.audioService.updateRouting(roomId).catch(err => console.error('[Audio] Auto routing update failed:', err));
        }
        return {
            token,
            appId: this.agoraService.getAppId(),
            uid: numericUid
        };
    }
};
exports.AudioController = AudioController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('token'),
    __param(0, (0, common_1.Query)('channelName')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AudioController.prototype, "getToken", null);
exports.AudioController = AudioController = __decorate([
    (0, common_1.Controller)('audio'),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => audio_service_1.AudioService))),
    __metadata("design:paramtypes", [agora_service_1.AgoraService,
        audio_service_1.AudioService])
], AudioController);
//# sourceMappingURL=audio.controller.js.map