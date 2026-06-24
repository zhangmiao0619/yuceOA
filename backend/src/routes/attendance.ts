// @ts-nocheck
import { getUser } from '../types/user'
import { Hono } from 'hono'
import { db } from '../db/index.js'
import { eq, desc, and, gte, lte, like } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'

const sqlite = (db as any).$client

// 审批人配置
const APPROVER_WANGLENG = '9bae22e3-f2b1-4e2f-9165-1ac2fecc7f0a'
const APPROVER_ZHANGGAN = 'ba1bd0f0d37fee435d376bd60b86e004'
const APPROVER_FEIHONGYING = '33285985-65d3-4c92-ac7a-bbe812972ade'

// 确保 leave_requests 表有审批人字段
try { sqlite.exec(`ALTER TABLE leave_requests ADD COLUMN approver_ids TEXT DEFAULT '[]'`) } catch (e) {}
try { sqlite.exec(`ALTER TABLE leave_requests ADD COLUMN approved_by TEXT DEFAULT '[]'`) } catch (e) {}

export const attendanceRoutes = new Hono()

attendanceRoutes.use('*', authMiddleware)

// ==================== 打卡相关 ====================

// 获取考勤记录列表
attendanceRoutes.get('/', async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    
    const { startDate, endDate, userId } = c.req.query()
    
    let query = 'SELECT * FROM attendance_records WHERE 1=1'
    const params: any[] = []
    
    // 非管理员只能看自己的
    if (!user.isAdmin) {
      query += ' AND user_id = ?'
      params.push(user.id)
    } else if (userId) {
      query += ' AND user_id = ?'
      params.push(userId)
    }
    
    if (startDate) {
      query += ' AND date >= ?'
      params.push(startDate)
    }
    
    if (endDate) {
      query += ' AND date <= ?'
      params.push(endDate)
    }
    
    query += ' ORDER BY date DESC'
    
    const stmt = sqlite.prepare(query)
    const records = stmt.all(...params)
    
    return c.json({ success: true, data: records })
  } catch (error: any) {
    console.error('Get attendance records error:', error)
    return c.json({ success: false, message: '获取考勤记录失败' }, 500)
  }
})

// 今日打卡状态
attendanceRoutes.get('/today', async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    const today = new Date().toISOString().split('T')[0]
    
    const stmt = sqlite.prepare(`
      SELECT * FROM attendance_records WHERE user_id = ? AND date = ?
    `)
    const record = stmt.get(user.id, today)

    return c.json({ success: true, data: record || null })
  } catch (error: any) {
    console.error('Get today attendance error:', error)
    return c.json({ success: false, message: '获取打卡状态失败' }, 500)
  }
})

// 判断是否是大小周的工作日
function isWorkDay(date: Date, configMap: Record<string, string>): boolean {
  const day = date.getDay()
  
  // 周日(0)休息
  if (day === 0) return false
  
  // 周一到周五工作
  if (day >= 1 && day <= 5) return true
  
  // 周六(6)：根据大小周配置判断
  if (day === 6) {
    const weekType = configMap['work_week_type'] || '双休'
    if (weekType === '双休') return false
    if (weekType === '单休') return true
    
    // 大小周：判断是单周还是双周
    if (weekType === '大小周') {
      const saturdayWeeks = configMap['work_saturday_weeks'] || 'odd'
      
      // 计算当前日期是本年度的第几周
      const startOfYear = new Date(date.getFullYear(), 0, 1)
      const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
      const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7)
      
      const isOddWeek = weekNumber % 2 === 1
      return saturdayWeeks === 'odd' ? isOddWeek : !isOddWeek
    }
  }
  
  return true
}

