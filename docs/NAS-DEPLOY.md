# OA 系统 NAS 部署指南

## 支持的 NAS 系统

- **群晖 Synology DSM** (DSM 7.0+)
- **威联通 QNAP QTS**
- **TrueNAS / FreeNAS**
- **Unraid**
- **绿联 UGREEN**
- **极空间 ZSpace**
- **通用 Linux NAS**

## 前置要求

1. NAS 已安装 Docker 和 Docker Compose
2. NAS 架构：x86_64（Intel/AMD）或 ARM64（部分新 NAS）
3. 至少 4GB 可用内存
4. 至少 10GB 可用存储空间

## 快速部署步骤

### 1. 下载项目到 NAS

```bash
# 通过 SSH 连接到 NAS
ssh user@your-nas-ip

# 进入共享文件夹目录（根据你的 NAS 调整路径）
cd /volume1/docker  # 群晖示例
cd /share/Container  # 威联通示例

# 克隆项目（如果有 git）
git clone https://your-repo-url/oa-system.git
cd oa-system

# 或者通过 File Station / Files 应用上传项目文件夹
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改：

```bash
cp .env.example .env
nano .env  # 或 vi .env
```

**必需配置项**：

```env
# 数据库密码（必须修改！）
DB_PASSWORD=YourStrongPassword123

# JWT 密钥（必须修改！用于用户认证）
JWT_SECRET=your-random-secret-key-here

# 访问地址（改为你的 NAS IP 或域名）
FRONTEND_URL=http://192.168.1.100
# 或 FRONTEND_URL=https://oa.yourdomain.com

# 数据存储路径（根据 NAS 调整）
NAS_DATA_PATH=/volume1/docker/oa-system/data  # 群晖
# NAS_DATA_PATH=/share/Container/oa-system/data  # 威联通

# 端口映射（如果 80 端口被占用，修改为其他端口）
HTTP_PORT=8080
BACKEND_PORT=3000
DB_PORT=5432

# 企业微信（可选）
WECHAT_CORP_ID=your-corp-id
WECHAT_SECRET=your-secret
```

### 3. 启动服务

```bash
# 使用 NAS 专用配置启动
docker compose -f docker-compose.nas.yml up -d

# 查看日志
docker compose -f docker-compose.nas.yml logs -f

# 等待数据库初始化完成（约 30 秒）
```

### 4. 访问系统

打开浏览器访问：

```
http://your-nas-ip:8080  # 如果 HTTP_PORT=8080
http://your-nas-ip       # 如果 HTTP_PORT=80
```

**默认管理员账号**：
- 用户名：`admin`
- 密码：`admin123`

⚠️ **首次登录后请立即修改密码！**

## NAS 特定配置

### 群晖 Synology

1. **安装 Container Manager**（DSM 7.2+）或 Docker（旧版 DSM）
2. **开启 SSH**（控制面板 → 终端机和 SNMP → 启用 SSH）
3. **文件夹权限**：
   ```bash
   # 在 NAS 上执行
   sudo chown -R 1000:1000 /volume1/docker/oa-system/data
   ```
4. **防火墙**：控制面板 → 安全性 → 防火墙 → 允许端口 8080（或你配置的端口）

### 威联通 QNAP

1. **安装 Container Station**
2. **文件权限**：
   ```bash
   # 在 NAS 上执行
   sudo chown -R 1000:1000 /share/Container/oa-system/data
   ```
3. **网络**：确保 Container 可以访问外部网络（用于企业微信等集成）

### TrueNAS Scale

1. **创建数据集**：`tank/apps/oa-system`
2. **使用 TrueCharts 或直接 Docker**：
   ```bash
   # 在 TrueNAS Scale 的 shell 中
   cd /mnt/tank/apps/oa-system
   docker compose -f docker-compose.nas.yml up -d
   ```

### Unraid

1. **安装 Docker 和 Compose 插件**
2. **使用 User Scripts 插件**创建启动脚本
3. **路径映射**：修改 `NAS_DATA_PATH` 为 `/mnt/user/appdata/oa-system`

## 数据备份

### 自动备份（推荐）

```bash
# 创建备份脚本
mkdir -p scripts
cat > scripts/backup-nas.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="${NAS_DATA_PATH:-./data}/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# 备份数据库
docker exec oa-db pg_dump -U oa_user oa_system > "$BACKUP_DIR/db_backup_$DATE.sql"

