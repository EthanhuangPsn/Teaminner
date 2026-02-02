import React, { useState, useEffect, useRef } from 'react';
import { Layout, Row, Col, Card, Avatar, Tag, Button, Space, List, Badge, Typography, message, Collapse } from 'antd';
import { useRoomStore } from '../store/roomStore';
import { useAuthStore } from '../store/authStore';
import { Mic, MicOff, Headphones, HeadphoneOff, ArrowLeft, Shield, User, Star, Users } from 'lucide-react';
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
  
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const initializingRef = useRef(false);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // 定期更新 ICE 状态
  useEffect(() => {
    const timer = setInterval(() => {
      if (webrtcRef.current) {
        setIceState(webrtcRef.current.getIceState());
      }
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // 获取设备列表
  useEffect(() => {
    const getDevices = async () => {
      try {
        // 先请求一次权限，否则拿不到设备 label
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

  useEffect(() => {
    if (localStream && micOn) {
      const initAudioContext = async () => {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        
        const source = ctx.createMediaStreamSource(localStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkVolume = () => {
          if (!micOn || !analyserRef.current) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          // 调低阈值到 5，并增加日志
          if (average > 5) {
            setLocalSpeaking(true);
          } else {
            setLocalSpeaking(false);
          }
          requestAnimationFrame(checkVolume);
        };

        checkVolume();
      };

      initAudioContext();

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

  // 全局点击激活音频上下文
  useEffect(() => {
    const handleGesture = () => {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };
    window.addEventListener('click', handleGesture);
    return () => window.removeEventListener('click', handleGesture);
  }, []);

  useEffect(() => {
    if (id) {
      fetchRoom(id);
    }
  }, [id, fetchRoom]);

  // 核心优化：如果进入了房间页面但不在成员列表中，自动执行加入逻辑
  useEffect(() => {
    if (currentRoom && user && !currentRoom.users.find(u => u.id === user.id)) {
      console.log('Detected user not in room, joining...');
      useRoomStore.getState().joinRoom(currentRoom.id).catch(err => {
        message.error('自动加入房间失败');
        navigate('/');
      });
    }
  }, [currentRoom, user, navigate]);

  // WebRTC 初始化
  useEffect(() => {
    if (socket && id && user && !webrtcRef.current && !initializingRef.current) {
      initializingRef.current = true;
      const manager = new WebRTCManager(socket, id, user.id);
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
    const newStatus = currentRoom.status === 'preparing' ? 'assaulting' : 'preparing';
    await toggleStatus(newStatus);
    message.success(`房间状态已切换为: ${newStatus === 'preparing' ? '备战' : '攻坚'}`);
  };

  const handleJoinTeam = async (teamId: string) => {
    try {
      await api.post(`/teams/${teamId}/join`);
      fetchRoom(currentRoom.id); // 刷新房间状态
      message.success('已加入小队');
    } catch (error) {
      message.error('加入小队失败');
    }
  };

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
          } 
        });
        
        setLocalStream(stream);
        if (webrtcRef.current) {
          await webrtcRef.current.startProducing(stream.getAudioTracks()[0]);
        }
        setMicOn(true);
        await api.patch(`/users/${user.id}`, { micEnabled: true });
        message.success('麦克风已开启');
      } catch (err) {
        message.error('无法获取麦克风权限');
      }
    } else {
      localStream?.getTracks().forEach(track => track.stop());
      setLocalStream(null);
      setMicOn(false);
      await api.patch(`/users/${user.id}`, { micEnabled: false });
      message.info('麦克风已关闭');
    }
  };

  const handleSpeakerToggle = async () => {
    const newSpeakerState = !speakerOn;
    setSpeakerOn(newSpeakerState);
    await api.patch(`/users/${user.id}`, { speakerEnabled: newSpeakerState });
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
      const alreadySubscribed = audioElementsRef.current.has(u.id);

      if (!isMe && isMicOn && !alreadySubscribed) {
        try {
          const consumer = await webrtcRef.current!.consume(u.id);
          if (consumer) {
            const stream = new MediaStream([consumer.track]);
            const audio = new Audio();
            audio.srcObject = stream;
            audio.autoplay = true;
            
            if (audioContainerRef.current) {
              audioContainerRef.current.appendChild(audio);
            }
            
            audio.play().catch(() => {});
            audioElementsRef.current.set(u.id, audio);
          }
        } catch (err: any) {}
      } 
      else if (!isMe && !isMicOn && alreadySubscribed) {
        const audio = audioElementsRef.current.get(u.id);
        audio?.pause();
        if (audio && audio.parentNode) {
          audio.parentNode.removeChild(audio);
        }
        audioElementsRef.current.delete(u.id);
      }
    });

    // 清理已经离开房间的用户
    const currentMemberIds = new Set(currentRoom.users.map(u => u.id));
    audioElementsRef.current.forEach((audio, userId) => {
      if (!currentMemberIds.has(userId)) {
        audio.pause();
        if (audio.parentNode) {
          audio.parentNode.removeChild(audio);
        }
        audioElementsRef.current.delete(userId);
      }
    });

  }, [currentRoom, user, speakerOn]);

  // 计算当前“谁能听到我”列表
  const talkableUsers = currentRoom.users.filter(u => {
    // 1. 自己始终不显示在“可对话”列表中（避免冗余）
    if (u.id === user.id) return false;

    // 2. 如果是备战状态，所有人互通
    if (currentRoom.status === 'preparing') return true;

    // 3. 攻坚状态下的过滤逻辑（匹配后端路由算法）
    const myRole = currentRoom.users.find(x => x.id === user.id)?.roomRole || 'member';
    const myTeamId = currentRoom.users.find(x => x.id === user.id)?.teamId;
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
  });

  const unassignedUsers = currentRoom?.users?.filter(u => !u.teamId) || [];

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
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', paddingRight: '24px' }}>
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
              <List
                itemLayout="horizontal"
                dataSource={team.members}
                renderItem={(m: any) => (
                  <List.Item style={{ padding: '8px 4px' }}>
                    <List.Item.Meta
                      avatar={
                        <Badge dot={m.id === user.id ? localSpeaking : speakingUsers.has(m.id)} color="green" offset={[-2, 28]}>
                          <Avatar size="small" src={m.avatar} icon={<User size={12} />} />
                        </Badge>
                      }
                      title={
                        <Space size={4}>
                          <span style={{ fontSize: '14px' }}>{m.username}</span>
                          {team.captainId === m.id && <Shield size={12} color="#1890ff" />}
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
                )}
              />
            </Panel>
          ))}

          {/* 未分队人员 */}
          {unassignedUsers.length > 0 && (
            <Panel 
              header={<Space><Users size={16} /><span>未分队 ({unassignedUsers.length})</span></Space>} 
              key="unassigned"
            >
              <List
                itemLayout="horizontal"
                dataSource={unassignedUsers}
                renderItem={(u) => (
                  <List.Item style={{ padding: '8px 4px' }}>
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
                )}
              />
            </Panel>
          )}
        </Collapse>
      </Sider>
      
      <Content style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>{currentRoom.roomName}</Title>
            <Space>
              <Text type="secondary">状态: </Text>
              <Tag color={currentRoom.status === 'preparing' ? 'green' : 'red'}>
                {currentRoom.status === 'preparing' ? '备战中' : '攻坚中'}
              </Tag>
            </Space>
          </div>
          
          <Space>
            {isLeader && (
              <Button type="primary" onClick={handleToggleStatus}>
                切换为{currentRoom.status === 'preparing' ? '攻坚' : '备战'}状态
              </Button>
            )}
            <Button 
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
            <Badge status="processing" text={<Text type="secondary">当前登录身份：<Text strong color="blue">{user.username}</Text></Text>} />
          </div>
          <Title level={4} style={{ marginBottom: '30px' }}>
            {currentRoom.status === 'preparing' ? '作战广播：当前全员互通' : '指挥雷达：当前可对话成员'}
          </Title>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
            {talkableUsers.length === 0 ? (
              <div style={{ padding: '20px', color: '#999' }}>
                {currentRoom.status === 'assaulting' && !user.teamId ? '⚠️ 尚未入队，处于静默状态' : '当前暂无有效对话对象'}
              </div>
            ) : (
              talkableUsers.map(u => (
                <div key={u.id} style={{ textAlign: 'center' }}>
                  <Badge dot={u.id === user.id ? localSpeaking : speakingUsers.has(u.id)} color="green" offset={[-10, 50]}>
                    <Avatar 
                      size={64} 
                      src={u.avatar} 
                      icon={<User size={32} />} 
                      style={{ 
                        border: (u.id === user.id ? localSpeaking : speakingUsers.has(u.id)) ? '4px solid #52c41a' : '2px solid #fff',
                        boxShadow: (u.id === user.id ? localSpeaking : speakingUsers.has(u.id)) ? '0 0 20px #52c41a' : '0 2px 8px rgba(0,0,0,0.1)',
                        transition: 'all 0.3s ease',
                        backgroundColor: u.teamId ? currentRoom.teams.find(t => t.id === u.teamId)?.teamColor : '#ccc'
                      }} 
                    />
                  </Badge>
                  <div style={{ marginTop: '12px' }}>
                    <Space direction="vertical" size={0}>
                      <Text strong={(u.id === user.id ? localSpeaking : speakingUsers.has(u.id))} style={{ fontSize: '14px' }}>{u.username}</Text>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                        {currentRoom.leaderId === u.id && <Tag color="gold" style={{ margin: 0, transform: 'scale(0.8)' }}>团长</Tag>}
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
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              接收流: <Text strong>{audioElementsRef.current.size}</Text>
            </Text>
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
