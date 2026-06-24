// @ts-nocheck
import { getUser } from '../types/user'
import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { sqlite } from '../db/index.js'

export const assetRoutes = new Hono()
assetRoutes.use('*', authMiddleware)

// 生成资产编号: GD-2026-0001 (固定) / WX-2026-0001 (无形)
function generateAssetNo(assetType) {
  const prefix = assetType === 'fixed' ? 'GD' : 'WX'
  const year = new Date().getFullYear()
  const last = sqlite.prepare(
    `SELECT asset_no FROM assets WHERE asset_no LIKE ? ORDER BY asset_no DESC LIMIT 1`
  ).get(`${prefix}-${year}-%`)
  
  let seq = 1
  if (last) {
    const parts = last.asset_no.split('-')
    seq = parseInt(parts[2] || '0') + 1
  }
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`
}

// 获取资产列表
assetRoutes.get('/', async (c) => {
  try {
    const user = getUser(c)
    if (!user) return c.json({ success: false, message: "未登录" }, 401)
    
    const { assetType, category, status, keyword, page = '1', pageSize = '20' } = c.req.query()
    
    let sql = `
      SELECT a.*, u.name as keeper_name 
      FROM assets a
      LEFT JOIN users u ON a.keeper_id = u.id
      WHERE 1=1
    `
    const params = []
    
    if (assetType) {
      sql += ' AND a.asset_type = ?'
      params.push(assetType)
    }
    if (category) {
      sql += ' AND a.category = ?'
      params.push(category)
    }
    if (status) {
      sql += ' AND a.status = ?'
      params.push(status)
    }
    if (keyword) {
      sql += ' AND (a.name LIKE ? OR a.asset_no LIKE ? OR a.serial_number LIKE ? OR a.license_no LIKE ?)'
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
    }
    
    const countStmt = sqlite.prepare(sql.replace('SELECT a.*, u.name as keeper_name', 'SELECT COUNT(*) as total'))
    const total = countStmt.get(...params).total
    
    sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const list = sqlite.prepare(sql).all(...params)
    
    return c.json({ success: true, data: list, total })
  } catch (error) {
    console.error('Get assets error:', error)
    return c.json({ success: false, message: '获取资产列表失败' }, 500)
  }
})

// 获取资产详情
assetRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const asset = sqlite.prepare(`
      SELECT a.*, u.name as keeper_name 
      FROM assets a
      LEFT JOIN users u ON a.keeper_id = u.id
      WHERE a.id = ?
    `).get(id)
    
    if (!asset) return c.json({ success: false, message: '资产不存在' }, 404)
    
    const records = sqlite.prepare(`
      SELECT ar.*, fu.name as from_user_name, tu.name as to_user_name, op.name as operator_name
      FROM asset_records ar
      LEFT JOIN users fu ON ar.from_user_id = fu.id
      LEFT JOIN users tu ON ar.to_user_id = tu.id
      LEFT JOIN users op ON ar.operator_id = op.id
      WHERE ar.asset_id = ?
      ORDER BY ar.created_at DESC
    `).all(id)
    
    return c.json({ success: true, data: { ...asset, records } })
  } catch (error) {
    console.error('Get asset error:', error)
    return c.json({ success: false, message: '获取资产详情失败' }, 500)
  }
})

// 创建资产（自动生成编号）
assetRoutes.post('/', async (c) => {
  try {
    const user = getUser(c)
    if (!user || !user.isAdmin) return c.json({ success: false, message: '权限不足' }, 403)
    
    const body = await c.req.json()
    const assetType = body.assetType || 'fixed'
    const assetNo = body.assetNo || generateAssetNo(assetType)
    
    const stmt = sqlite.prepare(`
      INSERT INTO assets (
        id, asset_no, name, category, asset_type, model, manufacturer, serial_number,
        purchase_date, purchase_price, current_value, status, location, keeper_id, department_name,
        warranty_expiry, maintenance_date, next_maintenance_date, license_no, issuing_authority,
        valid_from, valid_until, renewal_reminder_date, description, attachments, created_at, updated_at
      ) VALUES (
        lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
      )
      RETURNING *
    `)
    
    const asset = stmt.get(
      assetNo, body.name, body.category, assetType,
      body.model || null, body.manufacturer || null, body.serialNumber || null,
      body.purchaseDate || null, body.purchasePrice || null, body.purchasePrice || null,
      body.status || (assetType === 'fixed' ? 'idle' : 'valid'),
      body.location || null, body.keeperId || null, body.departmentName || null,
      body.warrantyExpiry || null, body.maintenanceDate || null, body.nextMaintenanceDate || null,
      body.licenseNo || null, body.issuingAuthority || null,
      body.validFrom || null, body.validUntil || null, body.renewalReminderDate || null,
      body.description || null, JSON.stringify(body.attachments || [])
    )
    
    sqlite.prepare(`
      INSERT INTO asset_records (id, asset_id, record_type, to_user_id, to_location, record_date, operator_id, reason, created_at)
      VALUES (lower(hex(randomblob(16))), ?, 'purchase', ?, ?, date('now'), ?, '资产录入', datetime('now'))
    `).run(asset.id, body.keeperId || null, body.location || null, user.id)
    
    return c.json({ success: true, data: asset }, 201)
  } catch (error) {
    console.error('Create asset error:', error)
    return c.json({ success: false, message: '创建资产失败' }, 500)
  }
})

// 更新资产
assetRoutes.put('/:id', async (c) => {
  try {
    const user = getUser(c)
    if (!user || !user.isAdmin) return c.json({ success: false, message: '权限不足' }, 403)
    
    const id = c.req.param('id')
    const body = await c.req.json()
    
    const fields = [
      'asset_no', 'name', 'category', 'asset_type', 'model', 'manufacturer', 'serial_number',
      'purchase_date', 'purchase_price', 'current_value', 'status', 'location', 'keeper_id', 'department_name',
      'warranty_expiry', 'maintenance_date', 'next_maintenance_date', 'license_no', 'issuing_authority',
      'valid_from', 'valid_until', 'renewal_reminder_date', 'description'
    ]
    
    const updates = []
    const values = []
    
    for (const field of fields) {
      const camelField = field.replace(/_([a-z])/g, (_, l) => l.toUpperCase())
      const val = body[field] !== undefined ? body[field] : body[camelField]
      if (val !== undefined) {
        updates.push(`${field} = ?`)
        values.push(val)
      }
    }
    
    if (body.attachments !== undefined) {
      updates.push('attachments = ?')
      values.push(JSON.stringify(body.attachments))
    }
    
    if (updates.length === 0) {
      return c.json({ success: false, message: '无更新内容' }, 400)
    }
    
    updates.push('updated_at = datetime("now")')
    values.push(id)
    
    const asset = sqlite.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = ? RETURNING *`).get(...values)
    
    return c.json({ success: true, data: asset })
  } catch (error) {
    console.error('Update asset error:', error)
    return c.json({ success: false, message: '更新资产失败' }, 500)
  }
})