# 备份上传文件
tar -czf "$BACKUP_DIR/uploads_backup_$DATE.tar.gz" -C "${NAS_DATA_PATH:-./data}" uploads

# 保留最近 30 个备份
ls -t "$BACKUP_DIR"/db_backup_*.sql | tail -n +31 | xargs rm -f
ls -t "$BACKUP_DIR"/uploads_backup_*.tar.gz | tail -n +31 | xargs rm -f

echo "✅ 备份完成: $DATE"
EOF

chmod +x scripts/backup-nas.sh

# 添加到定时任务（每天凌晨 2 点备份）
echo "0 2 * * * cd /path/to/oa-system && ./scripts/backup-nas.sh" | crontab -
```

### 群晖定时任务

1. 控制面板 → 任务计划 → 新增 → 触发事件 → 用户定义的脚本
2. 设置每天运行一次
3. 脚本内容：
   ```bash
   cd /volume1/docker/oa-system
   ./scripts/backup-nas.sh
   ```

## 常见问题

### 1. 端口冲突（80 端口被占用）

修改 `.env` 文件：
```env
HTTP_PORT=8080  # 改为其他端口
```

### 2. 数据库连接失败

检查日志：
```bash
docker compose -f docker-compose.nas.yml logs db
docker compose -f docker-compose.nas.yml logs backend
```

确保数据库健康检查通过后再启动后端。

### 3. 权限错误

```bash
# 修复数据目录权限
sudo chown -R 1000:1000 ${NAS_DATA_PATH}/postgres
sudo chmod 755 ${NAS_DATA_PATH}/postgres
```

### 4. 内存不足

如果 NAS 内存较小（< 4GB），可以限制容器内存：

编辑 `docker-compose.nas.yml`，为每个服务添加：
```yaml
deploy:
  resources:
    limits:
      memory: 512M
    reservations:
      memory: 256M
```

### 5. ARM 架构 NAS

如果你的 NAS 是 ARM 架构（如部分群晖、树莓派）：

1. 检查基础镜像是否支持 ARM：
   ```bash
   docker pull --platform linux/arm64 postgres:16-alpine
   docker pull --platform linux/arm64 node:20-alpine
   ```

2. 如需构建 ARM 镜像：
   ```bash
   docker buildx build --platform linux/arm64 -t oa-backend ./backend
   docker buildx build --platform linux/arm64 -t oa-frontend ./frontend
   ```

## 更新升级

```bash
cd /path/to/oa-system

# 拉取最新代码（如果使用 git）
git pull

# 重新构建并启动
docker compose -f docker-compose.nas.yml down
docker compose -f docker-compose.nas.yml pull  # 如果有外部镜像更新
docker compose -f docker-compose.nas.yml up --build -d

# 查看状态
docker compose -f docker-compose.nas.yml ps
```

## 卸载清理

```bash
cd /path/to/oa-system

# 停止并删除容器
docker compose -f docker-compose.nas.yml down

# 删除数据（谨慎操作！）
rm -rf ${NAS_DATA_PATH}/postgres
rm -rf ${NAS_DATA_PATH}/uploads

# 删除项目
cd ..
rm -rf oa-system
```

## 技术支持

如遇到问题，请检查：
1. Docker 和 Docker Compose 版本是否最新
2. NAS 剩余存储空间是否充足
3. NAS 防火墙是否放行相应端口
4. 查看容器日志：`docker compose -f docker-compose.nas.yml logs -f [服务名]`
