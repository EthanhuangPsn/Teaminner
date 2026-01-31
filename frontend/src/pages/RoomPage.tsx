import React, { useState, useEffect, useRef } from 'react';
import { Layout, Row, Col, Card, Avatar, Tag, Button, Space, List, Badge, Typography, message } from 'antd';
import { useRoomStore } from '../store/roomStore';
import { useAuthStore } from '../store/authStore';
import { Mic, MicOff, Headphones, HeadphoneOff, ArrowLeft, Shield, User, Star } from 'lucide-react';
import api from '../api/client';
import { WebRTCManager } from '../utils/webrtc';
import { useParams, useNavigate } from 'react-router-dom';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

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

  if (!currentRoom || !user) return null;

  const isLeader = currentRoom.leaderId === user.id;

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

  return (
    <Layout style={{ background: '#fff', borderRadius: '8px', overflow: 'hidden', minHeight: '80vh', border: '1px solid #f0f0f0' }}>
      <Sider width={280} theme="light" style={{ borderRight: '1px solid #f0f0f0', padding: '16px' }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>成员清单</Title>
          <Button type="text" icon={<ArrowLeft size={16} />} onClick={handleLeave}>退出</Button>
        </div>
        
        <List
          itemLayout="horizontal"
          dataSource={currentRoom.users}
          renderItem={(u) => (
            <List.Item>
              <List.Item.Meta
                avatar={<Avatar src={u.avatar} icon={<User size={16} />} />}
                title={
                  <Space>
                    <span>{u.username}</span>
                    {currentRoom.leaderId === u.id && <Tag color="gold" icon={<Star size={12} />}>团长</Tag>}
                    {u.roomRole === 'captain' && <Tag color="blue">队长</Tag>}
                  </Space>
                }
                description={
                  <Space>
                    {u.micEnabled ? <Mic size={14} color="green" /> : <MicOff size={14} color="red" />}
                    {u.speakerEnabled ? <Headphones size={14} color="green" /> : <HeadphoneOff size={14} color="red" />}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Sider>
      
      <Content style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>{currentRoom.roomName}</Title>
            <Text type="secondary">状态: </Text>
            <Tag color={currentRoom.status === 'preparing' ? 'green' : 'red'}>
              {currentRoom.status === 'preparing' ? '备战中' : '攻坚中'}
            </Tag>
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

        <Row gutter={[16, 16]}>
          {currentRoom.teams.map((team) => (
            <Col span={8} key={team.id}>
              <Card 
                title={`${team.teamColor.toUpperCase()} 小队`} 
                size="small"
                extra={
                  <Button type="link" onClick={() => handleJoinTeam(team.id)}>加入</Button>
                }
                style={{ borderColor: team.teamColor, borderTopWidth: '4px' }}
              >
                <List
                  size="small"
                  dataSource={team.members}
                  renderItem={(m: any) => (
                    <List.Item>
                      <Space>
                        <Avatar size="small" src={m.avatar} icon={<User size={12} />} />
                        <span>{m.username}</span>
                        {team.captainId === m.id && <Shield size={12} color="#1890ff" />}
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          ))}
        </Row>

        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <Title level={4}>当前可对话成员</Title>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
            {currentRoom.users.map(u => (
              <div key={u.id} style={{ textAlign: 'center' }}>
                <Badge dot={speakingUsers.has(u.id)} color="green" offset={[-10, 50]}>
                  <Avatar 
                    size={64} 
                    src={u.avatar} 
                    icon={<User size={32} />} 
                    style={{ 
                      border: speakingUsers.has(u.id) ? '3px solid #52c41a' : 'none',
                      boxShadow: speakingUsers.has(u.id) ? '0 0 15px #52c41a' : 'none',
                      transition: 'all 0.3s ease'
                    }} 
                  />
                </Badge>
                <div style={{ marginTop: '8px', fontWeight: speakingUsers.has(u.id) ? 'bold' : 'normal' }}>
                  {u.username}
                </div>
                {u.id === user.id && <Tag color="blue">我</Tag>}
              </div>
            ))}
          </div>
        </div>
      </Content>
    </Layout>
  );
};

export default RoomPage;
