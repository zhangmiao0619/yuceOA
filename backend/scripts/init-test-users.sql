-- 测试用户数据初始化脚本
-- 运行方式: sqlite3 oa_system.db < init-test-users.sql

-- 删除已存在的测试用户（如果有）
DELETE FROM users WHERE username LIKE 'test_%';

-- 测试用户1: 项目经理（有项目管理、任务管理、审批权限）
INSERT OR IGNORE INTO users (
  id, username, password, name, email, phone, department_name, role, 
  is_admin, is_active, position, entry_date, permissions, created_at, updated_at
) VALUES (
  'test-0000-0000-0000-000000000001', 'test_manager', 'test123', '张经理', 
  'manager@test.com', '13800138001', '技术部', 'manager',
  0, 1, '项目经理', '2024-01-01',
  '["project:create","project:edit","project:view","project:pause","task:create","task:edit","task:assign","task:review","task:view","workflow:submit","workflow:approve","hr:view","system:report","system:addressBook"]',
  datetime('now'), datetime('now')
);

-- 测试用户2: 普通员工（仅查看和提交审批）
INSERT OR IGNORE INTO users (
  id, username, password, name, email, phone, department_name, role,
  is_admin, is_active, position, entry_date, permissions, created_at, updated_at
) VALUES (
  'test-0000-0000-0000-000000000002', 'test_member', 'test123', '李员工',
  'member@test.com', '13800138002', '技术部', 'member',
  0, 1, '工程师', '2024-03-01',
  '["project:view","task:view","workflow:submit","hr:view"]',
  datetime('now'), datetime('now')
);

-- 测试用户3: 仅查看权限（只能看，不能操作）
INSERT OR IGNORE INTO users (
  id, username, password, name, email, phone, department_name, role,
  is_admin, is_active, position, entry_date, permissions, created_at, updated_at
) VALUES (
  'test-0000-0000-0000-000000000003', 'test_viewer', 'test123', '王查看',
  'viewer@test.com', '13800138003', '市场部', 'member',
  0, 1, '实习生', '2024-06-01',
  '["project:view","task:view","hr:view"]',
  datetime('now'), datetime('now')
);

-- 测试用户4: 人事专员（仅人事管理权限）
INSERT OR IGNORE INTO users (
  id, username, password, name, email, phone, department_name, role,
  is_admin, is_active, position, entry_date, permissions, created_at, updated_at
) VALUES (
  'test-0000-0000-0000-000000000004', 'test_hr', 'test123', '陈人事',
  'hr@test.com', '13800138004', '行政部', 'manager',
  0, 1, '人事专员', '2023-01-01',
  '["hr:view","hr:employee","hr:attendance","hr:asset","hr:contract","hr:alert","hr:dailyReport","hr:outsourcing","workflow:submit","workflow:approve","system:addressBook"]',
  datetime('now'), datetime('now')
);

-- 测试用户5: 部分项目权限（能创建项目但不能暂停）
INSERT OR IGNORE INTO users (
  id, username, password, name, email, phone, department_name, role,
  is_admin, is_active, position, entry_date, permissions, created_at, updated_at
) VALUES (
  'test-0000-0000-0000-000000000005', 'test_pm', 'test123', '刘项目',
  'pm@test.com', '13800138005', '测绘部', 'member',
  0, 1, '项目助理', '2024-02-01',
  '["project:create","project:edit","project:view","task:create","task:edit","task:view","workflow:submit","hr:view"]',
  datetime('now'), datetime('now')
);

-- 验证插入结果
SELECT '测试用户创建完成' as status;
SELECT id, username, name, role, is_admin, permissions FROM users WHERE username LIKE 'test_%';
