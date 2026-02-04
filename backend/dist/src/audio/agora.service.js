"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgoraService = void 0;
const common_1 = require("@nestjs/common");
const agora_token_1 = require("agora-token");
let AgoraService = class AgoraService {
    appId = 'bf9228d5a3f4461281a8093d60214c0a'.trim();
    appCertificate = '43c0a854276c426ead446845ea2a1f29'.trim();
    generateToken(channelName, uid, role = agora_token_1.RtcRole.PUBLISHER) {
        const expire = 3600;
        const numericUid = this.stringToUid(uid);
        console.log(`[AgoraService] Generating token for channel: ${channelName}, numericUid: ${numericUid}, role: ${role}`);
        const token = agora_token_1.RtcTokenBuilder.buildTokenWithUid(this.appId, this.appCertificate, channelName, numericUid, role, expire, expire);
        return token;
    }
    getNumericUid(uid) {
        return this.stringToUid(uid);
    }
    stringToUid(str) {
        if (!str || typeof str !== 'string') {
            console.warn('[AgoraService] Invalid UID string provided:', str);
            return 0;
        }
        const cleanStr = str.replace(/-/g, '');
        const hex = cleanStr.slice(-8);
        const uid = parseInt(hex, 16);
        return uid || 12345;
    }
    getAppId() {
        return this.appId;
    }
    async updateRouting(roomId) {
    }
};
exports.AgoraService = AgoraService;
exports.AgoraService = AgoraService = __decorate([
    (0, common_1.Injectable)()
], AgoraService);
//# sourceMappingURL=agora.service.js.map