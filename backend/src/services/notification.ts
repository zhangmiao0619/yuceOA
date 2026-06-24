// @ts-nocheck
import { db } from '../db/index.js'
import { notifications } from '../schema/index.js'
import { sendWechatMessage } from '../routes/wechat.js'
import { eq, and } from 'drizzle-orm'

/**
 * 通知服务 - 统一管理应用内通知和企业微信消息推送
 */

interface NotificationPayload {
  userId: string
  type: 'task' | 'workflow' | 'system' | 'reminder'
  title: string
  content: string
  link?: string
  wechatUserId?: string
}

/**
 * 发送通知（应用内 + 企业微信）
 */
export async function sendNotification(payload: NotificationPayload) {
  // 1. 保存到数据库（使用原生SQL绕过Drizzle在SQLite下的兼容性问题）
  const { sqlite } = await import('../db/index.js')
  const stmt = sqlite.prepare(`
    INSERT INTO notifications (id, user_id, type, title, content, link, is_read, created_at)
    VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 0, datetime('now'))
  `)
  stmt.run(
    payload.userId,
    payload.type,
    payload.title,
    payload.content || null,
    payload.link || null
  )
  
  // 2. 发送到企业微信（如果配置了）
  if (payload.wechatUserId) {
    await sendWechatMessage(payload.wechatUserId, {
      title: payload.title,
      description: payload.content,
      url: payload.link
    })
  }
}

/**
 * 任务相关通知
 */
export async function notifyTaskAssigned(taskId: string, assigneeId: string, taskTitle: string) {
  await sendNotification({
    userId: assigneeId,
    type: 'task',
    title: '新任务分配',
    content: `你被分配了任务：${taskTitle}`,
    link: `/tasks/${taskId}`
  })
}

export async function notifyTaskDueSoon(taskId: string, assigneeId: string, taskTitle: string, dueDate: string) {
  await sendNotification({
    userId: assigneeId,
    type: 'reminder',
    title: '任务即将到期',
    content: `任务「${taskTitle}」将于 ${dueDate} 到期，请及时处理`,
    link: `/tasks/${taskId}`
  })
}

export async function notifyTaskCompleted(taskId: string, creatorId: string, taskTitle: string) {
  await sendNotification({
    userId: creatorId,
    type: 'task',
    title: '任务已完成',
    content: `任务「${taskTitle}」已完成`,
    link: `/tasks/${taskId}`
  })
}

/**
 * 审批相关通知
 */
export async function notifyWorkflowSubmitted(instanceId: string, approverId: string, title: string) {
  await sendNotification({
    userId: approverId,
    type: 'workflow',
    title: '待审批提醒',
    content: `有一条新的审批需要处理：${title}`,
    link: `/workflows/${instanceId}`
  })
}

export async function notifyWorkflowApproved(instanceId: string, applicantId: string, title: string) {
  await sendNotification({
    userId: applicantId,
    type: 'workflow',
    title: '审批已通过',
    content: `你的申请「${title}」已通过审批`,
    link: `/workflows/${instanceId}`
  })
}

export async function notifyWorkflowRejected(instanceId: string, applicantId: string, title: string, reason?: string) {
  await sendNotification({
    userId: applicantId,
    type: 'workflow',
    title: '审批未通过',
    content: `你的申请「${title}」未通过审批${reason ? '，原因：' + reason : ''}`,
    link: `/workflows/${instanceId}`
  })
}

/**
 * 系统通知
 */
export async function notifySystem(userId: string, title: string, content: string, link?: string) {
  await sendNotification({
    userId,
    type: 'system',
    title,
    content,
    link
  })
}

/**
 * 批量发送系统通知
 */
export async function notifySystemBulk(userIds: string[], title: string, content: string, link?: string) {
  for (const userId of userIds) {
    await notifySystem(userId, title, content, link)
  }
}

/**
 * 标记通知为已读
 */
export async function markNotificationAsRead(notificationId: string) {
  await db.update(notifications)
    .set({ 
      isRead: true,
      readAt: new Date()
    })
    .where(eq(notifications.id, notificationId))
}

/**
 * 获取用户未读通知数
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const list = await db.select()
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false)
    ))
  
  return list.length
}


