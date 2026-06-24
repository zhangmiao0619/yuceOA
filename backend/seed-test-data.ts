import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const DB_PATH = process.env.DB_PATH || './data/oa_system.db'

// 确保数据目录存在
const dbDir = dirname(DB_PATH)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

const db = new Database(DB_PATH)

function uuid() {
  const hex = () => Math.floor(Math.random() * 16).toString(16)
  return `${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}-${hex()}${hex()}${hex()}${hex()}-4${hex()}${hex()}${hex()}-${hex()}${hex()}${hex()}${hex()}-${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}`
}

const now = new Date().toISOString()

console.log('开始创建测试数据...\n')

// 1. 创建测试用户
const users = [
  { id: uuid(), name: '张三', email: 'zhangsan@example.com', phone: '13800138001', departmentName: '技术部', isAdmin: 0 },
  { id: uuid(), name: '李四', email: 'lisi@example.com', phone: '13800138002', departmentName: '产品部', isAdmin: 0 },
  { id: uuid(), name: '王五', email: 'wangwu@example.com', phone: '13800138003', departmentName: '设计部', isAdmin: 0 },
  { id: uuid(), name: '赵六', email: 'zhaoliu@example.com', phone: '13800138004', departmentName: '技术部', isAdmin: 1 }
]

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (id, name, email, phone, department_name, is_admin, is_active, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
`)

for (const user of users) {
  insertUser.run(user.id, user.name, user.email, user.phone, user.departmentName, user.isAdmin)
  console.log(`✅ 用户: ${user.name} (${user.departmentName})`)
}

// 2. 创建测试项目
const projects = [
  { id: uuid(), name: 'OA系统开发', description: '企业内部办公自动化系统', status: 'active', progress: 75 },
  { id: uuid(), name: '官网改版', description: '公司官方网站重新设计与开发', status: 'active', progress: 30 },
  { id: uuid(), name: '移动端App', description: 'iOS和Android原生应用开发', status: 'planning', progress: 0 },
  { id: uuid(), name: '数据大屏', description: '业务数据可视化展示平台', status: 'completed', progress: 100 }
]

const insertProject = db.prepare(`
  INSERT OR IGNORE INTO projects (id, name, description, status, owner_id, progress, members, is_archived, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
`)

for (const project of projects) {
  const members = JSON.stringify([users[0].id, users[1].id])
  insertProject.run(project.id, project.name, project.description, project.status, users[0].id, project.progress, members)
  console.log(`✅ 项目: ${project.name} (${project.status})`)
}

// 3. 创建测试任务
const tasks = [
  { title: '设计数据库结构', status: 'done', priority: 'high', assignee: users[0].id, project: projects[0].id, actualHours: 16 },
  { title: '开发用户认证模块', status: 'done', priority: 'high', assignee: users[0].id, project: projects[0].id, actualHours: 24 },
  { title: '实现审批流程功能', status: 'in_progress', priority: 'high', assignee: users[0].id, project: projects[0].id, actualHours: 12 },
  { title: '编写API接口文档', status: 'todo', priority: 'medium', assignee: users[1].id, project: projects[0].id, actualHours: 0 },
  { title: '设计首页UI', status: 'in_progress', priority: 'medium', assignee: users[2].id, project: projects[1].id, actualHours: 8 },
  { title: '前端页面开发', status: 'todo', priority: 'medium', assignee: users[2].id, project: projects[1].id, actualHours: 0, dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
  { title: '需求分析报告', status: 'done', priority: 'low', assignee: users[1].id, project: projects[2].id, actualHours: 8 },
  { title: '技术选型评估', status: 'todo', priority: 'medium', assignee: users[0].id, project: projects[2].id, actualHours: 0, dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() }
]

const insertTask = db.prepare(`
  INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, creator_id, due_date, actual_hours, tags, created_at, updated_at)
  VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, '[]', datetime('now'), datetime('now'))
`)

for (const task of tasks) {
  const dueDate = task.dueDate || null
  insertTask.run(uuid(), task.project, task.title, task.status, task.priority, task.assignee, users[3].id, dueDate, task.actualHours || 0)
  console.log(`✅ 任务: ${task.title} (${task.status})`)
}

// 4. 创建测试审批实例（简化版，不设置外键约束）
console.log('\n跳过审批实例（外键约束）')

// 5. 创建测试通知
const notifications = [
  { userId: users[0].id, type: 'task', title: '新任务分配', content: '你被分配了任务：编写API接口文档' },
  { userId: users[0].id, type: 'workflow', title: '审批提醒', content: '你有一条待审批的请假申请' },
  { userId: users[1].id, type: 'system', title: '系统通知', content: 'OA系统已更新至最新版本' }
]

const insertNotification = db.prepare(`
  INSERT INTO notifications (id, user_id, type, title, content, is_read, created_at)
  VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
`)

for (const notif of notifications) {
  insertNotification.run(uuid(), notif.userId, notif.type, notif.title, notif.content)
  console.log(`✅ 通知: ${notif.title}`)
}

console.log('\n✅ 测试数据创建完成！')
console.log('\n测试账号：')
console.log('  管理员: 赵六')
console.log('  技术部: 张三')
console.log('  产品部: 李四')
console.log('  设计部: 王五')

db.close()
