#!/bin/bash

# OA 系统数据备份脚本

set -e

BACKUP_DIR="./data/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="oa_backup_${DATE}.sql"

echo "📦 开始备份 OA 系统数据..."

# 确保备份目录存在
mkdir -p ${BACKUP_DIR}

# 备份数据库
docker exec oa-db pg_dump -U oa_user -d oa_system > "${BACKUP_DIR}/${BACKUP_FILE}"

# 压缩备份文件
gzip "${BACKUP_DIR}/${BACKUP_FILE}"

echo "✅ 备份完成: ${BACKUP_DIR}/${BACKUP_FILE}.gz"

# 保留最近 7 天的备份
echo "🧹 清理旧备份..."
find ${BACKUP_DIR} -name "oa_backup_*.sql.gz" -mtime +7 -delete

echo "✅ 备份任务完成"

# 如果配置了 NAS 同步，执行 rsync
if [ -d "/Volumes/绿联NAS/backup" ]; then
    echo "🔄 同步到 NAS..."
    rsync -avz ${BACKUP_DIR}/ /Volumes/绿联NAS/backup/oa-system/
    echo "✅ NAS 同步完成"
fi