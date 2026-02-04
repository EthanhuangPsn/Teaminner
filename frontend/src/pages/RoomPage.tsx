import React, { useState, useEffect, useRef } from 'react';
import { Layout, Button, Space, List, Badge, Typography, message, Collapse, Avatar, Tag, Dropdown } from 'antd';
import { useRoomStore } from '../store/roomStore';
import { useAuthStore } from '../store/authStore';
import { Mic, MicOff, Headphones, HeadphoneOff, ArrowLeft, Shield, User, Users, Wifi, Activity, Radio } from 'lucide-react';
import api from '../api/client';
import { AgoraManager } from '../utils/agora';
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
  const [speakingUsers, setSpeakingUsers] = useState<Set<string>>(new Set());
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [outputVolume, setOutputVolume] = useState(60);
  const [isForceCalling, setIsForceCalling] = useState(false);
  const [allowedIds, setAllowedIds] = useState<string[]>([]);
  
  const agoraRef = useRef<AgoraManager | null>(null);
  const initializingRef = useRef(false);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);

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

  // 定期更新状态
  useEffect(() => {
    const timer = setInterval(() => {
      if (agoraRef.current) {
        // 声网会自动处理连接状态
      }
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // 实时调整音量 (考虑开关和音量滑块)
  useEffect(() => {
    if (agoraRef.current) {
      const targetVolume = speakerOn ? outputVolume : 0;
      agoraRef.current.setVolume(targetVolume);
    }
  }, [outputVolume, speakerOn]);

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

  // Agora 初始化
  useEffect(() => {
    // 增加严格的单例保护：如果已经有实例或正在初始化，则不执行
    if (!socket || !id || !user || agoraRef.current || initializingRef.current) return;

    initializingRef.current = true;
    
    const initAgora = async () => {
      let managerInstance: AgoraManager | null = null;
      try {
        console.log('[Agora] Starting initialization...');
        // 1. 获取 Token
        const { data } = await api.get('/audio/token', {
          params: { channelName: id }
        });
        
        console.log('[Agora] Token received:', data);
        
        // 2. 初始化 Agora 管理器
        managerInstance = new AgoraManager(
          data.appId,
          id,
          Number(data.uid),
          data.token
        );
        
        // 3. 执行 Join
        await managerInstance.join();
        
        // 4. 只有在成功 join 之后才挂载到 ref
        agoraRef.current = managerInstance;
        console.log('Agora RTC initialized and joined');
        
        if (micOn) {
          await managerInstance.publish();
        }
      } catch (err: any) {
        // 如果是 UID_CONFLICT，说明由于 React 并发特性已经有一个在跑了，我们忽略它
        if (err?.code === 'UID_CONFLICT' || err?.message?.includes('UID_CONFLICT')) {
          console.warn('[Agora] Ignored concurrent initialization');
          return;
        }
        console.error('Agora initialization failed:', err);
        message.error('音频服务连接失败，请刷新重试');
        initializingRef.current = false; // 只有真正的错误才允许重试
      }
    };

    initAgora();

    return () => {
      // 这里的清理要非常小心，如果正在初始化，不要轻易重置锁
      // 我们只在组件真正卸载时尝试离开
    };
  }, [socket, id, user]); // 只有核心依赖变化才重新初始化

  // 监听语音路由更新
  useEffect(() => {
    if (!socket) return;

    const handleRoutingUpdate = ({ allowedUserIds }: { allowedUserIds: string[] }) => {
      console.log('[RoomPage] Received audio routing update:', allowedUserIds);
      setAllowedIds(allowedUserIds);
    };

    socket.on('audio-routing-update', handleRoutingUpdate);
    return () => {
      socket.off('audio-routing-update', handleRoutingUpdate);
    };
  }, [socket]);

  // 当 Agora 实例或名单准备好时，同步名单
  useEffect(() => {
    // 关键修正：去掉 .length > 0 判定。即使名单为空（[]），也必须同步给 AgoraManager 去停止播放。
    if (agoraRef.current) {
      console.log('[RoomPage] Syncing allowed list to AgoraManager:', allowedIds);
      agoraRef.current.updateAllowedUsers(allowedIds);
    }
  }, [allowedIds, agoraRef.current]);

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

  const handleMicToggle = async () => {
    const newMicState = !micOn;
    if (newMicState) {
      try {
        await agoraRef.current?.publish();
        setMicOn(true);
        if (user) {
          await api.patch(`/users/${user.id}`, { micEnabled: true });
        }
        message.success('作战麦克风已开启 (声网链路激活)');
      } catch (err) {
        console.error('Failed to publish audio:', err);
        message.error('无法开启麦克风');
      }
    } else {
      await agoraRef.current?.unpublish();
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
    // 注意：updateRouting 在后端被触发后，会通过 socket 发回新的 allowedUserIds
    // 我们的 AgoraManager 会在 updateAllowedUsers 中处理音轨的播放与停止
    if (!newSpeakerState) {
      message.info('已停止收听');
    } else {
      message.success('已开启收听');
    }
  };

  // 说话者检测
  useEffect(() => {
    if (agoraRef.current && user && currentRoom) {
      const client = agoraRef.current.getInternalClient();
      
      const handleVolumeIndicator = (volumes: { uid: string | number, level: number }[]) => {
        const speakingSet = new Set<string>();
        let isLocalSpeaking = false;
        
        volumes.forEach(v => {
          if (v.level > 5) {
            const uidStr = v.uid.toString();
            // 0 代表本地，或者匹配本地分配的数字 UID
            if (v.uid === 0 || uidStr === agoraRef.current?.getUid().toString()) {
              isLocalSpeaking = true;
            } else {
              speakingSet.add(uidStr);
            }
          }
        });
        
        setSpeakingUsers(speakingSet);
        setLocalSpeaking(isLocalSpeaking);
      };

      client.enableAudioVolumeIndicator();
      client.on('volume-indicator', handleVolumeIndicator);
      
      return () => {
        client.off('volume-indicator', handleVolumeIndicator);
      };
    }
  }, [agoraRef.current, user, currentRoom]);

  // 辅助函数：判断用户是否正在说话 (支持 UUID 和 数字 UID 两种判定)
  const isUserSpeaking = (userId: string) => {
    // 1. 判定本地
    if (userId === user?.id) return localSpeaking;
    
    // 2. 判定 UUID 匹配
    if (speakingUsers.has(userId)) return true;
    
    // 3. 判定数字 UID 匹配 (将 UUID 转换为数字 ID 进行匹配)
    const numericId = parseInt(userId.replace(/-/g, '').slice(-8), 16).toString();
    if (speakingUsers.has(numericId)) return true;
    
    return false;
  };

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
                          <Badge dot={isUserSpeaking(m.id)} color="green" offset={[-2, 28]}>
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
                          <Badge dot={isUserSpeaking(u.id)} color="green" offset={[-2, 28]}>
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
                <Wifi size={12} color="#52c41a" />
                <Text type="secondary" style={{ fontSize: '10px' }}>
                  网络: SD-RTN (全球传输网络)
                </Text>
              </Space>
              
              <Space size={4}>
                <Activity size={12} color="#52c41a" />
                <Text type="secondary" style={{ fontSize: '10px' }}>
                  接收流: {currentRoom.users.filter(u => u.id !== user?.id && u.micEnabled).length}个
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
                  <Badge dot={isUserSpeaking(u.id)} color="green" offset={[-10, 50]}>
                    <Avatar 
                      size={64} 
                      src={u.avatar} 
                      icon={<User size={32} />} 
                      style={{ 
                        border: isUserSpeaking(u.id) ? '4px solid #52c41a' : '2px solid #fff',
                        boxShadow: isUserSpeaking(u.id) ? '0 0 20px #52c41a' : '0 2px 8px rgba(0,0,0,0.1)',
                        transition: 'all 0.3s ease',
                        backgroundColor: u.teamId ? currentRoom?.teams.find(t => t.id === u.teamId)?.teamColor : '#ccc'
                      }} 
                    />
                  </Badge>
                  <div style={{ marginTop: '12px' }}>
                    <Space direction="vertical" size={0}>
                      <Text strong={isUserSpeaking(u.id)} style={{ fontSize: '14px' }}>{u.username}</Text>
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
              status={agoraRef.current ? 'success' : 'processing'} 
              text={agoraRef.current ? '声网作战链路已加密连通' : '正在建立战术链路...'} 
            />
          </div>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              接收流: <Text strong>{currentRoom.users.filter(u => u.id !== user.id && u.micEnabled).length}</Text>
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
              网络模式: <Text strong>SD-RTN (全球传输网络)</Text>
            </Text>
          </div>
        </div>
      </Content>
    </Layout>
  );
};

export default RoomPage;
