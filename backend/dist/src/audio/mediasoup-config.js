"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    worker: {
        rtcMinPort: 10000,
        rtcMaxPort: 10500,
        logLevel: 'debug',
        logTags: [
            'info',
            'ice',
            'dtls',
            'rtp',
            'srtp',
            'rtcp',
        ],
    },
    router: {
        mediaCodecs: [
            {
                kind: 'audio',
                mimeType: 'audio/opus',
                clockRate: 48000,
                channels: 2,
                preferredPayloadType: 111,
                parameters: {
                    'sprop-stereo': 1,
                    'stereo': 1,
                    'useinbandfec': 1,
                    'usedtx': 1,
                    'minptime': 10,
                    'x-google-start-bitrate': 64000
                },
            },
        ],
    },
    webRtcTransport: {
        listenIps: [
            {
                ip: '0.0.0.0',
                announcedIp: '127.0.0.1',
            },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 1000000,
        minimumAvailableOutgoingBitrate: 600000,
        maxSctpMessageSize: 262144,
    },
};
//# sourceMappingURL=mediasoup-config.js.map