// 计算工作时长（扣除午休和晚饭时间）
function calculateWorkHours(checkInTime: Date, checkOutTime: Date, configMap: Record<string, string>): { workHours: number; overtimeHours: number } {
  let totalHours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)
  
  const restStart = configMap['rest_start'] || '12:00'
  const restEnd = configMap['rest_end'] || '13:30'
  const dinnerStart = configMap['dinner_start'] || '17:00'
  const dinnerEnd = configMap['dinner_end'] || '18:30'
  const workStartTime = configMap['work_start_time'] || '08:30'
  const workEndTime = configMap['work_end_time'] || '17:30'
  const workHoursPerDay = parseFloat(configMap['work_hours_per_day'] || '7.5')
  
  // 扣除午休时间
  const checkInStr = checkInTime.toTimeString().slice(0, 5)
  const checkOutStr = checkOutTime.toTimeString().slice(0, 5)
  
  if (checkInStr < restStart && checkOutStr > restEnd) {
    // 跨越了整个午休时间
    const restStartMinutes = parseInt(restStart.split(':')[0]) * 60 + parseInt(restStart.split(':')[1])
    const restEndMinutes = parseInt(restEnd.split(':')[0]) * 60 + parseInt(restEnd.split(':')[1])
    totalHours -= (restEndMinutes - restStartMinutes) / 60
  }
  
  // 扣除晚饭时间（如果跨越了晚饭时间且加班）
  if (checkOutStr > dinnerStart) {
    const dinnerStartMinutes = parseInt(dinnerStart.split(':')[0]) * 60 + parseInt(dinnerStart.split(':')[1])
    const dinnerEndMinutes = parseInt(dinnerEnd.split(':')[0]) * 60 + parseInt(dinnerEnd.split(':')[1])
    const checkOutMinutes = parseInt(checkOutStr.split(':')[0]) * 60 + parseInt(checkOutStr.split(':')[1])
    
    if (checkOutMinutes > dinnerEndMinutes) {
      // 跨越了整个晚饭时间
      totalHours -= (dinnerEndMinutes - dinnerStartMinutes) / 60
    } else if (checkOutMinutes > dinnerStartMinutes) {
      // 部分跨越晚饭时间
      totalHours -= (checkOutMinutes - dinnerStartMinutes) / 60
    }
  }
  
  totalHours = Math.max(0, parseFloat(totalHours.toFixed(2)))
  const overtimeHours = Math.max(0, parseFloat((totalHours - workHoursPerDay).toFixed(2)))
  
  return { workHours: totalHours, overtimeHours }
}

// 打卡（支持定位校验、工时统计、日报跳转）
attendanceRoutes.post('/check-in', async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    const body = await c.req.json()
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const currentTime = now.toTimeString().slice(0, 8)
    
    // 获取考勤配置
    const configStmt = sqlite.prepare('SELECT key, value FROM attendance_config')
    const configs = configStmt.all() as any[]
    const configMap: Record<string, string> = {}
    for (const cfg of configs) {
      configMap[cfg.key] = cfg.value
    }
    
    const workStartTime = configMap['work_start_time'] || '08:30'
    const workEndTime = configMap['work_end_time'] || '17:30'
    const lateThreshold = configMap['late_threshold'] || '08:40'
    const earlyLeaveThreshold = configMap['early_leave_threshold'] || '17:20'
    const officeLat = parseFloat(configMap['office_latitude'] || '0')
    const officeLng = parseFloat(configMap['office_longitude'] || '0')
    const checkInRadius = parseFloat(configMap['check_in_radius'] || '500')
    
    // 检查今天是否工作日（大小周）
    const isTodayWorkDay = isWorkDay(now, configMap)
    
    // 定位校验
    let locationValid = true
    let locationAbnormal = false
    if (body.latitude && body.longitude && officeLat && officeLng) {
      const distance = getDistanceFromLatLonInMeters(body.latitude, body.longitude, officeLat, officeLng)
      if (distance > checkInRadius) {
        locationValid = false
        locationAbnormal = true
      }
    }
    
    // 检查今天是否已打卡
    const existingStmt = sqlite.prepare('SELECT * FROM attendance_records WHERE user_id = ? AND date = ?')
    const existing = existingStmt.get(user.id, today) as any
    
    if (existing) {
      // 下班打卡
      let status = existing.status || 'normal'
      let exceptionType = existing.exception_type
      
      if (currentTime < earlyLeaveThreshold) {
        status = status === 'normal' ? 'early_leave' : status + ',early_leave'
        exceptionType = exceptionType ? exceptionType + ',early_leave' : 'early_leave'
      }
      if (locationAbnormal) {
        exceptionType = exceptionType ? exceptionType + ',location_abnormal' : 'location_abnormal'
      }
      
      // 计算工作时长（扣除午休和晚饭时间）
      const checkInTime = new Date(existing.check_in_time)
      const { workHours, overtimeHours } = calculateWorkHours(checkInTime, now, configMap)
      
      const updateStmt = sqlite.prepare(`
        UPDATE attendance_records 
        SET check_out_time = ?, check_out_location = ?, check_out_latitude = ?, check_out_longitude = ?,
            check_out_device = ?, check_out_type = ?, work_hours = ?, overtime_hours = ?, status = ?, exception_type = ?, updated_at = datetime('now')
        WHERE user_id = ? AND date = ?
      `)
      updateStmt.run(
        now.toISOString(), body.location || null, body.latitude || null, body.longitude || null,
        body.device || null, body.checkType || 'office', workHours, overtimeHours, status, exceptionType,
        user.id, today
      )
      
      // 自动记录工时到time_entries表（关联到日常任务或创建考勤任务）
      try {
        // 查找或创建考勤任务
        const taskStmt = sqlite.prepare(`
          SELECT id FROM tasks WHERE assignee_id = ? AND title LIKE '%考勤%' AND status != 'done' LIMIT 1
        `)
        let taskId = taskStmt.get(user.id)?.id
        
        if (!taskId) {
          // 创建考勤任务（使用默认考勤项目）
          const createTaskStmt = sqlite.prepare(`
            INSERT INTO tasks (id, project_id, title, description, status, assignee_id, creator_id, actual_hours, created_at, updated_at)
            VALUES (lower(hex(randomblob(16))), '00000000-0000-0000-0000-000000000000', '日常考勤工作', '日常考勤工时记录', 'in_progress', ?, ?, ?, datetime('now'), datetime('now'))
            RETURNING id
          `)
          taskId = createTaskStmt.get(user.id, user.id)?.id
        }
        
        // 更新工时
        if (taskId) {
          const updateTaskStmt = sqlite.prepare(`
            UPDATE tasks SET actual_hours = COALESCE(actual_hours, 0) + ? WHERE id = ?
          `)
          updateTaskStmt.run(workHours, taskId)
        }
      } catch (e) {
        console.error('Auto record work hours error:', e)
      }
      
      return c.json({ 
        success: true, 
        message: '下班打卡成功', 
        data: { 
          workHours, 
          overtimeHours, 
          locationValid,
          requireDailyReport: true // 标记需要填写日报
        } 
      })
    } else {
      // 上班打卡
      let status = 'normal'
      let exceptionType = null
      
      if (currentTime > lateThreshold) {
        status = 'late'
        exceptionType = 'late'
      }
      if (locationAbnormal) {
        exceptionType = exceptionType ? exceptionType + ',location_abnormal' : 'location_abnormal'
      }
      
      const insertStmt = sqlite.prepare(`
        INSERT INTO attendance_records (
          id, user_id, date, check_in_time, status, exception_type, check_in_location, check_in_latitude, check_in_longitude, 
          check_in_device, check_in_type, work_hours, created_at, updated_at
        ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
      `)
      insertStmt.run(
        user.id, today, now.toISOString(), status, exceptionType,
        body.location || null, body.latitude || null, body.longitude || null,
        body.device || null, body.checkType || 'office'
      )
      
      return c.json({ success: true, message: '上班打卡成功', data: { status, locationValid } })
    }
  } catch (error: any) {
    console.error('Check in error:', error)
    return c.json({ success: false, message: '打卡失败' }, 500)
  }
})

