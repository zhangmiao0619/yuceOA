// @ts-nocheck
import { getUser } from '../types/user.js'
import { Hono } from 'hono'
import { db } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const sqlite = (db as any).$client

export const hrRequestRoutes = new Hono()

hrRequestRoutes.use('*', authMiddleware)

// ==================== 外出申请 ====================

// 创建外出申请
hrRequestRoutes.post('/outgoing', async (c) => {
  try {
    const user = getUser(c)
    if (!user) return c.json({ success: false, message: "未登录" }, 401)
    const body = await c.req.json()

    const stmt = sqlite.prepare(`
      INSERT INTO outgoing_requests (
        id, user_id, destination, start_date, end_date, purpose, status, created_at, updated_at
      ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
      RETURNING *
    `)
    const request = stmt.get(
      user.id,
      body.destination,
      body.startDate,
      body.endDate,
      body.purpose || null
    )
    return c.json({ success: true, data: request }, 201)
  } catch (error: any) {
    console.error('Create outgoing request error:', error)
    return c.json({ success: false, message: '创建外出申请失败' }, 500)
  }
})

// 获取我的外出记录
hrRequestRoutes.get('/outgoing', async (c) => {
  try {
    const user = getUser(c)
    if (!user) return c.json({ success: false, message: "未登录" }, 401)
    const { status } = c.req.query()

    let sql = 'SELECT * FROM outgoing_requests WHERE user_id = ?'
    const params: any[] = [user.id]
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    sql += ' ORDER BY created_at DESC LIMIT 50'
    const stmt = sqlite.prepare(sql)
    const records = stmt.all(...params)
    return c.json({ success: true, data: records })
  } catch (error: any) {
    console.error('Get outgoing requests error:', error)
    return c.json({ success: false, message: '获取外出记录失败' }, 500)
  }
})

// 管理员：获取所有待审批外出
hrRequestRoutes.get('/admin/outgoing-pending', async (c) => {
  try {
    const user = getUser(c)
    if (!user || !user.isAdmin) return c.json({ success: false, message: '权限不足' }, 403)

    const stmt = sqlite.prepare(`
      SELECT o.*, u.name as user_name, u.department_name
      FROM outgoing_requests o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.status = 'pending'
      ORDER BY o.created_at DESC LIMIT 50
    `)
    return c.json({ success: true, data: stmt.all() })
  } catch (error: any) {
    console.error('Get pending outgoing error:', error)
    return c.json({ success: false, message: '获取待审批外出失败' }, 500)
  }
})

// 管理员：审批外出
hrRequestRoutes.put('/admin/outgoing/:id/approve', async (c) => {
  try {
    const user = getUser(c)
    if (!user || !user.isAdmin) return c.json({ success: false, message: '权限不足' }, 403)
    const id = c.req.param('id')
    const body = await c.req.json()
    const status = body.approved ? 'approved' : 'rejected'

    const stmt = sqlite.prepare(`
      UPDATE outgoing_requests
      SET status = ?, approver_id = ?, approved_at = datetime('now'), approver_notes = ?, updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `)
    const request = stmt.get(status, user.id, body.notes || null, id)
    return c.json({ success: true, data: request })
  } catch (error: any) {
    console.error('Approve outgoing error:', error)
    return c.json({ success: false, message: '审批失败' }, 500)
  }
})

// ==================== 出差申请 ====================

// 创建出差申请
hrRequestRoutes.post('/business-trip', async (c) => {
  try {
    const user = getUser(c)
    if (!user) return c.json({ success: false, message: "未登录" }, 401)
    const body = await c.req.json()

    const stmt = sqlite.prepare(`
      INSERT INTO business_trip_requests (
        id, user_id, destination, start_date, end_date, transport, purpose, status, created_at, updated_at
      ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
      RETURNING *
    `)
    const request = stmt.get(
      user.id,
      body.destination,
      body.startDate,
      body.endDate,
      body.transport || '汽车',
      body.purpose || null
    )
    return c.json({ success: true, data: request }, 201)
  } catch (error: any) {
    console.error('Create business trip request error:', error)
    return c.json({ success: false, message: '创建出差申请失败' }, 500)
  }
})

// 获取我的出差记录
hrRequestRoutes.get('/business-trip', async (c) => {
  try {
    const user = getUser(c)
    if (!user) return c.json({ success: false, message: "未登录" }, 401)
    const { status } = c.req.query()

    let sql = 'SELECT * FROM business_trip_requests WHERE user_id = ?'
    const params: any[] = [user.id]
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    sql += ' ORDER BY created_at DESC LIMIT 50'
    const stmt = sqlite.prepare(sql)
    const records = stmt.all(...params)
    return c.json({ success: true, data: records })
  } catch (error: any) {
    console.error('Get business trip requests error:', error)
    return c.json({ success: false, message: '获取出差记录失败' }, 500)
  }
})

// 管理员：获取所有待审批出差
hrRequestRoutes.get('/admin/business-trip-pending', async (c) => {
  try {
    const user = getUser(c)
    if (!user || !user.isAdmin) return c.json({ success: false, message: '权限不足' }, 403)

    const stmt = sqlite.prepare(`
      SELECT b.*, u.name as user_name, u.department_name
      FROM business_trip_requests b
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.status = 'pending'
      ORDER BY b.created_at DESC LIMIT 50
    `)
    return c.json({ success: true, data: stmt.all() })
  } catch (error: any) {
    console.error('Get pending business trip error:', error)
    return c.json({ success: false, message: '获取待审批出差失败' }, 500)
  }
})

// 管理员：审批出差
hrRequestRoutes.put('/admin/business-trip/:id/approve', async (c) => {
  try {
    const user = getUser(c)
    if (!user || !user.isAdmin) return c.json({ success: false, message: '权限不足' }, 403)
    const id = c.req.param('id')
    const body = await c.req.json()
    const status = body.approved ? 'approved' : 'rejected'

    const stmt = sqlite.prepare(`
      UPDATE business_trip_requests
      SET status = ?, approver_id = ?, approved_at = datetime('now'), approver_notes = ?, updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `)
    const request = stmt.get(status, user.id, body.notes || null, id)
    return c.json({ success: true, data: request })
  } catch (error: any) {
    console.error('Approve business trip error:', error)
    return c.json({ success: false, message: '审批失败' }, 500)
  }
})
