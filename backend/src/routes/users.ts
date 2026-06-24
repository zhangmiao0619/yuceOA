// @ts-nocheck
import { getUser } from '../types/user'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db, sqlite } from '../db/index.js'
import { users } from '../schema/index.js'
import { eq, desc } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import xlsx from 'xlsx'

export const userRoutes = new Hono()

// 所有允许的人事字段
const ALL_HR_FIELDS = [
  'name', 'email', 'phone', 'department_name', 'role', 'is_admin', 'is_active',
  'employee_no', 'id_card', 'gender', 'birth_date', 'address', 'emergency_contact',
  'emergency_phone', 'emergency_relation', 'education', 'major', 'graduation_school',
  'graduation_date', 'entry_date', 'probation_end_date', 'formal_date',
  'contract_start_date', 'contract_end_date', 'resignation_date', 'resignation_reason',
  'employment_status', 'position', 'job_level', 'salary_base', 'bank_account',
  'bank_name', 'bank_branch', 'bank_code', 'social_security_no', 'provident_fund_no',
  'qualifications', 'professional_title', 'title_declaration_date',
  'personnel_category', 'native_place', 'home_address', 'ethnicity',
  'cert_name', 'cert_no', 'cert_issue_date',
  'probation_salary', 'formal_salary', 'seniority_allowance',
  'contract_no', 'contract_term', 'contract_count',
  'ss_start_date', 'id_card_expiry', 'documents', 'remarks',
  'latest_contract_start', 'latest_contract_end'
]

// 构建用户对象（从数据库记录映射到前端字段）
function buildUserObject(user: any) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    departmentName: user.department_name,
    role: user.role || 'member',
    isAdmin: user.is_admin,
    isActive: user.is_active,
    createdAt: user.created_at,
    // 基本人事信息
    employeeNo: user.employee_no,
    personnelCategory: user.personnel_category,
    position: user.position,
    jobLevel: user.job_level,
    entryDate: user.entry_date,
    employmentStatus: user.employment_status || 'active',
    // 个人信息
    idCard: user.id_card,
    gender: user.gender,
    birthDate: user.birth_date,
    age: calculateAge(user.birth_date),
    phone: user.phone,
    email: user.email,
    address: user.address,
    homeAddress: user.home_address,
    nativePlace: user.native_place,
    ethnicity: user.ethnicity,
    // 紧急联系人
    emergencyContact: user.emergency_contact,
    emergencyPhone: user.emergency_phone,
    emergencyRelation: user.emergency_relation,
    // 学历信息
    education: user.education,
    major: user.major,
    graduationSchool: user.graduation_school,
    graduationDate: user.graduation_date,
    // 证书信息
    certName: user.cert_name,
    certNo: user.cert_no,
    certIssueDate: user.cert_issue_date,
    // 工作信息
    formalDate: user.formal_date,
    probationEndDate: user.probation_end_date,
    probationSalary: user.probation_salary,
    formalSalary: user.formal_salary,
    seniorityAllowance: user.seniority_allowance,
    salaryBase: user.salary_base,
    // 合同信息
    contractStartDate: user.contract_start_date,
    contractEndDate: user.contract_end_date,
    latestContractStart: user.latest_contract_start,
    latestContractEnd: user.latest_contract_end,
    contractNo: user.contract_no,
    contractTerm: user.contract_term,
    contractCount: user.contract_count,
    // 工龄
    workYears: calculateWorkYears(user.entry_date),
    // 权限
    permissions: user.permissions,
    // 门禁指纹编号
    fingerprintId: user.fingerprint_id,
    // 银行信息
    bankAccount: user.bank_account,
    bankName: user.bank_name,
    bankBranch: user.bank_branch,
    bankCode: user.bank_code,
    // 社保
    socialSecurityNo: user.social_security_no,
    providentFundNo: user.provident_fund_no,
    ssStartDate: user.ss_start_date,
    // 其他
    qualifications: user.qualifications,
    professionalTitle: user.professional_title,
    titleDeclarationDate: user.title_declaration_date,
    idCardExpiry: user.id_card_expiry,
    documents: user.documents ? JSON.parse(user.documents) : [],
    remarks: user.remarks,
    resignationDate: user.resignation_date,
    resignationReason: user.resignation_reason
  }
}

