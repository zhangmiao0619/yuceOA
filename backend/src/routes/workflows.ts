// @ts-nocheck
import { getUser } from '../types/user'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db, sqlite } from '../db/index.js'
import { workflowDefinitions, workflowInstances, tasks, projects, users } from '../schema/index.js'
import { eq, desc, and, inArray } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { notifySystem } from '../services/notification.js'

export const workflowRoutes = new Hono()

workflowRoutes.use('*', authMiddleware)

// 获取流程定义列表
workflowRoutes.get('/definitions', async (c) => {
  try {
    const page = parseInt(c.req.query('page') as string) || 1
    const pageSize = parseInt(c.req.query('pageSize') as string) || 10
    const offset = (page - 1) * pageSize
    
    const list = await db.select().from(workflowDefinitions)
      .where(eq(workflowDefinitions.isActive, 1))
    
    const total = list.length
    const paginatedList = list.slice(offset, offset + pageSize)
    
    return c.json({ success: true, data: paginatedList, total, page, pageSize })
  } catch (error) {
    console.error('Get workflow definitions error:', error)
    return c.json({ success: false, message: '获取审批流程定义失败' }, 500)
  }
})

// 获取流程定义详情
workflowRoutes.get('/definitions/:id', async (c) => {
  const id = c.req.param('id')
  
  const def = await db.query.workflowDefinitions.findFirst({
    where: eq(workflowDefinitions.id, id)
  })
  
  if (!def) {
    return c.json({ success: false, message: '流程定义不存在' }, 404)
  }
  
  return c.json({ success: true, data: def })
})

// 创建流程定义（管理员）
workflowRoutes.post('/definitions', requirePermission('canManageWorkflows'), zValidator('json', z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  formSchema: z.object({}).passthrough(),
  flowConfig: z.object({}).passthrough()
})), async (c) => {
  const body = c.req.valid('json')
  
  const [def] = await db.insert(workflowDefinitions).values(body).returning()
  
  return c.json({ success: true, data: def }, 201)
})

// 更新流程定义（管理员）
workflowRoutes.put('/definitions/:id', requirePermission('canManageWorkflows'), zValidator('json', z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  formSchema: z.object({}).passthrough().optional(),
  flowConfig: z.object({}).passthrough().optional(),
  isActive: z.boolean().optional()
})), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  
  const [existing] = await db.select().from(workflowDefinitions)
    .where(eq(workflowDefinitions.id, id))
  
  if (!existing) {
    return c.json({ success: false, message: '流程定义不存在' }, 404)
  }
  
  const [def] = await db.update(workflowDefinitions)
    .set({
      ...body,
      updatedAt: new Date()
    })
    .where(eq(workflowDefinitions.id, id))
    .returning()
  
  return c.json({ success: true, data: def })
})

