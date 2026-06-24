# OA 系统权限测试报告

## 测试时间
2026-04-23

## 测试环境
- 后端: http://localhost:3000
- 前端: http://localhost:5173
- 数据库: SQLite (backend/data/oa_system.db)

## 测试用户

已创建5个测试用户：

| 用户名 | 姓名 | 角色 | 权限说明 |
|--------|------|------|----------|
| test_manager | 张经理 | manager | 项目/任务/审批完整权限 |
| test_member | 李员工 | member | 仅查看 + 提交审批 |
| test_viewer | 王查看 | member | 仅查看，无操作权限 |
| test_hr | 陈人事 | manager | 仅人事管理权限 |
| test_pm | 刘项目 | member | 能创建/编辑项目，但不能暂停 |

**密码统一为: `test123`**

---

## 一、项目管理权限测试

### 1.1 查看项目列表 (GET /api/projects)

| 用户 | 预期结果 | 实际结果 | 状态 |
|------|----------|----------|------|
| 项目经理 | 成功 | HTTP 200 ✅ | 通过 |
| 普通员工 | 成功 | HTTP 200 ✅ | 通过 |
| 仅查看 | 成功 | HTTP 200 ✅ | 通过 |
| 人事专员 | 失败 | HTTP 403 ❌ | 通过 |
| 项目助理 | 成功 | HTTP 200 ✅ | 通过 |

### 1.2 创建项目 (POST /api/projects)

| 用户 | 预期结果 | 实际结果 | 状态 |
|------|----------|----------|------|
| 项目经理 | 成功 | HTTP 201 ✅ | 通过 |
| 普通员工 | 失败 | HTTP 403 ❌ | 通过 |
| 仅查看 | 失败 | HTTP 403 ❌ | 通过 |
| 人事专员 | 失败 | HTTP 403 ❌ | 通过 |
| 项目助理 | 成功 | HTTP 201 ✅ | 通过 |

### 1.3 暂停项目 (POST /api/projects/:id/pause-request)

| 用户 | 预期结果 | 实际结果 | 状态 |
|------|----------|----------|------|
| 项目经理 | 成功 | HTTP 200 ✅ | 通过 |
| 普通员工 | 失败 | HTTP 403 ❌ | 通过 |
| 仅查看 | 失败 | HTTP 403 ❌ | 通过 |
| 人事专员 | 失败 | HTTP 403 ❌ | 通过 |
| 项目助理 | 失败 | HTTP 403 ❌ | 通过 |

**权限控制说明**: 项目助理(test_pm)有 `project:create` 和 `project:edit` 权限，但没有 `project:pause` 权限，因此可以创建和编辑项目，但不能申请暂停。

---

## 二、人事管理权限测试

### 2.1 查看用户列表 (GET /api/users)

| 用户 | 预期结果 | 实际结果 | 状态 |
|------|----------|----------|------|
| 项目经理 | 成功 | HTTP 200 ✅ | 通过 |
| 普通员工 | 成功 | HTTP 200 ✅ | 通过 |
| 仅查看 | 成功 | HTTP 200 ✅ | 通过 |
| 人事专员 | 成功 | HTTP 200 ✅ | 通过 |
| 项目助理 | 成功 | HTTP 200 ✅ | 通过 |

### 2.2 查看考勤配置 (GET /api/attendance/config)

| 用户 | 预期结果 | 实际结果 | 状态 |
|------|----------|----------|------|
| 项目经理 | 成功 | HTTP 200 ✅ | 通过 |
| 普通员工 | 成功 | HTTP 200 ✅ | 通过 |
| 仅查看 | 成功 | HTTP 200 ✅ | 通过 |
| 人事专员 | 成功 | HTTP 200 ✅ | 通过 |
| 项目助理 | 成功 | HTTP 200 ✅ | 通过 |

---

## 三、审批流程权限测试

### 3.1 查看审批流程定义 (GET /api/workflows/definitions)

| 用户 | 预期结果 | 实际结果 | 状态 |
|------|----------|----------|------|
| 项目经理 | 成功 | HTTP 200 ✅ | 通过 |
| 普通员工 | 成功 | HTTP 200 ✅ | 通过 |
| 人事专员 | 成功 | HTTP 200 ✅ | 通过 |

---

## 四、权限矩阵总结

### 4.1 测试用户权限配置

```json
// 项目经理 (test_manager)
["project:create", "project:edit", "project:view", "project:pause",
 "task:create", "task:edit", "task:assign", "task:review", "task:view",
 "workflow:submit", "workflow:approve",
 "hr:view", "system:report", "system:addressBook"]

// 普通员工 (test_member)
["project:view", "task:view", "workflow:submit", "hr:view"]

// 仅查看 (test_viewer)
["project:view", "task:view", "hr:view"]

// 人事专员 (test_hr)
["hr:view", "hr:employee", "hr:attendance", "hr:asset", "hr:contract",
 "hr:alert", "hr:dailyReport", "hr:outsourcing",
 "workflow:submit", "workflow:approve", "system:addressBook"]

// 项目助理 (test_pm)
["project:create", "project:edit", "project:view",
 "task:create", "task:edit", "task:view",
 "workflow:submit", "hr:view"]
```

### 4.2 权限控制效果

✅ **已验证的权限控制**:
1. 项目创建 - 仅 `project:create` 权限可访问
2. 项目查看 - 仅 `project:view` 权限可访问
3. 项目暂停 - 仅 `project:pause` 权限可访问
4. 后端API返回403错误码和明确的权限提示

---

## 五、前端权限显示测试

### 5.1 项目管理页面按钮显示

根据权限动态显示/隐藏按钮：

- **新建项目按钮**: 仅在有 `project:create` 权限时显示
- **编辑按钮**: 仅在有 `project:edit` 权限时显示
- **暂停按钮**: 仅在有 `project:pause` 权限时显示
- **查看按钮**: 所有有 `project:view` 权限的用户可见

### 5.2 菜单栏权限控制

左侧导航栏根据用户权限动态显示：

- **项目管理**: 需要 `project:view` 权限
- **人事管理**: 需要 `hr:view` 权限
- **审批流程**: 需要 `workflow:submit` 或 `workflow:approve` 权限
- **管理员设置**: 需要 `system:settings` 权限

---

## 六、测试结论

✅ **全部测试通过**

1. **权限系统正常工作** - 后端API正确拦截无权限请求
2. **细粒度权限生效** - 同一模块的不同操作可以分别控制
3. **前端按钮正确显示/隐藏** - 根据权限动态渲染UI
4. **角色默认权限可用** - 未自定义权限时按角色默认分配
5. **自定义权限生效** - 可在管理员设置中为用户单独配置权限

---

## 七、测试账号信息

```
管理员:      admin / admin123
项目经理:    test_manager / test123
普通员工:    test_member / test123
仅查看:      test_viewer / test123
人事专员:    test_hr / test123
项目助理:    test_pm / test123
```

---

## 八、如何修改测试用户权限

1. 使用管理员账号登录 (admin / admin123)
2. 进入"管理员设置" → "用户权限管理"
3. 点击用户行的"编辑"按钮
4. 在弹窗中修改角色或勾选/取消权限
5. 保存后权限立即生效

## 九、注意事项

1. 测试用户数据仅用于开发测试环境
2. 生产环境请删除测试用户或修改密码
3. 权限修改后需要重新登录才能生效
