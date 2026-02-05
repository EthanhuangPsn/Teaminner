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

# 启动脚本：自动执行数据库迁移并启动服务
# 注意：在 Railway 中我们会将数据库文件重定向到持久化卷
CMD ["sh", "-c", "npx prisma db push && npm run start:prod"]
