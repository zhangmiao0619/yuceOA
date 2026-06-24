// @ts-nocheck
import { getUser } from '../types/user'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { eq, and, desc, or } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { sendWechatMessage } from './wechat.js'
import crypto from 'crypto'
import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core'

// 通知表定义
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // task, workflow, system
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content'),
  link: text('link'), // 跳转链接
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow()
})

// 通知类型
export type NotificationType = 'task' | 'workflow' | 'system' | 'reminder'

// 创建通知
export async function createNotification(data: {
  userId: string
  type: NotificationType
  title: string
  content?: string
  link?: string
}): Promise<any> {
  const [notification] = await db.insert(notifications).values({
    userId: data.userId,
    type: data.type,
    title: data.title,
    content: data.content,
    link: data.link
  }).returning()
  
  return notification
}

// 发送通知（内部 + 企业微信）
export async function sendNotification(data: {
  userId: string
  wechatUserId?: string
  type: NotificationType
  title: string
  content?: string
  link?: string
  sendWechat?: boolean
}): Promise<{ notification: any; wechatSent: boolean }> {
  // 创建内部通知
  const notification = await createNotification({
    userId: data.userId,
    type: data.type,
    title: data.title,
    content: data.content,
    link: data.link
  })
  
  // 发送企业微信消息
  let wechatSent = false
  if (data.sendWechat !== false && data.wechatUserId) {
    wechatSent = await sendWechatMessage(data.wechatUserId, {
      title: data.title,
      description: data.content || '',
      url: data.link
    })
  }
  
  return { notification, wechatSent }
}

// 任务通知
export async function notifyTaskAssigned(task: any, assignee: any): Promise<void> {
  await sendNotification({
    userId: assignee.id,
    wechatUserId: assignee.wechatUserId || undefined,
    type: 'task',
    title: '新任务指派',
    content: `你被指派了任务：${task.title}`,
    link: `/tasks/${task.id}`
  })
}

export async function notifyTaskDueSoon(task: any, assignee: any): Promise<void> {
  await sendNotification({
    userId: assignee.id,
    wechatUserId: assignee.wechatUserId || undefined,
    type: 'reminder',
    title: '任务即将到期',
    content: `任务 "${task.title}" 将于 ${task.dueDate?.slice(0, 10)} 到期`,
    link: `/tasks/${task.id}`
  })
}

// 审批通知
export async function notifyWorkflowSubmitted(instance: any, applicant: any, approvers: any[]): Promise<void> {
  for (const approver of approvers) {
    await sendNotification({
      userId: approver.id,
      wechatUserId: approver.wechatUserId || undefined,
      type: 'workflow',
      title: '新的审批申请',
      content: `${applicant.name} 提交了 "${instance.title}" 申请，需要你的审批`,
      link: `/workflows/${instance.id}`
    })
  }
}

export async function notifyWorkflowApproved(instance: any, applicant: any, approver: any): Promise<void> {
  await sendNotification({
    userId: applicant.id,
    wechatUserId: applicant.wechatUserId || undefined,
    type: 'workflow',
    title: '审批已通过',
    content: `你的申请 "${instance.title}" 已被 ${approver.name} 批准`,
    link: `/workflows/${instance.id}`
  })
}

export async function notifyWorkflowRejected(instance: any, applicant: any, approver: any, reason?: string): Promise<void> {
  await sendNotification({
    userId: applicant.id,
    wechatUserId: applicant.wechatUserId || undefined,
    type: 'workflow',
    title: '审批已拒绝',
    content: `你的申请 "${instance.title}" 被 ${approver.name} 拒绝${reason ? `，原因：${reason}` : ''}`,
    link: `/workflows/${instance.id}`
  })
}

// 通知路由
export const notificationRoutes = new Hono()

notificationRoutes.use('*', authMiddleware)

// 获取我的通知列表
notificationRoutes.get('/', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  const type = c.req.query('type')
  const isRead = c.req.query('isRead')
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = parseInt(c.req.query('offset') || '0')
  
  let conditions: any[] = [eq(notifications.userId, user.id)]
  
  if (type) {
    conditions.push(eq(notifications.type, type))
  }
  
  if (isRead !== undefined) {
    conditions.push(eq(notifications.isRead, isRead === 'true' ? 1 : 0))
  }
  
  const list = await db.select().from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset)
  
  return c.json({
    success: true,
    data: list
  })
})

// 获取未读通知数量
notificationRoutes.get('/unread-count', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  
  const unreadCount = await db.select().from(notifications)
    .where(and(
      eq(notifications.userId, user.id),
      eq(notifications.isRead, 0)
    ))
    .then(rows => rows.length)
  
  return c.json({
    success: true,
    data: unreadCount
  })
})

// 标记已读
notificationRoutes.put('/:id/read', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  const id = c.req.param('id')
  
  const [notification] = await db.update(notifications)
    .set({ isRead: 1, readAt: new Date() })
    .where(and(
      eq(notifications.id, id),
      eq(notifications.userId, user.id)
    ))
    .returning()
  
  if (!notification) {
    return c.json({ success: false, message: '通知不存在' }, 404)
  }
  
  return c.json({ success: true, data: notification })
})

// 标记全部已读
notificationRoutes.put('/read-all', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  
  await db.update(notifications)
    .set({ isRead: 1, readAt: new Date() })
    .where(and(
      eq(notifications.userId, user.id),
      eq(notifications.isRead, 0)
    ))
  
  return c.json({ success: true, message: '已全部标记为已读' })
})

// 删除通知
notificationRoutes.delete('/:id', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  const id = c.req.param('id')
  
  await db.delete(notifications)
    .where(and(
      eq(notifications.id, id),
      eq(notifications.userId, user.id)
    ))
  
  return c.json({ success: true, message: '删除成功' })
})

// 创建通知（测试用）
notificationRoutes.post('/', zValidator('json', z.object({
  userId: z.string().uuid(),
  type: z.enum(['task', 'workflow', 'system', 'reminder']),
  title: z.string(),
  content: z.string().optional(),
  link: z.string().optional()
})), async (c) => {
  const body = c.req.valid('json')
  
  const notification = await createNotification(body)
  
  return c.json({ success: true, data: notification }, 201)
})
