# OA系统迁移指南

## 📦 打包文件信息

- **打包文件路径**: `/Users/tianli/oa-system-migration.tar.gz`
- **文件大小**: 约69MB
- **包含内容**: 完整的OA系统源码、配置文件、数据库、文档
- **排除内容**: node_modules（可在目标机器重新安装）

## 🚀 迁移步骤

### 第一步：复制打包文件到目标Mac Mini

选择以下任一方式：

#### 方式1：使用移动硬盘/U盘
```bash
# 在源机器上（当前机器）
cp /Users/tianli/oa-system-migration.tar.gz /Volumes/YourUSBDrive/

# 在目标Mac Mini上
cp /Volumes/YourUSBDrive/oa-system-migration.tar.gz ~/Desktop/
```

#### 方式2：使用AirDrop
- 在Finder中找到 `/Users/tianli/oa-system-migration.tar.gz`
- 右键 → 共享 → AirDrop → 选择目标Mac Mini

#### 方式3：使用scp（同一网络）
```bash
# 在源机器上执行
scp /Users/tianli/oa-system-migration.tar.gz username@target-mac-ip:~/Desktop/
```

#### 方式4：使用云存储（iCloud/百度网盘等）
- 上传到云盘
- 在目标Mac Mini上下载

### 第二步：在目标Mac Mini上解压

```bash
# 进入桌面（或你希望存放的目录）
cd ~/Desktop

# 解压文件
tar -xzf oa-system-migration.tar.gz

# 进入项目目录
cd oa-system
```

### 第三步：安装依赖

#### 1. 确保已安装Node.js
```bash
# 检查Node.js版本（需要v18或更高）
node --version

# 如果没有安装，使用Homebrew安装
brew install node@22
```

#### 2. 安装后端依赖
```bash
cd backend
npm install

# 如果安装缓慢，可以使用淘宝镜像
npm install --registry=https://registry.npmmirror.com
cd ..
```

#### 3. 安装前端依赖
```bash
cd frontend
npm install

# 如果安装缓慢，可以使用淘宝镜像
npm install --registry=https://registry.npmmirror.com
cd ..
```

### 第四步：配置环境变量

```bash
# 检查.env文件是否存在
cat .env

# 如果需要修改配置，编辑.env文件
nano .env
```

默认的 `.env` 配置通常如下：
```
PORT=3000
JWT_SECRET=your-secret-key-here
DB_PATH=./backend/data/oa_system.db
FRONTEND_URL=http://localhost:5173
```

**重要**: 如果目标机器的端口被占用，请修改PORT值。

### 第五步：启动系统

#### 方式1：手动启动（开发模式）

**终端1 - 启动后端：**
```bash
cd backend
npm run dev
```

**终端2 - 启动前端：**
```bash
cd frontend
npm run dev
```

访问地址：
- 前端：http://localhost:5173
- 后端API：http://localhost:3000

#### 方式2：使用Docker启动（推荐用于生产环境）

```bash
# 确保已安装Docker
docker --version

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f
```

#### 方式3：使用启动脚本

```bash
# 赋予执行权限
chmod +x start.sh

# 运行启动脚本
./start.sh
```

### 第六步：验证迁移

1. **访问前端页面**
   - 打开浏览器，访问 http://localhost:5173
   - 应该能看到登录页面

2. **测试登录**
   - 用户名：admin
   - 密码：admin123

3. **检查数据完整性**
   - 登录后检查项目、任务、审批流程等数据是否正常
   - 检查财务模块是否正常工作

## 📋 迁移检查清单

- [ ] 打包文件已复制到目标Mac Mini
- [ ] 文件已解压到目标目录
- [ ] Node.js已安装（v18+）
- [ ] 后端依赖已安装（backend/node_modules）
- [ ] 前端依赖已安装（frontend/node_modules）
- [ ] 环境变量已配置（.env）
- [ ] 后端服务已启动（端口3000）
- [ ] 前端服务已启动（端口5173）
- [ ] 可以正常登录系统
- [ ] 数据完整性已验证

## 🔧 常见问题解决

### 问题1：端口被占用
```bash
# 检查端口占用
lsof -i :3000
lsof -i :5173

# 修改.env文件中的端口配置
# 或终止占用端口的进程
kill -9 <PID>
```

### 问题2：数据库文件权限
```bash
# 确保数据库文件可读写
chmod 666 backend/data/oa_system.db
```

### 问题3：node_modules安装失败
```bash
# 清除缓存后重试
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 问题4：前端构建失败
```bash
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

### 问题5：后端启动失败
```bash
cd backend
# 检查是否有语法错误
npm run build
# 查看详细错误日志
npm run dev 2>&1 | tee backend.log
```

## 📊 系统要求

### 最低配置
- **操作系统**: macOS 12+ (Monterey)
- **内存**: 4GB RAM
- **磁盘空间**: 2GB可用空间
- **Node.js**: v18.0.0 或更高

### 推荐配置
- **操作系统**: macOS 14+ (Sonoma)
- **内存**: 8GB RAM
- **磁盘空间**: 5GB可用空间
- **Node.js**: v22.0.0 或更高

## 🔒 安全建议

1. **修改默认密码**
   - 迁移完成后，立即修改admin用户的默认密码

2. **更新JWT密钥**
   - 修改 `.env` 文件中的 JWT_SECRET
   - 使用随机生成的强密码

3. **配置防火墙**
   - 如果暴露到公网，配置防火墙规则

4. **定期备份**
   ```bash
   # 备份数据库
   cp backend/data/oa_system.db backup/oa_system_$(date +%Y%m%d).db
   ```

## 📞 技术支持

如果在迁移过程中遇到问题：

1. 查看后端日志：`backend/` 目录下的控制台输出
2. 查看前端日志：浏览器开发者工具 (F12)
3. 检查系统状态：http://localhost:3000/health

## 📁 打包文件说明

打包文件包含以下内容：

```
oa-system/
├── backend/              # 后端源码（Hono + Drizzle ORM）
│   ├── src/              # 源代码
│   ├── data/             # SQLite数据库
│   └── package.json      # 依赖配置
├── frontend/             # 前端源码（React + Vite）
│   ├── src/              # 源代码
│   └── package.json      # 依赖配置
├── docs/                 # 文档（测试用例、部署指南等）
├── data/                 # 数据文件和备份
├── docker/               # Docker配置
├── nginx/                # Nginx配置
├── scripts/              # 脚本文件
├── .env                  # 环境变量
├── .env.example          # 环境变量示例
├── docker-compose.yml    # Docker Compose配置
├── docker-compose.nas.yml # NAS部署配置
├── deploy-nas.sh         # NAS部署脚本
├── start.sh              # 启动脚本
└── README.md             # 项目说明
```

## ✅ 迁移完成确认

完成所有步骤后，你应该能够：
- ✅ 访问 http://localhost:5173 看到登录页面
- ✅ 使用 admin/admin123 登录系统
- ✅ 看到所有项目、任务、审批、财务等数据
- ✅ 正常创建和管理所有业务数据

**迁移完成！** 🎉
