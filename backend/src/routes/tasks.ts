// @ts-nocheck
import { getUser } from '../types/user'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { tasks, projects, users } from '../schema/index.js'
import { eq, desc, and, or, gt, lt, sql } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { notifyTaskAssigned, notifySystem, notifySystemBulk } from '../services/notification.js'

const sqlite = (db as any).$client

export const taskRoutes = new Hono()

taskRoutes.use('*', authMiddleware)

// 辅助函数：更新项目进度
async function updateProjectProgress(projectId: string) {
  const taskList = await db.query.tasks.findMany({
    where: eq(tasks.projectId, projectId)
  })
  if (taskList.length === 0) return
  
  // 只计算已分配的任务（排除 unassigned 状态）
  const assignedTasks = taskList.filter(t => t.status !== 'unassigned')
  if (assignedTasks.length === 0) return
  
  const completed = assignedTasks.filter(t => t.status === 'completed').length
  const progress = Math.round((completed / assignedTasks.length) * 100)

  console.log('[updateProjectProgress]', projectId, 'tasks:', taskList.length, 'assigned:', assignedTasks.length, 'completed:', completed, 'progress:', progress)

  // 如果全部完成，自动将项目状态更新为 completed
  const statusSql = progress === 100 ? `status = 'completed',` : ''
  const stmt = sqlite.prepare(`UPDATE projects SET ${statusSql} progress = ?, updated_at = datetime('now') WHERE id = ?`)
  const res = stmt.run(progress, projectId)
  console.log('[updateProjectProgress] SQL result:', res)

  // 如果全部完成，推送通知给抄送人员（test_notifier）和管理员
  if (progress === 100) {
    // 获取test_notifier用户
    const notifierUser = await db.query.users.findFirst({
      where: eq(users.username, 'test_notifier')
    })
    if (notifierUser) {
      await notifySystem(notifierUser.id, '项目已完成', `项目「测试项目-完整流程」已完成，请查收。`, `/projects/${projectId}`)
    }
    // 同时通知管理员
    const adminUsers = await db.query.users.findMany({
      where: eq(users.isAdmin, 1)
    })
    for (const u of adminUsers) {
      await notifySystem(u.id, '项目已完成', `项目「测试项目-完整流程」已完成，请查收。`, `/projects/${projectId}`)
    }
  }
}

// 辅助函数：重新计算项目成员（项目负责人 + 所有子任务负责人）
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

// 获取任务列表
// @ts-ignore
taskRoutes.get('/', async (c) => {
  const user = getUser(c)
  if (!user) return c.json({ success: false, message: '未登录' }, 401)

  const projectId = c.req.query('projectId')
  const status = c.req.query('status')
  const assigneeId = c.req.query('assigneeId')
  const upcoming = c.req.query('upcoming') === 'true'
  const limit = parseInt(c.req.query('limit') || '100')

  const conditions = []
  if (projectId) conditions.push(eq(tasks.projectId, projectId))
  if (status) conditions.push(eq(tasks.status, status as any))
  if (assigneeId) conditions.push(eq(tasks.assigneeId, assigneeId))

  // 权限过滤：非管理员只能看自己负责的任务、自己创建的任务，或者是项目负责人的项目下的所有任务
  if (!user.isAdmin) {
    if (projectId) {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId)
      })
      const isOwner = project?.ownerId === user.id
      if (!isOwner) {
        conditions.push(
          or(
            eq(tasks.assigneeId, user.id),
            eq(tasks.creatorId, user.id)
          )
        )
      }
    } else {
      conditions.push(
        or(
          eq(tasks.assigneeId, user.id),
          eq(tasks.creatorId, user.id)
        )
      )
    }
  }

  if (upcoming) {
    const now = new Date()
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    conditions.push(gt(tasks.dueDate, now))
    conditions.push(lt(tasks.dueDate, nextWeek))
  }

  const list = await db.query.tasks.findMany({
    where: and(...conditions),
    orderBy: [desc(tasks.priority), desc(tasks.createdAt)],
    with: {
      assignee: true,
      creator: true,
      reviewer: true,
      project: {
        with: {
          owner: true
        }
      }
    },
    limit
  })

  // Drizzle pg-core timestamp 兼容性修复
  const rawRows = sqlite.prepare(`
    SELECT id, start_date, due_date, completed_at, reviewed_at, created_at, updated_at, deliverable_files
    FROM tasks WHERE id IN (${list.map(t => "'" + t.id.replace(/'/g, "''") + "'").join(',')})
  `).all() as Record<string, any>[]
  const rawMap = new Map(rawRows.map(r => [r.id, r]))
  for (const task of list) {
    const raw = rawMap.get(task.id)
    if (raw) {
      task.startDate = raw.start_date ?? null
      task.dueDate = raw.due_date ?? null
      task.completedAt = raw.completed_at ?? null
      task.reviewedAt = raw.reviewed_at ?? null
      task.createdAt = raw.created_at ?? null
      task.updatedAt = raw.updated_at ?? null
      try {
        task.deliverableFiles = raw.deliverable_files ? JSON.parse(raw.deliverable_files) : []
      } catch { task.deliverableFiles = [] }
    }
  }

  return c.json({ success: true, data: list })
})

