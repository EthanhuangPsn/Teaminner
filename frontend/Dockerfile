# 构建阶段
FROM node:20-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# 接收构建参数并写入环境变量
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# 运行阶段
FROM nginx:stable-alpine
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 配置 Nginx 支持 SPA 路由
RUN printf "server { \n\
    listen 80; \n\
    location / { \n\
        root /usr/share/nginx/html; \n\
        index index.html; \n\
        try_files \$uri \$uri/ /index.html; \n\
    } \n\
}" > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