// 计算年龄
function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

// 计算工龄
function calculateWorkYears(entryDate: string | null): string | null {
  if (!entryDate) return null
  const entry = new Date(entryDate)
  const today = new Date()
  const years = today.getFullYear() - entry.getFullYear()
  const months = today.getMonth() - entry.getMonth()
  const days = today.getDate() - entry.getDate()
  
  let totalMonths = years * 12 + months
  if (days < 0) totalMonths--
  
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  
  if (y > 0 && m > 0) return `${y}年${m}个月`
  if (y > 0) return `${y}年`
  if (m > 0) return `${m}个月`
  return '不到1个月'
}

// 获取用户列表
userRoutes.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') as string) || 1
    const pageSize = parseInt(c.req.query('pageSize') as string) || 10
    const offset = (page - 1) * pageSize
    
    const countStmt = sqlite.prepare('SELECT COUNT(*) as total FROM users')
    const countResult = countStmt.get() as { total: number }
    const total = countResult?.total || 0
    
    const list = sqlite.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?').all(pageSize, offset) as any[]
    const safeList = list.map(user => buildUserObject(user))
    return c.json({ success: true, data: safeList, total, page, pageSize })
  } catch (error) {
    console.error('Get users error:', error)
    return c.json({ success: false, message: '获取用户列表失败' }, 500)
  }
})

// 获取当前用户信息
userRoutes.get('/me', authMiddleware, async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    return c.json({ success: true, data: user })
  } catch (error) {
    console.error('Get me error:', error)
    return c.json({ success: false, message: '获取用户信息失败' }, 500)
  }
})

// 手机号正则校验
const phoneRegex = /^1[3-9]\d{9}$/

// 密码复杂度校验：至少6位，包含字母和数字
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/
const validatePassword = (password: string) => {
  if (password.length < 6) {
    return { valid: false, message: '密码长度至少6位' }
  }
  if (!/[A-Za-z]/.test(password)) {
    return { valid: false, message: '密码必须包含字母' }
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: '密码必须包含数字' }
  }
  return { valid: true, message: '' }
}

