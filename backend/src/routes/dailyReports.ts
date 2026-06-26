// @ts-nocheck
import { getUser } from '../types/user'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const sqlite = (db as any).$client

// 迁移：确保 daily_reports 表有必要的列
try { sqlite.exec(`ALTER TABLE daily_reports ADD COLUMN cc_users TEXT DEFAULT '[]'`) } catch (e) {}
try { sqlite.exec(`ALTER TABLE daily_reports ADD COLUMN submit_time DATETIME`) } catch (e) {}

export const dailyReportRoutes = new Hono()

dailyReportRoutes.use('*', authMiddleware)

// 获取日报列表
// GET /api/daily-reports
// Query: userId, startDate, endDate, status
dailyReportRoutes.get('/', async (c) => {
  const user = getUser(c)
  if (!user) {
    return c.json({ success: false, message: "未登录" }, 401)
  }
  
  const queryUserId = c.req.query('userId')
  const startDate = c.req.query('startDate')
  const endDate = c.req.query('endDate')
  const status = c.req.query('status')
  
  try {
    let sql = `
      SELECT dr.*, u.name as user_name
      FROM daily_reports dr
      LEFT JOIN users u ON dr.user_id = u.id
      WHERE 1=1
    `
    const params = []
    
    // 非管理员只能看自己的或抄送给自己的
    if (!user.isAdmin) {
      sql += ` AND (dr.user_id = ? OR dr.cc_users LIKE ?)`
      params.push(user.id)
      params.push(`%${user.id}%`)
    } else if (queryUserId) {
      sql += ` AND dr.user_id = ?`
      params.push(queryUserId)
    }
    
    if (startDate) {
      sql += ` AND dr.report_date >= ?`
      params.push(startDate)
    }
    if (endDate) {
      sql += ` AND dr.report_date <= ?`
      params.push(endDate)
    }
    if (status) {
      sql += ` AND dr.status = ?`
      params.push(status)
    }
    
    sql += ` ORDER BY dr.report_date DESC, dr.created_at DESC`
    
    const stmt = sqlite.prepare(sql)
    const reports = stmt.all(...params)
    
    // 解析JSON字段
    const parsedReports = reports.map((r: any) => ({
      ...r,
      completed_tasks: JSON.parse(r.completed_tasks || '[]'),
      planned_tasks: JSON.parse(r.planned_tasks || '[]'),
      cc_users: JSON.parse(r.cc_users || '[]')
    }))
    
    return c.json({ success: true, data: parsedReports })
  } catch (error: any) {
    console.error('Get daily reports error:', error)
    return c.json({ success: false, message: '获取日报失败' }, 500)
  }
})

// 获取日报详情
// GET /api/daily-reports/:id
dailyReportRoutes.get('/:id', async (c) => {
  const user = getUser(c)
  if (!user) {
    return c.json({ success: false, message: "未登录" }, 401)
  }
  
  const id = c.req.param('id')
  
  try {
    const stmt = sqlite.prepare(`
      SELECT dr.*, u.name as user_name
      FROM daily_reports dr
      LEFT JOIN users u ON dr.user_id = u.id
      WHERE dr.id = ?
    `)
    const report = stmt.get(id)
    
    if (!report) {
      return c.json({ success: false, message: '日报不存在' }, 404)
    }
    
    // 非管理员只能看自己的或抄送给自己的
    const ccUsers = JSON.parse(report.cc_users || '[]')
    if (!user.isAdmin && report.user_id !== user.id && !ccUsers.includes(user.id)) {
      return c.json({ success: false, message: '无权查看' }, 403)
    }
    
    return c.json({
      success: true,
      data: {
        ...report,
        completed_tasks: JSON.parse(report.completed_tasks || '[]'),
        planned_tasks: JSON.parse(report.planned_tasks || '[]'),
        cc_users: ccUsers
      }
    })
  } catch (error: any) {
    console.error('Get daily report error:', error)
    return c.json({ success: false, message: '获取日报详情失败' }, 500)
  }
})

