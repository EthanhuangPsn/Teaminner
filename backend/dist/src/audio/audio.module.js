"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioModule = void 0;
const common_1 = require("@nestjs/common");
const audio_service_1 = require("./audio.service");
const agora_service_1 = require("./agora.service");
const audio_controller_1 = require("./audio.controller");
const rooms_module_1 = require("../rooms/rooms.module");
const gateway_module_1 = require("../gateway/gateway.module");
let AudioModule = class AudioModule {
};
exports.AudioModule = AudioModule;
exports.AudioModule = AudioModule = __decorate([
    (0, common_1.Module)({
        imports: [
            (0, common_1.forwardRef)(() => rooms_module_1.RoomsModule),
            (0, common_1.forwardRef)(() => gateway_module_1.GatewayModule),
        ],
        controllers: [audio_controller_1.AudioController],
        providers: [audio_service_1.AudioService, agora_service_1.AgoraService],
        exports: [audio_service_1.AudioService, agora_service_1.AgoraService],
    })
], AudioModule);
//# sourceMappingURL=audio.module.js.map