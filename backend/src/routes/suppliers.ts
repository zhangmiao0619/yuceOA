// @ts-nocheck
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'

const sqlite = (db as any).$client

export const supplierRoutes = new Hono()

supplierRoutes.use('*', authMiddleware)

// 获取供应商列表
supplierRoutes.get('/', async (c) => {
  const keyword = c.req.query('keyword')
  const page = parseInt(c.req.query('page') as string) || 1
  const pageSize = parseInt(c.req.query('pageSize') as string) || 10
  const offset = (page - 1) * pageSize
  
  try {
    let whereClause = 'WHERE 1=1'
    const params: any[] = []
    
    if (keyword) {
      whereClause += ' AND (short_name LIKE ? OR full_name LIKE ? OR contact_person1 LIKE ? OR contact_person2 LIKE ?)'
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
    }
    
    const countStmt = sqlite.prepare(`SELECT COUNT(*) as total FROM suppliers ${whereClause}`)
    const countResult = countStmt.get(...params) as { total: number }
    const total = countResult?.total || 0
    
    const stmt = sqlite.prepare(`SELECT * FROM suppliers ${whereClause} ORDER BY short_name LIMIT ? OFFSET ?`)
    const suppliers = stmt.all(...params, pageSize, offset)
    
    return c.json({ success: true, data: suppliers, total, page, pageSize })
  } catch (error: any) {
    console.error('Get suppliers error:', error)
    return c.json({ success: false, message: '获取供应商列表失败' }, 500)
  }
})

// 获取供应商详情
supplierRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const stmt = sqlite.prepare('SELECT * FROM suppliers WHERE id = ?')
    const supplier = stmt.get(id)
    
    if (!supplier) {
      return c.json({ success: false, message: '供应商不存在' }, 404)
    }
    
    return c.json({ success: true, data: supplier })
  } catch (error: any) {
    console.error('Get supplier error:', error)
    return c.json({ success: false, message: '获取供应商详情失败' }, 500)
  }
})

// 创建供应商
supplierRoutes.post('/', requirePermission('canManageSuppliers'), zValidator('json', z.object({
  shortName: z.string().min(1, '供应商简称不能为空'),
  fullName: z.string().min(1, '供应商名称不能为空'),
  contactPerson1: z.string().optional(),
  contactPerson2: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankCode: z.string().optional(),
  advantages: z.string().optional(),
  remarks: z.string().optional()
})), async (c) => {
  const body = c.req.valid('json')
  
  try {
    const checkStmt = sqlite.prepare('SELECT id FROM suppliers WHERE short_name = ?')
    const existing = checkStmt.get(body.shortName)
    
    if (existing) {
      return c.json({ success: false, message: '供应商简称已存在' }, 400)
    }
    
    const stmt = sqlite.prepare(`
      INSERT INTO suppliers (id, short_name, full_name, contact_person1, contact_person2, tax_id, address, phone, bank_name, bank_account, bank_code, advantages, remarks, created_at, updated_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      RETURNING *
    `)
    
    const supplier = stmt.get(
      body.shortName,
      body.fullName,
      body.contactPerson1 || null,
      body.contactPerson2 || null,
      body.taxId || null,
      body.address || null,
      body.phone || null,
      body.bankName || null,
      body.bankAccount || null,
      body.bankCode || null,
      body.advantages || null,
      body.remarks || null
    )
    
    return c.json({ success: true, data: supplier, message: '供应商创建成功' }, 201)
  } catch (error: any) {
    console.error('Create supplier error:', error)
    return c.json({ success: false, message: '创建供应商失败' }, 500)
  }
})

