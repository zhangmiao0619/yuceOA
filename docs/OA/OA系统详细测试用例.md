# OA系统详细测试用例

> 测试日期：2026-05-14
> 测试人：小宇
> 版本：v1.0

---

## 一、项目管理模块测试用例

### 1.1 项目列表查询

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| PM-001 | 查询所有项目 | GET /projects | 返回项目列表 | P0 |
| PM-002 | 按名称模糊搜索 | GET /projects?name=测试 | 返回包含"测试"的项目 | P0 |
| PM-003 | 按状态筛选 | GET /projects?status=planning | 返回规划中项目 | P0 |
| PM-004 | 按时间范围筛选 | GET /projects?timeRange=1month | 返回1个月内项目 | P1 |
| PM-005 | 按开始日期筛选 | GET /projects?startDate=2026-01-01 | 返回开始后的项目 | P1 |
| PM-006 | 按结束日期筛选 | GET /projects?endDate=2026-12-31 | 返回结束前的项目 | P1 |
| PM-007 | 分页查询 | GET /projects?page=1&pageSize=10 | 返回分页数据 | P0 |
| PM-008 | 非管理员权限 | ceshi1用户查询 | 只返回自己项目 | P0 |

### 1.2 项目统计

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| PM-101 | 全局项目统计 | GET /projects/stats | 返回各状态数量 | P0 |
| PM-102 | 项目任务统计 | GET /projects/:id/stats | 返回任务数/完成率 | P0 |

### 1.3 项目创建

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| PM-201 | 创建必填项 | POST /projects {name: ""} | 返回400错误 | P0 |
| PM-202 | 创建项目-规划中 | POST /projects {name: "测试"} | 默认status=planning | P0 |
| PM-203 | 创建项目-草稿 | POST /projects {name: "测试", status: "draft"} | status=draft | P0 |
| PM-204 | 创建项目-进行中 | POST /projects {name: "测试", status: "active"} | status=active | P1 |
| PM-205 | 创建项目-带子任务 | POST /projects {name: "测试", subTasks: [{title: "任务1"}]} | 创建项目和任务 | P0 |
| PM-206 | 创建项目-带成员 | POST /projects {members: ["userId"]} | 成员被分配 | P1 |
| PM-207 | 创建项目-带日期 | POST /projects {startDate: "2026-01-01", endDate: "2026-12-31"} | 日期保存 | P0 |
| PM-208 | 创建项目-带工作量 | POST /projects {workload: 100, workloadUnit: "人天"} | 工作量保存 | P0 |

### 1.4 项目编辑

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| PM-301 | 编辑项目名称 | PUT /projects/:id {name: "新名称"} | 名称更新 | P0 |
| PM-302 | 编辑项目状态 | PUT /projects/:id {status: "active"} | 状态更新 | P0 |
| PM-303 | 编辑进度 | PUT /projects/:id {progress: 50} | 进度保存 | P1 |
| PM-304 | 编辑日期 | PUT /projects/:id {startDate: "2026-01-01"} | 日期更新 | P0 |
| PM-305 | 归档项目 | PUT /projects/:id {status: "archived"} | 自动记录归档时间 | P1 |
| PM-306 | 无权限编辑 | ceshi1编辑他人项目 | 返回403 | P0 |

### 1.5 项目暂停

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| PM-401 | 申请暂停 | POST /projects/:id/pause-request | 暂停申请提交 | P0 |
| PM-402 | 审批通过 | POST /projects/:id/pause-review {action: "approve"} | 状态变为paused | P0 |
| PM-403 | 审批驳回 | POST /projects/:id/pause-review {action: "reject", comments: "原因"} | 驳回并通知 | P0 |
| PM-404 | 重复申请 | 再次申请暂停 | 返回错误 | P1 |

### 1.6 项目删除

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| PM-501 | 删除项目 | DELETE /projects/:id | 项目删除 | P0 |
| PM-502 | 删除不存在项目 | DELETE /不存在id | 返回错误 | P1 |

### 1.7 项目详情

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| PM-601 | 查看项目详情 | GET /projects/:id | 返回详情和子任务 | P0 |
| PM-602 | 查看不存在项目 | GET /不存在id | 返回404 | P0 |

---

## 二、人事管理模块测试用例

### 2.1 用户列表

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| USR-001 | 获取用户列表 | GET /users | 返回用户列表 | P0 |
| USR-002 | 分页查询 | GET /users?page=1&pageSize=10 | 分页返回 | P0 |

