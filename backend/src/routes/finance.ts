// @ts-nocheck
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'

const sqlite = (db as any).$client

export const financeRoutes = new Hono()

financeRoutes.use('*', authMiddleware)

// 费用类别和明细数据（基于Excel文件）
const EXPENSE_CATEGORIES = [
  {
    category: '差旅费',
    details: [
      { name: '交通费', description: '公交、地铁、火车、飞机、汽车、打车、燃油费、停车费、过路费、租车', remark: '注明交通工具' },
      { name: '燃油费', description: '', remark: '注明车牌号，加油时里程数' },
      { name: '过路费', description: '', remark: '' },
      { name: '住宿费', description: '', remark: '要注明住宿起止日期' },
      { name: '差旅津贴', description: '50元/人/天', remark: '按实际工作日天数计，误餐费' },
      { name: '交通补助', description: '30元/人/天', remark: '司机，按实际工作日天数计' }
    ]
  },
  {
    category: '营业成本',
    details: [
      { name: '维修费', description: '车辆、设备、仪器', remark: '' },
      { name: '零散物资', description: '油漆、钉子、刷子、低值易耗品等', remark: '2000元以下的东西' },
      { name: 'Cros账号', description: '', remark: '' },
      { name: '租赁费', description: '仪器、设备', remark: '' },
      { name: '快递费', description: '', remark: '' },
      { name: '通讯费', description: '项目用电话、宽带', remark: '' },
      { name: '招待费', description: '招待客户', remark: '' },
      { name: '福利费', description: '项目上聚餐、培训、学习', remark: '' },
      { name: '打印费', description: '打印报告、图纸、装订成册', remark: '' },
      { name: '劳务费', description: '项目外包', remark: '' },
      { name: '固定资产', description: '车辆、设备、仪器', remark: '高价值' }
    ]
  },
  {
    category: '管理费用',
    details: [
      { name: '通讯费', description: '电话费、宽带', remark: '办公室用的' },
      { name: '咨询费', description: '代办服务费', remark: '' },
      { name: '办公费', description: '文具、家具家电、办公室维修和维护、快递费、劳保用品', remark: '' },
      { name: '福利费', description: '员工聚餐、团建、逢年过节礼品', remark: '' },
      { name: '水电费', description: '办公室用', remark: '' },
      { name: '房屋租赁费', description: '办公室用', remark: '' },
      { name: '物业费', description: '办公室用', remark: '' }
    ]
  },
  {
    category: '销售费用',
    details: [
      { name: '投标费', description: '标书制作、纸张、购买标书、办理CA、签章', remark: '' },
      { name: '宣传费', description: '网站、画册、宣传页、易拉宝', remark: '' },
      { name: '车辆费用', description: '保险、维修', remark: '鄂W5977T' },
      { name: '交通费', description: '公交、地铁、火车、飞机、汽车、打车、燃油费、停车费、过路费、租车', remark: '赵总和销售人员' },
      { name: '燃油费', description: '', remark: '' },
      { name: '招待费', description: '招待客户', remark: '赵总和销售人员' },
      { name: '住宿费', description: '', remark: '赵总和销售人员' }
    ]
  },
  {
    category: '财务费用',
    details: [
      { name: '贷款利息', description: '银行、其他机构融资利息、手续费', remark: '' },
      { name: '银行费用', description: '汇款手续费、工本费、手续费', remark: '' },
      { name: '财务咨询费', description: '审计报告、代账、财务咨询', remark: '' }
    ]
  },
  {
    category: '研发费用',
    details: [
      { name: '教育培训', description: '培训、学习', remark: '' },
      { name: '固定资产', description: '车辆、设备、仪器、物资', remark: '' }
    ]
  }
]

// 获取费用类别列表
financeRoutes.get('/expense-categories', async (c) => {
  return c.json({
    success: true,
    data: EXPENSE_CATEGORIES.map(cat => ({
      category: cat.category,
      details: cat.details
    }))
  })
})

