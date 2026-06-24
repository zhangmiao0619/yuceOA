# OA 办公系统

基于企业微信的办公 OA 系统，支持项目管理、任务看板、审批流程等功能。

## 技术栈

- **前端**: React 18 + TypeScript + Ant Design + Vite
- **后端**: Node.js + Hono + PostgreSQL + Drizzle ORM
- **部署**: Docker + Docker Compose

## 快速开始

### 1. 克隆项目

```bash
git clone <项目地址>
cd oa-system
```

### 2. 部署运行

```bash
# Mac mini 部署
./deploy.sh
```

### 3. 访问系统

- 前端: http://localhost
- 后端 API: http://localhost:3000

## 开发环境

```bash
# 后端
cd backend
npm install
npm run dev

# 前端
cd frontend
npm install
npm run dev
```

## 功能模块

- [x] 用户登录（企业微信接入）
- [x] 项目管理
- [x] 任务看板
- [ ] 审批流程
- [ ] 考勤管理
- [ ] 报表统计

## 数据备份

```bash
./scripts/backup.sh
```

自动备份到本地和 NAS（如已配置）。

## 企业微信配置

1. 登录企业微信管理后台
2. 创建自建应用
3. 配置可信域名
4. 获取 CorpID 和 AgentID
5. 填入系统设置

## 维护

- 日志查看: `docker compose logs -f`
- 数据库迁移: `cd backend && npx drizzle-kit migrate`
- 更新部署: `docker compose pull && docker compose up -d`