// 获取审批实例列表
workflowRoutes.get('/instances', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  const type = c.req.query('type') // 'applied' | 'pending' | 'approved'
  
  let list: any[] = []
  
  if (type === 'applied') {
    // 我提交的申请
    list = await db.select().from(workflowInstances)
      .where(eq(workflowInstances.applicantId, user.id))
      .orderBy(desc(workflowInstances.createdAt))
  } else if (type === 'pending') {
    // 获取所有 pending 实例
    const allPending = await db.select().from(workflowInstances)
      .where(eq(workflowInstances.status, 'pending'))
      .orderBy(desc(workflowInstances.createdAt))

    // 获取关联定义
    const pendingDefIds = [...new Set(allPending.map(i => i.definitionId))]
    const pendingDefs = pendingDefIds.length > 0
      ? await db.select().from(workflowDefinitions).where(inArray(workflowDefinitions.id, pendingDefIds))
      : []
    const pendingDefMap = new Map(pendingDefs.map(d => [d.id, d]))

    // 过滤出当前用户可以审批的
    list = allPending.filter(instance => {
      const def = pendingDefMap.get(instance.definitionId)
      if (!def) return false
      const flowConfig = (def as any).flowConfig || { steps: [] }
      const steps = flowConfig.steps || []
      const currentStepIdx = instance.currentStep || 0
      const step = steps[currentStepIdx]
      if (!step) return false
      const approver = step.approver

      // task_completion：检查是否是项目负责人（或管理员）
      if (def.type === 'task_completion') {
        const rawForm = (instance as any).formData || {}
        const formData = typeof rawForm === 'string' ? JSON.parse(rawForm) : rawForm
        const projectId = formData.projectId
        if (!projectId) return user.isAdmin
        const projectRow = sqlite.prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId) as any
        return (projectRow && projectRow.owner_id === user.id) || user.isAdmin
      }

      // subtask_delete：检查是否是项目负责人
      if (def.type === 'subtask_delete') {
        const rawForm = (instance as any).formData || {}
        const formData = typeof rawForm === 'string' ? JSON.parse(rawForm) : rawForm
        const projectId = formData.projectId
        if (!projectId) return false
        const projectRow = sqlite.prepare('SELECT owner_id FROM projects WHERE id = ?').get(projectId) as any
        return projectRow && projectRow.owner_id === user.id
      }

      switch (approver) {
        case 'admin':
          return user.isAdmin
        case 'manager':
          return user.role === 'manager' || user.isAdmin
        case 'hr':
          return user.role === 'manager' || user.isAdmin
        case 'finance':
          return user.isAdmin
        case 'ceo':
          return user.isAdmin
        default:
          if (typeof approver === 'string' && approver.startsWith('user:')) {
            return approver.slice(5) === user.id
          }
          return false
      }
    })
  } else if (type === 'approved') {
    // 我已审批的
    list = await db.select().from(workflowInstances)
      .where(
        and(
          eq(workflowInstances.status, 'approved'),
          eq(workflowInstances.applicantId, user.id)
        )
      )
      .orderBy(desc(workflowInstances.createdAt))
  }
  
  // 获取关联的流程定义
  const definitionIds = [...new Set(list.map(i => i.definitionId))]
  const definitions = definitionIds.length > 0 
    ? await db.select().from(workflowDefinitions).where(inArray(workflowDefinitions.id, definitionIds))
    : []
  
  const defMap = new Map(definitions.map(d => [d.id, d]))
  
  const enrichedList = list.map(instance => ({
    ...instance,
    definition: defMap.get(instance.definitionId) || null
  }))
  
  return c.json({ success: true, data: enrichedList })
})

// 获取审批实例详情
workflowRoutes.get('/instances/:id', async (c) => {
  const id = c.req.param('id')
  
  const instance = await db.query.workflowInstances.findFirst({
    where: eq(workflowInstances.id, id),
    with: {
      definition: true,
      applicant: true
    }
  })
  
  if (!instance) {
    return c.json({ success: false, message: '审批实例不存在' }, 404)
  }
  
  return c.json({ success: true, data: instance })
})

// 提交审批
workflowRoutes.post('/instances', zValidator('json', z.object({
  definitionId: z.string().min(1),
  title: z.string(),
  formData: z.object({}).passthrough()
})), async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    const body = c.req.valid('json')
    
    // 获取流程定义
    const def = await db.query.workflowDefinitions.findFirst({
      where: eq(workflowDefinitions.id, body.definitionId)
    })
    
    if (!def) {
      return c.json({ success: false, message: '流程定义不存在' }, 404)
    }
    
    // 使用原始SQL插入
    const client = (db as any).$client
    const stmt = client.prepare(`
      INSERT INTO workflow_instances (id, definition_id, title, applicant_id, form_data, current_step, status, approvers, created_at, updated_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, 0, 'pending', '[]', datetime('now'), datetime('now'))
      RETURNING *
    `)
    
    const instance = stmt.get(
      body.definitionId,
      body.title,
      user.id,
      JSON.stringify(body.formData)
    )
    
    return c.json({ success: true, data: instance }, 201)
  } catch (error: any) {
    console.error('Create workflow instance error:', error)
    return c.json({ success: false, message: '提交审批失败: ' + error.message }, 500)
  }
})

