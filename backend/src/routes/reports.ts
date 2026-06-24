// @ts-nocheck
import { getUser } from '../types/user'
import { Hono } from 'hono'
import { db } from '../db/index.js'
import { projects, tasks, users, workflowInstances, workflowDefinitions } from '../schema/index.js'
import { eq, and, sql, desc } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

export const reportRoutes = new Hono()

reportRoutes.use('*', authMiddleware)

// 报表根路由
reportRoutes.get('/', async (c) => {
  return c.json({ 
    success: true, 
    data: {
      message: '报表中心',
      endpoints: [
        '/projects - 项目报表',
        '/tasks - 任务报表', 
        '/users - 人员报表',
        '/workflows - 审批报表'
      ]
    }
  })
})

// 项目综合报表
reportRoutes.get('/projects', async (c) => {
  const status = c.req.query('status')
  
  // 查询项目
  let query = db.select().from(projects)
  if (status) {
    query = query.where(eq(projects.status, status as any))
  }
  
  const projectList = await query.orderBy(desc(projects.updatedAt))
  
  // 获取每个项目的任务统计
  const projectIds = projectList.map(p => p.id)
  let projectTasks: any[] = []
  if (projectIds.length > 0) {
    const { inArray } = await import('drizzle-orm')
    projectTasks = await db.select().from(tasks).where(inArray(tasks.projectId, projectIds))
  }
  
  const taskMap: Record<string, typeof projectTasks> = {}
  for (const t of projectTasks) {
    if (!taskMap[t.projectId]) taskMap[t.projectId] = []
    taskMap[t.projectId].push(t)
  }
  
  // 组装报表
  const report = projectList.map(p => {
    const pTasks = taskMap[p.id] || []
    const totalTasks = pTasks.length
    const completedTasks = pTasks.filter(t => t.status === 'done').length
    const inProgressTasks = pTasks.filter(t => t.status === 'in_progress').length
    const totalHours = pTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0)
    const estimatedHours = pTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
    
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      progress: p.progress,
      totalTasks,
      completedTasks,
      inProgressTasks,
      completionRate: totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0,
      totalHours,
      estimatedHours,
      variance: estimatedHours > 0 ? Math.round((totalHours - estimatedHours) / estimatedHours * 100) : 0
    }
  })
  
  return c.json({ success: true, data: report })
})

// 员工工作量报表
reportRoutes.get('/workload', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  
  if (!user.isAdmin) {
    return c.json({ success: false, message: '无权限' }, 403)
  }
  
  // 获取所有用户
  const allUsers = await db.select().from(users).where(eq(users.isActive, true))
  
  // 获取所有任务
  const allTasks = await db.select().from(tasks)
  
  // 获取所有审批实例
  const allInstances = await db.select().from(workflowInstances)
  
  const report = allUsers.map(u => {
    const userTasks = allTasks.filter(t => t.assigneeId === u.id)
    const userInstances = allInstances.filter(i => i.applicantId === u.id)
    
    return {
      userId: u.id,
      name: u.name,
      department: u.departmentName,
      // 任务统计
      totalTasks: userTasks.length,
      completedTasks: userTasks.filter(t => t.status === 'done').length,
      inProgressTasks: userTasks.filter(t => t.status === 'in_progress').length,
      pendingTasks: userTasks.filter(t => t.status === 'todo').length,
      reviewTasks: userTasks.filter(t => t.status === 'review').length,
      // 工时统计
      totalHours: userTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0),
      // 审批统计
      pendingApprovals: userInstances.filter(i => i.status === 'pending').length,
      approvedCount: userInstances.filter(i => i.status === 'approved').length
    }
  })
  
  // 按工时排序
  report.sort((a, b) => b.totalHours - a.totalHours)
  
  return c.json({ success: true, data: report })
})

