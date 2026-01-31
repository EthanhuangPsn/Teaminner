"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GatewayModule = void 0;
const common_1 = require("@nestjs/common");
const gateway_service_1 = require("./gateway.service");
const app_gateway_1 = require("./app.gateway");
const auth_module_1 = require("../auth/auth.module");
const rooms_module_1 = require("../rooms/rooms.module");
const teams_module_1 = require("../teams/teams.module");
const audio_module_1 = require("../audio/audio.module");
let GatewayModule = class GatewayModule {
};
exports.GatewayModule = GatewayModule;
exports.GatewayModule = GatewayModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            (0, common_1.forwardRef)(() => rooms_module_1.RoomsModule),
            (0, common_1.forwardRef)(() => teams_module_1.TeamsModule),
            (0, common_1.forwardRef)(() => audio_module_1.AudioModule),
        ],
        providers: [gateway_service_1.GatewayService, app_gateway_1.AppGateway],
        exports: [gateway_service_1.GatewayService],
    })
], GatewayModule);
//# sourceMappingURL=gateway.module.js.map