// 获取报销列表
financeRoutes.get('/reimbursements', async (c) => {
  try {
    const user = c.get('user')
    const keyword = c.req.query('keyword')
    const status = c.req.query('status')
    const month = c.req.query('month')
    const page = parseInt(c.req.query('page') as string) || 1
    const pageSize = parseInt(c.req.query('pageSize') as string) || 10
    const offset = (page - 1) * pageSize
    
    let sql = `
      SELECT er.*, u.name as applicant_name
      FROM expense_reimbursements er
      LEFT JOIN users u ON er.applicant_id = u.id
      WHERE 1=1
    `
    const params: any[] = []
    
    // 非管理员只能看自己的
    if (!user.isAdmin) {
      sql += ' AND er.applicant_id = ?'
      params.push(user.id)
    }
    
    if (keyword) {
      sql += ' AND (er.project_name LIKE ? OR er.remarks LIKE ?)'
      params.push(`%${keyword}%`, `%${keyword}%`)
    }
    
    if (status) {
      sql += ' AND er.status = ?'
      params.push(status)
    }
    
    if (month) {
      sql += ' AND er.reimbursement_month = ?'
      params.push(month)
    }
    
    // 获取总数
    const countSql = sql.replace('SELECT er.*, u.name as applicant_name', 'SELECT COUNT(*) as total')
    const countStmt = sqlite.prepare(countSql)
    const countResult = countStmt.get(...params) as { total: number }
    const total = countResult?.total || 0
    
    sql += ' ORDER BY er.created_at DESC LIMIT ? OFFSET ?'
    params.push(pageSize, offset)
    
    const stmt = sqlite.prepare(sql)
    const reimbursements = stmt.all(...params)
    
    // 获取每个报销单的明细
    for (const reimbursement of reimbursements) {
      const itemStmt = sqlite.prepare(
        'SELECT * FROM expense_items WHERE reimbursement_id = ?'
      )
      reimbursement.items = itemStmt.all(reimbursement.id)
    }
    
    return c.json({ success: true, data: reimbursements, total, page, pageSize })
  } catch (error) {
    console.error('Get reimbursements error:', error)
    return c.json({ success: false, message: '获取报销列表失败' }, 500)
  }
})

// 获取报销详情
financeRoutes.get('/reimbursements/:id', async (c) => {
  try {
    const id = c.req.param('id')
    
    const stmt = sqlite.prepare(`
      SELECT er.*, u.name as applicant_name
      FROM expense_reimbursements er
      LEFT JOIN users u ON er.applicant_id = u.id
      WHERE er.id = ?
    `)
    const reimbursement = stmt.get(id)
    
    if (!reimbursement) {
      return c.json({ success: false, message: '报销单不存在' }, 404)
    }
    
    const itemStmt = sqlite.prepare(
      'SELECT * FROM expense_items WHERE reimbursement_id = ?'
    )
    reimbursement.items = itemStmt.all(id)
    
    return c.json({ success: true, data: reimbursement })
  } catch (error) {
    console.error('Get reimbursement error:', error)
    return c.json({ success: false, message: '获取报销详情失败' }, 500)
  }
})

