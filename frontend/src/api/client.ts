import axios from 'axios';

// 添加这行日志！
console.log('--- 调试：当前 API 地址 ---', import.meta.env.VITE_API_URL);

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  // 回归主流：统一从 localStorage 获取 Token
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理 401 等全局错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 如果报错 401，说明 Token 失效，清理全局存储并重定向
      localStorage.removeItem('token');
      // 避免正在输入密码时突然跳转，可以加个简单的判断
      if (window.location.pathname !== '/') {
        window.location.href = '/'; 
      }
    }
    return Promise.reject(error);
  }
);

export default api;