// 创建日报
// POST /api/daily-reports
dailyReportRoutes.post('/', zValidator('json', z.object({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.string().min(1, '日报内容不能为空').max(2000, '内容不能超过2000字'),
  completedTasks: z.array(z.string()).optional(),
  plannedTasks: z.array(z.string()).optional(),
  problems: z.string().optional(),
  ccUsers: z.array(z.string()).optional()
})), async (c) => {
  const user = getUser(c)
  if (!user) {
    return c.json({ success: false, message: "未登录" }, 401)
  }
  
  const body = c.req.valid('json')
  
  try {
    // 检查是否已存在该日期的日报
    const existingStmt = sqlite.prepare(`
      SELECT id FROM daily_reports WHERE user_id = ? AND report_date = ?
    `)
    const existing = existingStmt.get(user.id, body.reportDate)
    
    if (existing) {
      return c.json({ success: false, message: '该日期已存在日报，请编辑' }, 400)
    }
    
    const stmt = sqlite.prepare(`
      INSERT INTO daily_reports (id, user_id, report_date, content, completed_tasks, planned_tasks, problems, status, cc_users, created_at, updated_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, 'draft', ?, datetime('now'), datetime('now'))
      RETURNING *
    `)
    
    const report = stmt.get(
      user.id,
      body.reportDate,
      body.content,
      JSON.stringify(body.completedTasks || []),
      JSON.stringify(body.plannedTasks || []),
      body.problems || null,
      JSON.stringify(body.ccUsers || [])
    )
    
    return c.json({
      success: true,
      data: {
        ...report,
        completed_tasks: JSON.parse(report.completed_tasks || '[]'),
        planned_tasks: JSON.parse(report.planned_tasks || '[]'),
        cc_users: JSON.parse(report.cc_users || '[]')
      },
      message: '日报创建成功'
    }, 201)
  } catch (error: any) {
    console.error('Create daily report error:', error)
    return c.json({ success: false, message: '创建日报失败' }, 500)
  }
})

// 更新日报
// PUT /api/daily-reports/:id
dailyReportRoutes.put('/:id', zValidator('json', z.object({
  content: z.string().min(1).max(2000).optional(),
  completedTasks: z.array(z.string()).optional(),
  plannedTasks: z.array(z.string()).optional(),
  problems: z.string().optional(),
  status: z.enum(['draft', 'submitted']).optional(),
  ccUsers: z.array(z.string()).optional()
})), async (c) => {
  const user = getUser(c)
  if (!user) {
    return c.json({ success: false, message: "未登录" }, 401)
  }
  
  const id = c.req.param('id')
  const body = c.req.valid('json')
  
  try {
    // 检查日报是否存在
    const checkStmt = sqlite.prepare(`SELECT * FROM daily_reports WHERE id = ?`)
    const existing = checkStmt.get(id)
    
    if (!existing) {
      return c.json({ success: false, message: '日报不存在' }, 404)
    }
    
    // 非管理员只能修改自己的
    if (!user.isAdmin && existing.user_id !== user.id) {
      return c.json({ success: false, message: '无权修改' }, 403)
    }
    
    // 已提交的不能修改内容（管理员可以）
    if (existing.status === 'submitted' && !user.isAdmin) {
      return c.json({ success: false, message: '已提交的日报不能修改' }, 400)
    }
    
    const stmt = sqlite.prepare(`
      UPDATE daily_reports
      SET content = COALESCE(?, content),
          completed_tasks = COALESCE(?, completed_tasks),
          planned_tasks = COALESCE(?, planned_tasks),
          problems = COALESCE(?, problems),
          status = COALESCE(?, status),
          cc_users = COALESCE(?, cc_users),
          updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `)
    
    const report = stmt.get(
      body.content || null,
      body.completedTasks ? JSON.stringify(body.completedTasks) : null,
      body.plannedTasks ? JSON.stringify(body.plannedTasks) : null,
      body.problems !== undefined ? body.problems : null,
      body.status || null,
      body.ccUsers ? JSON.stringify(body.ccUsers) : null,
      id
    )
    
    return c.json({
      success: true,
      data: {
        ...report,
        completed_tasks: JSON.parse(report.completed_tasks || '[]'),
        planned_tasks: JSON.parse(report.planned_tasks || '[]'),
        cc_users: JSON.parse(report.cc_users || '[]')
      },
      message: '更新成功'
    })
  } catch (error: any) {
    console.error('Update daily report error:', error)
    return c.json({ success: false, message: '更新日报失败' }, 500)
  }
})

