# 后端 Dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci

# 复制源代码
COPY . .

# 编译
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]