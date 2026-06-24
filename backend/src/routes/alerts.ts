// @ts-nocheck
import { getUser } from '../types/user'
import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { sqlite } from '../db/index.js'

export const alertRoutes = new Hono()
alertRoutes.use('*', authMiddleware)

// 获取预警看板
alertRoutes.get('/', async (c) => {
  try {
    const user = getUser(c)
    if (!user) return c.json({ success: false, message: "未登录" }, 401)
    
    const { status, type, page = '1', pageSize = '50' } = c.req.query()
    
    let sql = `
      SELECT a.*, u.name as resolver_name
      FROM alerts a
      LEFT JOIN users u ON a.resolved_by = u.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (status) {
      sql += ' AND a.status = ?'
      params.push(status)
    }
    if (type) {
      sql += ' AND a.alert_type = ?'
      params.push(type)
    }
    
    const countStmt = sqlite.prepare(sql.replace('SELECT a.*, u.name as resolver_name', 'SELECT COUNT(*) as total'))
    const total = countStmt.get(...params).total
    
    sql += ' ORDER BY a.due_date ASC, a.created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const stmt = sqlite.prepare(sql)
    const list = stmt.all(...params)
    
    return c.json({ success: true, data: list, total })
  } catch (error: any) {
    console.error('Get alerts error:', error)
    return c.json({ success: false, message: '获取预警失败' }, 500)
  }
})

// 获取预警统计
alertRoutes.get('/stats', async (c) => {
  try {
    const user = getUser(c)
    if (!user) return c.json({ success: false, message: "未登录" }, 401)
    
    const pending = sqlite.prepare("SELECT COUNT(*) as c FROM alerts WHERE status = 'pending'").get().c
    const notified = sqlite.prepare("SELECT COUNT(*) as c FROM alerts WHERE status = 'notified'").get().c
    const resolved = sqlite.prepare("SELECT COUNT(*) as c FROM alerts WHERE status = 'resolved'").get().c
    const urgent = sqlite.prepare("SELECT COUNT(*) as c FROM alerts WHERE status IN ('pending', 'notified') AND days_remaining <= 7").get().c
    
    // 按类型统计
    const typeStats = sqlite.prepare(`
      SELECT alert_type, COUNT(*) as count 
      FROM alerts 
      WHERE status IN ('pending', 'notified')
      GROUP BY alert_type
    `).all()
    
    return c.json({
      success: true,
      data: { pending, notified, resolved, urgent, typeStats }
    })
  } catch (error: any) {
    console.error('Alert stats error:', error)
    return c.json({ success: false, message: '获取统计失败' }, 500)
  }
})

// 手动触发预警扫描（管理员）
alertRoutes.post('/scan', async (c) => {
  try {
    const user = getUser(c)
    if (!user || !user.isAdmin) return c.json({ success: false, message: '权限不足' }, 403)
    
    const results = scanAlerts()
    
    return c.json({ success: true, data: results })
  } catch (error: any) {
    console.error('Scan alerts error:', error)
    return c.json({ success: false, message: '扫描预警失败' }, 500)
  }
})

// 标记预警已处理
alertRoutes.put('/:id/resolve', async (c) => {
  try {
    const user = getUser(c)
    if (!user) return c.json({ success: false, message: "未登录" }, 401)
    
    const id = c.req.param('id')
    const body = await c.req.json()
    
    const stmt = sqlite.prepare(`
      UPDATE alerts 
      SET status = 'resolved', resolved_at = datetime('now'), resolved_by = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `)
    const record = stmt.get(user.id, body.notes || null, id)
    
    return c.json({ success: true, data: record })
  } catch (error: any) {
    console.error('Resolve alert error:', error)
    return c.json({ success: false, message: '处理预警失败' }, 500)
  }
})

// 扫描并生成预警
export function scanAlerts() {
  const results: any[] = []
  const now = new Date()
  
  // 1. 劳动合同到期预警（30天、7天）
  const contractAlerts = sqlite.prepare(`
    SELECT id, name, contract_end_date 
    FROM users 
    WHERE employment_status = 'active' 
    AND contract_end_date IS NOT NULL 
    AND contract_end_date >= date('now')
    AND contract_end_date <= date('now', '+30 days')
  `).all() as any[]
  
  for (const u of contractAlerts) {
    const days = Math.ceil((new Date(u.contract_end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const existing = sqlite.prepare(`SELECT id FROM alerts WHERE target_id = ? AND alert_type = 'contract_renewal' AND status IN ('pending', 'notified')`).get(u.id)
    if (!existing) {
      const stmt = sqlite.prepare(`
        INSERT INTO alerts (id, alert_type, target_type, target_id, target_name, due_date, days_remaining, status, created_at, updated_at)
        VALUES (lower(hex(randomblob(16))), 'contract_renewal', 'user', ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
      `)
      stmt.run(u.id, u.name, u.contract_end_date, days)
      results.push({ type: 'contract_renewal', target: u.name, days })
    }
  }
  
  // 2. 试用期结束预警
  const probationAlerts = sqlite.prepare(`
    SELECT id, name, probation_end_date 
    FROM users 
    WHERE employment_status = 'probation' 
    AND probation_end_date IS NOT NULL 
    AND probation_end_date >= date('now')
    AND probation_end_date <= date('now', '+14 days')
  `).all() as any[]
  
  for (const u of probationAlerts) {
    const days = Math.ceil((new Date(u.probation_end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const existing = sqlite.prepare(`SELECT id FROM alerts WHERE target_id = ? AND alert_type = 'probation_end' AND status IN ('pending', 'notified')`).get(u.id)
    if (!existing) {
      sqlite.prepare(`
        INSERT INTO alerts (id, alert_type, target_type, target_id, target_name, due_date, days_remaining, status, created_at, updated_at)
        VALUES (lower(hex(randomblob(16))), 'probation_end', 'user', ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
      `).run(u.id, u.name, u.probation_end_date, days)
      results.push({ type: 'probation_end', target: u.name, days })
    }
  }
  
  // 3. 资质/工作证到期预警
  const assetAlerts = sqlite.prepare(`
    SELECT id, name, valid_until, category 
    FROM assets 
    WHERE valid_until IS NOT NULL 
    AND valid_until >= date('now')
    AND valid_until <= date('now', '+30 days')
  `).all() as any[]
  
  for (const a of assetAlerts) {
    const days = Math.ceil((new Date(a.valid_until).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const alertType = a.category === 'work_permit' ? 'work_permit_renewal' : 'qualification_renewal'
    const existing = sqlite.prepare(`SELECT id FROM alerts WHERE target_id = ? AND alert_type = ? AND status IN ('pending', 'notified')`).get(a.id, alertType)
    if (!existing) {
      sqlite.prepare(`
        INSERT INTO alerts (id, alert_type, target_type, target_id, target_name, due_date, days_remaining, status, created_at, updated_at)
        VALUES (lower(hex(randomblob(16))), ?, 'asset', ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
      `).run(alertType, a.id, a.name, a.valid_until, days)
      results.push({ type: alertType, target: a.name, days })
    }
  }
  
  // 4. 职称申报提醒（基于 title_declaration_date）
  const titleAlerts = sqlite.prepare(`
    SELECT id, name, title_declaration_date 
    FROM users 
    WHERE employment_status = 'active' 
    AND title_declaration_date IS NOT NULL 
    AND title_declaration_date >= date('now')
    AND title_declaration_date <= date('now', '+30 days')
  `).all() as any[]
  
  for (const u of titleAlerts) {
    const days = Math.ceil((new Date(u.title_declaration_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const existing = sqlite.prepare(`SELECT id FROM alerts WHERE target_id = ? AND alert_type = 'title_declaration' AND status IN ('pending', 'notified')`).get(u.id)
    if (!existing) {
      sqlite.prepare(`
        INSERT INTO alerts (id, alert_type, target_type, target_id, target_name, due_date, days_remaining, status, created_at, updated_at)
        VALUES (lower(hex(randomblob(16))), 'title_declaration', 'user', ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
      `).run(u.id, u.name, u.title_declaration_date, days)
      results.push({ type: 'title_declaration', target: u.name, days })
    }
  }
  
  // 5. 固定资产维保预警
  const maintenanceAlerts = sqlite.prepare(`
    SELECT id, name, next_maintenance_date 
    FROM assets 
    WHERE asset_type = 'fixed' 
    AND next_maintenance_date IS NOT NULL 
    AND next_maintenance_date >= date('now')
    AND next_maintenance_date <= date('now', '+14 days')
  `).all() as any[]
  
  for (const a of maintenanceAlerts) {
    const days = Math.ceil((new Date(a.next_maintenance_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const existing = sqlite.prepare(`SELECT id FROM alerts WHERE target_id = ? AND alert_type = 'asset_maintenance' AND status IN ('pending', 'notified')`).get(a.id)
    if (!existing) {
      sqlite.prepare(`
        INSERT INTO alerts (id, alert_type, target_type, target_id, target_name, due_date, days_remaining, status, created_at, updated_at)
        VALUES (lower(hex(randomblob(16))), 'asset_maintenance', 'asset', ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
      `).run(a.id, a.name, a.next_maintenance_date, days)
      results.push({ type: 'asset_maintenance', target: a.name, days })
    }
  }
  
  return results
}