### 2.2 用户创建

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| USR-201 | 创建必填项缺失 | POST /users {} | 返回400 | P0 |
| USR-202 | 创建用户-用户名重复 | POST /users {username: "admin"} | 返回400 | P0 |
| USR-203 | 创建用户-密码不足6位 | POST /users {password: "123"} | 返回400 | P0 |
| USR-204 | 创建用户-手机号格式错误 | POST /users {phone: "123"} | 返回400 | P0 |
| USR-205 | 创建用户-成功 | POST /users {username: "test", password: "test123"} | 创建成功 | P0 |
| USR-206 | 创建管理员 | POST /users {isAdmin: true} | isAdmin=true | P0 |

### 2.3 用户编辑

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| USR-301 | 编辑用户信息 | PUT /users/:id {name: "新名称"} | 更新成功 | P0 |
| USR-302 | 禁用用户 | PUT /users/:id {isActive: false} | 用户被禁用 | P0 |
| USR-303 | 修改角色 | PUT /users/:id {role: "manager"} | 角色更新 | P0 |

### 2.4 用户删除

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| USR-401 | 删除用户 | DELETE /users/:id | 用户删除 | P0 |
| USR-402 | 删除不存在用户 | DELETE /不存在id | 返回错误 | P1 |

### 2.5 离职处理

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| USR-501 | 员工离职 | POST /users/:id/resign | isActive=false | P0 |
| USR-502 | 恢复入职 | PUT /users/:id {isActive: true} | 恢复在职 | P1 |

### 2.6 密码重置

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| USR-601 | 重置密码 | POST /users/:id/reset-password | 返回新密码 | P0 |

### 2.7 当前用户

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| USR-701 | 获取当前用户 | GET /users/me | 返回当前用户信息 | P0 |
| USR-702 | 修改个人信息 | PUT /users/me {phone: "13800138000"} | 更新成功 | P0 |

---

## 三、财务管理模块测试用例

### 3.1 报销列表

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| FIN-001 | 获取报销列表 | GET /finance/reimbursements | 返回列表 | P0 |
| FIN-002 | 按状态筛选 | GET /finance/reimbursements?status=pending | 返回待审批 | P0 |
| FIN-003 | 按月份筛选 | GET /finance/reimbursements?month=2026-05 | 返回当月 | P0 |
| FIN-004 | 分页查询 | GET /finance/reimbursements?page=1&pageSize=10 | 分页返回 | P0 |

### 3.2 报销创建

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| FIN-201 | ���建��填项缺失 | POST /finance/reimbursements {} | 返回400 | P0 |
| FIN-202 | 创建报销-日期为空 | POST /finance/reimbursements {reimbursementDate: ""} | 返回400 | P0 |
| FIN-203 | 创建报销-日期为未来 | POST /finance/reimbursements {reimbursementDate: "2030-01-01"} | 返回400 | P0 |
| FIN-204 | 创建报销-无明细 | POST /finance/reimbursements {items: []} | 返回400 | P0 |
| FIN-205 | 创建报销-成功 | POST /finance/reimbursements {reimbursementDate: "2026-05-01", items: [{expenseCategory: "交通", expenseDetail: "打车", amount: 50}]} | 创建成功 | P0 |
| FIN-206 | 创建报销-多明细 | POST /finance/reimbursements {items: [...]} | 多个明细项 | P0 |
| FIN-207 | 创建报销-金额超2位 | POST /finance/reimbursements {items: [...]} | 返回400 | P0 |

### 3.3 报销审批

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| FIN-301 | 审批通过 | PUT /finance/reimbursements/:id/status {status: "approved"} | 状态更新 | P0 |
| FIN-302 | 审批拒绝 | PUT /finance/reimbursements/:id/status {status: "rejected", remark: "原因"} | 状态更新 | P0 |
| FIN-303 | 无权限审批 | ceshi1执行审批 | 返回403 | P0 |
| FIN-304 | 重复审批 | 再次审批已通过 | 返回错误 | P1 |

### 3.4 报销删除

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| FIN-401 | 删除草稿 | DELETE /finance/reimbursements/:id | 删除成功 | P0 |
| FIN-402 | 删除已审批 | DELETE /finance/reimbursements/:id | 返回400 | P0 |

### 3.5 财务统计

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| FIN-501 | 财务统计 | GET /finance/statistics | 返回统计数据 | P0 |
| FIN-502 | 费用类别 | GET /finance/expense-categories | 返回类别列表 | P0 |

---

## 四、合同管理模块测试用例

