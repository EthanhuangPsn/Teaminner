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
  
  const webrtcRef = useRef<WebRTCManager | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    if (id) {
      fetchRoom(id);
    }
  }, [id, fetchRoom]);

  // WebRTC 初始化
  useEffect(() => {
    if (socket && id && user && !webrtcRef.current) {
      const manager = new WebRTCManager(socket, id, user.id);
      manager.init().then(success => {
        if (success) {
          webrtcRef.current = manager;
          console.log('WebRTC Manager initialized');
        }
      });

      return () => {
        manager.close();
        webrtcRef.current = null;
        // 清理所有音频元素
        audioElementsRef.current.forEach(audio => {
          audio.pause();
          audio.srcObject = null;
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
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
          } 
        });
        setLocalStream(stream);
        if (webrtcRef.current) {
          await webrtcRef.current.startProducing(stream.getAudioTracks()[0]);
        }
        setMicOn(true);
        // 同步状态到后端
        await api.patch(`/users/${user.id}`, { micEnabled: true });
        message.success('麦克风已开启');
      } catch (err) {
        message.error('无法获取麦克风权限');
      }
    } else {
      localStream?.getTracks().forEach(track => track.stop());
      setLocalStream(null);
      setMicOn(false);
      // 同步状态到后端
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
      // 只有当对方开启了麦克风，且我们还没收听他时
      if (u.id !== user.id && u.micEnabled && !audioElementsRef.current.has(u.id)) {
        try {
          const consumer = await webrtcRef.current!.consume(u.id);
          if (consumer) {
            const stream = new MediaStream([consumer.track]);
            const audio = new Audio();
            audio.srcObject = stream;
            audio.play().catch(e => console.error('播放失败', e));
            audioElementsRef.current.set(u.id, audio);
            console.log(`正在收听用户: ${u.username}`);
          }
        } catch (err) {
          console.warn(`无法收听用户 ${u.username} 的音频:`, err);
        }
      } 
      // 如果对方关闭了麦克风，而我们还在收听，则清理
      else if (u.id !== user.id && !u.micEnabled && audioElementsRef.current.has(u.id)) {
        const audio = audioElementsRef.current.get(u.id);
        audio?.pause();
        audioElementsRef.current.delete(u.id);
      }
    });

    // 清理那些已经不在房间的用户
    const currentMemberIds = new Set(currentRoom.users.map(u => u.id));
    audioElementsRef.current.forEach((audio, userId) => {
      if (!currentMemberIds.has(userId)) {
        audio.pause();
        audioElementsRef.current.delete(userId);
      }
    });

  }, [currentRoom, user, speakerOn]);

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
                        <Badge dot={speakingUsers.has(m.id)} color="green" offset={[-2, 28]}>
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
                        <Badge dot={speakingUsers.has(u.id)} color="green" offset={[-2, 28]}>
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

        <div style={{ marginTop: '20px', padding: '40px', background: '#f9f9f9', borderRadius: '12px', textAlign: 'center' }}>
          <Title level={4} style={{ marginBottom: '30px' }}>实时语音状态</Title>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
            {currentRoom.users.map(u => (
              <div key={u.id} style={{ textAlign: 'center' }}>
                <Badge dot={speakingUsers.has(u.id)} color="green" offset={[-10, 50]}>
                  <Avatar 
                    size={64} 
                    src={u.avatar} 
                    icon={<User size={32} />} 
                    style={{ 
                      border: speakingUsers.has(u.id) ? '4px solid #52c41a' : '2px solid #fff',
                      boxShadow: speakingUsers.has(u.id) ? '0 0 20px #52c41a' : '0 2px 8px rgba(0,0,0,0.1)',
                      transition: 'all 0.3s ease',
                      backgroundColor: u.teamId ? currentRoom.teams.find(t => t.id === u.teamId)?.teamColor : '#ccc'
                    }} 
                  />
                </Badge>
                <div style={{ marginTop: '12px' }}>
                  <Space direction="vertical" size={0}>
                    <Text strong={speakingUsers.has(u.id)} style={{ fontSize: '14px' }}>{u.username}</Text>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                      {u.id === user.id && <Tag color="blue" style={{ margin: 0, transform: 'scale(0.8)' }}>我</Tag>}
                      {currentRoom.leaderId === u.id && <Tag color="gold" style={{ margin: 0, transform: 'scale(0.8)' }}>团长</Tag>}
                    </div>
                  </Space>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Content>
    </Layout>
  );
};

export default RoomPage;
