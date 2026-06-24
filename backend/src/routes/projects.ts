// @ts-nocheck
import { getUser } from '../types/user'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { projects, tasks, users } from '../schema/index.js'
import { eq, desc, and, or, like, gte, lte, sql, inArray } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { notifyTaskAssigned, notifySystem } from '../services/notification.js'

// 获取SQLite实例
const sqlite = (db as any).$client

export const projectRoutes = new Hono()

projectRoutes.use('*', authMiddleware)

// 辅助函数：计算项目进度
async function updateProjectProgress(projectId: string) {
  const taskList = await db.query.tasks.findMany({
    where: eq(tasks.projectId, projectId)
  })
  if (taskList.length === 0) return 0
  const completed = taskList.filter(t => t.status === 'completed').length
  return Math.round((completed / taskList.length) * 100)
}

async function recalculateProjectMembers(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId)
  })
  if (!project) return
  const memberIds = new Set<string>()
  if (project.ownerId) memberIds.add(project.ownerId)
  try {
    const rows = sqlite.prepare(`SELECT assignee_id FROM tasks WHERE project_id = ? AND assignee_id IS NOT NULL`).all(projectId) as any[]
    rows.forEach((r: any) => { if (r.assignee_id) memberIds.add(r.assignee_id) })
  } catch (e) {}
  sqlite.prepare(`UPDATE projects SET members = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(Array.from(memberIds)), projectId)
}

// 获取项目列表
projectRoutes.get('/', requirePermission('project:view'), async (c) => {
  const user = getUser(c)
  if (!user) return c.json({ success: false, message: '未登录' }, 401)

  const {
    name,
    startDate,
    endDate,
    timeRange,
    status,
    pendingClaim,
    page,
    pageSize
  } = c.req.query()

  // 待签收筛选：返回当前用户在 pending_receive 状态的任务所属项目
  if (pendingClaim === 'true') {
    const rows = sqlite.prepare(`
      SELECT DISTINCT p.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.assignee_id = ? AND t.status = 'pending_receive') as pending_count
      FROM projects p
      JOIN tasks t ON t.project_id = p.id
      WHERE t.assignee_id = ? AND t.status = 'pending_receive'
      ORDER BY p.updated_at DESC
    `).all(user.id, user.id) as any[]
    return c.json({ success: true, data: { list: rows, total: rows.length } })
  }

  const pageNum = parseInt(page as string) || 1
  const size = parseInt(pageSize as string) || 10
  const offset = (pageNum - 1) * size

  const conditions = []

  if (!user.isAdmin) {
    conditions.push(
      or(
        eq(projects.ownerId, user.id),
        sql`EXISTS (SELECT 1 FROM tasks WHERE tasks.project_id = projects.id AND tasks.assignee_id = ${user.id})`
      )
    )
  }

  if (status) {
    conditions.push(eq(projects.status, status as any))
  }

  if (name) {
    conditions.push(like(projects.name, `%${name}%`))
  }

  const now = new Date()
  if (timeRange) {
    const start = new Date()
    switch (timeRange) {
      case '1month':
        start.setMonth(now.getMonth() - 1)
        conditions.push(gte(projects.createdAt, start))
        break
      case '3months':
        start.setMonth(now.getMonth() - 3)
        conditions.push(gte(projects.createdAt, start))
        break
      case '6months':
        start.setMonth(now.getMonth() - 6)
        conditions.push(gte(projects.createdAt, start))
        break
      case '1year':
        start.setFullYear(now.getFullYear() - 1)
        conditions.push(gte(projects.createdAt, start))
        break
    }
  }

  if (startDate) {
    conditions.push(gte(projects.startDate, new Date(startDate)))
  }
  if (endDate) {
    conditions.push(lte(projects.endDate, new Date(endDate)))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // 使用原生SQL分页获取数据
  let orderBy = `CASE WHEN status = 'archived' OR is_archived = 1 THEN 1 ELSE 0 END,
                  CASE WHEN status = 'completed' THEN 1 ELSE 0 END,
                  updated_at DESC`

  let whereSql = ''
  const sqlParams: any[] = []
  const whereParts: string[] = []

  if (!user.isAdmin) {
    whereParts.push(`(p.owner_id = ? OR EXISTS (SELECT 1 FROM tasks WHERE tasks.project_id = p.id AND tasks.assignee_id = ?))`)
    sqlParams.push(user.id, user.id)
  }
  if (status) {
    whereParts.push(`p.status = ?`)
    sqlParams.push(status)
  }
  if (name) {
    whereParts.push(`p.name LIKE ?`)
    sqlParams.push(`%${name}%`)
  }

  if (startDate) {
    whereParts.push(`p.start_date >= ?`)
    sqlParams.push(startDate)
  }
  if (endDate) {
    whereParts.push(`p.end_date <= ?`)
    sqlParams.push(endDate)
  }

  if (whereParts.length > 0) {
    whereSql = 'WHERE ' + whereParts.join(' AND ')
  }

  const totalStmt = sqlite.prepare(`SELECT COUNT(*) as total FROM projects p ${whereSql}`)
  const totalResult = totalStmt.get(...sqlParams) as { total: number }
  const total = totalResult?.total || 0

  const listStmt = sqlite.prepare(`
    SELECT p.*, u.name as owner_name, u.department_name as owner_department
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `)

  const projectRows = listStmt.all(...sqlParams, size, offset) as any[]

  // 获取每个项目的子任务
  const result = await Promise.all(projectRows.map(async (project) => {
    const subTasksStmt = sqlite.prepare(`
      SELECT t.*, u.name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = ?
      ORDER BY t."order", t.created_at
    `)
    const subTasks = subTasksStmt.all(project.id)

    // 转换 snake_case 为 camelCase 供前端使用
    for (const task of subTasks) {
      // 先提取 assignee_name 再转换字段名
      const assigneeName = task.assignee_name
      const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
      for (const key of Object.keys(task)) {
        const camelKey = snakeToCamel(key)
        if (camelKey !== key) {
          task[camelKey] = task[key]
          delete task[key]
        }
      }
      if (assigneeName) {
        task.assignee = { name: assigneeName }
      }
      // 关联项目名称
      if (!task.projectName) {
        task.projectName = project.name
      }
    }

    // 转换 project 的 snake_case 为 camelCase
    const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    const projectCamel: any = {}
    for (const key of Object.keys(project)) {
      const camelKey = snakeToCamel(key)
      projectCamel[camelKey] = project[key]
    }

    return {
      ...projectCamel,
      owner: {
        id: project.owner_id,
        name: project.owner_name,
        departmentName: project.owner_department
      },
      subTasks
    }
  }))

  return c.json({
    success: true,
    data: {
      list: result,
      total,
      page: pageNum,
      pageSize: size
    }
  })
})

// 获取项目全局统计（Dashboard用）
projectRoutes.get('/stats', requirePermission('project:view'), async (c) => {
  const user = getUser(c)
  if (!user) {
    return c.json({ success: false, message: "未登录" }, 401)
  }

  let projectsForStats
  if (user.isAdmin) {
    projectsForStats = await db.select().from(projects)
  } else {
    projectsForStats = sqlite.prepare(`
      SELECT p.* FROM projects p
      WHERE p.owner_id = ? OR EXISTS (SELECT 1 FROM tasks WHERE tasks.project_id = p.id AND tasks.assignee_id = ?)
    `).all(user.id, user.id) as any[]
  }

  const total = projectsForStats.length
  const planning = projectsForStats.filter((p: any) => p.status === 'assigned').length
  const active = projectsForStats.filter((p: any) => p.status === 'in_progress').length
  const completed = projectsForStats.filter((p: any) => p.status === 'completed').length
  const paused = projectsForStats.filter((p: any) => p.status === 'paused').length

  return c.json({
    success: true,
    data: {
      total,
      active,
      completed,
      planning,
      paused
    }
  })
})

// 获取待签收项目（当前用户有待签收子任务的项目）
projectRoutes.get('/pending-claim', requirePermission('project:view'), async (c) => {
  const user = getUser(c)
  if (!user) {
    return c.json({ success: false, message: "未登录" }, 401)
  }

  const rows = sqlite.prepare(`
    SELECT DISTINCT p.id, p.name, p.short_name, p.status, p.progress,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.assignee_id = ? AND t.status = 'pending_receive') as pending_count
    FROM projects p
    JOIN tasks t ON t.project_id = p.id
    WHERE t.assignee_id = ? AND t.status = 'pending_receive'
    ORDER BY p.updated_at DESC
  `).all(user.id, user.id) as any[]

  return c.json({ success: true, data: rows })
})

// 创建项目
projectRoutes.post('/', requirePermission('project:create'), zValidator('json', z.object({
  name: z.string().min(1).max(200),
  shortName: z.string().optional(),
  ownerId: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  clientShortName: z.string().optional(),
  workload: z.number().optional(),
  workloadUnit: z.string().optional(),
  completedDate: z.string().optional(),
  projectMaterials: z.array(z.string()).optional(),
  remarks: z.string().optional(),
  members: z.array(z.string()).optional(),
  status: z.enum(['draft', 'assigned', 'in_progress', 'paused', 'completed', 'archived']).optional(),
  subTasks: z.array(z.object({
    title: z.string().min(1),
    projectName: z.string().optional(),
    assigneeId: z.string().optional(),
    workCycle: z.string().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent', 'P0', 'P1', 'P2', 'P3']).optional(),
    remarks: z.string().optional(),
    workload: z.number().optional(),
    workloadUnit: z.string().optional()
  })).optional()
})), async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    const body = c.req.valid('json')

    // 插入项目，状态默认为 assigned，支持 draft 草稿状态
    const status = body.status || 'assigned'
    const stmt = sqlite.prepare(`
      INSERT INTO projects (
        id, name, short_name, description, owner_id, status,
        start_date, end_date, client_short_name, workload, workload_unit,
        completed_date, project_materials, remarks, members, settings, progress, is_archived, created_at, updated_at
      )
      VALUES (
        lower(hex(randomblob(16))), ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 0, 0, datetime('now'), datetime('now')
      )
      RETURNING *
    `)

    const project = stmt.get(
      body.name,
      body.shortName || null,
      body.description || null,
      body.ownerId || user.id,
      status,
      body.startDate || null,
      body.endDate || null,
      body.clientShortName || null,
      body.workload !== undefined ? body.workload : null,
      body.workloadUnit || null,
      body.completedDate || null,
      JSON.stringify(body.projectMaterials || []),
      body.remarks || null,
      JSON.stringify(body.members || [])
    )

    // 创建子任务
    const createdSubTasks = []
    if (body.subTasks && body.subTasks.length > 0) {
      const taskStmt = sqlite.prepare(`
        INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, creator_id, start_date, due_date, project_name, work_cycle, remarks, workload, workload_unit, tags, attachments, "order", created_at, updated_at)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, datetime('now'), datetime('now'))
        RETURNING *
      `)

      for (let i = 0; i < body.subTasks.length; i++) {
        const st = body.subTasks[i]
        const hasAssignee = st.assigneeId && st.assigneeId.trim() !== ''
        const status = hasAssignee ? 'pending_receive' : 'unassigned'
        const priorityMap: Record<string, string> = {
          P0: 'urgent', P1: 'high', P2: 'medium', P3: 'low'
        }
        const priority = priorityMap[st.priority || ''] || st.priority || 'medium'

        const task = taskStmt.get(
          project.id,
          st.title,
          st.description || null,
          status,
          priority,
          st.assigneeId || null,
          user.id,
          st.startDate || null,
          st.dueDate || null,
          st.projectName || body.shortName || body.name,
          st.workCycle || null,
          st.remarks || null,
          st.workload !== undefined && st.workload !== '' ? Number(st.workload) : null,
          st.workloadUnit || null,
          i
        )
        createdSubTasks.push(task)

        // 发送分配通知
        if (hasAssignee && st.assigneeId !== user.id) {
          await notifyTaskAssigned(task.id, st.assigneeId, st.title)
        }
      }
    }

    // 更新项目进度
    const progress = await updateProjectProgress(project.id)
    sqlite.prepare(`UPDATE projects SET progress = ? WHERE id = ?`).run(progress, project.id)
    project.progress = progress

    // 自动计算项目成员（项目负责人 + 所有子任务负责人）
    await recalculateProjectMembers(project.id)

    // 获取owner信息
    const ownerId = body.ownerId || user.id
    const owner = await db.query.users.findFirst({
      where: eq(users.id, ownerId)
    })

    return c.json({ success: true, data: { ...project, owner, subTasks: createdSubTasks } }, 201)
  } catch (error: any) {
    console.error('Create project error:', error)
    return c.json({ success: false, message: '创建项目失败: ' + error.message }, 500)
  }
})

// 获取项目详情
projectRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const user = getUser(c)

  if (!user) return c.json({ success: false, message: '未登录' }, 401)

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      owner: true
    }
  })

  if (!project) {
    return c.json({ success: false, message: '项目不存在' }, 404)
  }

  const subTasksRaw = sqlite.prepare(`
    SELECT t.*, u.name as assignee_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.project_id = ?
    ORDER BY t."order", t.created_at
  `).all(id) as any[]

  const subTasks = subTasksRaw.map(task => {
    const assigneeName = task.assignee_name
    const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    for (const key of Object.keys(task)) {
      const camelKey = snakeToCamel(key)
      if (camelKey !== key) {
        task[camelKey] = task[key]
        delete task[key]
      }
    }
    if (assigneeName) {
      task.assignee = { name: assigneeName }
    }
    return task
  })

  return c.json({ success: true, data: { ...project, subTasks } })
})

// 更新项目
projectRoutes.put('/:id', requirePermission('project:edit'), zValidator('json', z.object({
  workload: z.number().optional().nullable(),
  workloadUnit: z.string().optional().nullable(),
  clientShortName: z.string().optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  shortName: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'assigned', 'in_progress', 'paused', 'completed', 'archived']).optional(),
  progress: z.number().min(0).max(100).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  completedDate: z.string().optional().nullable(),
  projectMaterials: z.union([z.array(z.string()), z.string()]).optional(),
  remarks: z.string().optional().nullable(),
  members: z.union([z.array(z.string()), z.string()]).optional(),
  archivedBy: z.string().optional().nullable(),
  archivedAt: z.string().optional().nullable(),
  pauseRequestStatus: z.enum(['pending', 'approved', 'rejected']).optional().nullable()
})), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const user = getUser(c)

  const updateData: any = {
    ...body,
    updatedAt: new Date()
  }

  if (body.startDate !== undefined) {
    updateData.startDate = body.startDate ? new Date(body.startDate) : null
  }
  if (body.endDate !== undefined) {
    updateData.endDate = body.endDate ? new Date(body.endDate) : null
  }
  if (body.completedDate !== undefined) {
    updateData.completedDate = body.completedDate ? new Date(body.completedDate) : null
  }
  if (body.archivedAt !== undefined) {
    updateData.archivedAt = body.archivedAt ? new Date(body.archivedAt) : null
  }
  if (body.projectMaterials !== undefined) {
    updateData.projectMaterials = JSON.stringify(body.projectMaterials)
  }
  if (body.members !== undefined) {
    updateData.members = typeof body.members === 'string' ? body.members : JSON.stringify(body.members)
  }

  // 当状态变为 archived 时，自动设置归档信息（SQLite 用 1/0 代替 boolean）
  if (body.status === 'archived') {
    updateData.isArchived = 1
    if (!body.archivedBy && user) {
      updateData.archivedBy = user.id
    }
    if (!body.archivedAt) {
      updateData.archivedAt = new Date()
    }
  }

  const [project] = await db.update(projects)
    .set(updateData)
    .where(eq(projects.id, id))
    .returning()

  return c.json({ success: true, data: project })
})

// 提交暂停申请
projectRoutes.post('/:id/pause-request', requirePermission('project:pause'), async (c) => {
  const id = c.req.param('id')
  const user = getUser(c)
  if (!user) return c.json({ success: false, message: '未登录' }, 401)

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) })
  if (!project) return c.json({ success: false, message: '项目不存在' }, 404)

  // 更新暂停申请状态
  sqlite.prepare(`UPDATE projects SET pause_request_status = 'pending', updated_at = datetime('now') WHERE id = ?`).run(id)

  // 通知所有管理员
  const admins = await db.query.users.findMany({ where: eq(users.isAdmin, 1) })
  for (const admin of admins) {
    await notifySystem(admin.id, '项目暂停申请', `项目「${project.name}」提交了暂停申请，请及时审核。`, `/projects/${id}`)
  }

  return c.json({ success: true, message: '暂停申请已提交，等待管理员审核' })
})

// 审核暂停申请
projectRoutes.post('/:id/pause-review', zValidator('json', z.object({
  action: z.enum(['approve', 'reject']),
  comments: z.string().optional()
})), async (c) => {
  const id = c.req.param('id')
  const user = getUser(c)
  if (!user || !user.isAdmin) return c.json({ success: false, message: '无权限' }, 403)

  const body = c.req.valid('json')
  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) })
  if (!project) return c.json({ success: false, message: '项目不存在' }, 404)

  if (body.action === 'approve') {
    sqlite.prepare(`UPDATE projects SET status = 'paused', pause_request_status = 'approved', updated_at = datetime('now') WHERE id = ?`).run(id)
    if (project.ownerId) {
      await notifySystem(project.ownerId, '项目暂停申请已通过', `项目「${project.name}」的暂停申请已通过。`, `/projects/${id}`)
    }
    return c.json({ success: true, message: '已通过暂停申请，项目状态已更新为已暂停' })
  } else {
    sqlite.prepare(`UPDATE projects SET pause_request_status = 'rejected', updated_at = datetime('now') WHERE id = ?`).run(id)
    if (project.ownerId) {
      await notifySystem(project.ownerId, '项目暂停申请已驳回', `项目「${project.name}」的暂停申请已被驳回${body.comments ? '，原因：' + body.comments : ''}。`, `/projects/${id}`)
    }
    return c.json({ success: true, message: '已驳回暂停申请' })
  }
})

// 删除项目
projectRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')

  await db.delete(projects).where(eq(projects.id, id))

  return c.json({ success: true })
})

// 获取项目统计
projectRoutes.get('/:id/stats', async (c) => {
  const id = c.req.param('id')

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id)
  })

  if (!project) {
    return c.json({ success: false, message: '项目不存在' }, 404)
  }

  const taskList = await db.query.tasks.findMany({
    where: eq(tasks.projectId, id)
  })

  const totalTasks = taskList.length
  const completedTasks = taskList.filter(t => t.status === 'completed').length
  const inProgressTasks = taskList.filter(t => t.status === 'received').length
  const todoTasks = taskList.filter(t => t.status === 'pending_receive' || t.status === 'unassigned').length
  const reviewTasks = taskList.filter(t => t.status === 'submitted').length

  const memberSet = new Set<string>()
  if (project.ownerId) memberSet.add(project.ownerId)
  let taskDebug: any[] = []
  try {
    taskDebug = sqlite.prepare(`SELECT id, assignee_id, status FROM tasks WHERE project_id = ?`).all(id) as any[]
    taskDebug.forEach((r: any) => { if (r.assignee_id) memberSet.add(r.assignee_id) })
  } catch (e) {}
  const memberCount = memberSet.size || 1

  return c.json({
    success: true,
    data: {
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      reviewTasks,
      memberCount,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      taskDebug
    }
  })
})
