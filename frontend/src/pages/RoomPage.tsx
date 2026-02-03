import React, { useState, useEffect, useRef } from 'react';
import { Layout, Button, Space, List, Badge, Typography, message, Collapse, Avatar, Tag, Dropdown } from 'antd';
import { useRoomStore } from '../store/roomStore';
import { useAuthStore } from '../store/authStore';
import { Mic, MicOff, Headphones, HeadphoneOff, ArrowLeft, Shield, User, Users, Wifi, Activity, Radio } from 'lucide-react';
import api from '../api/client';
import { WebRTCManager } from '../utils/webrtc';
import { useParams, useNavigate } from 'react-router-dom';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const { Panel } = Collapse;

const RoomPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentRoom, fetchRoom, leaveRoom, toggleStatus, socket } = useRoomStore();
  const { user } = useAuthStore();
  
  const [micOn, setMicOn] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [iceState, setIceState] = useState({ send: 'none', recv: 'none' });
  const [outputVolume, setOutputVolume] = useState(60);
  const [isForceCalling, setIsForceCalling] = useState(false);
  
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const initializingRef = useRef(false);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioNodesRef = useRef<Map<string, { 
    source: MediaStreamAudioSourceNode, 
    panner: StereoPannerNode,
    clarity?: BiquadFilterNode,
    lowCut?: BiquadFilterNode
  }>>(new Map());
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterCompressorRef = useRef<DynamicsCompressorNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // 获取设备列表
  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = allDevices.filter(d => d.kind === 'audioinput');
        setDevices(audioDevices);
        if (audioDevices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(audioDevices[0].deviceId);
        }
      } catch (err) {
        console.warn('获取设备列表失败:', err);
      }
    };
    getDevices();
  }, []);

  // 定期更新 ICE 状态
  useEffect(() => {
    const timer = setInterval(() => {
      if (webrtcRef.current) {
        setIceState(webrtcRef.current.getIceState());
      }
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // 统一的 AudioContext 获取入口
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'balanced', 
        sampleRate: 48000,
      });
      
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, ctx.currentTime);
      compressor.knee.setValueAtTime(30, ctx.currentTime);
      compressor.ratio.setValueAtTime(12, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.25, ctx.currentTime);
      
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(outputVolume / 100, ctx.currentTime); 
      
      // 直接连接：压缩器 -> 主增益 -> 扬声器
      compressor.connect(masterGain);
      masterGain.connect(ctx.destination);
      
      masterCompressorRef.current = compressor;
      masterGainRef.current = masterGain;
      audioContextRef.current = ctx;
    }
    return audioContextRef.current;
  };

  // 全局点击激活音频上下文
  useEffect(() => {
    const handleGesture = () => {
      const ctx = audioContextRef.current;
      if (ctx?.state === 'suspended') {
        ctx.resume();
      }
    };
    window.addEventListener('click', handleGesture);
    return () => window.removeEventListener('click', handleGesture);
  }, []);

  // 实时调整音量
  useEffect(() => {
    if (masterGainRef.current && audioContextRef.current) {
      masterGainRef.current.gain.setTargetAtTime(outputVolume / 100, audioContextRef.current.currentTime, 0.1);
    }
  }, [outputVolume]);

  useEffect(() => {
    if (localStream && micOn) {
      const initLocalAnalysing = async () => {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        
        // 检查 localStream 是否有效
        if (!localStream.active || localStream.getAudioTracks().length === 0) {
          console.error("Local stream is not active or has no audio tracks");
          return;
        }

        const source = ctx.createMediaStreamSource(localStream);
        
        // 关键：创建一个专门用于“人声分析”的滤波器链路
        // 这不会影响发送出去的声音质量（避免延迟），仅用于本地判定
        const analysisFilter = ctx.createBiquadFilter();
        analysisFilter.type = 'bandpass';
        analysisFilter.frequency.value = 1500; // 中心频率设为人声最敏感的 1.5kHz
        analysisFilter.Q.value = 1.0;          // 过滤掉极低频(摩擦声)和极高频(嘶嘶声)

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.4; // 增加平滑度，防止波动过快

        source.connect(analysisFilter);
        analysisFilter.connect(analyser);
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // 更严格的门限参数
        const THRESHOLD = 18;  // 稍微提高门槛，过滤环境杂音
        const HOLD_TIME = 800; // 增加保持时间，让对话更自然
        let lastSpeakTime = 0;

        const checkVolume = () => {
          if (!micOn || !analyserRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          
          // 1. 人声核心区 (300Hz - 3000Hz) - 人声能量最集中的地方
          let vocalSum = 0;
          let vocalMax = 0;
          for (let i = 3; i < 32; i++) {
            vocalSum += dataArray[i];
            if (dataArray[i] > vocalMax) vocalMax = dataArray[i];
          }
          const vocalAvg = vocalSum / 29;

          // 2. 噪声敏感区 (6000Hz+) - 主要是摩擦声、电流声、嘶嘶声
          let noiseSum = 0;
          for (let i = 64; i < 128; i++) {
            noiseSum += dataArray[i];
          }
          const noiseAvg = noiseSum / 64;
          
          const now = Date.now();
          
          // AI 启发式逻辑：
          // - 核心区能量必须高于门限
          // - 核心区必须有显著的“峰值”（人声特征），而不仅仅是平铺的噪声
          // - 核心区能量必须显著高于高频噪声区 (SNR 判定)
          const hasVocalFeature = vocalMax > (vocalAvg * 1.2);
          const isHumanVoice = vocalAvg > THRESHOLD && hasVocalFeature && vocalAvg > (noiseAvg * 2.0);

          if (isHumanVoice) {
            lastSpeakTime = now;
            setLocalSpeaking(true);
            if (localOutputGainRef.current && audioContextRef.current) {
              // 极速开启：10ms
              localOutputGainRef.current.gain.setTargetAtTime(1.0, audioContextRef.current.currentTime, 0.01);
            }
          } else if (now - lastSpeakTime > HOLD_TIME) {
            setLocalSpeaking(false);
            if (localOutputGainRef.current && audioContextRef.current) {
              // 平滑关闭：150ms，防止产生“咔嗒”声
              localOutputGainRef.current.gain.setTargetAtTime(0.001, audioContextRef.current.currentTime, 0.15);
            }
          }

          requestAnimationFrame(checkVolume);
        };

        checkVolume();
      };

      initLocalAnalysing();

      return () => {
        if (analyserRef.current) {
          analyserRef.current.disconnect();
          analyserRef.current = null;
        }
      };
    } else {
      setLocalSpeaking(false);
    }
  }, [localStream, micOn]);

  useEffect(() => {
    if (id) {
      fetchRoom(id);
    }
  }, [id, fetchRoom]);

  // 核心优化：如果进入了房间页面但不在成员列表中，自动执行加入逻辑
  useEffect(() => {
    if (currentRoom && user && !currentRoom.users.find(u => u.id === user.id)) {
      console.log('Detected user not in room, joining...');
      useRoomStore.getState().joinRoom(currentRoom.id).catch(() => {
        message.error('自动加入房间失败');
        navigate('/');
      });
    }
  }, [currentRoom, user, navigate]);

  // WebRTC 初始化
  useEffect(() => {
    if (socket && id && user && !webrtcRef.current && !initializingRef.current) {
      initializingRef.current = true;
      const manager = new WebRTCManager(
        socket, 
        id, 
        user.id,
        (state) => setIceState(state)
      );
      manager.init().then(success => {
        if (success) {
          webrtcRef.current = manager;
          console.log('WebRTC Manager initialized');
        }
        initializingRef.current = false;
      }).catch(() => {
        initializingRef.current = false;
      });

      return () => {
        manager.close();
        webrtcRef.current = null;
        initializingRef.current = false;
        // 清理所有音频元素
        audioElementsRef.current.forEach(audio => {
          audio.pause();
          audio.srcObject = null;
          if (audio.parentNode) {
            audio.parentNode.removeChild(audio);
          }
        });
        audioElementsRef.current.clear();
      };
    }
  }, [socket, id, user]);

  // 移除第 58 行附近的早期 return null

  const isLeader = currentRoom?.leaderId === user?.id;

  const handleLeave = async () => {
    await leaveRoom();
    navigate('/');
    message.info('已离开房间');
  };

  const handleToggleStatus = async () => {
    if (!currentRoom) return;
    const newStatus = currentRoom.status === 'preparing' ? 'assaulting' : 'preparing';
    await toggleStatus(newStatus);
    message.success(`房间状态已切换为: ${newStatus === 'preparing' ? '备战' : '攻坚'}`);
  };

  const handleJoinTeam = async (teamId: string) => {
    if (!currentRoom) return;
    try {
      await api.post(`/teams/${teamId}/join`);
      fetchRoom(currentRoom.id); // 刷新房间状态
      message.success('已加入小队');
    } catch (error) {
      message.error('加入小队失败');
    }
  };

  const handleAssignUser = async (userId: string, teamId: string) => {
    if (!currentRoom) return;
    try {
      await api.post(`/teams/${teamId}/assign`, { userId });
      fetchRoom(currentRoom.id);
      message.success('指派成功');
    } catch (error) {
      message.error('指派失败');
    }
  };

  const handleUnassignUser = async (userId: string) => {
    if (!currentRoom) return;
    try {
      await api.post(`/teams/unassign`, { userId });
      fetchRoom(currentRoom.id);
      message.success('已移出小队');
    } catch (error) {
      message.error('移出小队失败');
    }
  };

  const handleSetCaptain = async (teamId: string, userId: string) => {
    if (!currentRoom) return;
    try {
      await api.post(`/teams/${teamId}/captain`, { userId });
      fetchRoom(currentRoom.id);
      message.success('已任命新队长');
    } catch (error) {
      message.error('任命队长失败');
    }
  };

  const localProcessedStreamRef = useRef<MediaStream | null>(null);
  const localOutputGainRef = useRef<GainNode | null>(null);

  const handleMicToggle = async () => {
    const newMicState = !micOn;
    if (newMicState) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            // 启用一些高级实验性参数
            // @ts-ignore
            googEchoCancellation: true,
            googAutoGainControl: true,
            googNoiseSuppression: true,
            googHighpassFilter: true, // 硬件级高通滤波
          } 
        });
        
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') await ctx.resume();

        // 建立发送端处理链路：源 -> 高通滤波 -> 软增益门 -> 目标
        const source = ctx.createMediaStreamSource(stream);
        
        // 1. 低切滤波器 (切掉衣领摩擦、喷麦声)
        const lowCut = ctx.createBiquadFilter();
        lowCut.type = 'highpass';
        lowCut.frequency.setValueAtTime(120, ctx.currentTime); // 提高到 120Hz，更彻底
        
        // 2. 软增益门
        const gateGain = ctx.createGain();
        gateGain.gain.setValueAtTime(0, ctx.currentTime); // 默认静音，等待检测开启
        localOutputGainRef.current = gateGain;

        // 3. 动态压缩器 (让声音更稳、更厚实)
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-20, ctx.currentTime);
        compressor.knee.setValueAtTime(10, ctx.currentTime);
        compressor.ratio.setValueAtTime(4, ctx.currentTime);

        const dest = ctx.createMediaStreamDestination();
        
        source.connect(lowCut);
        lowCut.connect(compressor);
        compressor.connect(gateGain);
        gateGain.connect(dest);

        setLocalStream(stream);
        localProcessedStreamRef.current = dest.stream;

        // 发送处理后的轨道
        if (webrtcRef.current) {
          const processedTrack = dest.stream.getAudioTracks()[0];
          await webrtcRef.current.startProducing(processedTrack);
        }

        setMicOn(true);
        if (user) {
          await api.patch(`/users/${user.id}`, { micEnabled: true });
        }
        message.success('作战麦克风已开启 (专业级链路激活)');
      } catch {
        message.error('无法获取麦克风权限');
      }
    } else {
      localStream?.getTracks().forEach(track => track.stop());
      localProcessedStreamRef.current?.getTracks().forEach(track => track.stop());
      setLocalStream(null);
      localProcessedStreamRef.current = null;
      localOutputGainRef.current = null;
      setMicOn(false);
      if (user) {
        await api.patch(`/users/${user.id}`, { micEnabled: false });
      }
      message.info('麦克风已关闭');
    }
  };

  const handleSpeakerToggle = async () => {
    const newSpeakerState = !speakerOn;
    setSpeakerOn(newSpeakerState);
    if (user) {
      await api.patch(`/users/${user.id}`, { speakerEnabled: newSpeakerState });
    }
    if (!newSpeakerState) {
      audioElementsRef.current.forEach(audio => audio.pause());
      message.info('已停止收听');
    } else {
      message.success('已开启收听');
    }
  };

  // 监听说话状态
  useEffect(() => {
    if (!socket || !currentRoom) return;

    const handleUserSpeaking = ({ userId, isSpeaking }: { userId: string | null, isSpeaking: boolean }) => {
      setSpeakingUsers(prev => {
        const next = new Set(prev);
        if (isSpeaking && userId) {
          next.add(userId);
        } else if (userId) {
          next.delete(userId);
        } else {
          next.clear(); // silence
        }
        return next;
      });
    };

    socket.on('user-speaking', handleUserSpeaking);
    return () => {
      socket.off('user-speaking', handleUserSpeaking);
    };
  }, [socket, currentRoom]);

  // 监听其他用户的音频流
  useEffect(() => {
    if (!currentRoom || !user || !webrtcRef.current || !speakerOn) return;

    currentRoom.users.forEach(async (u) => {
      const isMe = u.id === user.id;
      const isMicOn = u.micEnabled;
      const alreadySubscribed = audioNodesRef.current.has(u.id);

      if (!isMe && isMicOn && !alreadySubscribed) {
        try {
          const consumer = await webrtcRef.current!.consume(u.id);
          if (consumer) {
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') await ctx.resume();

            const stream = new MediaStream([consumer.track]);
            
            // 关键修复：增加一个静音播放的 Audio 元素来激活 Chromium 的 WebRTC 数据流
            const helperAudio = new Audio();
            helperAudio.srcObject = stream;
            helperAudio.muted = true;
            helperAudio.play().catch(() => {});
            audioElementsRef.current.set(u.id, helperAudio);

            const source = ctx.createMediaStreamSource(stream);
            
            // A. 空间化定位：根据用户 ID 分配左右位置
            const panner = ctx.createStereoPanner();
            const panValue = (parseInt(u.id.slice(0, 2), 16) / 255) * 1.2 - 0.6; 
            panner.pan.setValueAtTime(panValue, ctx.currentTime);

            // B. 人声“清晰度”增强滤镜 (Presence Filter)
            const clarity = ctx.createBiquadFilter();
            clarity.type = 'peaking';
            clarity.frequency.setValueAtTime(3000, ctx.currentTime);
            clarity.Q.setValueAtTime(1.2, ctx.currentTime);
            clarity.gain.setValueAtTime(3, ctx.currentTime); 

            // C. 接收端防杂音过滤 (防止对方传来的低频杂音)
            const lowCut = ctx.createBiquadFilter();
            lowCut.type = 'highpass';
            lowCut.frequency.setValueAtTime(150, ctx.currentTime);

            // 链路：源 -> 清晰度增强 -> 空间定位 -> 低切 -> 总压缩器
            source.connect(clarity);
            clarity.connect(panner);
            panner.connect(lowCut);
            lowCut.connect(masterCompressorRef.current!);
            
            audioNodesRef.current.set(u.id, { source, panner, clarity, lowCut });
            console.log(`[Audio] Premium spatial pipeline activated for ${u.username}`);
          }
        } catch (err: any) {
          console.error('[Audio] Connection failed:', err);
        }
      } 
      else if (!isMe && !isMicOn && alreadySubscribed) {
        const nodes = audioNodesRef.current.get(u.id);
        nodes?.source.disconnect();
        nodes?.clarity?.disconnect();
        nodes?.panner.disconnect();
        nodes?.lowCut?.disconnect();
        audioNodesRef.current.delete(u.id);

        const helper = audioElementsRef.current.get(u.id);
        helper?.pause();
        audioElementsRef.current.delete(u.id);
      }
    });

    // 清理离开的用户
    audioNodesRef.current.forEach((nodes, userId) => {
      if (!currentRoom.users.find(ux => ux.id === userId)) {
        nodes.source.disconnect();
        nodes.clarity?.disconnect();
        nodes.panner.disconnect();
        nodes.lowCut?.disconnect();
        audioNodesRef.current.delete(userId);

        const helper = audioElementsRef.current.get(userId);
        helper?.pause();
        audioElementsRef.current.delete(userId);
      }
    });

  }, [currentRoom, user, speakerOn]);

  // 计算当前“谁能听到我”列表
  const talkableUsers = currentRoom ? currentRoom.users.filter(u => {
    // 1. 自己始终不显示在“可对话”列表中（避免冗余）
    if (u.id === user?.id) return false;

    // 2. 如果是备战状态，所有人互通
    if (currentRoom.status === 'preparing') return true;

    // 3. 攻坚状态下的过滤逻辑（匹配后端路由算法）
    const myUser = currentRoom.users.find(x => x.id === user?.id);
    const myRole = myUser?.roomRole || 'member';
    const myTeamId = myUser?.teamId;
    const targetRole = u.roomRole;
    const targetTeamId = u.teamId;

    // A. 团长与队长的关系
    if (myRole === 'leader' && targetRole === 'captain') return true;
    if (myRole === 'captain' && targetRole === 'leader') return true;

    // B. 队长与队长的关系
    if (myRole === 'captain' && targetRole === 'captain') return true;

    // C. 队内关系
    if (myTeamId && myTeamId === targetTeamId) return true;

    // D. 团长如果兼任了某队队长，也能听到该队队员（后端已涵盖，这里前端简化实现）
    
    return false;
  }) : [];

  const unassignedUsers = currentRoom?.users?.filter(u => !u.teamId) || [];

  const [draggingUserId, setDraggingUserId] = useState<string | null>(null);

  const handleDragStart = (userId: string) => {
    setDraggingUserId(userId);
  };

  const handleDropOnTeam = (teamId: string) => {
    if (draggingUserId) {
      handleAssignUser(draggingUserId, teamId);
      setDraggingUserId(null);
    }
  };

  const handleDropOnUnassigned = () => {
    if (draggingUserId) {
      handleUnassignUser(draggingUserId);
      setDraggingUserId(null);
    }
  };

  // 统一的指挥官操作
  const handleLeaderMuteAll = () => {
    if (!socket) return;
    socket.emit('leader:mute-all', id);
    message.warning('已下达全体禁音指令');
  };

  const handleLeaderForceCall = () => {
    if (!socket) return;
    const nextState = !isForceCalling;
    socket.emit('leader:force-call', { roomId: id, enabled: nextState });
    setIsForceCalling(nextState);
    if (nextState) {
      message.success('全体强制呼叫已开启 (无视路由规则)');
    } else {
      message.info('全体强制呼叫已关闭');
    }
  };

  // 监听指挥官指令
  useEffect(() => {
    if (!socket) return;

    const onForceMute = () => {
      // 如果自己不是团长，则强制关麦
      const isLeader = currentRoom?.leaderId === user?.id;
      if (!isLeader && micOn) {
        // 模拟点击关麦
        const micBtn = document.getElementById('mic-toggle-btn');
        if (micBtn) micBtn.click();
        message.error('指挥官已下达全体禁音指令');
      }
    };

    const onForceCallStatus = ({ enabled }: { enabled: boolean }) => {
      setIsForceCalling(enabled);
    };

    socket.on('force-mute-all', onForceMute);
    socket.on('force-call-status', onForceCallStatus);

    return () => {
      socket.off('force-mute-all', onForceMute);
      socket.off('force-call-status', onForceCallStatus);
    };
  }, [socket, currentRoom, user, micOn]);

  if (!currentRoom || !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Text type="secondary">正在退出房间...</Text>
      </div>
    );
  }

  return (
    <Layout style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', minHeight: '80vh', border: '1px solid #f0f0f0' }}>
      {/* 隐藏的音频容器 */}
      <div ref={audioContainerRef} style={{ display: 'none' }} />
      <Sider width={300} theme="light" style={{ borderRight: '1px solid #f0f0f0', padding: '16px', overflowY: 'auto' }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>作战编队</Title>
          <Button type="text" icon={<ArrowLeft size={16} />} onClick={handleLeave}>退出</Button>
        </div>
        
        <Collapse ghost defaultActiveKey={[...currentRoom.teams.map(t => t.id), 'unassigned']} expandIconPosition="end">
          {/* 各小队人员 */}
          {currentRoom.teams.map((team) => (
            <Panel 
              header={
                <div 
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={() => handleDropOnTeam(team.id)}
                  style={{ display: 'flex', justifyContent: 'space-between', width: '100%', paddingRight: '24px' }}
                >
                  <Space>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: team.teamColor }} />
                    <span style={{ fontWeight: 'bold' }}>{team.teamColor === 'red' ? '红队' : team.teamColor === 'green' ? '绿队' : team.teamColor === 'yellow' ? '黄队' : team.teamColor}</span>
                    <span style={{ color: '#999', fontSize: '12px' }}>({team.members.length}人)</span>
                  </Space>
                  <Button 
                    type="link" 
                    size="small" 
                    style={{ padding: 0, height: 'auto' }} 
                    onClick={(e) => { e.stopPropagation(); handleJoinTeam(team.id); }}
                  >
                    加入
                  </Button>
                </div>
              } 
              key={team.id}
            >
              <div 
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={() => handleDropOnTeam(team.id)}
                style={{ minHeight: '40px' }}
              >
                <List
                  itemLayout="horizontal"
                  dataSource={team.members}
                  renderItem={(m: any) => (
                    <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'set-captain',
                          label: '任命为队长',
                          disabled: m.roomRole === 'captain',
                          onClick: () => handleSetCaptain(m.teamId, m.id),
                        },
                        { type: 'divider' },
                        {
                          key: 'unassign',
                          label: '从队中移出',
                          onClick: () => handleUnassignUser(m.id),
                          danger: true,
                        },
                        { type: 'divider' },
                        ...currentRoom.teams.map(t => ({
                          key: t.id,
                          label: `移动到: ${t.teamColor === 'red' ? '红队' : t.teamColor === 'green' ? '绿队' : t.teamColor === 'yellow' ? '黄队' : t.teamColor}`,
                          disabled: t.id === m.teamId,
                          onClick: () => handleAssignUser(m.id, t.id)
                        }))
                      ]
                    }}
                      trigger={isLeader ? ['contextMenu'] : []}
                    >
                      <List.Item 
                        style={{ padding: '8px 4px', cursor: isLeader ? 'grab' : 'default' }}
                        draggable={isLeader}
                        onDragStart={() => handleDragStart(m.id)}
                      >
                        <List.Item.Meta
                        avatar={
                          <Badge dot={m.id === user.id ? localSpeaking : speakingUsers.has(m.id)} color="green" offset={[-2, 28]}>
                            <Avatar size="small" src={m.avatar} icon={<User size={12} />} />
                          </Badge>
                        }
                          title={
                            <Space size={4}>
                              <span style={{ fontSize: '14px' }}>{m.username}</span>
                              {m.roomRole === 'captain' && <Tag color="blue" style={{ margin: 0, padding: '0 4px', fontSize: '10px' }}>队长</Tag>}
                              {currentRoom.leaderId === m.id && <Tag color="gold" style={{ margin: 0, padding: '0 4px', fontSize: '10px' }}>团长</Tag>}
                            </Space>
                          }
                          description={
                            <Space size={8}>
                              {m.micEnabled ? <Mic size={12} color="green" /> : <MicOff size={12} color="#bfbfbf" />}
                              {m.speakerEnabled ? <Headphones size={12} color="green" /> : <HeadphoneOff size={12} color="#bfbfbf" />}
                            </Space>
                          }
                        />
                      </List.Item>
                    </Dropdown>
                  )}
                />
              </div>
            </Panel>
          ))}

          {/* 未分队人员 */}
          {unassignedUsers.length > 0 && (
            <Panel 
              header={<Space><Users size={16} /><span>未分队 ({unassignedUsers.length})</span></Space>} 
              key="unassigned"
            >
              <div 
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={() => handleDropOnUnassigned()}
                style={{ minHeight: '40px' }}
              >
                <List
                  itemLayout="horizontal"
                  dataSource={unassignedUsers}
                  renderItem={(u) => (
                    <Dropdown
                      menu={{
                        items: currentRoom.teams.map(t => ({
                          key: t.id,
                          label: `指派到: ${t.teamColor === 'red' ? '红队' : t.teamColor === 'green' ? '绿队' : t.teamColor === 'yellow' ? '黄队' : t.teamColor}`,
                          onClick: () => handleAssignUser(u.id, t.id)
                        }))
                      }}
                      trigger={isLeader ? ['contextMenu'] : []}
                    >
                      <List.Item 
                        style={{ padding: '8px 4px', cursor: isLeader ? 'grab' : 'default' }}
                        draggable={isLeader}
                        onDragStart={() => handleDragStart(u.id)}
                      >
                        <List.Item.Meta
                          avatar={
                            <Badge dot={u.id === user.id ? localSpeaking : speakingUsers.has(u.id)} color="green" offset={[-2, 28]}>
                              <Avatar size="small" src={u.avatar} icon={<User size={12} />} />
                            </Badge>
                          }
                          title={
                            <Space size={4}>
                              <span style={{ fontSize: '14px' }}>{u.username}</span>
                              {currentRoom.leaderId === u.id && <Tag color="gold" style={{ margin: 0, padding: '0 4px', fontSize: '10px' }}>团长</Tag>}
                            </Space>
                          }
                          description={
                            <Space size={8}>
                              {u.micEnabled ? <Mic size={12} color="green" /> : <MicOff size={12} color="#bfbfbf" />}
                              {u.speakerEnabled ? <Headphones size={12} color="green" /> : <HeadphoneOff size={12} color="#bfbfbf" />}
                            </Space>
                          }
                        />
                      </List.Item>
                    </Dropdown>
                  )}
                />
              </div>
            </Panel>
          )}
        </Collapse>
      </Sider>
      
      <Content style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Title level={3} style={{ margin: 0 }}>{currentRoom.roomName}</Title>
            <Space split={<Text type="secondary" style={{ fontSize: '12px' }}>|</Text>}>
              <Space size={4}>
                <Text type="secondary" style={{ fontSize: '12px' }}>状态: </Text>
                <Tag color={currentRoom.status === 'preparing' ? 'green' : 'red'} style={{ margin: 0 }}>
                  {currentRoom.status === 'preparing' ? '备战中' : '攻坚中'}
                </Tag>
              </Space>
              
              <Space size={4}>
                <Wifi size={12} color={iceState.send === 'connected' ? '#52c41a' : '#faad14'} />
                <Text type="secondary" style={{ fontSize: '10px' }}>
                  上行: {iceState.send.toUpperCase()}
                </Text>
              </Space>
              
              <Space size={4}>
                <Activity size={12} color={iceState.recv === 'connected' ? '#52c41a' : '#faad14'} />
                <Text type="secondary" style={{ fontSize: '10px' }}>
                  下行: {iceState.recv.toUpperCase()}
                </Text>
              </Space>
            </Space>
          </div>
          
          <Space>
            {isLeader && (
              <Space style={{ background: '#fff1f0', padding: '4px 12px', borderRadius: '6px', border: '1px solid #ffa39e' }}>
                <Text strong style={{ color: '#cf1322', marginRight: '8px', fontSize: '12px' }}>
                  <Shield size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  指挥权
                </Text>
                <Button 
                  size="small"
                  type={currentRoom.status === 'preparing' ? 'primary' : 'default'}
                  danger={currentRoom.status === 'preparing'}
                  onClick={handleToggleStatus}
                >
                  {currentRoom.status === 'preparing' ? '开启攻坚模式' : '切回备战模式'}
                </Button>
                <Button 
                  size="small"
                  icon={<MicOff size={14} />} 
                  onClick={handleLeaderMuteAll}
                >
                  全体静音
                </Button>
                <Button 
                  size="small"
                  type={isForceCalling ? 'primary' : 'default'}
                  danger={isForceCalling}
                  icon={<Radio size={14} />} 
                  onClick={handleLeaderForceCall}
                >
                  {isForceCalling ? '停止强呼' : '全体强呼'}
                </Button>
              </Space>
            )}
            <Button 
              id="mic-toggle-btn"
              icon={micOn ? <Mic size={16} /> : <MicOff size={16} />} 
              onClick={handleMicToggle}
              type={micOn ? 'primary' : 'default'}
              danger={!micOn}
            >
              麦克风: {micOn ? '开启' : '关闭'}
            </Button>
            <Button 
              icon={speakerOn ? <Headphones size={16} /> : <HeadphoneOff size={16} />} 
              onClick={handleSpeakerToggle}
              type={speakerOn ? 'primary' : 'default'}
            >
              收听: {speakerOn ? '开启' : '关闭'}
            </Button>
          </Space>
        </div>

        <div style={{ marginTop: '20px', padding: '40px', background: '#f9f9f9', borderRadius: '12px', textAlign: 'center', border: '2px solid #e6f7ff' }}>
          <div style={{ marginBottom: '20px' }}>
            <Badge status="processing" text={<Text type="secondary">当前登录身份：<Text strong color="blue">{user?.username}</Text></Text>} />
          </div>
          <Title level={4} style={{ marginBottom: '30px' }}>
            {currentRoom?.status === 'preparing' ? '作战广播：当前全员互通' : '指挥雷达：当前可对话成员'}
          </Title>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
            {talkableUsers.length === 0 ? (
              <div style={{ padding: '20px', color: '#999' }}>
                {currentRoom?.status === 'assaulting' && !currentRoom.users.find(u => u.id === user?.id)?.teamId ? '⚠️ 尚未入队，处于静默状态' : '当前暂无有效对话对象'}
              </div>
            ) : (
              talkableUsers.map(u => (
                <div key={u.id} style={{ textAlign: 'center' }}>
                  <Badge dot={u.id === user?.id ? localSpeaking : speakingUsers.has(u.id)} color="green" offset={[-10, 50]}>
                    <Avatar 
                      size={64} 
                      src={u.avatar} 
                      icon={<User size={32} />} 
                      style={{ 
                        border: (u.id === user?.id ? localSpeaking : speakingUsers.has(u.id)) ? '4px solid #52c41a' : '2px solid #fff',
                        boxShadow: (u.id === user?.id ? localSpeaking : speakingUsers.has(u.id)) ? '0 0 20px #52c41a' : '0 2px 8px rgba(0,0,0,0.1)',
                        transition: 'all 0.3s ease',
                        backgroundColor: u.teamId ? currentRoom?.teams.find(t => t.id === u.teamId)?.teamColor : '#ccc'
                      }} 
                    />
                  </Badge>
                  <div style={{ marginTop: '12px' }}>
                    <Space direction="vertical" size={0}>
                      <Text strong={(u.id === user?.id ? localSpeaking : speakingUsers.has(u.id))} style={{ fontSize: '14px' }}>{u.username}</Text>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                        {currentRoom?.leaderId === u.id && <Tag color="gold" style={{ margin: 0, transform: 'scale(0.8)' }}>团长</Tag>}
                        {u.roomRole === 'captain' && <Tag color="blue" style={{ margin: 0, transform: 'scale(0.8)' }}>队长</Tag>}
                      </div>
                    </Space>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 音频设置与状态 */}
        <div style={{ marginTop: '20px', padding: '16px', background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: '8px' }}>
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <Text strong style={{ fontSize: '14px' }}>输入设备</Text>
              <select 
                value={selectedDeviceId} 
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                style={{ fontSize: '14px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #d9d9d9' }}
                disabled={micOn}
              >
                {devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `设备 ${d.deviceId.slice(0,5)}`}</option>
                ))}
              </select>
            </Space>
            <Badge 
              status={iceState.send === 'connected' ? 'success' : 'processing'} 
              text={iceState.send === 'connected' ? '语音通道已加密连通' : '正在建立连接...'} 
            />
          </div>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              接收流: <Text strong>{audioNodesRef.current.size}</Text>
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>输出音量:</Text>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={outputVolume} 
                onChange={(e) => setOutputVolume(parseInt(e.target.value))}
                style={{ width: '80px', height: '4px' }}
              />
              <Text strong style={{ fontSize: '12px', minWidth: '25px' }}>{outputVolume}%</Text>
            </div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              网络模式: <Text strong>{iceState.send === 'connected' ? '混合模式 (UDP/TCP)' : '探测中'}</Text>
            </Text>
          </div>
        </div>
      </Content>
    </Layout>
  );
};

export default RoomPage;
