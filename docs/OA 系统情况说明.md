# OA 系统情况说明

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | React 18 + TypeScript + Vite |
| **UI 组件库** | Ant Design 5 |
| **前端状态管理** | Zustand |
| **HTTP 客户端** | Axios + React Query |
| **后端框架** | Hono (Node.js) |
| **数据库** | PostgreSQL 16 / better-sqlite3 (开发) + Drizzle ORM |
| **ORM** | Drizzle ORM |
| **认证** | JWT (jose 库) |
| **中间件** | Docker + Docker Compose |
| **Web 服务器** | Nginx (生产) |

## 核心业务

**解决的问题**：武汉宇测科技有限公司内部 OA 系统，实现测绘外业项目的全流程管理。

**主要流程**：
1. 用户使用用户名/密码登录（已移除企业微信）
2. 创建/管理测绘项目，分配任务
3. 员工进行考勤打卡（上班、请假、加班）
4. 提交日常工作日报
5. 审批流程（测绘成果、合同、采购等）
6. 财务管理（费用报销、成本统计）
7. 测绘外业记录与成果上传
8. 数据导出与分析报表

## 模块与职责

### 后端 (`backend/`)

| 模块 | 职责 |
|------|------|
| `routes/auth.ts` | 用户名/密码登录、JWT 认证 |
| `routes/projects.ts` | 项目管理 CRUD |
| `routes/tasks.ts` | 任务看板管理 |
| `routes/workflows.ts` | 审批流程引擎 |
| `routes/attendance.ts` | 考勤打卡、请假、加班 |
| `routes/timeTracking.ts` | 工时记录 |
| `routes/dailyReports.ts` | 日报提交与查看 |
| `routes/finance.ts` | 费用报销、成本统计 |
| `routes/contracts.ts` | 合同管理 |
| `routes/suppliers.ts` | 供应商管理 |
| `routes/clients.ts` | 客户管理 |
| `routes/assets.ts` | 资产管理 |
| `routes/survey.ts` | 测绘成果、外业记录 |
| `routes/alerts.ts` | 系统通知/提醒 |
| `routes/notifications.ts` | 消息通知 |
| `routes/wechat.ts` | 企业微信消息推送（仅消息功能保留，登录已禁用） |
| `routes/users.ts` | 用户管理 |
| `routes/uploads.ts` | 文件上传 |
| `routes/reports.ts` | 报表统计 |
| `routes/outsourcing.ts` | 外包管理 |
| `middleware/auth.ts` | JWT 中间件 |
| `middleware/permission.ts` | 权限控制 |
| `plugins/crop-audit/` | 流转审计插件 |
| `db/` | Drizzle ORM 数据库定义 |

### 前端 (`frontend/src/`)

| 模块 | 职责 |
|------|------|
| `pages/Login.tsx` | 用户名/密码登录页 |
| `pages/Dashboard.tsx` | 工作台首页 |
| `pages/Projects.tsx` | 项目列表 |
| `pages/ProjectDetail.tsx` | 项目详情 |
| `pages/Tasks.tsx` | 任务看板 |
| `pages/Workflows.tsx` | 审批流程 |
| `pages/Attendance.tsx` | 考勤管理 |
| `pages/TimeTracking.tsx` | 工时记录 |
| `pages/DailyReport.tsx` | 日报管理 |
| `pages/Finance.tsx` | 财务管理 |
| `pages/Contracts.tsx` | 合同管理 |
| `pages/SurveyProjects.tsx` | 测绘项目 |
| `pages/SurveyFieldRecords.tsx` | 外业记录 |
| `pages/SurveyDeliverables.tsx` | 测绘成果 |
| `pages/SurveyGantt.tsx` | 甘特图视图 |
| `pages/Reports.tsx` | 报表统计 |
| `pages/Assets.tsx` | 资产管理 |
| `pages/Outsourcing.tsx` | 外包管理 |
| `pages/SupplierManager.tsx` | 供应商管理 |
| `pages/AddressBook.tsx` | 通讯录 |
| `pages/Users.tsx` | 用户管理 |
| `pages/Alerts.tsx` | 消息通知 |
| `pages/EquipmentManagement.tsx` | 设备管理 |
| `pages/AdminSettings.tsx` | 系统设置 |
| `pages/DataExport.tsx` | 数据导出 |
| `components/Layout.tsx` | 主布局（侧边栏、顶栏） |
| `components/NotificationCenter.tsx` | 通知中心组件 |
| `stores/auth.ts` | 认证状态 (Zustand) |
| `lib/api.ts` | API 请求封装 |

## 代码结构

```
oa-system/
├── .env                      # 主环境配置
├── .env.example              # 环境配置模板
├── docker-compose.yml        # Docker Compose 配置
├── docker-compose.prod.yml   # 生产环境 Compose
├── docker-compose.nas.yml    # NAS 部署 Compose
├── deploy.sh                 # 部署脚本
├── deploy-to-server.sh       # 远程部署脚本
├── init.sql                  # 数据库初始化脚本
├── README.md
├── WORKLOG.md
├── MIGRATION-GUIDE.md
│
├── backend/
│   ├── src/
│   │   ├── index.ts          # Hono 入口
│   │   ├── db/
│   │   │   ├── index.ts      # 数据库连接
│   │   │   └── sqlite.ts
│   │   ├── schema/           # Drizzle ORM 表定义
│   │   ├── routes/           # API 路由
│   │   ├── middleware/       # auth, permission
│   │   ├── plugins/          # 流转审计插件
│   │   ├── services/         # 业务服务
│   │   └── types/            # TS 类型定义
│   ├── scripts/             # 脚本
│   ├── uploads/              # 上传文件目录
│   ├── public/               # 静态资源
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                  # 后端环境配置
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── components/       # 布局、通知组件
│   │   ├── pages/            # 各功能页面
│   │   ├── stores/           # Zustand 状态
│   │   ├── lib/              # API 封装
│   │   └── types/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── Dockerfile
│
├── docker/
│   └── docker-compose.yml
│
├── nginx/
├── scripts/
├── data/                     # PostgreSQL 数据卷
└── docs/                      # 文档
```