// 创建用户
userRoutes.post('/', authMiddleware, requirePermission('canManageUsers'), zValidator('json', z.object({
  username: z.string().min(1).max(50),
  name: z.string().max(100).optional(),
  password: z.string().min(6).max(100),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  departmentName: z.string().optional(),
  role: z.enum(['admin', 'manager', 'member']).optional().default('member'),
  isAdmin: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  fingerprintId: z.string().optional(),
  position: z.string().optional(),
  employeeNo: z.string().optional(),
  entryDate: z.string().optional()
}).refine((data) => {
  if (data.phone && !phoneRegex.test(data.phone)) {
    return false
  }
  return true
}, {
  message: '手机号格式不正确，请输入11位有效手机号',
  path: ['phone']
}).refine((data) => {
  const result = validatePassword(data.password)
  return result.valid
}, {
  message: '密码必须至少6位，且包含字母和数字',
  path: ['password']
})), async (c) => {
  try {
    const currentUser = getUser(c)
    if (!currentUser.isAdmin) {
      return c.json({ success: false, message: '无权限' }, 403)
    }
    
    const data = c.req.valid('json')
    
    // 使用Drizzle ORM创建基本用户
    const newUser = await db.insert(users).values({
      username: data.username,
      name: data.name || data.username,
      password: data.password,
      email: data.email,
      phone: data.phone,
      departmentName: data.departmentName,
      role: data.role,
      isAdmin: data.isAdmin ? 1 : 0,
      isActive: data.isActive ? 1 : 0
    }).returning()
    
    // 使用原生SQL更新额外字段
    const userId = newUser[0].id
    const extraFields = ['fingerprint_id', 'position', 'employee_no', 'entry_date']
    const setClauses: string[] = []
    const values: any[] = []
    
    for (const field of extraFields) {
      const camelField = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
      if (data[camelField] !== undefined) {
        setClauses.push(`${field} = ?`)
        values.push(data[camelField])
      }
    }
    
    if (setClauses.length > 0) {
      values.push(userId)
      const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`
      sqlite.prepare(sql).run(...values)
    }
    
    return c.json({ success: true, data: newUser[0] })
  } catch (error) {
    console.error('Create user error:', error)
    return c.json({ success: false, message: '创建用户失败' }, 500)
  }
})

// 更新用户
userRoutes.put('/:id', authMiddleware, requirePermission('canManageUsers'), zValidator('json', z.object({
  name: z.string().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  departmentName: z.string().optional().nullable(),
  role: z.enum(['admin', 'manager', 'member']).optional(),
  isAdmin: z.boolean().optional(),
  isActive: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
  fingerprintId: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  employeeNo: z.string().optional().nullable(),
  entryDate: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  idCard: z.string().optional().nullable()
})), async (c) => {
  try {
    const currentUser = getUser(c)
    if (!currentUser.isAdmin) {
      return c.json({ success: false, message: '无权限' }, 403)
    }
    
    const userId = c.req.param('id')
    const data = c.req.valid('json')
    
    if (userId === currentUser.id && data.isAdmin === false) {
      return c.json({ success: false, message: '不能取消自己的管理员权限' }, 400)
    }
    
    const updateData: any = { ...data, updatedAt: new Date() }
    if (data.isAdmin !== undefined) updateData.isAdmin = data.isAdmin ? 1 : 0
    if (data.isActive !== undefined) updateData.isActive = data.isActive ? 1 : 0
    // 权限字段
    if (data.permissions !== undefined) updateData.permissions = data.permissions
    
    // 先使用 Drizzle ORM 更新基本字段
    const updated = await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning()
    
    if (!updated[0]) {
      return c.json({ success: false, message: '用户不存在' }, 404)
    }
    
    // 使用原生SQL更新额外字段（不在Drizzle schema中的字段）
    const extraFields = ['fingerprint_id', 'position', 'employee_no', 'entry_date', 'gender', 'id_card']
    const setClauses: string[] = []
    const values: any[] = []
    
    for (const field of extraFields) {
      const camelField = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
      if (data[camelField] !== undefined) {
        setClauses.push(`${field} = ?`)
        values.push(data[camelField])
      }
    }
    
    if (setClauses.length > 0) {
      values.push(userId)
      const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`
      sqlite.prepare(sql).run(...values)
    }
    
    return c.json({ success: true, data: updated[0] })
  } catch (error) {
    console.error('Update user error:', error)
    return c.json({ success: false, message: '更新用户失败' }, 500)
  }
})

// 删除用户
userRoutes.delete('/:id', authMiddleware, requirePermission('canManageUsers'), async (c) => {
  try {
    const currentUser = getUser(c)
    if (!currentUser.isAdmin) {
      return c.json({ success: false, message: '无权限' }, 403)
    }
    
    const userId = c.req.param('id')
    
    if (userId === currentUser.id) {
      return c.json({ success: false, message: '不能删除自己' }, 400)
    }
    
    const deleted = await db.delete(users).where(eq(users.id, userId)).returning()
    
    if (!deleted[0]) {
      return c.json({ success: false, message: '用户不存在' }, 404)
    }
    
    return c.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('Delete user error:', error)
    return c.json({ success: false, message: '删除用户失败' }, 500)
  }
})

// 办理离职
userRoutes.post('/:id/resign', authMiddleware, async (c) => {
  try {
    const currentUser = getUser(c)
    if (!currentUser.isAdmin) {
      return c.json({ success: false, message: '无权限' }, 403)
    }
    
    const userId = c.req.param('id')
    const body = await c.req.json()
    
    if (userId === currentUser.id) {
      return c.json({ success: false, message: '不能为自己办理离职' }, 400)
    }
    
    // 更新用户状态为离职
    const stmt = sqlite.prepare(`
      UPDATE users SET 
        employment_status = 'resigned',
        resignation_date = ?,
        resignation_reason = ?,
        is_active = 0,
        updated_at = datetime('now')
      WHERE id = ?
    `)
    stmt.run(body.resignationDate || new Date().toISOString().split('T')[0], body.reason || null, userId)
    
    // 添加入转调离记录
    const recordStmt = sqlite.prepare(`
      INSERT INTO user_work_records (
        id, user_id, record_type, old_value, new_value, effective_date, reason, approver_id, status, created_at, updated_at
      ) VALUES (lower(hex(randomblob(16))), ?, 'resignation', ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
    `)
    recordStmt.run(userId, '在职', '离职', body.resignationDate || new Date().toISOString().split('T')[0], body.reason || null, currentUser.id)
    
    return c.json({ success: true, message: '离职办理成功' })
  } catch (error) {
    console.error('Resign user error:', error)
    return c.json({ success: false, message: '办理离职失败' }, 500)
  }
})