// 计算两个坐标之间的距离（米）
function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
function deg2rad(deg: number) {
  return deg * (Math.PI / 180)
}

// 获取打卡记录列表
attendanceRoutes.get('/records', async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    const { startDate, endDate, page = '1', pageSize = '30' } = c.req.query()
    
    let sql = 'SELECT * FROM attendance_records WHERE user_id = ?'
    const params: any[] = [user.id]
    
    if (startDate) {
      sql += ' AND date >= ?'
      params.push(startDate)
    }
    if (endDate) {
      sql += ' AND date <= ?'
      params.push(endDate)
    }
    
    sql += ' ORDER BY date DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const stmt = sqlite.prepare(sql)
    const records = stmt.all(...params)
    
    // 获取总数
    let countSql = 'SELECT COUNT(*) as total FROM attendance_records WHERE user_id = ?'
    const countParams: any[] = [user.id]
    if (startDate) {
      countSql += ' AND date >= ?'
      countParams.push(startDate)
    }
    if (endDate) {
      countSql += ' AND date <= ?'
      countParams.push(endDate)
    }
    const countStmt = sqlite.prepare(countSql)
    const total = countStmt.get(...countParams).total
    
    return c.json({ success: true, data: records, total })
  } catch (error: any) {
    console.error('Get attendance records error:', error)
    return c.json({ success: false, message: '获取打卡记录失败' }, 500)
  }
})

// 获取考勤统计
attendanceRoutes.get('/stats', async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    const { month } = c.req.query() // YYYY-MM
    
    const targetMonth = month || new Date().toISOString().slice(0, 7)
    const startDate = targetMonth + '-01'
    const endDate = new Date(targetMonth + '-01').toISOString().slice(0, 10)
    
    // 获取该月天数
    const daysInMonth = new Date(parseInt(targetMonth.slice(0, 4)), parseInt(targetMonth.slice(5, 7)), 0).getDate()
    
    const stmt = sqlite.prepare(`
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'normal' THEN 1 ELSE 0 END) as normal_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(CASE WHEN check_in_time IS NOT NULL THEN 1 ELSE 0 END) as checked_days
      FROM attendance_records 
      WHERE user_id = ? AND date >= ? AND date <= ?
    `)
    const stats = stmt.get(user.id, startDate, endDate)
    
    // 获取请假天数
    const leaveStmt = sqlite.prepare(`
      SELECT SUM(days) as leave_days FROM leave_requests 
      WHERE user_id = ? AND status = 'approved' AND start_date >= ? AND start_date < date(?, '+1 day')
    `)
    const leaveDayResult = leaveStmt.get(user.id, startDate, endDate) as any
    const leaveDays = leaveDayResult?.leave_days || 0
    
    // 获取加班小时数
    const overtimeStmt = sqlite.prepare(`
      SELECT SUM(hours) as overtime_hours FROM overtime_requests 
      WHERE user_id = ? AND status = 'approved' AND date >= ? AND date <= ?
    `)
    const overtimeHours = overtimeStmt.get(user.id, startDate, endDate)?.overtime_hours || 0
    
    return c.json({ 
      success: true, 
      data: {
        month: targetMonth,
        totalDays: daysInMonth,
        checkedDays: stats?.checked_days || 0,
        normalDays: stats?.normal_days || 0,
        lateDays: stats?.late_days || 0,
        absentDays: stats?.absent_days || 0,
        leaveDays,
        overtimeHours
      } 
    })
  } catch (error: any) {
    console.error('Get attendance stats error:', error)
    return c.json({ success: false, message: '获取考勤统计失败' }, 500)
  }
})