## 关键配置

### 数据库连接

**开发环境** (`backend/.env`):
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=oa_system
DB_USER=oauser
DB_PASSWORD=oa123456
```

**生产环境** (`docker-compose.yml`):
```
POSTGRES_DB: oa_system
POSTGRES_USER: oa_user
POSTGRES_PASSWORD: oa_password
```

### 外部 API

~~**企业微信登录**（已禁用 2026-05-09）~~
```
WECHAT_CORP_ID=ww7885fa978ebab1db
WECHAT_AGENT_ID=1000014
WECHAT_SECRET=<secret>
```

### 环境变量

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | JWT 签名密钥 |
| `FRONTEND_URL` | 前端地址（用于 CORS） |
| `PORT` | 后端端口 (默认 3000) |
| `UPLOAD_DIR` | 上传目录 (默认 ./uploads) |
| `MAX_FILE_SIZE` | 最大文件大小 (默认 10MB) |

### 访问地址

- 前端: http://localhost
- 后端 API: http://localhost:3000
- 数据库: localhost:5432

## 当前进度/待办

### 已完成

- [x] 用户登录（用户名/密码，已移除企业微信）
- [x] 项目管理
- [x] 任务看板
- [x] 考勤管理（打卡、请假、加班）
- [x] 审批流程（加签、催办、批量审批）
- [x] 甘特图可视化
- [x] 测绘成果文件上传
- [x] 数据导出（CSV/JSON）
- [x] 移动端适配
- [x] 日报管理
- [x] 财务管理
- [x] 合同/供应商/客户管理
- [x] 资产管理
- [x] 外包管理
- [x] 工时记录

### 未完成

- [ ] 报表统计（部分完成）
- [ ] 设备管理模块

## 常用命令

### 开发环境

```bash
# 后端开发
cd backend
npm install
npm run dev          # 启动后端 (tsx watch)

# 前端开发
cd frontend
npm install
npm run dev          # 启动前端 (Vite, http://localhost:5173)
```

### Docker 部署

```bash
# 启动全部服务
docker compose up -d

# 查看日志
docker compose logs -f

# 重启服务
docker compose restart

# 停止服务
docker compose down
```

### 数据库

```bash
# 数据库迁移
cd backend && npx drizzle-kit migrate

# 生成迁移
npx drizzle-kit generate

# 推送 schema 到数据库
npx drizzle-kit push
```

### 构建

```bash
# 前端构建
cd frontend && npm run build

# 后端构建
cd backend && npm run build
```

### 部署脚本

```bash
./deploy.sh           # Mac mini 本地部署
./deploy-to-server.sh # 远程部署
```

## 已知问题或约定

### 编码规范

- **TypeScript**: 严格模式
- **前端状态**: Zustand store 管理认证状态，其余通过 React Query 管理服务端状态
- **后端路由**: 每个路由模块独立文件，使用 `app.route()` 注册
- **Schema 验证**: 使用 Zod 进行请求参数校验
- **数据库**: Drizzle ORM 定义 schema，PostgreSQL 生产环境，SQLite 开发环境

### 特殊逻辑

- 企业微信认证：通过 `routes/wechat.ts` 发送消息，登录功能已禁用（2026-05-09）
- 文件上传：`routes/uploads.ts` 处理，支持 `crop-audit` 等特定类型文件
- 流转审计：使用 `plugins/crop-audit/` 插件记录审批链
- 甘特图：前端 `SurveyGantt.tsx` 使用自定义实现
- 企业微信验证文件：`backend/public/WW_verify_jIjysYzqz5HiOfqw.txt` 用于微信域名验证（已停用登录功能，文件暂保留）

### 数据库约定

- 使用 Drizzle ORM 管理数据库 schema
- UUID 作为主键：`uuid-ossp` 扩展
- migrations 目录由 drizzle-kit 管理

### 部署约定

- 生产环境使用 Docker Compose 部署
- PostgreSQL 数据卷挂载到 `./data/postgres`
- Nginx 作为前端静态文件服务器

## 登录方式变更说明（2026-05-09）

**变更内容**：已移除企业微信扫码登录功能，改用用户名/密码登录。

**变更范围**：
- `backend/src/routes/auth.ts`：企业微信登录相关路由已注释禁用，保留用户名/密码登录 `/auth/login` 和开发模式登录 `/auth/dev-login`
- `frontend/src/pages/Login.tsx`：保持现有的用户名/密码登录表单不变
- `backend/src/types/user.ts`：移除企业微信用户信息获取函数引用

**不影响的功能**：
- 所有 API 认证（JWT）机制保持不变
- 企业微信消息推送功能（`/api/wechat/send`）保留
- 所有业务模块（项目管理、考勤、审批等）不受影响

**如何恢复企业微信登录**：恢复 `backend/src/routes/auth.ts` 中被注释的代码，并配置 `backend/.env` 中的企业微信参数即可。
