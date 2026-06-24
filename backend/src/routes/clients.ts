// @ts-nocheck
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const sqlite = (db as any).$client

export const clientRoutes = new Hono()

clientRoutes.use('*', authMiddleware)

// 获取客户列表
clientRoutes.get('/', async (c) => {
  const keyword = c.req.query('keyword')
  
  try {
    let sql = 'SELECT * FROM clients WHERE 1=1'
    const params = []
    
    if (keyword) {
      sql += ' AND (short_name LIKE ? OR full_name LIKE ? OR contact_person LIKE ?)'
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
    }
    
    sql += ' ORDER BY short_name'
    
    const stmt = sqlite.prepare(sql)
    const clients = stmt.all(...params)
    
    return c.json({ success: true, data: clients })
  } catch (error: any) {
    console.error('Get clients error:', error)
    return c.json({ success: false, message: '获取客户列表失败' }, 500)
  }
})

// 获取客户详情
clientRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const stmt = sqlite.prepare('SELECT * FROM clients WHERE id = ?')
    const client = stmt.get(id)
    
    if (!client) {
      return c.json({ success: false, message: '客户不存在' }, 404)
    }
    
    return c.json({ success: true, data: client })
  } catch (error: any) {
    console.error('Get client error:', error)
    return c.json({ success: false, message: '获取客户详情失败' }, 500)
  }
})

// 创建客户
clientRoutes.post('/', zValidator('json', z.object({
  shortName: z.string().min(1, '客户简称不能为空'),
  fullName: z.string().min(1, '客户名称不能为空'),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  remarks: z.string().optional()
})), async (c) => {
  const body = c.req.valid('json')
  
  try {
    // 检查简称是否已存在
    const checkStmt = sqlite.prepare('SELECT id FROM clients WHERE short_name = ?')
    const existing = checkStmt.get(body.shortName)
    
    if (existing) {
      return c.json({ success: false, message: '客户简称已存在' }, 400)
    }
    
    const stmt = sqlite.prepare(`
      INSERT INTO clients (id, short_name, full_name, contact_person, contact_phone, contact_email, address, tax_id, bank_name, bank_account, remarks, created_at, updated_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      RETURNING *
    `)
    
    const client = stmt.get(
      body.shortName,
      body.fullName,
      body.contactPerson || null,
      body.contactPhone || null,
      body.contactEmail || null,
      body.address || null,
      body.taxId || null,
      body.bankName || null,
      body.bankAccount || null,
      body.remarks || null
    )
    
    return c.json({ success: true, data: client, message: '客户创建成功' }, 201)
  } catch (error: any) {
    console.error('Create client error:', error)
    return c.json({ success: false, message: '创建客户失败' }, 500)
  }
})

// 更新客户
clientRoutes.put('/:id', zValidator('json', z.object({
  shortName: z.string().min(1).optional(),
  fullName: z.string().min(1).optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  remarks: z.string().optional()
})), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  
  try {
    // 检查客户是否存在
    const checkStmt = sqlite.prepare('SELECT * FROM clients WHERE id = ?')
    const existing = checkStmt.get(id)
    
    if (!existing) {
      return c.json({ success: false, message: '客户不存在' }, 404)
    }
    
    // 检查新简称是否与其他客户冲突
    if (body.shortName && body.shortName !== existing.short_name) {
      const conflictStmt = sqlite.prepare('SELECT id FROM clients WHERE short_name = ? AND id != ?')
      const conflict = conflictStmt.get(body.shortName, id)
      if (conflict) {
        return c.json({ success: false, message: '客户简称已存在' }, 400)
      }
    }
    
    const stmt = sqlite.prepare(`
      UPDATE clients
      SET short_name = COALESCE(?, short_name),
          full_name = COALESCE(?, full_name),
          contact_person = COALESCE(?, contact_person),
          contact_phone = COALESCE(?, contact_phone),
          contact_email = COALESCE(?, contact_email),
          address = COALESCE(?, address),
          tax_id = COALESCE(?, tax_id),
          bank_name = COALESCE(?, bank_name),
          bank_account = COALESCE(?, bank_account),
          remarks = COALESCE(?, remarks),
          updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `)
    
    const client = stmt.get(
      body.shortName || null,
      body.fullName || null,
      body.contactPerson !== undefined ? body.contactPerson : null,
      body.contactPhone !== undefined ? body.contactPhone : null,
      body.contactEmail !== undefined ? body.contactEmail : null,
      body.address !== undefined ? body.address : null,
      body.taxId !== undefined ? body.taxId : null,
      body.bankName !== undefined ? body.bankName : null,
      body.bankAccount !== undefined ? body.bankAccount : null,
      body.remarks !== undefined ? body.remarks : null,
      id
    )
    
    return c.json({ success: true, data: client, message: '客户更新成功' })
  } catch (error: any) {
    console.error('Update client error:', error)
    return c.json({ success: false, message: '更新客户失败' }, 500)
  }
})

// 删除客户
clientRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    // 检查是否有合同引用该客户
    const checkContractsStmt = sqlite.prepare('SELECT COUNT(*) as count FROM project_contracts WHERE client_id = ?')
    const { count } = checkContractsStmt.get(id)
    
    if (count > 0) {
      return c.json({ success: false, message: '该客户下存在合同，无法删除' }, 400)
    }
    
    const stmt = sqlite.prepare('DELETE FROM clients WHERE id = ?')
    stmt.run(id)
    
    return c.json({ success: true, message: '客户删除成功' })
  } catch (error: any) {
    console.error('Delete client error:', error)
    return c.json({ success: false, message: '删除客户失败' }, 500)
  }
})

// 批量导入客户
clientRoutes.post('/import', async (c) => {
  const body = await c.req.json()
  
  if (!Array.isArray(body.clients) || body.clients.length === 0) {
    return c.json({ success: false, message: '导入数据不能为空' }, 400)
  }
  
  const results = { success: 0, failed: 0, errors: [] as string[] }
  
  try {
    const insertStmt = sqlite.prepare(`
      INSERT INTO clients (id, short_name, full_name, contact_person, contact_phone, contact_email, address, tax_id, bank_name, bank_account, remarks, created_at, updated_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `)
    
    for (const client of body.clients) {
      try {
        // 检查必填字段
        if (!client.shortName || !client.fullName) {
          results.failed++
          results.errors.push(`客户简称和名称不能为空: ${client.shortName || '未知'}`)
          continue
        }
        
        // 检查是否已存在
        const checkStmt = sqlite.prepare('SELECT id FROM clients WHERE short_name = ?')
        const existing = checkStmt.get(client.shortName)
        
        if (existing) {
          results.failed++
          results.errors.push(`客户简称已存在: ${client.shortName}`)
          continue
        }
        
        insertStmt.run(
          client.shortName,
          client.fullName,
          client.contactPerson || null,
          client.contactPhone || null,
          client.contactEmail || null,
          client.address || null,
          client.taxId || null,
          client.bankName || null,
          client.bankAccount || null,
          client.remarks || null
        )
        
        results.success++
      } catch (err: any) {
        results.failed++
        results.errors.push(`导入失败: ${client.shortName} - ${err.message}`)
      }
    }
    
    return c.json({
      success: true,
      data: results,
      message: `导入完成：成功 ${results.success} 条，失败 ${results.failed} 条`
    })
  } catch (error: any) {
    console.error('Import clients error:', error)
    return c.json({ success: false, message: '导入客户失败' }, 500)
  }
})
