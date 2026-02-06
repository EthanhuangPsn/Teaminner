# 构建阶段
FROM node:20-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 运行阶段
FROM nginx:stable-alpine

# 拷贝静态资源
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 创建配置注入脚本
# 当容器启动时，它会将环境变量 VITE_API_URL 写入 config.js
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    location / { \
    root /usr/share/nginx/html; \
    index index.html; \
    try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# 使用 entrypoint 在启动时动态生成 config.js
CMD ["sh", "-c", "echo \"window.APP_CONFIG = { VITE_API_URL: '${VITE_API_URL}' };\" > /usr/share/nginx/html/config.js && nginx -g 'daemon off;'"]

EXPOSE 80