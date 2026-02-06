import axios from 'axios';

// 添加这行日志，方便在浏览器控制台确认地址是否注入成功
console.log('--- 调试：环境变量 VITE_API_URL ---', import.meta.env.VITE_API_URL);
console.log('--- 调试：运行时配置 window.APP_CONFIG ---', (window as any).APP_CONFIG);

const getBaseURL = () => {
  // 1. 优先使用运行时注入的配置 (window.APP_CONFIG)
  if ((window as any).APP_CONFIG?.VITE_API_URL) {
    return (window as any).APP_CONFIG.VITE_API_URL;
  }
  // 2. 其次使用构建时环境变量
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // 3. 最后兜底本地地址
  return 'http://localhost:3000';
};

const api = axios.create({
  baseURL: getBaseURL(),
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
