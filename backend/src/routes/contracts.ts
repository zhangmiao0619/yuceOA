// @ts-nocheck
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const sqlite = (db as any).$client

export const contractRoutes = new Hono()

contractRoutes.use('*', authMiddleware)

// 获取合同列表
contractRoutes.get('/', async (c) => {
  const keyword = c.req.query('keyword')
  const clientId = c.req.query('clientId')
  const projectType = c.req.query('projectType')
  const page = parseInt(c.req.query('page') as string) || 1
  const pageSize = parseInt(c.req.query('pageSize') as string) || 10
  const offset = (page - 1) * pageSize
  
  try {
    let whereClause = 'WHERE 1=1'
    const params: any[] = []
    
    if (keyword) {
      whereClause += ' AND (pc.project_name LIKE ? OR pc.contract_no LIKE ? OR s.short_name LIKE ?)'
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
    }
    
    if (clientId) {
      whereClause += ' AND pc.supplier_id = ?'
      params.push(clientId)
    }
    
    if (projectType) {
      whereClause += ' AND pc.project_type = ?'
      params.push(projectType)
    }
    
    const countStmt = sqlite.prepare(`SELECT COUNT(*) as total FROM project_contracts pc LEFT JOIN suppliers s ON pc.supplier_id = s.id ${whereClause}`)
    const countResult = countStmt.get(...params) as { total: number }
    const total = countResult?.total || 0
    
    const stmt = sqlite.prepare(`
      SELECT pc.*, s.short_name as supplier_short_name, s.full_name as supplier_full_name
      FROM project_contracts pc
      LEFT JOIN suppliers s ON pc.supplier_id = s.id
      ${whereClause}
      ORDER BY pc.created_at DESC
      LIMIT ? OFFSET ?
    `)
    const contracts = stmt.all(...params, pageSize, offset)
    
    return c.json({ success: true, data: contracts, total, page, pageSize })
  } catch (error: any) {
    console.error('Get contracts error:', error)
    return c.json({ success: false, message: '获取合同列表失败' }, 500)
  }
})

// 获取合同详情
contractRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const stmt = sqlite.prepare(`
      SELECT pc.*, s.short_name as supplier_short_name, s.full_name as supplier_full_name
      FROM project_contracts pc
      LEFT JOIN suppliers s ON pc.supplier_id = s.id
      WHERE pc.id = ?
    `)
    const contract = stmt.get(id)
    
    if (!contract) {
      return c.json({ success: false, message: '合同不存在' }, 404)
    }
    
    return c.json({ success: true, data: contract })
  } catch (error: any) {
    console.error('Get contract error:', error)
    return c.json({ success: false, message: '获取合同详情失败' }, 500)
  }
})

// 创建合同
contractRoutes.post('/', zValidator('json', z.object({
  projectName: z.string().min(1, '项目名称不能为空'),
  contractDate: z.string().optional(),
  contractNo: z.string().optional(),
  supplierId: z.string().min(1, '供应商不能为空'),
  unitPrice: z.number().optional(),
  workload: z.number().optional(),
  contractAmount: z.number().optional(),
  paymentMethod: z.string().optional(),
  invoiceType: z.enum(['普票', '专票']).optional(),
  taxRate: z.number().optional(),
  actualWorkload: z.number().optional(),
  totalInvoicedAmount: z.number().optional(),
  salesperson: z.string().optional(),
  projectType: z.string().optional(),
  grossProfit: z.number().optional(),
  remarks: z.string().optional()
})), async (c) => {
  const body = c.req.valid('json')
  
  try {
    // 获取供应商信息
    const supplierStmt = sqlite.prepare('SELECT short_name, full_name FROM suppliers WHERE id = ?')
    const supplier = supplierStmt.get(body.supplierId)
    
    if (!supplier) {
      return c.json({ success: false, message: '供应商不存在' }, 400)
    }
    
    const stmt = sqlite.prepare(`
      INSERT INTO project_contracts (
        id, project_name, contract_date, contract_no, supplier_id, supplier_short_name, supplier_full_name,
        unit_price, workload, contract_amount, payment_method, invoice_type, tax_rate,
        actual_workload, total_invoiced_amount, salesperson, project_type, gross_profit, remarks,
        created_at, updated_at
      ) VALUES (
        lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        datetime('now'), datetime('now')
      )
      RETURNING *
    `)
    
    const contract = stmt.get(
      body.projectName,
      body.contractDate || null,
      body.contractNo || null,
      body.supplierId,
      supplier.short_name,
      supplier.full_name,
      body.unitPrice || null,
      body.workload || null,
      body.contractAmount || null,
      body.paymentMethod || null,
      body.invoiceType || null,
      body.taxRate || null,
      body.actualWorkload || null,
      body.totalInvoicedAmount || null,
      body.salesperson || null,
      body.projectType || null,
      body.grossProfit || null,
      body.remarks || null
    )
    
    return c.json({ success: true, data: contract, message: '合同创建成功' }, 201)
  } catch (error: any) {
    console.error('Create contract error:', error)
    return c.json({ success: false, message: '创建合同失败' }, 500)
  }
})

