import React, { useEffect, useState } from 'react';
import { Layout, Button, Input, Modal, message, Typography, Space, Tag } from 'antd';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import api from './api/client';
import { useAuthStore } from './store/authStore';
import { useRoomStore } from './store/roomStore';
import RoomList from './pages/RoomList';
import RoomPage from './pages/RoomPage';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

const App: React.FC = () => {
  const { user, token, initialized, initAuth, guestLogin, register, login, logout } = useAuthStore();
  const { currentRoom, connectSocket, disconnectSocket, resetRoom } = useRoomStore();
  const [isAuthModalVisible, setIsAuthModalVisible] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'guest'>('guest');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (token) {
      connectSocket(token);
    } else {
      disconnectSocket();
    }
  }, [token]);

  // 处理登录后的跳转
  useEffect(() => {
    if (user && location.pathname === '/') {
      if (currentRoom) {
        navigate(`/room/${currentRoom.id}`);
      }
    }
  }, [user, currentRoom, location.pathname]);

  if (!initialized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Title level={2}>正在加载语音服务...</Title>
      </div>
    );
  }

  const handleAuth = async () => {
    if (!username && authMode !== 'guest') {
      message.warning('请输入账号');
      return;
    }
    if (!password && authMode !== 'guest') {
      message.warning('请输入密码');
      return;
    }

    setConfirmLoading(true);
    try {
      if (authMode === 'guest') {
        await guestLogin(username);
      } else if (authMode === 'login') {
        await login(username, password);
      } else if (authMode === 'register') {
        await register(username, password);
      }
      setIsAuthModalVisible(false);
      setUsername('');
      setPassword('');
      message.success('登录成功');
    } catch (error: any) {
      console.error('Auth error:', error);
      message.error(error.response?.data?.message || '操作失败，请检查网络或账号密码');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    resetRoom();
    navigate('/');
  };

  const handlePurgeData = async () => {
    Modal.confirm({
      title: '危险操作：清理所有数据',
      content: '这将备份并删除所有用户、房间、编队和登录记录。此操作不可撤销（除非从备份文件手动恢复）。确定要继续吗？',
      okText: '确定清理',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await api.post('/auth/purge-data');
          message.success(`数据清理成功！已备份至: ${response.data.backupFile}`);
          logout();
          navigate('/');
        } catch (error: any) {
          message.error(error.response?.data?.message || '清理失败');
        }
      },
    });
  };

  return (
    <Layout className="layout" style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="logo" style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => navigate('/')}>
          游戏语音服务
        </div>
        <div>
          {user ? (
            <div style={{ color: 'white' }}>
              <span style={{ marginRight: '16px' }}>
                {user.username} {user.accountRole === 'admin' && <Tag color="red">管理员</Tag>}
              </span>
              <Space>
                {user.accountRole === 'admin' && (
                  <Button type="default" danger onClick={handlePurgeData}>
                    清理全站数据
                  </Button>
                )}
                <Button type="primary" danger onClick={handleLogout}>退出</Button>
              </Space>
            </div>
          ) : (
            <Space>
              <Button type="link" style={{ color: 'white' }} onClick={() => { setAuthMode('login'); setIsAuthModalVisible(true); }}>登录</Button>
              <Button type="primary" onClick={() => { setAuthMode('guest'); setIsAuthModalVisible(true); }}>立即进入</Button>
            </Space>
          )}
        </div>
      </Header>
      <Content style={{ padding: '24px', minHeight: '280px', width: '100%' }}>
        {!user ? (
          <div style={{ textAlign: 'center', marginTop: '100px', background: '#fff', padding: '50px', borderRadius: '8px' }}>
            <h1>欢迎使用游戏语音服务</h1>
            <p>即刻加入多人语音，支持编队管控</p>
            <Space size="large" style={{ marginTop: '24px' }}>
              <Button type="primary" size="large" onClick={() => { setAuthMode('guest'); setIsAuthModalVisible(true); }}>
                游客进入
              </Button>
              <Button size="large" onClick={() => { setAuthMode('login'); setIsAuthModalVisible(true); }}>
                账号登录
              </Button>
            </Space>
          </div>
        ) : (
          <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
            <Routes>
              <Route path="/" element={<RoomList />} />
              <Route path="/room/:id" element={<RoomPage />} />
            </Routes>
          </div>
        )}
      </Content>
      <Footer style={{ textAlign: 'center' }}>Game Voice Service ©2026 Created by AI Assistant</Footer>

             <Modal
               title={authMode === 'guest' ? '游客进入' : authMode === 'login' ? '账号登录' : '注册账号'}
               open={isAuthModalVisible}
               onOk={handleAuth}
               onCancel={() => setIsAuthModalVisible(false)}
               confirmLoading={confirmLoading}
               okText={authMode === 'register' ? '注册并登录' : '进入'}
             >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <div style={{ marginBottom: '8px' }}>昵称/账号</div>
            <Input
              placeholder={authMode === 'guest' ? '请输入昵称 (可选)' : '请输入账号'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onPressEnter={handleAuth}
            />
          </div>
          
          {authMode !== 'guest' && (
            <div>
              <div style={{ marginBottom: '8px' }}>密码</div>
              <Input.Password
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onPressEnter={handleAuth}
              />
            </div>
          )}

          {authMode === 'login' && (
            <div style={{ textAlign: 'right' }}>
              <Button type="link" onClick={() => setAuthMode('register')}>还没有账号？立即注册</Button>
            </div>
          )}
          {authMode === 'register' && (
            <div style={{ textAlign: 'right' }}>
              <Button type="link" onClick={() => setAuthMode('login')}>已有账号？去登录</Button>
            </div>
          )}
        </Space>
      </Modal>
    </Layout>
  );
};

export default App;
