import React, { useEffect, useState } from 'react';
import { Layout, Button, Input, Modal, message } from 'antd';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useRoomStore } from './store/roomStore';
import RoomList from './pages/RoomList';
import RoomPage from './pages/RoomPage';

const { Header, Content, Footer } = Layout;

const App: React.FC = () => {
  const { user, token, initAuth, guestLogin, logout } = useAuthStore();
  const { currentRoom, connectSocket, disconnectSocket } = useRoomStore();
  const [isLoginModalVisible, setIsLoginModalVisible] = useState(false);
  const [guestName, setGuestName] = useState('');
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
      // 如果已登录且在首页，且有当前房间，跳转到房间
      if (currentRoom) {
        navigate(`/room/${currentRoom.id}`);
      }
    }
  }, [user, currentRoom, location.pathname]);

  const handleGuestLogin = async () => {
    try {
      await guestLogin(guestName);
      setIsLoginModalVisible(false);
      message.success('登录成功');
    } catch (error) {
      message.error('登录失败');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
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
              <span style={{ marginRight: '16px' }}>{user.username}</span>
              <Button type="primary" danger onClick={handleLogout}>退出</Button>
            </div>
          ) : (
            <Button type="primary" onClick={() => setIsLoginModalVisible(true)}>游客登录</Button>
          )}
        </div>
      </Header>
      <Content style={{ padding: '24px', minHeight: '280px', width: '100%' }}>
        {!user ? (
          <div style={{ textAlign: 'center', marginTop: '100px', background: '#fff', padding: '50px', borderRadius: '8px' }}>
            <h1>欢迎使用游戏语音服务</h1>
            <p>请先登录以进入房间</p>
            <Button type="primary" size="large" onClick={() => setIsLoginModalVisible(true)}>
              立即进入
            </Button>
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
        title="游客登录"
        open={isLoginModalVisible}
        onOk={handleGuestLogin}
        onCancel={() => setIsLoginModalVisible(false)}
      >
        <Input
          placeholder="请输入你的昵称 (可选)"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          onPressEnter={handleGuestLogin}
        />
      </Modal>
    </Layout>
  );
};

export default App;