### 4.1 合同列表

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| CON-001 | 获取合同列表 | GET /contracts | 返回列表 | P0 |
| CON-002 | 分页查询 | GET /contracts?page=1&pageSize=10 | 分页返回 | P0 |

### 4.2 合同创建

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| CON-201 | 创建必填项缺失 | POST /contracts {} | 返回400 | P0 |
| CON-202 | 创建合同-无供应商 | POST /contracts {projectName: "测试"} | 返回400 | P0 |
| CON-203 | 创建合同-成功 | POST /contracts {projectName: "测试", supplierId: "xxx"} | 创建成功 | P0 |
| CON-204 | 创建合同-带金额 | POST /contracts {contractAmount: 100000} | 金额保存 | P0 |

### 4.3 合同编辑

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| CON-301 | 编辑合同 | PUT /contracts/:id {contractAmount: 200000} | 更新成功 | P0 |
| CON-302 | 修改供应商 | PUT /contracts/:id {supplierId: "新供应商"} | 供应商更新 | P0 |

### 4.4 合同删除

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| CON-401 | 删除合同 | DELETE /contracts/:id | 删除成功 | P0 |

### 4.5 合同统计

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| CON-501 | 合同统计 | GET /contracts/stats/overview | 返回统计 | P0 |

---

## 五、认证模块测试用例

### 5.1 登录

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| AUTH-001 | 登录成功 | POST /auth/login {username: "admin", password: "admin123"} | 返回token | P0 |
| AUTH-002 | 用户名错��� | POST /auth/login {username: "不存在", password: "xxx"} | 返回401 | P0 |
| AUTH-003 | 密码错误 | POST /auth/login {username: "admin", password: "错误"} | 返回401 | P0 |
| AUTH-004 | 用户禁用 | POST /auth/login {isActive: false} | 返回403 | P0 |

### 5.2 登出

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| AUTH-101 | 登出 | POST /auth/logout | 成功 | P1 |

---

## 六、权限模块测试用例

### 6.1 权限验证

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| PER-001 | 管理员全权限 | admin访问所有API | 允许 | P0 |
| PER-002 | 普通用户限制 | ceshi1访问需权限API | 允许 | P0 |
| PER-003 | 无权限访问 | ceshi1访问管理API | 返回403/无数据 | P0 |

---

## 七、系统测试用例

### 7.1 未授权访问

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| SYS-001 | 无token访问 | GET /projects | 返回401 | P0 |
| SYS-002 | token过期 | GET /projects {token: "过期"} | 返回401 | P0 |
| SYS-003 | 无效token | GET /projects {token: "无效"} | 返回401 | P0 |

### 7.2 CORS

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| SYS-101 | 跨域请求 | 带Origin请求 | 允许 | P0 |

---

## 八、测试账号

| 账号 | 密码 | 角色 | 权限 |
|------|------|------|------|
| admin | admin123 | 管理员 | 全部 |
| ceshi1 | ceshi123 | 普通 | 基本 |
| employee_test2 | test123 | 员工 | 指定权限 |

---

## 九、测试数据准备

### 9.1 测试用户
- 创建测试用户：testuser1, testuser2
- 创建测试管理员：testadmin

### 9.2 测试项目
- 创建测试项目：PM-TEST-001, PM-TEST-002

### 9.3 测试报销
- 创建测试报销：FIN-TEST-001
- 准备审批测试报销

### 9.4 测试供应商
- 创建测试供应商：TEST-SUPPLIER

### 9.5 测试合同
- 创建测试合同：CON-TEST-001

---

## 十、优先级说明

| 优先级 | 说明 |
|--------|------|
| P0 | 核心功能，必须测试 |
| P1 | 重要功能，建议测试 |
| P2 | 一般功能，可选测试 |

---

## 十一、测试环境

- 后端地址：localhost:3000
- 数据库：SQLite
- 测试工具：Postman / curl


---

## 十二、任务管理模块测试用例

### 12.1 任务列表

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| TASK-001 | 获取任务列表 | GET /tasks | 返回任务列表 | P0 |
| TASK-002 | 按项目筛选 | GET /tasks?projectId=xxx | 返回项目任务 | P0 |
| TASK-003 | 按状态筛选 | GET /tasks?status=assigned | 返回指定状态 | P0 |
| TASK-004 | 按执行人筛选 | GET /tasks?assigneeId=xxx | 返回指派任务 | P0 |
| TASK-005 | 分页查询 | GET /tasks?page=1&pageSize=10 | 分页返回 | P0 |

