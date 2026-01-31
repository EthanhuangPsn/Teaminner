import React, { useEffect } from 'react';
import { Card, List, Button, Tag, Space, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useRoomStore } from '../store/roomStore';
import { Users, LogIn } from 'lucide-react';

const RoomList: React.FC = () => {
  const { rooms, fetchRooms, joinRoom } = useRoomStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleJoin = async (roomId: string) => {
    try {
      await joinRoom(roomId);
      message.success('已加入房间');
      navigate(`/room/${roomId}`);
    } catch (error) {
      message.error('加入房间失败');
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>语音房间列表</h2>
      <List
        grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 4, xxl: 4 }}
        dataSource={rooms}
        renderItem={(room) => (
          <List.Item>
            <Card
              title={room.roomName}
              extra={
                <Tag color={room.status === 'preparing' ? 'green' : 'red'}>
                  {room.status === 'preparing' ? '备战中' : '攻坚中'}
                </Tag>
              }
              actions={[
                <Button 
                  type="primary" 
                  icon={<LogIn size={16} />} 
                  onClick={() => handleJoin(room.id)}
                  block
                >
                  进入房间
                </Button>
              ]}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Users size={16} style={{ marginRight: '8px' }} />
                  <span>在线人数: {room._count?.users || 0} / {room.maxUsers}</span>
                </div>
              </Space>
            </Card>
          </List.Item>
        )}
      />
    </div>
  );
};

export default RoomList;