// 更新合同
contractRoutes.put('/:id', zValidator('json', z.object({
  projectName: z.string().min(1).optional(),
  contractDate: z.string().optional(),
  contractNo: z.string().optional(),
  supplierId: z.string().optional(),
  unitPrice: z.number().optional(),
  workload: z.number().optional(),
  contractAmount: z.number().optional(),
  paymentMethod: z.string().optional(),
  invoiceType: z.enum(['普票', '专票']).optional(),
  taxRate: z.number().optional(),
  actualWorkload: z.number().optional(),
  totalInvoicedAmount: z.number().optional(),
  salesperson: z.string().optional(),
  projectType: z.string().optional(),
  grossProfit: z.number().optional(),
  remarks: z.string().optional()
})), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  
  try {
    // 检查合同是否存在
    const checkStmt = sqlite.prepare('SELECT * FROM project_contracts WHERE id = ?')
    const existing = checkStmt.get(id)
    
    if (!existing) {
      return c.json({ success: false, message: '合同不存在' }, 404)
    }
    
    // 如果更新了供应商，获取新供应商信息
    let supplierShortName = existing.supplier_short_name
    let supplierFullName = existing.supplier_full_name
    
    if (body.supplierId) {
      const supplierStmt = sqlite.prepare('SELECT short_name, full_name FROM suppliers WHERE id = ?')
      const supplier = supplierStmt.get(body.supplierId)
      if (supplier) {
        supplierShortName = supplier.short_name
        supplierFullName = supplier.full_name
      }
    }
    
    const stmt = sqlite.prepare(`
      UPDATE project_contracts
      SET project_name = COALESCE(?, project_name),
          contract_date = COALESCE(?, contract_date),
          contract_no = COALESCE(?, contract_no),
          supplier_id = COALESCE(?, supplier_id),
          supplier_short_name = COALESCE(?, supplier_short_name),
          supplier_full_name = COALESCE(?, supplier_full_name),
          unit_price = COALESCE(?, unit_price),
          workload = COALESCE(?, workload),
          contract_amount = COALESCE(?, contract_amount),
          payment_method = COALESCE(?, payment_method),
          invoice_type = COALESCE(?, invoice_type),
          tax_rate = COALESCE(?, tax_rate),
          actual_workload = COALESCE(?, actual_workload),
          total_invoiced_amount = COALESCE(?, total_invoiced_amount),
          salesperson = COALESCE(?, salesperson),
          project_type = COALESCE(?, project_type),
          gross_profit = COALESCE(?, gross_profit),
          remarks = COALESCE(?, remarks),
          updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `)
    
    const contract = stmt.get(
      body.projectName || null,
      body.contractDate !== undefined ? body.contractDate : null,
      body.contractNo !== undefined ? body.contractNo : null,
      body.supplierId || null,
      supplierShortName,
      supplierFullName,
      body.unitPrice !== undefined ? body.unitPrice : null,
      body.workload !== undefined ? body.workload : null,
      body.contractAmount !== undefined ? body.contractAmount : null,
      body.paymentMethod !== undefined ? body.paymentMethod : null,
      body.invoiceType !== undefined ? body.invoiceType : null,
      body.taxRate !== undefined ? body.taxRate : null,
      body.actualWorkload !== undefined ? body.actualWorkload : null,
      body.totalInvoicedAmount !== undefined ? body.totalInvoicedAmount : null,
      body.salesperson !== undefined ? body.salesperson : null,
      body.projectType !== undefined ? body.projectType : null,
      body.grossProfit !== undefined ? body.grossProfit : null,
      body.remarks !== undefined ? body.remarks : null,
      id
    )
    
    return c.json({ success: true, data: contract, message: '合同更新成功' })
  } catch (error: any) {
    console.error('Update contract error:', error)
    return c.json({ success: false, message: '更新合同失败' }, 500)
  }
})

// 删除合同
contractRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const stmt = sqlite.prepare('DELETE FROM project_contracts WHERE id = ?')
    stmt.run(id)
    
    return c.json({ success: true, message: '合同删除成功' })
  } catch (error: any) {
    console.error('Delete contract error:', error)
    return c.json({ success: false, message: '删除合同失败' }, 500)
  }
})

// 获取统计信息
contractRoutes.get('/stats/overview', async (c) => {
  try {
    const totalStmt = sqlite.prepare('SELECT COUNT(*) as count, COALESCE(SUM(contract_amount), 0) as total_amount FROM project_contracts')
    const total = totalStmt.get()
    
    const supplierStmt = sqlite.prepare('SELECT COUNT(*) as count FROM suppliers')
    const supplierCount = supplierStmt.get()
    
    return c.json({
      success: true,
      data: {
        totalContracts: total.count || 0,
        totalAmount: total.total_amount || 0,
        totalSuppliers: supplierCount.count || 0
      }
    })
  } catch (error: any) {
    console.error('Get contract stats error:', error)
    return c.json({ success: false, message: '获取统计信息失败' }, 500)
  }
})