### 12.2 任务创建

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| TASK-201 | 创建必填项缺失 | POST /tasks {} | 返回400 | P0 |
| TASK-202 | 创建任务-成功 | POST /tasks {title: "测试任务", projectId: "xxx"} | 创建成功 | P0 |
| TASK-203 | 创建任务-带执行人 | POST /tasks {assigneeId: "userId"} | 任务已分配 | P0 |
| TASK-204 | 创建任务-带优先级 | POST /tasks {priority: "high"} | 优先级设置 | P0 |
| TASK-205 | 创建任务-带日期 | POST /tasks {startDate: "2026-01-01", dueDate: "2026-12-31"} | 日期保存 | P0 |

### 12.3 任务编辑

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| TASK-301 | 编辑任务状态 | PUT /tasks/:id {status: "received"} | 状态更新 | P0 |
| TASK-302 | 签收任务 | PUT /tasks/:id {status: "received"} | 签收成功 | P0 |
| TASK-303 | 提交任务 | PUT /tasks/:id {status: "submitted"} | 提交成功 | P0 |
| TASK-304 | 完成任务 | PUT /tasks/:id {status: "completed"} | 完成成功 | P0 |
| TASK-305 | 重新分配 | PUT /tasks/:id {assigneeId: "newUserId"} | 重新分配 | P0 |

### 12.4 任务删除

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|
| TASK-401 | 删除任务 | DELETE /tasks/:id | 删除成功 | P0 |

---

## 十三、考勤管理模块测试用例

### 13.1 考勤打卡

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| ATT-001 | 上班打卡 | POST /attendance/checkin | 打卡成功 | P0 |
| ATT-002 | 下班打卡 | POST /attendance/checkin?type=check-out | 打卡成功 | P0 |
| ATT-003 | 重复打卡 | 再次打卡 | 返回提示 | P1 |
| ATT-004 | 未登录打卡 | 无token | 返回401 | P0 |

### 13.2 考勤记录

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| ATT-101 | 获取考勤记录 | GET /attendance | 返回记录列表 | P0 |
| ATT-102 | 按日期筛选 | GET /attendance?date=2026-05-14 | 返回当天 | P0 |
| ATT-103 | 按月份筛选 | GET /attendance?month=2026-05 | 返回当月 | P0 |
| ATT-104 | 查看他人记录 | ceshi1查看admin | 无数据/403 | P0 |

### 13.3 请假申请

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| ATT-201 | 创建请假 | POST /leave-requests {startDate: "2026-05-15", endDate: "2026-05-16", type: "年假"} | 创建成功 | P0 |
| ATT-202 | 审批请假 | PUT /leave-requests/:id/status {status: "approved"} | 审批通过 | P0 |
| ATT-203 | 拒绝请假 | PUT /leave-requests/:id/status {status: "rejected"} | 拒绝成功 | P0 |

### 13.4 加班申请

| 用例ID | 用例名称 |  测试步骤 | 预期结果 | 优先级 |
|--------|----------|-------------|----------|--------|
| ATT-301 | 创建加班 | POST /overtime-requests {hours: 2, date: "2026-05-14"} | 创建成功 | P0 |
| ATT-302 | 审批加班 | PUT /overtime-requests/:id/status {status: "approved"} | 审批通过 | P0 |

---

## 十四、工时管理模块测试用例

### 14.1 工时记录

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| TIME-001 | 记录工时 | POST /time-tracking {projectId: "xxx", hours: 8} | 记录成功 | P0 |
| TIME-002 | 查询工时 | GET /time-tracking?date=2026-05-14 | 返回记录 | P0 |
| TIME-003 | 统计工时 | GET /time-tracking/statistics | 返回统计 | P0 |

---

## 十五、日报管理模块测试用例

### 15.1 日报

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| DREP-001 | 创建日报 | POST /daily-reports {content: "今天完成了..."} | 创建成功 | P0 |
| DREP-002 | 查看日报 | GET /daily-reports | 返回列表 | P0 |
| DREP-003 | 查看他人日报 | ceshi1查看admin | 无数据 | P0 |

---

## 十六、通知管理模块测试用例

### 16.1 通知

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| NOT-001 | 获取通知 | GET /notifications | 返回列表 | P0 |
| NOT-002 | 标记已读 | PUT /notifications/:id/read | 标记成功 | P0 |
| NOT-003 | 删除通知 | DELETE /notifications/:id | 删除成功 | P0 |

---

## 十七、供应商管理模块测试用例

