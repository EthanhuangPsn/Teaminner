FROM node:20-alpine

WORKDIR /app

# 安装必要的库
RUN apk add --no-cache openssl

# 拷贝依赖描述文件
COPY package*.json ./
COPY prisma ./prisma/

# 安装依赖
RUN npm install

# 拷贝所有代码
COPY . .

# 构建项目
RUN npm run build

# 生成 Prisma 客户端
RUN npx prisma generate

# 暴露端口
EXPOSE 3000

# 启动脚本：确保 /data 目录存在并同步数据库
CMD ["sh", "-c", "mkdir -p /data && npx prisma db push && npm run start:prod"]