// 重置密码
userRoutes.post('/:id/reset-password', authMiddleware, zValidator('json', z.object({
  newPassword: z.string().min(1)
}).refine((data) => {
  const result = validatePassword(data.newPassword)
  return result.valid
}, {
  message: '密码必须至少6位，且包含字母和数字',
  path: ['newPassword']
})), async (c) => {
  try {
    const currentUser = getUser(c)
    if (!currentUser.isAdmin) {
      return c.json({ success: false, message: '无权限' }, 403)
    }
    
    const userId = c.req.param('id')
    const { newPassword } = c.req.valid('json')
    
    await db.update(users)
      .set({ password: newPassword, updatedAt: new Date() })
      .where(eq(users.id, userId))
    
    return c.json({ success: true, message: '密码重置成功' })
  } catch (error) {
    console.error('Reset password error:', error)
    return c.json({ success: false, message: '重置密码失败' }, 500)
  }
})

// ==================== 电子档案卡 / 人事变动 ====================

// 获取用户完整档案
userRoutes.get('/:id/profile', authMiddleware, async (c) => {
  try {
    const userId = c.req.param('id')
    const stmt = sqlite.prepare('SELECT * FROM users WHERE id = ?')
    const user = stmt.get(userId) as any
    
    if (!user) {
      return c.json({ success: false, message: '用户不存在' }, 404)
    }
    
    // 获取人事变动记录
    const recordsStmt = sqlite.prepare(`
      SELECT uwr.*, u.name as approver_name 
      FROM user_work_records uwr 
      LEFT JOIN users u ON uwr.approver_id = u.id
      WHERE uwr.user_id = ? 
      ORDER BY uwr.effective_date DESC
    `)
    const workRecords = recordsStmt.all(userId)
    
    const { password, ...safeUser } = user
    
    return c.json({ 
      success: true, 
      data: { ...buildUserObject(user), workRecords }
    })
  } catch (error) {
    console.error('Get profile error:', error)
    return c.json({ success: false, message: '获取档案失败' }, 500)
  }
})

