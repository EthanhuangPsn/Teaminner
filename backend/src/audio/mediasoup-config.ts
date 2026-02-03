import * as mediasoup from 'mediasoup';

export const config = {
  // Worker settings
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 10500, // 扩大端口范围
    logLevel: 'debug',
    logTags: [
      'info',
      'ice',
      'dtls',
      'rtp',
      'srtp',
      'rtcp',
    ],
  } as mediasoup.types.WorkerSettings,
  // Router settings
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        preferredPayloadType: 111, // 增加此必填字段
        parameters: {
          'sprop-stereo': 1,
          'stereo': 1,
          'useinbandfec': 1,
          'usedtx': 1,
          'minptime': 10,
          'x-google-start-bitrate': 64000
        },
      },
    ] as mediasoup.types.RtpCodecCapability[],
  } as mediasoup.types.RouterOptions,
  // WebRtcTransport settings
  webRtcTransport: {
    listenIps: [
      {
        ip: '0.0.0.0',
        announcedIp: '127.0.0.1', // 本地测试用 127.0.0.1
      },
    ],
    enableUdp: true,
    enableTcp: true, // <--- 关键：开启 TCP 支持
    preferUdp: true, // 优先使用 UDP
    initialAvailableOutgoingBitrate: 1000000,
    minimumAvailableOutgoingBitrate: 600000,
    maxSctpMessageSize: 262144,
  } as mediasoup.types.WebRtcTransportOptions,
};