// 资产流转/操作
assetRoutes.post('/:id/transfer', async (c) => {
  try {
    const user = getUser(c)
    if (!user || !user.isAdmin) return c.json({ success: false, message: '权限不足' }, 403)
    
    const id = c.req.param('id')
    const body = await c.req.json()
    
    const asset = sqlite.prepare('SELECT * FROM assets WHERE id = ?').get(id)
    if (!asset) return c.json({ success: false, message: '资产不存在' }, 404)
    
    const recordType = body.recordType || 'transfer'
    let newStatus = body.status || asset.status
    
    if (recordType === 'scrap') newStatus = 'scrapped'
    else if (recordType === 'return') newStatus = 'idle'
    else if (recordType === 'allocate') newStatus = 'in_use'
    
    sqlite.prepare(`
      UPDATE assets SET keeper_id = ?, location = ?, department_name = ?, status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(
      body.toUserId || asset.keeper_id,
      body.toLocation || asset.location,
      body.departmentName || asset.department_name,
      newStatus, id
    )
    
    const record = sqlite.prepare(`
      INSERT INTO asset_records (
        id, asset_id, record_type, from_user_id, to_user_id, from_location, to_location,
        record_date, reason, operator_id, created_at
      ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      RETURNING *
    `).get(
      id, recordType, asset.keeper_id, body.toUserId || asset.keeper_id,
      asset.location, body.toLocation || asset.location,
      body.recordDate || new Date().toISOString().split('T')[0],
      body.reason || '资产流转', user.id
    )
    
    return c.json({ success: true, data: record })
  } catch (error) {
    console.error('Transfer asset error:', error)
    return c.json({ success: false, message: '资产流转失败' }, 500)
  }
})

// 维保记录
assetRoutes.post('/:id/maintenance', async (c) => {
  try {
    const user = getUser(c)
    if (!user || !user.isAdmin) return c.json({ success: false, message: '权限不足' }, 403)
    
    const id = c.req.param('id')
    const body = await c.req.json()
    
    const asset = sqlite.prepare('SELECT * FROM assets WHERE id = ?').get(id)
    if (!asset) return c.json({ success: false, message: '资产不存在' }, 404)
    
    const startDate = body.startDate || new Date().toISOString().split('T')[0]
    const endDate = body.endDate || startDate
    
    // 更新资产维保信息
    sqlite.prepare(`
      UPDATE assets SET status = 'maintenance', maintenance_date = ?, next_maintenance_date = ?, updated_at = datetime('now') WHERE id = ?
    `).run(startDate, endDate, id)
    
    // 记录维保流转记录
    const reason = `[${body.maintenanceType || 'maintenance'}] ${body.reason || ''}` + (body.vendor ? ` 单位:${body.vendor}` : '') + (body.cost ? ` 费用:¥${body.cost}` : '')
    
    const record = sqlite.prepare(`
      INSERT INTO asset_records (
        id, asset_id, record_type, from_location, to_location, record_date, reason, operator_id, created_at
      ) VALUES (lower(hex(randomblob(16))), ?, 'maintenance', ?, ?, ?, ?, ?, datetime('now'))
      RETURNING *
    `).get(id, asset.location, asset.location, endDate, reason, user.id)
    
    return c.json({ success: true, data: record })
  } catch (error) {
    console.error('Maintenance asset error:', error)
    return c.json({ success: false, message: '维保记录保存失败' }, 500)
  }
})

// 删除资产
assetRoutes.delete('/:id', async (c) => {
  try {
    const user = getUser(c)
    if (!user || !user.isAdmin) return c.json({ success: false, message: '权限不足' }, 403)
    
    const id = c.req.param('id')
    sqlite.prepare('DELETE FROM asset_records WHERE asset_id = ?').run(id)
    sqlite.prepare('DELETE FROM assets WHERE id = ?').run(id)
    
    return c.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('Delete asset error:', error)
    return c.json({ success: false, message: '删除资产失败' }, 500)
  }
})

// 资产统计
assetRoutes.get('/stats/overview', async (c) => {
  try {
    const user = getUser(c)
    if (!user) return c.json({ success: false, message: "未登录" }, 401)
    
    const total = sqlite.prepare("SELECT COUNT(*) as c FROM assets").get().c
    const fixed = sqlite.prepare("SELECT COUNT(*) as c FROM assets WHERE asset_type = 'fixed'").get().c
    const intangible = sqlite.prepare("SELECT COUNT(*) as c FROM assets WHERE asset_type = 'intangible'").get().c
    const inUse = sqlite.prepare("SELECT COUNT(*) as c FROM assets WHERE status = 'in_use'").get().c
    const maintenance = sqlite.prepare("SELECT COUNT(*) as c FROM assets WHERE status = 'maintenance'").get().c
    const nearExpiry = sqlite.prepare("SELECT COUNT(*) as c FROM assets WHERE (status IN ('valid','in_use','idle') AND valid_until IS NOT NULL AND valid_until <= date('now', '+30 days')) OR (asset_type = 'fixed' AND next_maintenance_date IS NOT NULL AND next_maintenance_date <= date('now', '+30 days'))").get().c
    
    return c.json({
      success: true,
      data: { total, fixed, intangible, inUse, maintenance, nearExpiry }
    })
  } catch (error) {
    console.error('Asset stats error:', error)
    return c.json({ success: false, message: '获取统计失败' }, 500)
  }
})
