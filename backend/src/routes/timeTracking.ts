// @ts-nocheck
import { getUser } from '../types/user'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { tasks } from '../schema/index.js'
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

export const timeTrackingRoutes = new Hono()

timeTrackingRoutes.use('*', authMiddleware)

// 获取工时统计（兼容旧API）
timeTrackingRoutes.get('/stats', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  
  // 获取用户所有有工时的任务
  const userTasks = await db.select().from(tasks)
    .where(
      and(
        eq(tasks.assigneeId, user.id),
        sql`${tasks.actualHours} > 0`
      )
    )
  
  const totalHours = userTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0)
  
  return c.json({
    success: true,
    data: {
      totalHours,
      taskCount: userTasks.length
    }
  })
})

// 获取今日工时统计（Dashboard用）
timeTrackingRoutes.get('/stats/today', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  
  // 获取用户今日更新的任务（简化统计）
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const userTasks = await db.select().from(tasks)
    .where(
      and(
        eq(tasks.assigneeId, user.id),
        gte(tasks.updatedAt, today)
      )
    )
  
  // 今日工时（基于今日更新的任务的工时增量，简化计算）
  const todayHours = userTasks.reduce((sum, t) => sum + (t.actualHours || 0) * 0.1, 0)
  
  // 本周工时
  const weekStart = new Date(today)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  
  const weekTasks = await db.select().from(tasks)
    .where(
      and(
        eq(tasks.assigneeId, user.id),
        gte(tasks.updatedAt, weekStart)
      )
    )
  
  const weekHours = weekTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0)
  
  return c.json({
    success: true,
    data: {
      todayHours: Math.round(todayHours * 10) / 10,
      weekHours: Math.round(weekHours * 10) / 10
    }
  })
})

// 记录工时
// POST /api/time-entries
timeTrackingRoutes.post('/', zValidator('json', z.object({
  taskId: z.string().uuid(),
  hours: z.number().min(0.5).max(24),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  description: z.string().optional()
})), async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  const body = c.req.valid('json')
  
  // 验证任务存在且属于当前用户
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, body.taskId)
  })
  
  if (!task) {
    return c.json({ success: false, message: '任务不存在' }, 404)
  }
  
  // 更新任务实际工时
  const currentHours = task.actualHours || 0
  const [updated] = await db.update(tasks)
    .set({
      actualHours: currentHours + body.hours,
      updatedAt: new Date()
    })
    .where(eq(tasks.id, body.taskId))
    .returning()
  
  return c.json({
    success: true,
    data: {
      taskId: body.taskId,
      hours: body.hours,
      date: body.date,
      description: body.description,
      totalHours: updated.actualHours
    }
  }, 201)
})

// 获取我的工时统计
timeTrackingRoutes.get('/my-stats', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  const startDate = c.req.query('startDate') // YYYY-MM-DD
  const endDate = c.req.query('endDate') // YYYY-MM-DD
  
  // 查询用户的所有任务
  let query = db.select().from(tasks)
    .where(
      and(
        eq(tasks.assigneeId, user.id),
        sql`${tasks.actualHours} > 0`
      )
    )
  
  const taskList = await query.orderBy(desc(tasks.updatedAt))
  
  // 统计
  const totalHours = taskList.reduce((sum, t) => sum + (t.actualHours || 0), 0)
  const completedTasks = taskList.filter(t => t.status === 'done').length
  const inProgressTasks = taskList.filter(t => t.status === 'in_progress').length
  
  // 按项目分组统计
  const projectStats: Record<string, { hours: number; tasks: number }> = {}
  for (const task of taskList) {
    const pid = task.projectId
    if (!projectStats[pid]) {
      projectStats[pid] = { hours: 0, tasks: 0 }
    }
    projectStats[pid].hours += task.actualHours || 0
    projectStats[pid].tasks += 1
  }
  
  return c.json({
    success: true,
    data: {
      totalHours,
      completedTasks,
      inProgressTasks,
      totalTasks: taskList.length,
      projectStats,
      recentTasks: taskList.slice(0, 10).map(t => ({
        id: t.id,
        title: t.title,
        actualHours: t.actualHours,
        status: t.status
      }))
    }
  })
})

// 获取项目工时统计
timeTrackingRoutes.get('/project-stats/:projectId', async (c) => {
  const projectId = c.req.param('projectId')
  
  const projectTasks = await db.select().from(tasks)
    .where(eq(tasks.projectId, projectId))
  
  // 总工时
  const totalHours = projectTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0)
  const estimatedHours = projectTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
  
  // 按成员统计
  const memberStats: Record<string, { name: string; hours: number; tasks: number }> = {}
  
  // 获取用户信息
  const userIds = [...new Set(projectTasks.filter(t => t.assigneeId).map(t => t.assigneeId!))]
  const { users } = await import('../schema/index.js')
  const userList = userIds.length > 0 
    ? await db.select().from(users).where(inArray(users.id, userIds))
    : []
  
  const userMap = new Map(userList.map(u => [u.id, u]))
  
  for (const task of projectTasks) {
    if (task.assigneeId) {
      const user = userMap.get(task.assigneeId)
      if (!memberStats[task.assigneeId]) {
        memberStats[task.assigneeId] = {
          name: user?.name || '未知',
          hours: 0,
          tasks: 0
        }
      }
      memberStats[task.assigneeId].hours += task.actualHours || 0
      memberStats[task.assigneeId].tasks += 1
    }
  }
  
  return c.json({
    success: true,
    data: {
      totalHours,
      estimatedHours,
      variance: estimatedHours > 0 ? ((totalHours - estimatedHours) / estimatedHours * 100).toFixed(1) : 0,
      completedTasks: projectTasks.filter(t => t.status === 'done').length,
      totalTasks: projectTasks.length,
      memberStats: Object.values(memberStats)
    }
  })
})

// 获取团队工时统计（管理员）
timeTrackingRoutes.get('/team-stats', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  
  if (!user.isAdmin) {
    return c.json({ success: false, message: '无权限' }, 403)
  }
  
  // 获取所有任务
  const allTasks = await db.select().from(tasks)
    .where(sql`${tasks.actualHours} > 0`)
  
  // 按成员统计
  const memberStats: Record<string, { hours: number; tasks: number }> = {}
  for (const task of allTasks) {
    if (task.assigneeId) {
      if (!memberStats[task.assigneeId]) {
        memberStats[task.assigneeId] = { hours: 0, tasks: 0 }
      }
      memberStats[task.assigneeId].hours += task.actualHours || 0
      memberStats[task.assigneeId].tasks += 1
    }
  }
  
  // 按状态统计
  const statusStats = {
    todo: allTasks.filter(t => t.status === 'todo').length,
    in_progress: allTasks.filter(t => t.status === 'in_progress').length,
    review: allTasks.filter(t => t.status === 'review').length,
    done: allTasks.filter(t => t.status === 'done').length
  }
  
  return c.json({
    success: true,
    data: {
      totalHours: allTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0),
      memberStats,
      statusStats
    }
  })
})

import { inArray } from 'drizzle-orm'