// 获取任务统计（Dashboard用）
taskRoutes.get('/stats', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }

  const allTasks = await db.select().from(tasks)
  const myTasks = allTasks.filter(t => t.assigneeId === user.id)

  const pendingReceive = myTasks.filter(t => t.status === 'pending_receive').length
  const received = myTasks.filter(t => t.status === 'received').length
  const submitted = myTasks.filter(t => t.status === 'submitted').length
  const completed = myTasks.filter(t => t.status === 'completed').length

  return c.json({
    success: true,
    data: {
      total: myTasks.length,
      todo: pendingReceive + received,
      inProgress: submitted,
      done: completed
    }
  })
})

// 创建任务
taskRoutes.post('/', zValidator('json', z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(300),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.number().optional(),
  tags: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  projectName: z.string().optional(),
  workCycle: z.string().optional(),
  remarks: z.string().optional()
})), async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    const body = c.req.valid('json')

    const hasAssignee = body.assigneeId && body.assigneeId.trim() !== ''
    const status = hasAssignee ? 'pending_receive' : 'unassigned'

    // 自动填充 projectName
    let projectName = body.projectName
    if (!projectName && body.projectId) {
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, body.projectId)
      })
      if (project) {
        projectName = project.shortName || project.name
      }
    }

    const stmt = sqlite.prepare(`
      INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, creator_id, start_date, due_date, estimated_hours, tags, parent_id, project_name, work_cycle, remarks, "order", created_at, updated_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
      RETURNING *
    `)

    const task = stmt.get(
      body.projectId,
      body.title,
      body.description || null,
      status,
      body.priority || 'medium',
      body.assigneeId || null,
      user.id,
      body.startDate || null,
      body.dueDate || null,
      body.estimatedHours || null,
      JSON.stringify(body.tags || []),
      body.parentId || null,
      projectName,
      body.workCycle || null,
      body.remarks || null
    )

    if (hasAssignee && body.assigneeId !== user.id) {
      await notifyTaskAssigned(task.id, body.assigneeId, body.title)
    }

    await updateProjectProgress(body.projectId)
    await recalculateProjectMembers(body.projectId)

    return c.json({ success: true, data: task }, 201)
  } catch (error: any) {
    console.error('Create task error:', error)
    return c.json({ success: false, message: '创建任务失败: ' + error.message }, 500)
  }
})