// 更新用户档案（HR/管理员）
userRoutes.put('/:id/profile', authMiddleware, async (c) => {
  try {
    const currentUser = getUser(c)
    if (!currentUser.isAdmin) {
      return c.json({ success: false, message: '无权限' }, 403)
    }
    
    const userId = c.req.param('id')
    const body = await c.req.json()
    
    // 数据库字段名映射
    const fieldMapping: Record<string, string> = {
      'employeeNo': 'employee_no',
      'personnelCategory': 'personnel_category',
      'idCard': 'id_card',
      'gender': 'gender',
      'birthDate': 'birth_date',
      'address': 'address',
      'homeAddress': 'home_address',
      'nativePlace': 'native_place',
      'ethnicity': 'ethnicity',
      'emergencyContact': 'emergency_contact',
      'emergencyPhone': 'emergency_phone',
      'emergencyRelation': 'emergency_relation',
      'education': 'education',
      'major': 'major',
      'graduationSchool': 'graduation_school',
      'graduationDate': 'graduation_date',
      'certName': 'cert_name',
      'certNo': 'cert_no',
      'certIssueDate': 'cert_issue_date',
      'entryDate': 'entry_date',
      'probationEndDate': 'probation_end_date',
      'formalDate': 'formal_date',
      'contractStartDate': 'contract_start_date',
      'contractEndDate': 'contract_end_date',
      'latestContractStart': 'latest_contract_start',
      'latestContractEnd': 'latest_contract_end',
      'position': 'position',
      'jobLevel': 'job_level',
      'salaryBase': 'salary_base',
      'probationSalary': 'probation_salary',
      'formalSalary': 'formal_salary',
      'seniorityAllowance': 'seniority_allowance',
      'bankAccount': 'bank_account',
      'bankName': 'bank_name',
      'bankBranch': 'bank_branch',
      'bankCode': 'bank_code',
      'socialSecurityNo': 'social_security_no',
      'providentFundNo': 'provident_fund_no',
      'ssStartDate': 'ss_start_date',
      'qualifications': 'qualifications',
      'professionalTitle': 'professional_title',
      'titleDeclarationDate': 'title_declaration_date',
      'contractNo': 'contract_no',
      'contractTerm': 'contract_term',
      'contractCount': 'contract_count',
      'idCardExpiry': 'id_card_expiry',
      'documents': 'documents',
      'remarks': 'remarks',
      'resignationDate': 'resignation_date',
      'resignationReason': 'resignation_reason',
      'employmentStatus': 'employment_status'
    }
    
    const updates: any = { updated_at: new Date().toISOString() }
    
    for (const [frontKey, dbKey] of Object.entries(fieldMapping)) {
      if (body[frontKey] !== undefined) {
        if (frontKey === 'documents') {
          updates[dbKey] = JSON.stringify(body[frontKey])
        } else {
          updates[dbKey] = body[frontKey]
        }
      }
    }
    
    if (Object.keys(updates).length <= 1) {
      return c.json({ success: false, message: '无有效更新字段' }, 400)
    }
    
    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(updates)
    values.push(userId)
    
    const stmt = sqlite.prepare(`UPDATE users SET ${setClause} WHERE id = ?`)
    stmt.run(...values)
    
    return c.json({ success: true, message: '档案更新成功' })
  } catch (error) {
    console.error('Update profile error:', error)
    return c.json({ success: false, message: '更新档案失败' }, 500)
  }
})

// 添加入转调离记录
userRoutes.post('/:id/work-records', authMiddleware, async (c) => {
  try {
    const currentUser = getUser(c)
    if (!currentUser.isAdmin) {
      return c.json({ success: false, message: '无权限' }, 403)
    }
    
    const userId = c.req.param('id')
    const body = await c.req.json()
    
    const stmt = sqlite.prepare(`
      INSERT INTO user_work_records (
        id, user_id, record_type, old_value, new_value, effective_date, reason, approver_id, status, created_at, updated_at
      ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      RETURNING *
    `)
    
    const record = stmt.get(
      userId,
      body.recordType,
      body.oldValue || null,
      body.newValue || null,
      body.effectiveDate,
      body.reason || null,
      currentUser.id,
      body.status || 'active'
    )
    
    if (body.recordType === 'resignation') {
      sqlite.prepare(`UPDATE users SET employment_status = 'resigned', resignation_date = ?, is_active = 0 WHERE id = ?`).run(body.effectiveDate, userId)
    } else if (body.recordType === 'entry') {
      sqlite.prepare(`UPDATE users SET employment_status = 'active', entry_date = ? WHERE id = ?`).run(body.effectiveDate, userId)
    } else if (body.recordType === 'transfer') {
      sqlite.prepare(`UPDATE users SET department_name = ?, position = ? WHERE id = ?`).run(body.newValue?.department || null, body.newValue?.position || null, userId)
    }
    
    return c.json({ success: true, data: record })
  } catch (error) {
    console.error('Create work record error:', error)
    return c.json({ success: false, message: '添加记录失败' }, 500)
  }
})

