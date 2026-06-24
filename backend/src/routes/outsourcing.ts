// @ts-nocheck
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const sqlite = (db as any).$client

export const outsourcingRoutes = new Hono()

outsourcingRoutes.use('*', authMiddleware)

// 获取委外信息列表
outsourcingRoutes.get('/', async (c) => {
  const keyword = c.req.query('keyword')
  const supplierId = c.req.query('supplierId')
  const page = parseInt(c.req.query('page') as string) || 1
  const pageSize = parseInt(c.req.query('pageSize') as string) || 10
  const offset = (page - 1) * pageSize
  
  try {
    let whereClause = 'WHERE 1=1'
    const params: any[] = []
    
    if (keyword) {
      whereClause += ' AND (o.project_name LIKE ? OR o.contract_name LIKE ? OR o.contract_no LIKE ?)'
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
    }
    
    if (supplierId) {
      whereClause += ' AND o.supplier_id = ?'
      params.push(supplierId)
    }
    
    const countStmt = sqlite.prepare(`SELECT COUNT(*) as total FROM outsourcing o ${whereClause}`)
    const countResult = countStmt.get(...params) as { total: number }
    const total = countResult?.total || 0
    
    const stmt = sqlite.prepare(`
      SELECT o.*, s.short_name as supplier_short_name
      FROM outsourcing o
      LEFT JOIN suppliers s ON o.supplier_id = s.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `)
    const records = stmt.all(...params, pageSize, offset)
    
    return c.json({ success: true, data: records, total, page, pageSize })
  } catch (error: any) {
    console.error('Get outsourcing error:', error)
    return c.json({ success: false, message: '获取委外信息列表失败' }, 500)
  }
})

// 获取委外信息详情
outsourcingRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const stmt = sqlite.prepare(`
      SELECT o.*, s.short_name as supplier_short_name
      FROM outsourcing o
      LEFT JOIN suppliers s ON o.supplier_id = s.id
      WHERE o.id = ?
    `)
    const record = stmt.get(id)
    
    if (!record) {
      return c.json({ success: false, message: '委外信息不存在' }, 404)
    }
    
    return c.json({ success: true, data: record })
  } catch (error: any) {
    console.error('Get outsourcing detail error:', error)
    return c.json({ success: false, message: '获取委外信息详情失败' }, 500)
  }
})

// 创建委外信息
outsourcingRoutes.post('/', zValidator('json', z.object({
  projectName: z.string().min(1, '项目名称不能为空'),
  contractName: z.string().optional(),
  isRepeated: z.number().optional(),
  signDate: z.string().optional(),
  supplierId: z.string().min(1, '供应商不能为空'),
  taskDescription: z.string().optional(),
  unitPrice: z.number().optional(),
  workload: z.number().optional(),
  contractAmount: z.number().optional(),
  confirmedWorkload: z.number().optional(),
  confirmedAmount: z.number().optional(),
  invoiceType: z.enum(['普票', '专票']).optional(),
  taxRate: z.number().optional(),
  totalInvoicedAmount: z.number().optional(),
  totalPaidAmount: z.number().optional(),
  paymentRatio: z.number().optional(),
  unpaidInvoiceAmount: z.number().optional(),
  accountsPayable: z.number().optional(),
  remarks: z.string().optional(),
  paymentTerms: z.string().optional(),
  contractNo: z.string().optional()
})), async (c) => {
  const body = c.req.valid('json')
  
  try {
    const supplierStmt = sqlite.prepare('SELECT short_name, full_name FROM suppliers WHERE id = ?')
    const supplier = supplierStmt.get(body.supplierId)
    
    if (!supplier) {
      return c.json({ success: false, message: '供应商不存在' }, 400)
    }
    
    const stmt = sqlite.prepare(`
      INSERT INTO outsourcing (
        id, project_name, contract_name, is_repeated, sign_date, supplier_id, supplier_name,
        task_description, unit_price, workload, contract_amount, confirmed_workload, confirmed_amount,
        invoice_type, tax_rate, total_invoiced_amount, total_paid_amount, payment_ratio,
        unpaid_invoice_amount, accounts_payable, remarks, payment_terms, contract_no,
        created_at, updated_at
      ) VALUES (
        lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        datetime('now'), datetime('now')
      )
      RETURNING *
    `)
    
    const record = stmt.get(
      body.projectName,
      body.contractName || null,
      body.isRepeated || 0,
      body.signDate || null,
      body.supplierId,
      supplier.full_name,
      body.taskDescription || null,
      body.unitPrice || null,
      body.workload || null,
      body.contractAmount || null,
      body.confirmedWorkload || null,
      body.confirmedAmount || null,
      body.invoiceType || null,
      body.taxRate || null,
      body.totalInvoicedAmount || null,
      body.totalPaidAmount || null,
      body.paymentRatio || null,
      body.unpaidInvoiceAmount || null,
      body.accountsPayable || null,
      body.remarks || null,
      body.paymentTerms || null,
      body.contractNo || null
    )
    
    return c.json({ success: true, data: record, message: '委外信息创建成功' }, 201)
  } catch (error: any) {
    console.error('Create outsourcing error:', error)
    return c.json({ success: false, message: '创建委外信息失败' }, 500)
  }
})

