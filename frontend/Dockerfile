# 构建阶段
FROM node:20-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# 接收构建参数
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# 执行构建
RUN npm run build

# 运行阶段
FROM nginx:stable-alpine

# 拷贝静态资源
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 手动创建一个最稳的 Nginx 配置文件
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