// 审批操作（批准/拒绝）
workflowRoutes.put('/instances/:id/approve', zValidator('json', z.object({
  action: z.enum(['approve', 'reject']),
  comment: z.string().optional()
})), async (c) => {
  const id = c.req.param('id')
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  const body = c.req.valid('json')
  
  const [instance] = await db.select().from(workflowInstances)
    .where(eq(workflowInstances.id, id))
  
  if (!instance) {
    return c.json({ success: false, message: '审批实例不存在' }, 404)
  }
  
  if (instance.status !== 'pending') {
    return c.json({ success: false, message: '该申请已处理' }, 400)
  }
  
  // 获取流程定义
  const def = await db.query.workflowDefinitions.findFirst({
    where: eq(workflowDefinitions.id, instance.definitionId)
  })

  // 子任务删除：仅项目负责人可审批
  if (def?.type === 'subtask_delete' && body.action === 'approve') {
    const formData = instance.formData as any || {}
    const projectId = formData.projectId
    if (projectId) {
      const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) })
      if (project && project.ownerId !== user.id) {
        return c.json({ success: false, message: '仅项目负责人可审批子任务删除申请' }, 403)
      }
    }
  }

  const flowConfig = def?.flowConfig as any || { steps: [] }
  const steps = flowConfig.steps || []
  const currentStep = steps[instance.currentStep]
  if (currentStep) {
    const approver = currentStep.approver
    if (typeof approver === 'string' && approver.startsWith('user:')) {
      if (approver.slice(5) !== user.id) {
        return c.json({ success: false, message: '您不是当前步骤的审批人' }, 403)
      }
    }
  }
  const nextStep = instance.currentStep + 1
  const isLastStep = nextStep >= steps.length
  
  // 更新审批记录
  const approvers = [...(instance.approvers || []), {
    step: instance.currentStep,
    userId: user.id,
    userName: user.name,
    action: body.action,
    comment: body.comment,
    time: new Date().toISOString()
  }]
  
  // 确定新状态
  let newStatus = instance.status
  let completedAt = instance.completedAt
  
  if (body.action === 'reject') {
    newStatus = 'rejected'
    completedAt = new Date()
  } else if (body.action === 'approve' && isLastStep) {
    newStatus = 'approved'
    completedAt = new Date()
  }
  
  const [updated] = await db.update(workflowInstances)
    .set({
      approvers,
      status: newStatus,
      currentStep: nextStep,
      completedAt,
      updatedAt: new Date()
    })
    .where(eq(workflowInstances.id, id))
    .returning()

  // 子任务删除审批通过后，执行实际删除
  if (body.action === 'approve' && newStatus === 'approved' && def?.type === 'subtask_delete') {
    const formData = instance.formData as any || {}
    const taskId = formData.taskId
    if (taskId) {
      try {
        const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) })
        if (task) {
          const projectId = task.projectId
          await db.delete(tasks).where(eq(tasks.id, taskId))
          // Recalculate project progress
          const sqlite = (db as any).$client
          const taskList = sqlite.prepare(`SELECT status FROM tasks WHERE project_id = ?`).all(projectId) as any[]
          const assignedTasks = taskList.filter((t: any) => t.status !== 'unassigned')
          if (assignedTasks.length > 0) {
            const completed = assignedTasks.filter((t: any) => t.status === 'completed').length
            const progress = Math.round((completed / assignedTasks.length) * 100)
            const statusSql = progress === 100 ? `status = 'completed',` : ''
            sqlite.prepare(`UPDATE projects SET ${statusSql} progress = ?, updated_at = datetime('now') WHERE id = ?`).run(progress, projectId)
          }
          // 重新计算项目成员
          const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) })
          if (project) {
            const memberIds = new Set<string>()
            if (project.ownerId) memberIds.add(project.ownerId)
            try {
              const rows = sqlite.prepare(`SELECT assignee_id FROM tasks WHERE project_id = ? AND assignee_id IS NOT NULL`).all(projectId) as any[]
              rows.forEach((r: any) => { if (r.assignee_id) memberIds.add(r.assignee_id) })
            } catch (e) {}
            sqlite.prepare(`UPDATE projects SET members = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(Array.from(memberIds)), projectId)
          }
          await notifySystem(instance.applicantId, '子任务删除已通过', `子任务「${formData.taskTitle || taskId}」的删除申请已通过审批。`, `/projects/${projectId}`)

          // 审批后抄送所有管理员
          const admins = await db.select().from(users).where(eq(users.isAdmin, 1))
          for (const admin of admins) {
            if (admin.id !== user.id && admin.id !== instance.applicantId) {
              await notifySystem(admin.id, '子任务删除抄送', `子任务「${formData.taskTitle || taskId}」的删除申请已由「${user.name}」审批通过。`, `/projects/${projectId}`)
            }
          }
        }
      } catch (err: any) {
        console.error('Failed to delete task after approval:', err)
      }
    }
  }

  // 子任务删除被驳回时，通知申请人
  if (body.action === 'reject' && def?.type === 'subtask_delete') {
    const formData = instance.formData as any || {}
    await notifySystem(instance.applicantId, '子任务删除申请被驳回', `子任务「${formData.taskTitle || ''}」的删除申请已被驳回${body.comment ? '，原因：' + body.comment : ''}。`, `/projects/${formData.projectId || ''}`)
  }

  // 人事类审批通过后，抄送给人事主管
  if (body.action === 'approve' && newStatus === 'approved') {
    const hrTypes = ['hr_employee', 'hr_attendance', 'hr_contract', 'hr_asset', '转正申请', '离职申请', '调动申请']
    const isHRWorkflow = hrTypes.some(t => def?.type?.includes(t) || instance.title?.includes(t))
    
    if (isHRWorkflow) {
      const hrSupervisor = await db.query.users.findFirst({
        where: eq(users.username, 'hr_supervisor')
      })
      if (hrSupervisor) {
        await notifySystem(hrSupervisor.id, '人事审批抄送', 
          `「${user.name}」已审批通过：${instance.title}`, 
          `/workflows/${id}`)
      }
    }
  }

  return c.json({ success: true, data: updated })
})

// 撤销申请
workflowRoutes.put('/instances/:id/cancel', async (c) => {
  const id = c.req.param('id')
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  
  const [instance] = await db.select().from(workflowInstances)
    .where(eq(workflowInstances.id, id))
  
  if (!instance) {
    return c.json({ success: false, message: '审批实例不存在' }, 404)
  }
  
  if (instance.applicantId !== user.id) {
    return c.json({ success: false, message: '无权撤销' }, 403)
  }
  
  if (instance.status !== 'pending') {
    return c.json({ success: false, message: '已处理的申请不能撤销' }, 400)
  }
  
  const [updated] = await db.update(workflowInstances)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(workflowInstances.id, id))
    .returning()
  
  return c.json({ success: true, data: updated })
})

// 获取审批统计
workflowRoutes.get('/stats', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  
  // 我的申请统计
  const myApplied = await db.select().from(workflowInstances)
    .where(eq(workflowInstances.applicantId, user.id))
  
  // 待审批数量
  const pendingCount = await db.select().from(workflowInstances)
    .where(eq(workflowInstances.status, 'pending'))
    .then(list => list.length)
  
  return c.json({
    success: true,
    data: {
      myApplied: {
        total: myApplied.length,
        pending: myApplied.filter(i => i.status === 'pending').length,
        approved: myApplied.filter(i => i.status === 'approved').length,
        rejected: myApplied.filter(i => i.status === 'rejected').length
      },
      pending: pendingCount
    }
  })
})

// 获取我的申请（兼容旧API）
workflowRoutes.get('/my-applications', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  if (!user) {
    return c.json({ success: false, message: '未登录' }, 401)
  }
  
  const list = await db.select().from(workflowInstances)
    .where(eq(workflowInstances.applicantId, user.id))
    .orderBy(desc(workflowInstances.createdAt))
  
  // 获取关联的流程定义
  const definitionIds = [...new Set(list.map(i => i.definitionId))]
  const definitions = definitionIds.length > 0 
    ? await db.select().from(workflowDefinitions).where(inArray(workflowDefinitions.id, definitionIds))
    : []
  
  const defMap = new Map(definitions.map(d => [d.id, d]))
  
  const enrichedList = list.map(instance => ({
    ...instance,
    definition: defMap.get(instance.definitionId) || null
  }))
  
  return c.json({ success: true, data: enrichedList })
})

// 获取待我审批（兼容旧API）
workflowRoutes.get('/pending', async (c) => {
  const list = await db.select().from(workflowInstances)
    .where(eq(workflowInstances.status, 'pending'))
    .orderBy(desc(workflowInstances.createdAt))
  
  // 获取关联的流程定义
  const definitionIds = [...new Set(list.map(i => i.definitionId))]
  const definitions = definitionIds.length > 0 
    ? await db.select().from(workflowDefinitions).where(inArray(workflowDefinitions.id, definitionIds))
    : []
  
  const defMap = new Map(definitions.map(d => [d.id, d]))
  
  const enrichedList = list.map(instance => ({
    ...instance,
    definition: defMap.get(instance.definitionId) || null
  }))
  
  return c.json({ success: true, data: enrichedList })
})

// ==================== 扩展功能 ====================

// 加签：转交给其他人审批
workflowRoutes.post('/instances/:id/transfer', async (c) => {
  try {
    const id = c.req.param('id')
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    if (!user) {
      return c.json({ success: false, message: '未登录' }, 401)
    }
    const body = await c.req.json()
    
    const [instance] = await db.select().from(workflowInstances)
      .where(eq(workflowInstances.id, id))
    
    if (!instance) {
      return c.json({ success: false, message: '审批实例不存在' }, 404)
    }
    
    if (instance.status !== 'pending') {
      return c.json({ success: false, message: '该申请已处理' }, 400)
    }
    
    // 更新审批记录，添加转交信息
    const approvers = [...((instance.approvers as any[]) || []), {
      step: instance.currentStep,
      userId: user.id,
      userName: user.name,
      action: 'transfer',
      transferTo: body.transferToUserId,
      transferToName: body.transferToUserName,
      comment: body.comment || '转交给其他人审批',
      time: new Date().toISOString()
    }]
    
    // 更新实例
    const client = (db as any).$client
    const stmt = client.prepare(`
      UPDATE workflow_instances 
      SET approvers = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    stmt.run(JSON.stringify(approvers), id)

    return c.json({ success: true, message: '已转交审批' })
  } catch (error: any) {
    console.error('Transfer workflow error:', error)
    return c.json({ success: false, message: '转交失败' }, 500)
  }
})