// 更新委外信息
outsourcingRoutes.put('/:id', zValidator('json', z.object({
  projectName: z.string().min(1).optional(),
  contractName: z.string().optional(),
  isRepeated: z.number().optional(),
  signDate: z.string().optional(),
  supplierId: z.string().optional(),
  taskDescription: z.string().optional(),
  unitPrice: z.number().optional(),
  workload: z.number().optional(),
  contractAmount: z.number().optional(),
  confirmedWorkload: z.number().optional(),
  confirmedAmount: z.number().optional(),
  invoiceType: z.enum(['普票', '专票']).optional(),
  taxRate: z.number().optional(),
  totalInvoicedAmount: z.number().optional(),
  totalPaidAmount: z.number().optional(),
  paymentRatio: z.number().optional(),
  unpaidInvoiceAmount: z.number().optional(),
  accountsPayable: z.number().optional(),
  remarks: z.string().optional(),
  paymentTerms: z.string().optional(),
  contractNo: z.string().optional()
})), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  
  try {
    const checkStmt = sqlite.prepare('SELECT * FROM outsourcing WHERE id = ?')
    const existing = checkStmt.get(id)
    
    if (!existing) {
      return c.json({ success: false, message: '委外信息不存在' }, 404)
    }
    
    let supplierName = existing.supplier_name
    
    if (body.supplierId) {
      const supplierStmt = sqlite.prepare('SELECT full_name FROM suppliers WHERE id = ?')
      const supplier = supplierStmt.get(body.supplierId)
      if (supplier) {
        supplierName = supplier.full_name
      }
    }
    
    const stmt = sqlite.prepare(`
      UPDATE outsourcing
      SET project_name = COALESCE(?, project_name),
          contract_name = COALESCE(?, contract_name),
          is_repeated = COALESCE(?, is_repeated),
          sign_date = COALESCE(?, sign_date),
          supplier_id = COALESCE(?, supplier_id),
          supplier_name = COALESCE(?, supplier_name),
          task_description = COALESCE(?, task_description),
          unit_price = COALESCE(?, unit_price),
          workload = COALESCE(?, workload),
          contract_amount = COALESCE(?, contract_amount),
          confirmed_workload = COALESCE(?, confirmed_workload),
          confirmed_amount = COALESCE(?, confirmed_amount),
          invoice_type = COALESCE(?, invoice_type),
          tax_rate = COALESCE(?, tax_rate),
          total_invoiced_amount = COALESCE(?, total_invoiced_amount),
          total_paid_amount = COALESCE(?, total_paid_amount),
          payment_ratio = COALESCE(?, payment_ratio),
          unpaid_invoice_amount = COALESCE(?, unpaid_invoice_amount),
          accounts_payable = COALESCE(?, accounts_payable),
          remarks = COALESCE(?, remarks),
          payment_terms = COALESCE(?, payment_terms),
          contract_no = COALESCE(?, contract_no),
          updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `)
    
    const record = stmt.get(
      body.projectName || null,
      body.contractName !== undefined ? body.contractName : null,
      body.isRepeated !== undefined ? body.isRepeated : null,
      body.signDate !== undefined ? body.signDate : null,
      body.supplierId || null,
      supplierName,
      body.taskDescription !== undefined ? body.taskDescription : null,
      body.unitPrice !== undefined ? body.unitPrice : null,
      body.workload !== undefined ? body.workload : null,
      body.contractAmount !== undefined ? body.contractAmount : null,
      body.confirmedWorkload !== undefined ? body.confirmedWorkload : null,
      body.confirmedAmount !== undefined ? body.confirmedAmount : null,
      body.invoiceType !== undefined ? body.invoiceType : null,
      body.taxRate !== undefined ? body.taxRate : null,
      body.totalInvoicedAmount !== undefined ? body.totalInvoicedAmount : null,
      body.totalPaidAmount !== undefined ? body.totalPaidAmount : null,
      body.paymentRatio !== undefined ? body.paymentRatio : null,
      body.unpaidInvoiceAmount !== undefined ? body.unpaidInvoiceAmount : null,
      body.accountsPayable !== undefined ? body.accountsPayable : null,
      body.remarks !== undefined ? body.remarks : null,
      body.paymentTerms !== undefined ? body.paymentTerms : null,
      body.contractNo !== undefined ? body.contractNo : null,
      id
    )
    
    return c.json({ success: true, data: record, message: '委外信息更新成功' })
  } catch (error: any) {
    console.error('Update outsourcing error:', error)
    return c.json({ success: false, message: '更新委外信息失败' }, 500)
  }
})

// 删除委外信息
outsourcingRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const stmt = sqlite.prepare('DELETE FROM outsourcing WHERE id = ?')
    stmt.run(id)
    
    return c.json({ success: true, message: '委外信息删除成功' })
  } catch (error: any) {
    console.error('Delete outsourcing error:', error)
    return c.json({ success: false, message: '删除委外信息失败' }, 500)
  }
})

// 获取统计信息
outsourcingRoutes.get('/stats/overview', async (c) => {
  try {
    const totalStmt = sqlite.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(contract_amount), 0) as total_contract_amount,
        COALESCE(SUM(confirmed_amount), 0) as total_confirmed_amount,
        COALESCE(SUM(total_paid_amount), 0) as total_paid_amount,
        COALESCE(SUM(accounts_payable), 0) as total_payable
      FROM outsourcing
    `)
    const stats = totalStmt.get()
    
    return c.json({
      success: true,
      data: {
        totalRecords: stats.count || 0,
        totalContractAmount: stats.total_contract_amount || 0,
        totalConfirmedAmount: stats.total_confirmed_amount || 0,
        totalPaidAmount: stats.total_paid_amount || 0,
        totalPayable: stats.total_payable || 0
      }
    })
  } catch (error: any) {
    console.error('Get outsourcing stats error:', error)
    return c.json({ success: false, message: '获取统计信息失败' }, 500)
  }
})