// 创建报销申请
financeRoutes.post('/reimbursements', zValidator('json', z.object({
  reimbursementDate: z.string(),
  reimbursementMonth: z.string(),
  projectName: z.string().optional(),
  items: z.array(z.object({
    expenseCategory: z.string(),
    expenseDetail: z.string(),
    description: z.string().optional(),
    amount: z.number().min(0),
    invoiceCode: z.string().optional(),
    remarks: z.string().optional()
  })).min(1, '至少需要一个报销明细'),
  remarks: z.string().optional()
})), async (c) => {
  try {
    const user = c.get('user')
    const data = c.req.valid('json')
    
    // 校验报销日期不能是未来日期
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const reimbursementDate = new Date(data.reimbursementDate)
    if (reimbursementDate > today) {
      return c.json({ success: false, message: '报销日期不能为未来日期' }, 400)
    }
    
    // 校验金额精度和上限
    for (const item of data.items) {
      // 校验两位小数
      const amountStr = item.amount.toString()
      if (amountStr.includes('.') && amountStr.split('.')[1].length > 2) {
        return c.json({ success: false, message: '金额最多只能有两位小数' }, 400)
      }
      // 校验单条金额上限
      if (item.amount > 1000000) {
        return c.json({ success: false, message: '单条明细金额不能超过100万元' }, 400)
      }
    }
    
    // 计算总金额（确保两位小数精度）
    const totalAmount = Math.round(
      data.items.reduce((sum, item) => sum + item.amount, 0) * 100
    ) / 100
    
    // 校验总金额上限
    if (totalAmount > 10000000) {
      return c.json({ success: false, message: '报销总金额不能超过1000万元' }, 400)
    }
    
    // 生成报销单ID
    const id = crypto.randomUUID()
    
    // 插入报销主表
    const insertStmt = sqlite.prepare(`
      INSERT INTO expense_reimbursements (
        id, applicant_id, applicant_name, reimbursement_date, reimbursement_month,
        project_name, total_amount, invoice_count, status, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    insertStmt.run(
      id,
      user.id,
      user.name || user.username,
      data.reimbursementDate,
      data.reimbursementMonth,
      data.projectName || null,
      totalAmount,
      data.items.length,
      'pending',
      data.remarks || null
    )
    
    // 插入报销明细
    const itemStmt = sqlite.prepare(`
      INSERT INTO expense_items (
        id, reimbursement_id, expense_category, expense_detail,
        description, amount, invoice_code, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    for (const item of data.items) {
      itemStmt.run(
        crypto.randomUUID(),
        id,
        item.expenseCategory,
        item.expenseDetail,
        item.description || null,
        item.amount,
        item.invoiceCode || null,
        item.remarks || null
      )
    }
    
    return c.json({
      success: true,
      message: '报销申请创建成功',
      data: { id, totalAmount }
    })
  } catch (error) {
    console.error('Create reimbursement error:', error)
    return c.json({ success: false, message: '创建报销申请失败' }, 500)
  }
})

// 更新报销状态（审批）
financeRoutes.put('/reimbursements/:id/status', requirePermission('finance:approve'), zValidator('json', z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  remark: z.string().optional()
})), async (c) => {
  try {
    const id = c.req.param('id')
    const { status, remark } = c.req.valid('json')
    
    const stmt = sqlite.prepare(`
      UPDATE expense_reimbursements
      SET status = ?, remarks = COALESCE(remarks || '; ' || ?, ?), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    
    stmt.run(status, remark || '', remark || '', id)
    
    return c.json({ success: true, message: '状态更新成功' })
  } catch (error) {
    console.error('Update reimbursement status error:', error)
    return c.json({ success: false, message: '更新状态失败' }, 500)
  }
})

// 删除报销单
financeRoutes.delete('/reimbursements/:id', async (c) => {
  try {
    const user = c.get('user')
    const id = c.req.param('id')
    
    // 检查权限
    const checkStmt = sqlite.prepare(
      'SELECT applicant_id, status FROM expense_reimbursements WHERE id = ?'
    )
    const reimbursement = checkStmt.get(id)
    
    if (!reimbursement) {
      return c.json({ success: false, message: '报销单不存在' }, 404)
    }
    
    if (!user.isAdmin && reimbursement.applicant_id !== user.id) {
      return c.json({ success: false, message: '无权限删除' }, 403)
    }
    
    if (reimbursement.status !== 'pending') {
      return c.json({ success: false, message: '已审批的报销单不能删除' }, 400)
    }
    
    const deleteStmt = sqlite.prepare(
      'DELETE FROM expense_reimbursements WHERE id = ?'
    )
    deleteStmt.run(id)
    
    return c.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('Delete reimbursement error:', error)
    return c.json({ success: false, message: '删除失败' }, 500)
  }
})

// 获取报销统计
financeRoutes.get('/statistics', async (c) => {
  try {
    const user = c.get('user')
    const month = c.req.query('month')
    
    let whereClause = ''
    const params = []
    
    if (!user.isAdmin) {
      whereClause = 'WHERE applicant_id = ?'
      params.push(user.id)
    }
    
    if (month) {
      whereClause += whereClause ? ' AND reimbursement_month = ?' : 'WHERE reimbursement_month = ?'
      params.push(month)
    }
    
    // 按状态统计
    const statusStmt = sqlite.prepare(`
      SELECT status, COUNT(*) as count, SUM(total_amount) as total
      FROM expense_reimbursements
      ${whereClause}
      GROUP BY status
    `)
    const statusStats = statusStmt.all(...params)
    
    // 按费用类别统计
    let categoryWhere = ''
    const categoryParams = []
    
    if (!user.isAdmin) {
      categoryWhere = 'WHERE er.applicant_id = ?'
      categoryParams.push(user.id)
    }
    
    if (month) {
      categoryWhere += categoryWhere ? ' AND er.reimbursement_month = ?' : 'WHERE er.reimbursement_month = ?'
      categoryParams.push(month)
    }
    
    const categoryStmt = sqlite.prepare(`
      SELECT ei.expense_category, COUNT(*) as count, SUM(ei.amount) as total
      FROM expense_items ei
      JOIN expense_reimbursements er ON ei.reimbursement_id = er.id
      ${categoryWhere}
      GROUP BY ei.expense_category
    `)
    const categoryStats = categoryStmt.all(...categoryParams)
    
    return c.json({
      success: true,
      data: {
        statusStats,
        categoryStats
      }
    })
  } catch (error) {
    console.error('Get statistics error:', error)
    return c.json({ success: false, message: '获取统计失败' }, 500)
  }
})