// 任务统计报表
reportRoutes.get('/tasks', async (c) => {
  const projectId = c.req.query('projectId')
  
  // 查询任务
  let query = db.select().from(tasks)
  if (projectId) {
    query = query.where(eq(tasks.projectId, projectId))
  }
  
  const taskList = await query
  
  // 统计
  const statusCount = {
    todo: taskList.filter(t => t.status === 'todo').length,
    in_progress: taskList.filter(t => t.status === 'in_progress').length,
    review: taskList.filter(t => t.status === 'review').length,
    done: taskList.filter(t => t.status === 'done').length,
    cancelled: taskList.filter(t => t.status === 'cancelled').length
  }
  
  const priorityCount = {
    low: taskList.filter(t => t.priority === 'low').length,
    medium: taskList.filter(t => t.priority === 'medium').length,
    high: taskList.filter(t => t.priority === 'high').length,
    urgent: taskList.filter(t => t.priority === 'urgent').length
  }
  
  const totalHours = taskList.reduce((sum, t) => sum + (t.actualHours || 0), 0)
  const estimatedHours = taskList.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
  
  // 逾期任务
  const overdueTasks = taskList.filter(t => 
    t.status !== 'done' && 
    t.dueDate && 
    new Date(t.dueDate) < new Date()
  )
  
  return c.json({
    success: true,
    data: {
      total: taskList.length,
      statusCount,
      priorityCount,
      totalHours,
      estimatedHours,
      variance: estimatedHours > 0 ? Math.round((totalHours - estimatedHours) / estimatedHours * 100) : 0,
      overdueCount: overdueTasks.length,
      overdueTasks: overdueTasks.slice(0, 10).map(t => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate
      }))
    }
  })
})

// 审批统计报表
reportRoutes.get('/workflows', async (c) => {
  const instances = await db.select().from(workflowInstances)
  
  const statusCount = {
    pending: instances.filter(i => i.status === 'pending').length,
    approved: instances.filter(i => i.status === 'approved').length,
    rejected: instances.filter(i => i.status === 'rejected').length,
    processing: instances.filter(i => i.status === 'processing').length
  }
  
  // 按类型统计
  const typeStats: Record<string, number> = {}
  const definitions = await db.select().from(workflowDefinitions)
  const defMap = new Map(definitions.map(d => [d.id, d]))
  
  for (const inst of instances) {
    const def = defMap.get(inst.definitionId)
    const type = def?.type || 'unknown'
    typeStats[type] = (typeStats[type] || 0) + 1
  }
  
  // 平均审批时长（已完成的）
  const completedInstances = instances.filter(i => 
    i.completedAt && i.createdAt
  )
  
  let avgDuration = 0
  if (completedInstances.length > 0) {
    const totalDuration = completedInstances.reduce((sum, i) => {
      const duration = new Date(i.completedAt!).getTime() - new Date(i.createdAt).getTime()
      return sum + duration
    }, 0)
    avgDuration = Math.round(totalDuration / completedInstances.length / (1000 * 60 * 60)) // 小时
  }
  
  return c.json({
    success: true,
    data: {
      total: instances.length,
      statusCount,
      typeStats,
      avgDurationHours: avgDuration,
      completedCount: completedInstances.length
    }
  })
})

// 仪表盘数据
reportRoutes.get('/dashboard', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  
  // 项目统计
  const projectList = await db.select().from(projects)
  const activeProjects = projectList.filter(p => p.status === 'in_progress').length
  
  // 任务统计
  const taskList = await db.select().from(tasks)
  const myTasks = taskList.filter(t => t.assigneeId === user.id)
  const myPendingTasks = myTasks.filter(t => t.status === 'todo' || t.status === 'in_progress')
  
  // 审批统计
  const myInstances = await db.select().from(workflowInstances)
    .where(eq(workflowInstances.applicantId, user.id))
  const pendingApprovals = await db.select().from(workflowInstances)
    .where(eq(workflowInstances.status, 'pending'))
  
  // 工时统计
  const totalHours = myTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0)
  
  return c.json({
    success: true,
    data: {
      projects: {
        total: projectList.length,
        active: activeProjects
      },
      tasks: {
        total: myTasks.length,
        pending: myPendingTasks.length,
        done: myTasks.filter(t => t.status === 'done').length
      },
      workflows: {
        myApplications: myInstances.length,
        myPending: myInstances.filter(i => i.status === 'pending').length,
        pendingReview: pendingApprovals.length
      },
      timeTracking: {
        totalHours,
        thisWeek: totalHours // 简化
      }
    }
  })
})