### 17.1 供应商

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| SUP-001 | 获取供应商 | GET /suppliers | 返回列表 | P0 |
| SUP-002 | 创建供应商 | POST /suppliers {shortName: "测试", fullName: "测试公司"} | 创建成功 | P0 |
| SUP-003 | 编辑供应商 | PUT /suppliers/:id {shortName: "新名称"} | 更新成功 | P0 |
| SUP-004 | 删除供应商 | DELETE /suppliers/:id | 删除成功 | P0 |

---

## 十八、客户管理模块测试用例

### 18.1 客户

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| CLI-001 | 获取客户 | GET /clients | 返回列表 | P0 |
| CLI-002 | 创建客户 | POST /clients {shortName: "测试", fullName: "测试公司"} | 创建成功 | P0 |
| CLI-003 | 编辑客户 | PUT /clients/:id {shortName: "新名称"} | 更新成功 | P0 |
| CLI-004 | 删除客户 | DELETE /clients/:id | 删除成功 | P0 |

---

## 十九、资产管理模块测试用例

### 19.1 资产

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| AST-001 | 获取资产 | GET /assets | 返回列表 | P0 |
| AST-002 | 创建资产 | POST /assets {name: "电脑", quantity: 1} | 创建成功 | P0 |
| AST-003 | 编辑资产 | PUT /assets/:id {quantity: 5} | 更新成功 | P0 |
| AST-004 | 删除资产 | DELETE /assets/:id | 删除成功 | P0 |
| AST-005 | 资产分配 | PUT /assets/:id {assigneeId: "userId"} | 分配成功 | P0 |

---

## 二十、报表统计模块测试用例

### 20.1 报表

| 用例ID | 用例名称 | 测试步骤 | 预期结果 | 优先级 |
|--------|----------|----------|----------|--------|
| RPT-001 | 项目报表 | GET /reports/projects | 返回统计 | P0 |
| RPT-002 | 考勤报表 | GET /reports/attendance | 返回统计 | P0 |
| RPT-003 | 工时报表 | GET /reports/time-tracking | 返回统计 | P0 |
| RPT-004 | 财务报表 | GET /reports/finance | 返回统计 | P0 |

---

##二十一、API测试���行��序

### 第一阶段：认证 (必须最先测试)
1. AUTH-001 登录成功
2. 获取 token 用于后续测试
3. AUTH-002/AUTH-003/AUTH-004 异常场景

### 第二阶段：基础数据 (准备好测试环境)
1. USR-001~USR-701 用户管理
2. SUP-001~SUP-004 供应商
3. CLI-001~CLI-004 客户
4. CON-001~CON-501 合同

### 第三阶段：核心业务
1. PM-001~PM-601 项目管理
2. TASK-001~TASK-401 任务管理
3. FIN-001~FIN-501 财务管理

### 第四阶段：辅助功能
1. ATT-001~ATT-303 考勤
2. TIME-001~TIME-003 工时
3. DREP-001~DREP-003 日报

### 第五阶段：系统集成
1. PER-001~PER-003 权限
2. SYS-001~SYS-101 系统

---

##二十二、回归测试清单

| 模块 | 测试用例数 | 通过 | 失败 |
|------|------------|------|------|
| 认证 | 4 | - | - |
| 人事 | 12 | - | - |
| 财务 | 11 | - | - |
| 合同 | 6 | - | - |
| 项目 | 19 | - | - |
| 任务 | 11 | - | - |
| 考勤 | 10 | - | - |
| 工时 | 3 | - | - |
| 日报 | 3 | - | - |
| 通知 | 3 | - | - |
| 供应商 | 4 | - | - |
| 客户 | 4 | - | - |
| 资产 | 5 | - | - |
| 报表 | 4 | - | - |
| 权限 | 3 | - | - |
| 系统 | 4 | - | - |
| **合计** | **106** | **-** | **-** |


---

## 二十一、API参数补充说明

### 21.1 工时管理模块

| 用例名称 | 正确API | 参数说明 |
|---------|---------|---------|
| 工时统计 | GET /api/time-entries/stats | 工时统计端点 |

### 21.2 资产管理模块

| 用例名称 | 正确API | 必填参数 |
|---------|---------|----------|
| 创建资产 | POST /api/assets | assetNo, name, category |

**资产创建请求示例：**
```json
POST /api/assets
{
  "assetNo": "AST-001",
  "name": "测试电脑",
  "category": "it"
}
```

### 21.3 测试注意事项

1. **Token有效期**: 测试时需要使用最新的token，避免过期
2. **必填字段**: 创建资源时注意必填字段，参考API文档
3. **API路径**: 部分模块有特殊的路径，如工时统计