// 催办：提醒审批人尽快处理
workflowRoutes.post('/instances/:id/remind', async (c) => {
  try {
    const id = c.req.param('id')
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    if (!user) {
      return c.json({ success: false, message: '未登录' }, 401)
    }
    
    const [instance] = await db.select().from(workflowInstances)
      .where(eq(workflowInstances.id, id))
    
    if (!instance) {
      return c.json({ success: false, message: '审批实例不存在' }, 404)
    }
    
    // 创建催办通知
    const client = (db as any).$client
    const notificationStmt = client.prepare(`
      INSERT INTO notifications (id, user_id, type, title, content, link, created_at)
      VALUES (lower(hex(randomblob(16))), ?, 'workflow_remind', ?, ?, ?, datetime('now'))
    `)
    
    // 获取流程定义获取审批人信息
    const [definition] = await db.select().from(workflowDefinitions)
      .where(eq(workflowDefinitions.id, instance.definitionId))
    
    const flowConfig = definition?.flowConfig as any || { steps: [] }
    const steps = flowConfig.steps || []
    const currentStep = steps[instance.currentStep || 0]
    
    // 这里简化处理，实际应该通知当前步骤的审批人
    notificationStmt.run(
      user.id,
      '催办提醒',
      `您有新的审批待处理：${instance.title}`,
      `/workflows?instanceId=${id}`
    )

    return c.json({ success: true, message: '催办成功' })
  } catch (error: any) {
    console.error('Remind workflow error:', error)
    return c.json({ success: false, message: '催办失败' }, 500)
  }
})