// 提交日报
// POST /api/daily-reports/:id/submit
dailyReportRoutes.post('/:id/submit', async (c) => {
  const user = getUser(c)
  if (!user) {
    return c.json({ success: false, message: "未登录" }, 401)
  }
  
  const id = c.req.param('id')
  
  try {
    const checkStmt = sqlite.prepare(`SELECT * FROM daily_reports WHERE id = ?`)
    const existing = checkStmt.get(id)
    
    if (!existing) {
      return c.json({ success: false, message: '日报不存在' }, 404)
    }
    
    if (existing.user_id !== user.id) {
      return c.json({ success: false, message: '只能提交自己的日报' }, 403)
    }
    
    const stmt = sqlite.prepare(`
      UPDATE daily_reports
      SET status = 'submitted', submit_time = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `)
    const report = stmt.get(id)
    
    // 给抄送人发送通知
    const ccUsers = JSON.parse(existing.cc_users || '[]')
    if (ccUsers.length > 0) {
      const notifyStmt = sqlite.prepare(`
        INSERT INTO notifications (id, user_id, type, title, content, link, created_at)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, datetime('now'))
      `)
      for (const ccUserId of ccUsers) {
        notifyStmt.run(
          ccUserId,
          'daily_report',
          '日报抄送',
          `${user.name}提交了${existing.report_date}的日报`,
          `/daily-reports/${id}`
        )
      }
    }
    
    return c.json({
      success: true,
      data: {
        ...report,
        completed_tasks: JSON.parse(report.completed_tasks || '[]'),
        planned_tasks: JSON.parse(report.planned_tasks || '[]'),
        cc_users: JSON.parse(report.cc_users || '[]')
      },
      message: '日报已提交'
    })
  } catch (error: any) {
    console.error('Submit daily report error:', error)
    return c.json({ success: false, message: '提交失败' }, 500)
  }
})

// 删除日报
// DELETE /api/daily-reports/:id
dailyReportRoutes.delete('/:id', async (c) => {
  const user = getUser(c)
  if (!user) {
    return c.json({ success: false, message: "未登录" }, 401)
  }
  
  const id = c.req.param('id')
  
  try {
    const checkStmt = sqlite.prepare(`SELECT * FROM daily_reports WHERE id = ?`)
    const existing = checkStmt.get(id)
    
    if (!existing) {
      return c.json({ success: false, message: '日报不存在' }, 404)
    }
    
    // 只能删除自己的草稿，管理员可以删除任何
    if (!user.isAdmin && existing.user_id !== user.id) {
      return c.json({ success: false, message: '无权删除' }, 403)
    }
    
    if (!user.isAdmin && existing.status !== 'draft') {
      return c.json({ success: false, message: '只能删除草稿' }, 400)
    }
    
    const stmt = sqlite.prepare(`DELETE FROM daily_reports WHERE id = ?`)
    stmt.run(id)
    
    return c.json({ success: true, message: '删除成功' })
  } catch (error: any) {
    console.error('Delete daily report error:', error)
    return c.json({ success: false, message: '删除失败' }, 500)
  }
})

// 获取日报统计
// GET /api/daily-reports/stats/overview
dailyReportRoutes.get('/stats/overview', async (c) => {
  const user = getUser(c)
  if (!user) {
    return c.json({ success: false, message: "未登录" }, 401)
  }
  
  try {
    const today = new Date().toISOString().split('T')[0]
    
    let sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN report_date = ? THEN 1 ELSE 0 END) as today_count
      FROM daily_reports
      WHERE 1=1
    `
    const params = [today]
    
    if (!user.isAdmin) {
      sql += ` AND user_id = ?`
      params.push(user.id)
    }
    
    const stmt = sqlite.prepare(sql)
    const stats = stmt.get(...params)
    
    return c.json({
      success: true,
      data: {
        total: stats.total || 0,
        submitted: stats.submitted || 0,
        todayCount: stats.today_count || 0
      }
    })
  } catch (error: any) {
    console.error('Get daily report stats error:', error)
    return c.json({ success: false, message: '获取统计失败' }, 500)
  }
})