// ==================== 请假相关 ====================

// 请假类型选项
const LEAVE_TYPES = [
  { value: 'annual', label: '年假', color: 'blue' },
  { value: 'sick', label: '病假', color: 'red' },
  { value: 'personal', label: '事假', color: 'orange' },
  { value: 'marriage', label: '婚假', color: 'magenta' },
  { value: 'maternity', label: '产假', color: 'pink' },
  { value: 'paternity', label: '陪产假', color: 'purple' },
  { value: 'bereavement', label: '丧假', color: 'gray' },
  { value: 'time_off', label: '调休假', color: 'cyan' },
  { value: 'other', label: '其他', color: 'default' },
]

// 获取请假类型列表
attendanceRoutes.get('/leave-types', async (c) => {
  return c.json({ success: true, data: LEAVE_TYPES })
})

// 申请请假
attendanceRoutes.post('/leave', async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    const body = await c.req.json()
    
    // 计算请假天数
    const startDate = new Date(body.startDate)
    const endDate = new Date(body.endDate)
    const diffMs = endDate.getTime() - startDate.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    const sameDay = startDate.toDateString() === endDate.toDateString()
    const days = sameDay ? (diffHours >= 5 ? 1 : 0.5) : Math.round((diffHours / 24) * 2) / 2

    // 确定审批人
    let approverIds: string[]
    const dept = user.departmentName || ''
    if (user.id === APPROVER_WANGLENG || user.id === APPROVER_ZHANGGAN) {
      // wangleng 和人事的请假 -> feihongying 审批
      approverIds = [APPROVER_FEIHONGYING]
    } else if (dept.includes('数据工程中心')) {
      // 生产部门请假 -> wangleng + 人事一起审批
      approverIds = [APPROVER_WANGLENG, APPROVER_ZHANGGAN]
    } else {
      // 其他部门 -> 人事审批
      approverIds = [APPROVER_ZHANGGAN]
    }
    
    const stmt = sqlite.prepare(`
      INSERT INTO leave_requests (
        id, user_id, leave_type, start_date, end_date, days, reason, status, approver_ids, approved_by, created_at, updated_at
      ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, 'pending', ?, '[]', datetime('now'), datetime('now'))
      RETURNING *
    `)
    
    const request = stmt.get(
      user.id,
      body.leaveType,
      body.startDate,
      body.endDate,
      days,
      body.reason || null,
      JSON.stringify(approverIds)
    )

    return c.json({ success: true, data: request }, 201)
  } catch (error: any) {
    console.error('Create leave request error:', error)
    return c.json({ success: false, message: '创建请假申请失败' }, 500)
  }
})

// 获取请假记录
attendanceRoutes.get('/leave', async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    const { status, page = '1', pageSize = '20' } = c.req.query()
    
    let sql = 'SELECT * FROM leave_requests WHERE user_id = ?'
    const params: any[] = [user.id]
    
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const stmt = sqlite.prepare(sql)
    const records = stmt.all(...params)
    
    return c.json({ success: true, data: records })
  } catch (error: any) {
    console.error('Get leave requests error:', error)
    return c.json({ success: false, message: '获取请假记录失败' }, 500)
  }
})

// ==================== 加班相关 ====================

// 申请加班
attendanceRoutes.post('/overtime', async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    const body = await c.req.json()
    
    // 计算加班小时数
    const startTime = new Date(body.startTime)
    const endTime = new Date(body.endTime)
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    
    const stmt = sqlite.prepare(`
      INSERT INTO overtime_requests (
        id, user_id, date, start_time, end_time, hours, reason, status, created_at, updated_at
      ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
      RETURNING *
    `)
    
    const request = stmt.get(
      user.id,
      body.date,
      body.startTime,
      body.endTime,
      hours,
      body.reason || null
    )

    return c.json({ success: true, data: request }, 201)
  } catch (error: any) {
    console.error('Create overtime request error:', error)
    return c.json({ success: false, message: '创建加班申请失败' }, 500)
  }
})