// 更新供应商
supplierRoutes.put('/:id', requirePermission('canManageSuppliers'), zValidator('json', z.object({
  shortName: z.string().min(1).optional(),
  fullName: z.string().min(1).optional(),
  contactPerson1: z.string().optional(),
  contactPerson2: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankCode: z.string().optional(),
  advantages: z.string().optional(),
  remarks: z.string().optional()
})), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  
  try {
    const checkStmt = sqlite.prepare('SELECT * FROM suppliers WHERE id = ?')
    const existing = checkStmt.get(id)
    
    if (!existing) {
      return c.json({ success: false, message: '供应商不存在' }, 404)
    }
    
    if (body.shortName && body.shortName !== existing.short_name) {
      const conflictStmt = sqlite.prepare('SELECT id FROM suppliers WHERE short_name = ? AND id != ?')
      const conflict = conflictStmt.get(body.shortName, id)
      if (conflict) {
        return c.json({ success: false, message: '供应商简称已存在' }, 400)
      }
    }
    
    const stmt = sqlite.prepare(`
      UPDATE suppliers
      SET short_name = COALESCE(?, short_name),
          full_name = COALESCE(?, full_name),
          contact_person1 = COALESCE(?, contact_person1),
          contact_person2 = COALESCE(?, contact_person2),
          tax_id = COALESCE(?, tax_id),
          address = COALESCE(?, address),
          phone = COALESCE(?, phone),
          bank_name = COALESCE(?, bank_name),
          bank_account = COALESCE(?, bank_account),
          bank_code = COALESCE(?, bank_code),
          advantages = COALESCE(?, advantages),
          remarks = COALESCE(?, remarks),
          updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `)
    
    const supplier = stmt.get(
      body.shortName || null,
      body.fullName || null,
      body.contactPerson1 !== undefined ? body.contactPerson1 : null,
      body.contactPerson2 !== undefined ? body.contactPerson2 : null,
      body.taxId !== undefined ? body.taxId : null,
      body.address !== undefined ? body.address : null,
      body.phone !== undefined ? body.phone : null,
      body.bankName !== undefined ? body.bankName : null,
      body.bankAccount !== undefined ? body.bankAccount : null,
      body.bankCode !== undefined ? body.bankCode : null,
      body.advantages !== undefined ? body.advantages : null,
      body.remarks !== undefined ? body.remarks : null,
      id
    )
    
    return c.json({ success: true, data: supplier, message: '供应商更新成功' })
  } catch (error: any) {
    console.error('Update supplier error:', error)
    return c.json({ success: false, message: '更新供应商失败' }, 500)
  }
})

// 删除供应商
supplierRoutes.delete('/:id', requirePermission('canManageSuppliers'), async (c) => {
  const id = c.req.param('id')
  
  try {
    const checkContractsStmt = sqlite.prepare('SELECT COUNT(*) as count FROM project_contracts WHERE supplier_id = ?')
    const { count: contractCount } = checkContractsStmt.get(id)
    
    const checkOutsourcingStmt = sqlite.prepare('SELECT COUNT(*) as count FROM outsourcing WHERE supplier_id = ?')
    const { count: outsourcingCount } = checkOutsourcingStmt.get(id)
    
    if (contractCount > 0 || outsourcingCount > 0) {
      return c.json({ success: false, message: '该供应商下存在合同或委外信息，无法删除' }, 400)
    }
    
    const stmt = sqlite.prepare('DELETE FROM suppliers WHERE id = ?')
    stmt.run(id)
    
    return c.json({ success: true, message: '供应商删除成功' })
  } catch (error: any) {
    console.error('Delete supplier error:', error)
    return c.json({ success: false, message: '删除供应商失败' }, 500)
  }
})

// 批量导入供应商
supplierRoutes.post('/import', requirePermission('canManageSuppliers'), async (c) => {
  const body = await c.req.json()
  
  if (!Array.isArray(body.suppliers) || body.suppliers.length === 0) {
    return c.json({ success: false, message: '导入数据不能为空' }, 400)
  }
  
  const results = { success: 0, failed: 0, errors: [] as string[] }
  
  try {
    const insertStmt = sqlite.prepare(`
      INSERT INTO suppliers (id, short_name, full_name, contact_person1, contact_person2, tax_id, address, phone, bank_name, bank_account, bank_code, advantages, remarks, created_at, updated_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `)
    
    for (const supplier of body.suppliers) {
      try {
        if (!supplier.shortName || !supplier.fullName) {
          results.failed++
          results.errors.push(`供应商简称和名称不能为空: ${supplier.shortName || '未知'}`)
          continue
        }
        
        const checkStmt = sqlite.prepare('SELECT id FROM suppliers WHERE short_name = ?')
        const existing = checkStmt.get(supplier.shortName)
        
        if (existing) {
          results.failed++
          results.errors.push(`供应商简称已存在: ${supplier.shortName}`)
          continue
        }
        
        insertStmt.run(
          supplier.shortName,
          supplier.fullName,
          supplier.contactPerson1 || null,
          supplier.contactPerson2 || null,
          supplier.taxId || null,
          supplier.address || null,
          supplier.phone || null,
          supplier.bankName || null,
          supplier.bankAccount || null,
          supplier.bankCode || null,
          supplier.advantages || null,
          supplier.remarks || null
        )
        
        results.success++
      } catch (err: any) {
        results.failed++
        results.errors.push(`导入失败: ${supplier.shortName} - ${err.message}`)
      }
    }
    
    return c.json({
      success: true,
      data: results,
      message: `导入完成：成功 ${results.success} 条，失败 ${results.failed} 条`
    })
  } catch (error: any) {
    console.error('Import suppliers error:', error)
    return c.json({ success: false, message: '导入供应商失败' }, 500)
  }
})