// 批量审批
workflowRoutes.post('/instances/batch-approve', async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    if (!user) {
      return c.json({ success: false, message: '未登录' }, 401)
    }
    const body = await c.req.json()
    const { instanceIds, action, comment } = body
    
    if (!instanceIds || !Array.isArray(instanceIds)) {
      return c.json({ success: false, message: '缺少审批实例ID' }, 400)
    }
    
    const results = []
    
    for (const id of instanceIds) {
      const [instance] = await db.select().from(workflowInstances)
        .where(eq(workflowInstances.id, id))
      
      if (!instance || instance.status !== 'pending') {
        results.push({ id, success: false, message: '不存在或已处理' })
        continue
      }
      
      // 获取流程定义
      const [definition] = await db.select().from(workflowDefinitions)
        .where(eq(workflowDefinitions.id, instance.definitionId))
      
      const flowConfig = definition?.flowConfig as any || { steps: [] }
      const steps = flowConfig.steps || []
      const nextStep = (instance.currentStep || 0) + 1
      const isLastStep = nextStep >= steps.length
      
      // 更新审批记录
      const approvers = [...((instance.approvers as any[]) || []), {
        step: instance.currentStep || 0,
        userId: user.id,
        userName: user.name,
        action,
        comment: comment || '',
        time: new Date().toISOString()
      }]
      
      let newStatus: 'pending' | 'approved' | 'rejected' = 'pending'
      let completedAt: Date | null = null
      
      if (action === 'reject') {
        newStatus = 'rejected'
        completedAt = new Date()
      } else if (action === 'approve' && isLastStep) {
        newStatus = 'approved'
        completedAt = new Date()
      }
      
      const client = (db as any).$client
      const updateStmt = client.prepare(`
        UPDATE workflow_instances 
        SET status = ?, current_step = ?, approvers = ?, result = ?, completed_at = ?, updated_at = datetime('now')
        WHERE id = ?
      `)
      updateStmt.run(
        newStatus,
        isLastStep ? instance.currentStep : nextStep,
        JSON.stringify(approvers),
        JSON.stringify({ action, comment }),
        completedAt,
        id
      )
      
      results.push({ id, success: true })
    }

    return c.json({ success: true, data: results })
  } catch (error: any) {
    console.error('Batch approve error:', error)
    return c.json({ success: false, message: '批量审批失败' }, 500)
  }
})

// 获取审批历史
workflowRoutes.get('/instances/:id/history', async (c) => {
  try {
    const id = c.req.param('id')
    
    const [instance] = await db.select().from(workflowInstances)
      .where(eq(workflowInstances.id, id))
    
    if (!instance) {
      return c.json({ success: false, message: '审批实例不存在' }, 404)
    }

    return c.json({ success: true, data: instance.approvers || [] })
  } catch (error: any) {
    console.error('Get workflow history error:', error)
    return c.json({ success: false, message: '获取审批历史失败' }, 500)
  }
})