// 获取加班记录
attendanceRoutes.get('/overtime', async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    const { status } = c.req.query()
    
    let sql = 'SELECT * FROM overtime_requests WHERE user_id = ?'
    const params: any[] = [user.id]
    
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    
    sql += ' ORDER BY date DESC LIMIT 50'
    
    const stmt = sqlite.prepare(sql)
    const records = stmt.all(...params)
    
    return c.json({ success: true, data: records })
  } catch (error: any) {
    console.error('Get overtime requests error:', error)
    return c.json({ success: false, message: '获取加班记录失败' }, 500)
  }
})

// ==================== 管理员功能 ====================

// 获取所有考勤记录（管理员）
attendanceRoutes.get('/admin/records', async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    
    // 检查是否是管理员
    if (!user.isAdmin) {
      return c.json({ success: false, message: '权限不足' }, 403)
    }
    
    const { startDate, endDate, departmentId, page = '1', pageSize = '50' } = c.req.query()
    
    let sql = `
      SELECT ar.*, u.name as user_name, u.department_name 
      FROM attendance_records ar
      LEFT JOIN users u ON ar.user_id = u.id
      WHERE 1=1
    `
    const params: any[] = []
    
    if (startDate) {
      sql += ' AND ar.date >= ?'
      params.push(startDate)
    }
    if (endDate) {
      sql += ' AND ar.date <= ?'
      params.push(endDate)
    }
    
    sql += ' ORDER BY ar.date DESC, u.name ASC LIMIT ? OFFSET ?'
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize))
    
    const stmt = sqlite.prepare(sql)
    const records = stmt.all(...params)
    
    return c.json({ success: true, data: records })
  } catch (error: any) {
    console.error('Get all attendance records error:', error)
    return c.json({ success: false, message: '获取考勤记录失败' }, 500)
  }
})

// 获取待审批请假（按审批人匹配）
attendanceRoutes.get('/admin/leave-pending', authMiddleware, async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    
    const stmt = sqlite.prepare(`
      SELECT lr.*, u.name as user_name, u.department_name 
      FROM leave_requests lr
      LEFT JOIN users u ON lr.user_id = u.id
      WHERE lr.status = 'pending'
      ORDER BY lr.created_at DESC
      LIMIT 50
    `)
    const records = stmt.all()
    
    // 过滤出当前用户需要审批的记录
    const filtered = records.filter((r: any) => {
      const ids = JSON.parse(r.approver_ids || '[]')
      const approvedBy = JSON.parse(r.approved_by || '[]')
      return ids.includes(user.id) && !approvedBy.some((a: any) => a.userId === user.id)
    })
    
    return c.json({ success: true, data: filtered })
  } catch (error: any) {
    console.error('Get pending leave requests error:', error)
    return c.json({ success: false, message: '获取待审批请假失败' }, 500)
  }
})