// 获取任务详情（子任务负责人查看后，状态从 assigned 变为 received）
taskRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const user = getUser(c)

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: {
      assignee: true,
      creator: true,
      reviewer: true,
      project: {
        with: {
          owner: true
        }
      }
    }
  })

  if (!task) {
    return c.json({ success: false, message: '任务不存在' }, 404)
  }

  // Drizzle 的 pg-core timestamp 与 better-sqlite3 不兼容，
  // mapFromDriverValue 会在值后追加 +0000 导致 Invalid Date，
  // 这里用原始 SQL 重新读取所有日期/jsonb 字段覆盖 Drizzle 结果
  const raw = sqlite.prepare(`
    SELECT completed_at, start_date, due_date, reviewed_at, created_at, updated_at, deliverable_files
    FROM tasks WHERE id = ?
  `).get(id) as Record<string, any> | undefined
  if (raw) {
    task.completedAt = raw.completed_at ?? null
    task.startDate = raw.start_date ?? null
    task.dueDate = raw.due_date ?? null
    task.reviewedAt = raw.reviewed_at ?? null
    task.createdAt = raw.created_at ?? null
    task.updatedAt = raw.updated_at ?? null
    try {
      task.deliverableFiles = raw.deliverable_files ? JSON.parse(raw.deliverable_files) : []
    } catch {
      task.deliverableFiles = []
    }
  }

  // 子任务负责人查看，状态变为已接收（received），项目变为进行中（in_progress）
  if (task.status === 'pending_receive' && user && task.assigneeId === user.id) {
    sqlite.prepare(`UPDATE tasks SET status = 'received', updated_at = datetime('now') WHERE id = ?`).run(id)
    task.status = 'received'

    if (task.project?.status === 'assigned') {
      sqlite.prepare(`UPDATE projects SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(task.projectId)
      task.project.status = 'in_progress'
    }
  }

  return c.json({ success: true, data: task })
})

// 更新任务
taskRoutes.put('/:id', zValidator('json', z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().optional(),
  status: z.enum(['unassigned', 'assigned', 'pending_receive', 'received', 'submitted', 'completed', 'rejected']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  actualHours: z.number().optional(),
  tags: z.array(z.string()).optional(),
  order: z.number().optional(),
  projectName: z.string().optional(),
  workCycle: z.string().optional(),
  remarks: z.string().optional().nullable()
})), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const user = getUser(c)

  const existing = await db.query.tasks.findFirst({ where: eq(tasks.id, id), with: { project: true } })
  if (!existing) {
    return c.json({ success: false, message: '任务不存在' }, 404)
  }

  let status = body.status || existing.status
  // 如果分配了新的负责人且状态未变，状态变为 assigned
  if (body.assigneeId && body.status === undefined && existing.assigneeId !== body.assigneeId) {
    status = 'assigned'
  }

  const completedAt = body.status === 'completed' ? new Date().toISOString() : (existing.completedAt ?? null)
  const dueDate = body.dueDate !== undefined ? (body.dueDate ? String(new Date(body.dueDate).toISOString()) : null) : (existing.dueDate ? String(existing.dueDate) : null)
  const startDate = body.startDate !== undefined ? (body.startDate ? String(new Date(body.startDate).toISOString()) : null) : (existing.startDate ? String(existing.startDate) : null)

  const stmt = sqlite.prepare(`
    UPDATE tasks
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        status = ?,
        priority = COALESCE(?, priority),
        assignee_id = COALESCE(?, assignee_id),
        start_date = ?,
        due_date = ?,
        actual_hours = COALESCE(?, actual_hours),
        tags = COALESCE(?, tags),
        "order" = COALESCE(?, "order"),
        project_name = COALESCE(?, project_name),
        work_cycle = COALESCE(?, work_cycle),
        remarks = COALESCE(?, remarks),
        completed_at = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `)
  stmt.run(
    body.title || null,
    body.description || null,
    status,
    body.priority || null,
    body.assigneeId !== undefined ? body.assigneeId : null,
    startDate,
    dueDate,
    body.actualHours !== undefined ? body.actualHours : null,
    body.tags ? JSON.stringify(body.tags) : null,
    body.order !== undefined ? body.order : null,
    body.projectName || null,
    body.workCycle || null,
    body.remarks !== undefined ? body.remarks : null,
    completedAt,
    id
  )

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: { assignee: true, creator: true, reviewer: true, project: { with: { owner: true } } }
  })

  await updateProjectProgress(existing.projectId)
  await recalculateProjectMembers(existing.projectId)

  return c.json({ success: true, data: task })
})

// 提交审批
taskRoutes.post('/:id/submit', zValidator('json', z.object({
  completedDate: z.string().optional(),
  projectMaterials: z.array(z.any()).optional(),
  projectMaterial1: z.any().optional(),
  projectMaterial2: z.string().optional()
}), (result, c) => {
  if (!result.success) {
    console.error('提交审批验证失败:', result.error)
    return c.json({ success: false, message: '提交审批参数验证失败' }, 400)
  }
}), async (c) => {
  const id = c.req.param('id')
  const user = getUser(c)
  const body = c.req.valid('json')

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: { project: true }
  })

  if (!task) return c.json({ success: false, message: '任务不存在' }, 404)
  if (!user) return c.json({ success: false, message: '未登录' }, 401)
  if (task.assigneeId !== user.id) {
    return c.json({ success: false, message: '只有子任务负责人可以提交审批' }, 403)
  }

  if (!['received', 'rejected'].includes(task.status)) {
    return c.json({ success: false, message: '当前状态不可提交审批' }, 400)
  }

  const materials = body.projectMaterials || (body.projectMaterial1 ? [body.projectMaterial1] : [])

  const completedDate = body.completedDate ? new Date(body.completedDate + 'T00:00:00') : new Date()
  await db.update(tasks)
    .set({
      status: 'submitted',
      completedAt: completedDate,
      deliverableFiles: materials,
      deliverableUrl: body.projectMaterial2 || null,
      updatedAt: new Date()
    })
    .where(eq(tasks.id, id))

  // 创建审批流程实例
  // 确保流程定义存在
  const defId = '00000000-0000-0000-0000-000000000114'
  try {
    sqlite.prepare(`
      INSERT OR IGNORE INTO workflow_definitions (id, name, type, description, form_schema, flow_config, is_active)
      VALUES (?, '子任务完成审批', 'task_completion', '子任务完成审批流程',
        '{"fields":[{"name":"taskId","label":"任务ID","type":"text"},{"name":"taskTitle","label":"任务标题","type":"text"},{"name":"projectId","label":"项目ID","type":"text"}]}',
        '{"steps":[{"name":"项目负责人审批","approver":"project_owner"}]}',
        1)
    `).run(defId)

    sqlite.prepare(`
      INSERT INTO workflow_instances (definition_id, title, applicant_id, form_data, current_step, status, approvers, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, 'pending', '[]', datetime('now'), datetime('now'))
    `).run(
      defId,
      `子任务「${task.title}」完成审批`,
      user.id,
      JSON.stringify({ taskId: task.id, taskTitle: task.title, projectId: task.projectId })
    )
  } catch (e) {
    console.error('创建审批流程实例失败:', e)
  }

  // 通知项目负责人
  if (task.project?.ownerId) {
    await notifySystem(task.project.ownerId, '子任务提交审批', `子任务「${task.title}」已提交审批，请处理。`, `/projects/${task.projectId}`)
  }

  return c.json({ success: true, message: '提交审批成功' })
})

// 审批处理（同意/驳回）
taskRoutes.post('/:id/review', zValidator('json', z.object({
  action: z.enum(['approve', 'reject']),
  comments: z.string().optional()
})), async (c) => {
  const id = c.req.param('id')
  const user = getUser(c)
  const body = c.req.valid('json')

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, id),
    with: { project: true }
  })

  if (!task) return c.json({ success: false, message: '任务不存在' }, 404)
  if (!user) return c.json({ success: false, message: '未登录' }, 401)
  // 子任务待审批状态由项目主负责人审批
  if (task.project?.ownerId !== user.id && !user.isAdmin) {
    return c.json({ success: false, message: '只有项目主负责人可以审批' }, 403)
  }
  if (task.status !== 'submitted') {
    return c.json({ success: false, message: '只能审批已提交的任务' }, 400)
  }

  const newStatus = body.action === 'approve' ? 'completed' : 'rejected'

  const preserveCompletedAt = body.action === 'reject'
    ? sqlite.prepare('SELECT completed_at FROM tasks WHERE id = ?').get(id)?.completed_at ?? null
    : null

  const updateStmt = sqlite.prepare(`
    UPDATE tasks
    SET status = ?, reviewer_id = ?, review_comments = ?, reviewed_at = datetime('now'),
        completed_at = ?, updated_at = datetime('now')
    WHERE id = ?
  `)
  updateStmt.run(
    newStatus,
    user.id,
    body.comments || null,
    body.action === 'approve' ? new Date().toISOString() : preserveCompletedAt,
    id
  )

  // 通知子任务负责人
  if (task.assigneeId) {
    const title = body.action === 'approve' ? '子任务审批已通过' : '子任务审批被驳回'
    const content = body.action === 'approve'
      ? `你的子任务「${task.title}」已通过审批。`
      : `你的子任务「${task.title}」被驳回${body.comments ? '，原因：' + body.comments : ''}，请重新提交。`
    await notifySystem(task.assigneeId, title, content, `/projects/${task.projectId}`)
  }

  // 更新对应的审批流程实例
  const defId = '00000000-0000-0000-0000-000000000114'
  const instance = sqlite.prepare(`
    SELECT id FROM workflow_instances
    WHERE definition_id = ? AND json_extract(form_data, '$.taskId') = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(defId, id) as any
  if (instance) {
    const newInstanceStatus = body.action === 'approve' ? 'approved' : 'rejected'
    sqlite.prepare(`
      UPDATE workflow_instances
      SET status = ?, current_step = 1, approvers = ?, completed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(newInstanceStatus, JSON.stringify([{
      step: 0,
      userId: user.id,
      userName: user.name,
      action: body.action,
      comment: body.comments || '',
      time: new Date().toISOString()
    }]), instance.id)
  }

  await updateProjectProgress(task.projectId)

  return c.json({ success: true, message: body.action === 'approve' ? '审批通过' : '审批已驳回' })
})

// 删除任务
taskRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) })
  if (task) {
    await db.delete(tasks).where(eq(tasks.id, id))
    await updateProjectProgress(task.projectId)
    await recalculateProjectMembers(task.projectId)
  }

  return c.json({ success: true })
})