// 批量导入员工
userRoutes.post('/import', authMiddleware, requirePermission('canManageUsers'), async (c) => {
  try {
    const currentUser = getUser(c)
    if (!currentUser || !currentUser.isAdmin) {
      return c.json({ success: false, message: '无权限' }, 403)
    }

    const formData = await c.req.formData()
    const file = formData.get('file') as File
    if (!file) {
      return c.json({ success: false, message: '请选择文件' }, 400)
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let rows: any[] = []
    const fileName = file.name.toLowerCase()

    if (fileName.endsWith('.csv')) {
      const text = buffer.toString('utf-8')
      const lines = text.split('\n').map(l => l.trim()).filter(l => l)
      if (lines.length < 2) {
        return c.json({ success: false, message: 'CSV 文件为空或格式不正确' }, 400)
      }
      const headers = lines[0].split(',').map((h: string) => h.trim())
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v: string) => v.trim())
        const row: any = {}
        headers.forEach((h: string, idx: number) => {
          row[h] = values[idx] || ''
        })
        rows.push(row)
      }
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = xlsx.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      rows = xlsx.utils.sheet_to_json(sheet)
    } else {
      return c.json({ success: false, message: '不支持的文件格式，请上传 CSV 或 Excel 文件' }, 400)
    }

    const fieldMap: Record<string, string> = {
      'username': 'username', '用户名': 'username',
      'name': 'name', '姓名': 'name',
      'password': 'password', '密码': 'password',
      'email': 'email', '邮箱': 'email',
      'phone': 'phone', '手机': 'phone',
      'department_name': 'departmentName', '部门': 'departmentName',
      'role': 'role', '角色': 'role',
      'employee_no': 'employeeNo', '工号': 'employeeNo',
      'id_card': 'idCard', '身份证号': 'idCard',
      'gender': 'gender', '性别': 'gender',
      'birth_date': 'birthDate', '出生日期': 'birthDate',
      'entry_date': 'entryDate', '入职日期': 'entryDate',
      'position': 'position', '岗位': 'position',
      'job_level': 'jobLevel', '职级': 'jobLevel',
      'salary_base': 'salaryBase', '基本工资': 'salaryBase',
      'bank_account': 'bankAccount', '银行卡号': 'bankAccount',
      'bank_name': 'bankName', '开户行': 'bankName',
      'social_security_no': 'socialSecurityNo', '社保号': 'socialSecurityNo',
      'provident_fund_no': 'providentFundNo', '公积金号': 'providentFundNo',
      'education': 'education', '学历': 'education',
      'major': 'major', '专业': 'major',
      'graduation_school': 'graduationSchool', '毕业院校': 'graduationSchool',
      'professional_title': 'professionalTitle', '职称': 'professionalTitle'
    }

    let successCount = 0
    let failCount = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i]
      const row: any = {}
      Object.keys(rawRow).forEach(key => {
        const mapped = fieldMap[key.trim()]
        if (mapped) {
          row[mapped] = rawRow[key]
        }
      })

      if (!row.name || !row.username) {
        failCount++
        errors.push(`第 ${i + 2} 行: 姓名和用户名不能为空`)
        continue
      }

      const defaultPassword = row.password || '123456'

      try {
        sqlite.prepare(`
          INSERT INTO users (
            id, username, password, name, email, phone, department_name, role, is_admin, is_active,
            employee_no, id_card, gender, birth_date, entry_date, position, job_level, salary_base,
            bank_account, bank_name, social_security_no, provident_fund_no,
            education, major, graduation_school, professional_title, created_at, updated_at
          ) VALUES (
            lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, 0, 1,
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, datetime('now'), datetime('now')
          )
        `).run(
          row.username, defaultPassword, row.name, row.email || null, row.phone || null,
          row.departmentName || null, row.role || 'member',
          row.employeeNo || null, row.idCard || null, row.gender || null,
          row.birthDate || null, row.entryDate || null, row.position || null,
          row.jobLevel || null, row.salaryBase || null,
          row.bankAccount || null, row.bankName || null,
          row.socialSecurityNo || null, row.providentFundNo || null,
          row.education || null, row.major || null,
          row.graduationSchool || null, row.professionalTitle || null
        )
        successCount++
      } catch (err: any) {
        failCount++
        errors.push(`第 ${i + 2} 行: ${err.message || '插入失败'}`)
      }
    }

    return c.json({
      success: true,
      data: { total: rows.length, success: successCount, fail: failCount, errors: errors.slice(0, 20) }
    })
  } catch (error: any) {
    console.error('Import users error:', error)
    return c.json({ success: false, message: '导入失败: ' + (error.message || '未知错误') }, 500)
  }
})