// 审批请假
attendanceRoutes.put('/admin/leave/:id/approve', authMiddleware, async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    const id = c.req.param('id')
    const body = await c.req.json()

    const leave = sqlite.prepare('SELECT * FROM leave_requests WHERE id = ?').get(id) as any
    if (!leave) return c.json({ success: false, message: '请假记录不存在' }, 404)

    const approverIds: string[] = JSON.parse(leave.approver_ids || '[]')
    let approvedBy: { userId: string; userName: string; time: string }[] = JSON.parse(leave.approved_by || '[]')

    if (!approverIds.includes(user.id)) {
      return c.json({ success: false, message: '您不是该请假的审批人' }, 403)
    }
    if (approvedBy.some(a => a.userId === user.id)) {
      return c.json({ success: false, message: '您已审批过该请假' }, 400)
    }

    if (body.approved === false) {
      sqlite.prepare(`
        UPDATE leave_requests SET status = 'rejected', approver_notes = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(body.notes || null, id)
      return c.json({ success: true, message: '已驳回' })
    }

    approvedBy.push({ userId: user.id, userName: user.name, time: new Date().toISOString() })
    const allApproved = approverIds.every(id => approvedBy.some(a => a.userId === id))

    if (allApproved) {
      sqlite.prepare(`
        UPDATE leave_requests SET status = 'approved', approved_by = ?, approver_notes = ?, approved_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(JSON.stringify(approvedBy), body.notes || null, id)

      // 抄送人事
      if (user.id !== APPROVER_ZHANGGAN) {
        try {
          const { notifySystem } = await import('../services/notification.js')
          const leaveRow = sqlite.prepare('SELECT lr.*, u.name as user_name FROM leave_requests lr LEFT JOIN users u ON lr.user_id = u.id WHERE lr.id = ?').get(id) as any
          if (leaveRow) {
            await notifySystem(APPROVER_ZHANGGAN, '请假审批通过', `${leaveRow.user_name} 的请假申请已通过审批`, `/attendance`)
          }
        } catch (e) {}
      }
    } else {
      sqlite.prepare(`
        UPDATE leave_requests SET approved_by = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(JSON.stringify(approvedBy), id)
    }

    return c.json({ success: true, message: allApproved ? '审批通过' : '已审批，等待其他审批人' })
  } catch (error: any) {
    console.error('Approve leave request error:', error)
    return c.json({ success: false, message: '审批失败' }, 500)
  }
})

// 获取考勤配置
attendanceRoutes.get('/config', async (c) => {
  try {
    const stmt = sqlite.prepare('SELECT * FROM attendance_config')
    const configs = stmt.all()
    
    const configMap: Record<string, string> = {}
    for (const config of configs) {
      configMap[config.key] = config.value
    }
    
    return c.json({ success: true, data: configMap })
  } catch (error: any) {
    console.error('Get attendance config error:', error)
    return c.json({ success: false, message: '获取考勤配置失败' }, 500)
  }
})

// 更新考勤配置
attendanceRoutes.put('/config', requirePermission('canManageAttendanceRules'), async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    
    if (!user.isAdmin) {
      return c.json({ success: false, message: '权限不足' }, 403)
    }
    
    const body = await c.req.json()
    
    for (const [key, value] of Object.entries(body)) {
      const stmt = sqlite.prepare(`
        INSERT INTO attendance_config (id, key, value, updated_at)
        VALUES (lower(hex(randomblob(16))), ?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
      `)
      stmt.run(key, value, value)
    }

    return c.json({ success: true, message: '配置更新成功' })
  } catch (error: any) {
    console.error('Update attendance config error:', error)
    return c.json({ success: false, message: '更新配置失败' }, 500)
  }
})

// ==================== 考勤异常处理 ====================

// 提交异常申诉
attendanceRoutes.post('/exceptions', async (c) => {
  try {
    const user = getUser(c)
    if (!user) return c.json({ success: false, message: "未登录" }, 401)
    
    const body = await c.req.json()
    const stmt = sqlite.prepare(`
      INSERT INTO attendance_exceptions (
        id, user_id, record_date, exception_type, description, evidence, status, created_at, updated_at
      ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
      RETURNING *
    `)
    
    const record = stmt.get(
      user.id,
      body.recordDate,
      body.exceptionType,
      body.description,
      JSON.stringify(body.evidence || [])
    )
    
    return c.json({ success: true, data: record })
  } catch (error: any) {
    console.error('Create exception error:', error)
    return c.json({ success: false, message: '提交申诉失败' }, 500)
  }
})

// 获取我的异常申诉
attendanceRoutes.get('/exceptions/my', async (c) => {
  try {
    const user = getUser(c)
    if (!user) return c.json({ success: false, message: "未登录" }, 401)
    
    const stmt = sqlite.prepare(`
      SELECT ae.*, u.name as handler_name 
      FROM attendance_exceptions ae
      LEFT JOIN users u ON ae.handler_id = u.id
      WHERE ae.user_id = ?
      ORDER BY ae.created_at DESC
    `)
    const records = stmt.all(user.id)
    return c.json({ success: true, data: records })
  } catch (error: any) {
    console.error('Get my exceptions error:', error)
    return c.json({ success: false, message: '获取申诉记录失败' }, 500)
  }
})

// 管理员获取所有异常申诉
attendanceRoutes.get('/exceptions/admin', async (c) => {
  try {
    const user = getUser(c)
    if (!user || !user.isAdmin) return c.json({ success: false, message: '权限不足' }, 403)
    
    const { status } = c.req.query()
    let sql = `
      SELECT ae.*, u.name as user_name, h.name as handler_name 
      FROM attendance_exceptions ae
      LEFT JOIN users u ON ae.user_id = u.id
      LEFT JOIN users h ON ae.handler_id = h.id
      WHERE 1=1
    `
    const params: any[] = []
    if (status) {
      sql += ' AND ae.status = ?'
      params.push(status)
    }
    sql += ' ORDER BY ae.created_at DESC LIMIT 200'
    
    const stmt = sqlite.prepare(sql)
    const records = stmt.all(...params)
    return c.json({ success: true, data: records })
  } catch (error: any) {
    console.error('Get admin exceptions error:', error)
    return c.json({ success: false, message: '获取异常申诉失败' }, 500)
  }
})

// 处理异常申诉
attendanceRoutes.put('/exceptions/:id/handle', requirePermission('canManageAttendanceRules'), async (c) => {
  try {
    const user = getUser(c)
    if (!user || !user.isAdmin) return c.json({ success: false, message: '权限不足' }, 403)
    
    const id = c.req.param('id')
    const body = await c.req.json()
    
    const stmt = sqlite.prepare(`
      UPDATE attendance_exceptions 
      SET status = ?, handler_id = ?, handler_notes = ?, handled_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `)
    const record = stmt.get(body.status, user.id, body.notes || null, id)
    
    // 如果批准，同步更新考勤记录状态
    if (body.status === 'approved' && record) {
      const rec = record as any
      sqlite.prepare(`
        UPDATE attendance_records 
        SET exception_status = 'resolved', status = 'normal', updated_at = datetime('now')
        WHERE user_id = ? AND date = ?
      `).run(rec.user_id, rec.record_date)
    }
    
    return c.json({ success: true, data: record })
  } catch (error: any) {
    console.error('Handle exception error:', error)
    return c.json({ success: false, message: '处理申诉失败' }, 500)
  }
})

// 获取考勤配置
attendanceRoutes.get('/config', async (c) => {
  try {
    const user = getUser(c)
    if (!user) return c.json({ success: false, message: "未登录" }, 401)
    
    const stmt = sqlite.prepare('SELECT key, value, description FROM attendance_config')
    const configs = stmt.all() as any[]
    
    const configMap: Record<string, any> = {}
    for (const cfg of configs) {
      configMap[cfg.key] = {
        value: cfg.value,
        description: cfg.description
      }
    }
    
    return c.json({ success: true, data: configMap })
  } catch (error: any) {
    console.error('Get config error:', error)
    return c.json({ success: false, message: '获取配置失败' }, 500)
  }
})

// ==================== 日历规则（单双休）====================

// 获取日历数据
attendanceRoutes.get('/calendar', async (c) => {
  const user = getUser(c)
  if (!user) return c.json({ success: false, message: "未登录" }, 401)
  
  try {
    const year = c.req.query('year') || new Date().getFullYear()
    const month = c.req.query('month') || (new Date().getMonth() + 1)
    
    // 获取节假日
    const holidayStmt = sqlite.prepare(`
      SELECT date, name, type FROM holidays 
      WHERE strftime('%Y', date) = ? AND strftime('%m', date) = ?
      ORDER BY date
    `)
    const holidays = holidayStmt.all(String(year), String(month).padStart(2, '0'))
    
    // 获取日历配置
    const configStmt = sqlite.prepare('SELECT reference_date, week_type as reference_week_type FROM attendance_rules ORDER BY created_at DESC LIMIT 1')
    const calendarConfig = configStmt.get()
    
    return c.json({
      success: true,
      data: {
        holidays,
        makeupDays: holidays.filter((h: any) => h.type === 'makeup'),
        calendarConfig
      }
    })
  } catch (error: any) {
    console.error('Get calendar error:', error)
    return c.json({ success: false, message: '获取日历数据失败' }, 500)
  }
})

// 更新日历规则
attendanceRoutes.put('/calendar-rules', requirePermission('canManageAttendanceRules'), async (c) => {
  const user = getUser(c)
  if (!user) return c.json({ success: false, message: "未登录" }, 401)
  if (!user.isAdmin) return c.json({ success: false, message: '权限不足' }, 403)
  
  try {
    const body = await c.req.json()
    
    // 更新基准配置（使用 attendance_rules 表）
    // 先删除旧规则，再插入新规则
    sqlite.prepare(`DELETE FROM attendance_rules`).run()
    const configStmt = sqlite.prepare(`
      INSERT INTO attendance_rules (id, reference_date, week_type, description, created_by, created_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, '单双休基准规则', ?, datetime('now'))
    `)
    configStmt.run(body.referenceDate, body.referenceWeekType, user.id)
    
    // 更新节假日（先删除该年数据，再插入）
    if (body.holidays) {
      // 删除旧数据
      const year = new Date().getFullYear()
      sqlite.prepare(`DELETE FROM holidays WHERE strftime('%Y', date) = ?`).run(String(year))
      
      // 插入新数据
      const insertStmt = sqlite.prepare(`
        INSERT INTO holidays (id, date, name, type, year, created_at)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, datetime('now'))
      `)
      for (const holiday of body.holidays) {
        const date = typeof holiday === 'string' ? holiday : holiday.date
        const name = typeof holiday === 'string' ? '节假日' : (holiday.name || '节假日')
        insertStmt.run(date, name, 'holiday', year)
      }
    }
    
    // 更新补班日
    if (body.makeupDays) {
      const year = new Date().getFullYear()
      const insertStmt = sqlite.prepare(`
        INSERT INTO holidays (id, date, name, type, year, created_at)
        VALUES (lower(hex(randomblob(16))), ?, '补班', 'makeup', ?, datetime('now'))
      `)
      for (const date of body.makeupDays) {
        insertStmt.run(date, year)
      }
    }
    
    return c.json({ success: true, message: '日历规则保存成功' })
  } catch (error: any) {
    console.error('Save calendar rules error:', error)
    return c.json({ success: false, message: '保存日历规则失败' }, 500)
  }
})

// 节假日CRUD
attendanceRoutes.post('/holidays', requirePermission('canManageAttendanceRules'), async (c) => {
  const user = getUser(c)
  if (!user) return c.json({ success: false, message: "未登录" }, 401)
  
  try {
    const body = await c.req.json()
    const stmt = sqlite.prepare(`
      INSERT INTO holidays (id, date, name, type, year, description, created_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, datetime('now'))
      RETURNING *
    `)
    const year = new Date(body.date).getFullYear()
    const holiday = stmt.get(body.date, body.name, body.type, year, body.description || null)
    return c.json({ success: true, data: holiday }, 201)
  } catch (error: any) {
    console.error('Create holiday error:', error)
    return c.json({ success: false, message: '创建节假日失败' }, 500)
  }
})

attendanceRoutes.put('/holidays/:id', requirePermission('canManageAttendanceRules'), async (c) => {
  const user = getUser(c)
  if (!user) return c.json({ success: false, message: "未登录" }, 401)
  
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const stmt = sqlite.prepare(`
      UPDATE holidays
      SET date = COALESCE(?, date),
          name = COALESCE(?, name),
          type = COALESCE(?, type),
          year = COALESCE(?, year),
          description = COALESCE(?, description),
          updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `)
    const year = body.date ? new Date(body.date).getFullYear() : null
    const holiday = stmt.get(
      body.date || null,
      body.name || null,
      body.type || null,
      year,
      body.description !== undefined ? body.description : null,
      id
    )
    return c.json({ success: true, data: holiday })
  } catch (error: any) {
    console.error('Update holiday error:', error)
    return c.json({ success: false, message: '更新节假日失败' }, 500)
  }
})

attendanceRoutes.delete('/holidays/:id', requirePermission('canManageAttendanceRules'), async (c) => {
  const user = getUser(c)
  if (!user) return c.json({ success: false, message: "未登录" }, 401)
  
  try {
    const id = c.req.param('id')
    sqlite.prepare('DELETE FROM holidays WHERE id = ?').run(id)
    return c.json({ success: true, message: '删除成功' })
  } catch (error: any) {
    console.error('Delete holiday error:', error)
    return c.json({ success: false, message: '删除节假日失败' }, 500)
  }
})

// 判断某天是否工作日
attendanceRoutes.get('/is-work-day', async (c) => {
  const user = getUser(c)
  if (!user) return c.json({ success: false, message: "未登录" }, 401)
  
  try {
    const date = c.req.query('date')
    if (!date) return c.json({ success: false, message: '请提供日期' }, 400)
    
    const dateObj = new Date(date)
    const dayOfWeek = dateObj.getDay()
    
    // 检查是否是节假日
    const holidayStmt = sqlite.prepare('SELECT type FROM holidays WHERE date = ?')
    const holiday = holidayStmt.get(date)
    
    if (holiday) {
      if (holiday.type === 'holiday') {
        return c.json({ success: true, data: { isWorkDay: false, reason: '法定节假日' } })
      }
      if (holiday.type === 'makeup') {
        return c.json({ success: true, data: { isWorkDay: true, reason: '补班日' } })
      }
    }
    
    // 周日休息
    if (dayOfWeek === 0) {
      return c.json({ success: true, data: { isWorkDay: false, reason: '周日休息' } })
    }
    
    // 周六：根据单双周判断
    if (dayOfWeek === 6) {
      const configStmt = sqlite.prepare('SELECT reference_date, week_type as reference_week_type FROM attendance_rules ORDER BY created_at DESC LIMIT 1')
      const config = configStmt.get()
      
      if (!config || !config.reference_date) {
        return c.json({ success: true, data: { isWorkDay: true, reason: '默认上班' } })
      }
      
      const refDate = new Date(config.reference_date)
      const refWeek = getWeekNumber(refDate)
      const currentWeek = getWeekNumber(dateObj)
      const weekDiff = Math.abs(currentWeek - refWeek)
      const isSingleWeek = weekDiff % 2 === 0
      const shouldWork = config.reference_week_type === 'single' ? isSingleWeek : !isSingleWeek
      
      return c.json({
        success: true,
        data: {
          isWorkDay: shouldWork,
          reason: shouldWork ? '周六上班（单休周）' : '周六休息（双休周）'
        }
      })
    }
    
    // 周一到周五默认上班
    return c.json({ success: true, data: { isWorkDay: true, reason: '工作日' } })
  } catch (error: any) {
    console.error('Check work day error:', error)
    return c.json({ success: false, message: '查询失败' }, 500)
  }
})

// 辅助函数：获取周数
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
