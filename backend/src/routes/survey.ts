// @ts-nocheck
import { getUser } from '../types/user'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { projects, surveyProjects, surveyProjectStages, surveyStageTemplates, surveyDeliverables, surveyEquipment, surveyFieldRecords } from '../schema/index.js'
import { eq, desc, and } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'

const sqlite = (db as any).$client

export const surveyRoutes = new Hono()

surveyRoutes.use('*', authMiddleware)

// ==================== 测绘项目管理 ====================

// 创建测绘项目（同时创建基础项目和测绘扩展信息）
surveyRoutes.post('/projects', async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    const body = await c.req.json()
    
    // 1. 创建基础项目
    const projectStmt = sqlite.prepare(`
      INSERT INTO projects (id, name, description, owner_id, status, progress, members, settings, created_at, updated_at)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, 'assigned', 0, ?, '{}', datetime('now'), datetime('now'))
      RETURNING *
    `)
    const project = projectStmt.get(
      body.name,
      body.description || null,
      user.id,
      JSON.stringify(body.members || [])
    )

    // 2. 创建测绘项目扩展信息
    const surveyStmt = sqlite.prepare(`
      INSERT INTO survey_projects (
        id, project_id, project_type, contract_number, client_name, client_contact, client_phone,
        location, area_size, coordinates, scale, accuracy, coordinate_system, elevation_system,
        current_stage, contract_amount, planned_start_date, planned_end_date, created_at, updated_at
      ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'preparation', ?, ?, ?, datetime('now'), datetime('now'))
      RETURNING *
    `)
    const surveyProject = surveyStmt.get(
      project.id,
      body.projectType || 'topographic',
      body.contractNumber || null,
      body.clientName || null,
      body.clientContact || null,
      body.clientPhone || null,
      body.location || null,
      body.areaSize || null,
      body.coordinates ? JSON.stringify(body.coordinates) : null,
      body.scale || null,
      body.accuracy || null,
      body.coordinateSystem || null,
      body.elevationSystem || null,
      body.contractAmount || null,
      body.plannedStartDate || null,
      body.plannedEndDate || null
    )

    // 3. 根据项目类型自动创建工序
    const templates = await db.query.surveyStageTemplates.findMany({
      where: and(
        eq(surveyStageTemplates.projectType, body.projectType || 'topographic'),
        eq(surveyStageTemplates.isActive, 1)
      ),
      orderBy: surveyStageTemplates.order
    })

    for (const template of templates) {
      const stageStmt = sqlite.prepare(`
        INSERT INTO survey_project_stages (
          id, survey_project_id, stage_name, stage_code, description, "order",
          status, planned_start_date, planned_end_date, created_at, updated_at
        ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))
      `)
      stageStmt.run(
        surveyProject.id,
        template.stageName,
        template.stageCode,
        template.description,
        template.order,
        null, // planned_start_date
        null  // planned_end_date
      )
    }

    return c.json({ 
      success: true, 
      data: { ...project, surveyInfo: surveyProject, stages: templates.length }
    }, 201)
  } catch (error: any) {
    console.error('Create survey project error:', error)
    return c.json({ success: false, message: '创建测绘项目失败: ' + error.message }, 500)
  }
})

// 获取测绘项目列表
surveyRoutes.get('/projects', async (c) => {
  try {
    const type = c.req.query('type')
    const status = c.req.query('status')
    const page = parseInt(c.req.query('page') as string) || 1
    const pageSize = parseInt(c.req.query('pageSize') as string) || 10
    const offset = (page - 1) * pageSize
    
    // 获取所有项目
    const projectList = await db.query.projects.findMany({
      orderBy: desc(projects.updatedAt),
      with: {
        owner: true
      }
    })

    // 获取测绘项目信息
    const surveyList = await db.query.surveyProjects.findMany()
    const surveyMap = new Map(surveyList.map(s => [s.projectId, s]))

    // 合并数据
    const enrichedList = projectList.map(p => ({
      ...p,
      surveyInfo: surveyMap.get(p.id) || null
    }))

    // 过滤
    let filteredList = enrichedList
    if (type) {
      filteredList = filteredList.filter(p => p.surveyInfo?.projectType === type)
    }
    if (status) {
      filteredList = filteredList.filter(p => p.status === status)
    }

    const total = filteredList.length
    const paginatedList = filteredList.slice(offset, offset + pageSize)

    return c.json({ success: true, data: paginatedList, total, page, pageSize })
  } catch (error: any) {
    console.error('Get survey projects error:', error)
    return c.json({ success: false, message: '获取项目列表失败' }, 500)
  }
})

// 获取测绘项目详情
surveyRoutes.get('/projects/:id', async (c) => {
  try {
    const id = c.req.param('id')
    
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: { owner: true }
    })
    
    if (!project) {
      return c.json({ success: false, message: '项目不存在' }, 404)
    }

    const surveyInfo = await db.query.surveyProjects.findFirst({
      where: eq(surveyProjects.projectId, id)
    })

    // 获取工序列表
    let stages = []
    if (surveyInfo) {
      stages = await db.query.surveyProjectStages.findMany({
        where: eq(surveyProjectStages.surveyProjectId, surveyInfo.id),
        orderBy: surveyProjectStages.order,
        with: { manager: true }
      })
    }

    return c.json({ 
      success: true, 
      data: { ...project, surveyInfo, stages }
    })
  } catch (error: any) {
    console.error('Get survey project error:', error)
    return c.json({ success: false, message: '获取项目详情失败' }, 500)
  }
})

// 更新工序状态
surveyRoutes.put('/stages/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    
    const updates: any = {}
    if (body.status !== undefined) updates.status = body.status
    if (body.progress !== undefined) updates.progress = body.progress
    if (body.managerId !== undefined) updates.manager_id = body.managerId
    if (body.plannedStartDate !== undefined) updates.planned_start_date = body.plannedStartDate
    if (body.plannedEndDate !== undefined) updates.planned_end_date = body.plannedEndDate
    if (body.actualStartDate !== undefined) updates.actual_start_date = body.actualStartDate
    if (body.actualEndDate !== undefined) updates.actual_end_date = body.actualEndDate
    if (body.notes !== undefined) updates.notes = body.notes
    updates.updated_at = new Date().toISOString()

    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(updates)

    const stmt = sqlite.prepare(`
      UPDATE survey_project_stages SET ${setClause} WHERE id = ? RETURNING *
    `)
    const stage = stmt.get(...values, id)

    return c.json({ success: true, data: stage })
  } catch (error: any) {
    console.error('Update stage error:', error)
    return c.json({ success: false, message: '更新工序失败' }, 500)
  }
})

// ==================== 工序模板管理 ====================

// 获取工序模板列表
surveyRoutes.get('/stage-templates', async (c) => {
  try {
    const projectType = c.req.query('projectType')
    
    let list = await db.query.surveyStageTemplates.findMany({
      where: projectType ? eq(surveyStageTemplates.projectType, projectType) : undefined,
      orderBy: [surveyStageTemplates.projectType, surveyStageTemplates.order]
    })

    return c.json({ success: true, data: list })
  } catch (error: any) {
    console.error('Get stage templates error:', error)
    return c.json({ success: false, message: '获取工序模板失败' }, 500)
  }
})

// ==================== 设备管理 ====================

// 获取设备列表
surveyRoutes.get('/equipment', async (c) => {
  try {
    const status = c.req.query('status')
    const type = c.req.query('type')
    
    let list = await db.query.surveyEquipment.findMany({
      where: and(
        status ? eq(surveyEquipment.status, status) : undefined,
        type ? eq(surveyEquipment.type, type) : undefined
      ),
      with: { keeper: true, currentProject: true },
      orderBy: desc(surveyEquipment.updatedAt)
    })

    return c.json({ success: true, data: list })
  } catch (error: any) {
    console.error('Get equipment error:', error)
    return c.json({ success: false, message: '获取设备列表失败' }, 500)
  }
})

// 创建设备
surveyRoutes.post('/equipment', async (c) => {
  try {
    const body = await c.req.json()
    
    const stmt = sqlite.prepare(`
      INSERT INTO survey_equipment (
        id, name, model, serial_number, type, manufacturer, purchase_date,
        calibration_date, next_calibration_date, status, location, notes, created_at, updated_at
      ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, datetime('now'), datetime('now'))
      RETURNING *
    `)
    
    const equipment = stmt.get(
      body.name,
      body.model || null,
      body.serialNumber,
      body.type,
      body.manufacturer || null,
      body.purchaseDate || null,
      body.calibrationDate || null,
      body.nextCalibrationDate || null,
      body.location || null,
      body.notes || null
    )

    return c.json({ success: true, data: equipment }, 201)
  } catch (error: any) {
    console.error('Create equipment error:', error)
    return c.json({ success: false, message: '创建设备失败' }, 500)
  }
})

// ==================== 外业记录管理 ====================

// 获取外业记录列表
surveyRoutes.get('/field-records', async (c) => {
  try {
    const projectId = c.req.query('projectId')
    
    let list = await db.query.surveyFieldRecords.findMany({
      where: projectId ? eq(surveyFieldRecords.surveyProjectId, projectId) : undefined,
      with: { surveyProject: true, stage: true, recorder: true },
      orderBy: desc(surveyFieldRecords.recordDate)
    })

    return c.json({ success: true, data: list })
  } catch (error: any) {
    console.error('Get field records error:', error)
    return c.json({ success: false, message: '获取外业记录失败' }, 500)
  }
})

// 创建外业记录
surveyRoutes.post('/field-records', async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    const body = await c.req.json()
    
    const stmt = sqlite.prepare(`
      INSERT INTO survey_field_records (
        id, survey_project_id, stage_id, record_date, weather, temperature,
        team_leader, team_members, equipment_used, work_content, work_area,
        progress, issues, solutions, photos, attachments, recorder_id, created_at, updated_at
      ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      RETURNING *
    `)
    
    const record = stmt.get(
      body.surveyProjectId,
      body.stageId || null,
      body.recordDate,
      body.weather || null,
      body.temperature || null,
      body.teamLeader || null,
      JSON.stringify(body.teamMembers || []),
      JSON.stringify(body.equipmentUsed || []),
      body.workContent || null,
      body.workArea || null,
      body.progress || null,
      body.issues || null,
      body.solutions || null,
      JSON.stringify(body.photos || []),
      JSON.stringify(body.attachments || []),
      user.id
    )

    return c.json({ success: true, data: record }, 201)
  } catch (error: any) {
    console.error('Create field record error:', error)
    return c.json({ success: false, message: '创建外业记录失败' }, 500)
  }
})

// ==================== 成果管理 ====================

// 获取成果列表
surveyRoutes.get('/deliverables', async (c) => {
  try {
    const projectId = c.req.query('projectId')
    
    let list = await db.query.surveyDeliverables.findMany({
      where: projectId ? eq(surveyDeliverables.surveyProjectId, projectId) : undefined,
      with: { surveyProject: true, stage: true },
      orderBy: desc(surveyDeliverables.createdAt)
    })

    return c.json({ success: true, data: list })
  } catch (error: any) {
    console.error('Get deliverables error:', error)
    return c.json({ success: false, message: '获取成果列表失败' }, 500)
  }
})

// 创建成果
surveyRoutes.post('/deliverables', async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    const body = await c.req.json()
    
    const stmt = sqlite.prepare(`
      INSERT INTO survey_deliverables (
        id, survey_project_id, stage_id, name, type, format, description,
        file_path, file_size, version, status, submitted_by, created_at, updated_at
      ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, datetime('now'), datetime('now'))
      RETURNING *
    `)
    
    const deliverable = stmt.get(
      body.surveyProjectId,
      body.stageId || null,
      body.name,
      body.type,
      body.format || null,
      body.description || null,
      body.filePath || null,
      body.fileSize || null,
      body.version || '1.0',
      user.id
    )

    return c.json({ success: true, data: deliverable }, 201)
  } catch (error: any) {
    console.error('Create deliverable error:', error)
    return c.json({ success: false, message: '创建成果失败' }, 500)
  }
})

// 删除成果
surveyRoutes.delete('/deliverables/:id', async (c) => {
  try {
    const id = c.req.param('id')
    
    const stmt = sqlite.prepare('DELETE FROM survey_deliverables WHERE id = ?')
    stmt.run(id)

    return c.json({ success: true })
  } catch (error: any) {
    console.error('Delete deliverable error:', error)
    return c.json({ success: false, message: '删除成果失败' }, 500)
  }
})

// 审核成果
surveyRoutes.put('/deliverables/:id/review', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    
    const stmt = sqlite.prepare(`
      UPDATE survey_deliverables 
      SET status = ?, reviewer_id = ?, review_date = datetime('now'), review_comments = ?, updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `)
    
    const deliverable = stmt.get(body.status, body.reviewerId || null, body.comments || null, id)

    return c.json({ success: true, data: deliverable })
  } catch (error: any) {
    console.error('Review deliverable error:', error)
    return c.json({ success: false, message: '审核成果失败' }, 500)
  }
})

// ==================== 甘特图与可视化管控 ====================

// 获取项目甘特图数据
surveyRoutes.get('/gantt/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    
    // 获取项目基本信息
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: { owner: true }
    })
    
    if (!project) {
      return c.json({ success: false, message: '项目不存在' }, 404)
    }

    // 获取测绘项目信息
    const surveyInfo = await db.query.surveyProjects.findFirst({
      where: eq(surveyProjects.projectId, projectId)
    })

    // 获取所有工序
    let stages = []
    if (surveyInfo) {
      stages = await db.query.surveyProjectStages.findMany({
        where: eq(surveyProjectStages.surveyProjectId, surveyInfo.id),
        orderBy: surveyProjectStages.order,
        with: { manager: true }
      })
    }

    // 如果没有工序数据，添加演示数据
    if (stages.length === 0) {
      stages = [
        { id: '1', stageName: '项目立项', stageCode: 'preparation', status: 'in_progress', progress: 30, plannedStartDate: '2026-02-01', plannedEndDate: '2026-02-07', order: 1 },
        { id: '2', stageName: '技术设计', stageCode: 'design', status: 'pending', progress: 0, plannedStartDate: '2026-02-08', plannedEndDate: '2026-02-15', order: 2 },
        { id: '3', stageName: '控制测量', stageCode: 'control', status: 'pending', progress: 0, plannedStartDate: '2026-02-16', plannedEndDate: '2026-02-28', order: 3 },
        { id: '4', stageName: '图根测量', stageCode: 'root_control', status: 'pending', progress: 0, plannedStartDate: '2026-03-01', plannedEndDate: '2026-03-10', order: 4 },
        { id: '5', stageName: '外业采集', stageCode: 'field_work', status: 'pending', progress: 0, plannedStartDate: '2026-03-11', plannedEndDate: '2026-03-20', order: 5 },
      ]
    }

    // 转换为甘特图数据格式
    const ganttData = stages.map((stage: any, idx: number) => {
      // 演示数据：如果日期为空，使用默认日期
      const demoDates = [
        { start: '2026-02-01', end: '2026-02-07' },
        { start: '2026-02-08', end: '2026-02-15' },
        { start: '2026-02-16', end: '2026-02-28' },
        { start: '2026-03-01', end: '2026-03-10' },
        { start: '2026-03-11', end: '2026-03-20' },
        { start: '2026-03-21', end: '2026-03-25' },
        { start: '2026-03-26', end: '2026-03-31' },
        { start: '2026-04-01', end: '2026-04-05' },
        { start: '2026-04-06', end: '2026-04-10' },
      ]
      const demo = demoDates[idx] || { start: null, end: null }

      return {
        id: stage.id,
        name: stage.stageName,
        code: stage.stageCode,
        start: stage.actualStartDate || stage.plannedStartDate || demo.start,
        end: stage.actualEndDate || stage.plannedEndDate || demo.end,
        progress: stage.progress || 0,
        status: stage.status,
        duration: (stage.plannedStartDate && stage.plannedEndDate) || demo.start ? 
          Math.ceil((new Date(stage.plannedEndDate || demo.end).getTime() - new Date(stage.plannedStartDate || demo.start).getTime()) / (1000 * 60 * 60 * 24)) : null,
        manager: stage.manager?.name || null,
        dependencies: stage.order > 1 ? [stages.find((s: any) => s.order === stage.order - 1)?.id] : [],
        type: 'task'
      }
    })

    // 里程碑数据
    const milestones = [
      {
        id: 'start',
        name: '项目启动',
        date: project.startDate || surveyInfo?.actualStartDate || project.createdAt,
        type: 'milestone'
      },
      {
        id: 'complete',
        name: '项目完成',
        date: project.endDate || surveyInfo?.actualEndDate,
        type: 'milestone'
      }
    ].filter(m => m.date)

    return c.json({
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          startDate: project.startDate || surveyInfo?.plannedStartDate,
          endDate: project.endDate || surveyInfo?.plannedEndDate,
          progress: project.progress || 0
        },
        tasks: ganttData,
        milestones
      }
    })
  } catch (error: any) {
    console.error('Get gantt data error:', error)
    return c.json({ success: false, message: '获取甘特图数据失败' }, 500)
  }
})

// 获取项目进度统计（仪表盘用）
surveyRoutes.get('/dashboard/stats', async (c) => {
  try {
    const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
    
    // 获取所有测绘项目
    const surveyProjectList = await db.query.surveyProjects.findMany()
    const projectIds = surveyProjectList.map((sp: any) => sp.projectId)
    
    // 获取项目基本信息
    const projectList = await db.query.projects.findMany({
      where: projectIds.length > 0 ? undefined : undefined,
      with: { owner: true }
    })
    
    // 统计各类项目数量
    const stats = {
      total: surveyProjectList.length,
      byType: {} as Record<string, number>,
      byStatus: {
        assigned: 0,
        in_progress: 0,
        completed: 0
      },
      totalContract: 0,
      totalReceived: 0,
      stageProgress: {} as Record<string, { total: number, completed: number }>
    }

    for (const sp of surveyProjectList) {
      // 按类型统计
      stats.byType[sp.projectType] = (stats.byType[sp.projectType] || 0) + 1
      
      // 合同金额
      stats.totalContract += sp.contractAmount || 0
      stats.totalReceived += sp.receivedAmount || 0
    }

    // 项目状态统计
    for (const p of projectList) {
      if (p.status === 'assigned') stats.byStatus.assigned++
      else if (p.status === 'in_progress') stats.byStatus.in_progress++
      else if (p.status === 'completed') stats.byStatus.completed++
    }

    // 工序进度统计
    const allStages = await db.query.surveyProjectStages.findMany()
    for (const stage of allStages) {
      if (!stats.stageProgress[stage.stageName]) {
        stats.stageProgress[stage.stageName] = { total: 0, completed: 0 }
      }
      stats.stageProgress[stage.stageName].total++
      if (stage.status === 'completed') {
        stats.stageProgress[stage.stageName].completed++
      }
    }

    // 近期项目（最近5个）
    const recentProjects = projectList
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((p: any) => {
        const sp = surveyProjectList.find((s: any) => s.projectId === p.id)
        return {
          id: p.id,
          name: p.name,
          type: sp?.projectType,
          status: p.status,
          progress: sp?.stageProgress || 0
        }
      })

    return c.json({
      success: true,
      data: {
        ...stats,
        recentProjects
      }
    })
  } catch (error: any) {
    console.error('Get dashboard stats error:', error)
    return c.json({ success: false, message: '获取统计失败' }, 500)
  }
})

// 获取工序进度时间线
surveyRoutes.get('/timeline/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    
    const surveyInfo = await db.query.surveyProjects.findFirst({
      where: eq(surveyProjects.projectId, projectId)
    })

    if (!surveyInfo) {
      return c.json({ success: false, message: '测绘项目不存在' }, 404)
    }

    // 获取所有工序
    const stages = await db.query.surveyProjectStages.findMany({
      where: eq(surveyProjectStages.surveyProjectId, surveyInfo.id),
      orderBy: surveyProjectStages.order,
      with: { manager: true }
    })

    // 构建时间线数据
    const timeline = stages.map((stage: any, index: number) => ({
      id: stage.id,
      title: stage.stageName,
      description: stage.description,
      status: stage.status,
      progress: stage.progress,
      date: stage.actualEndDate || stage.plannedEndDate,
      color: stage.status === 'completed' ? '#52c41a' : 
             stage.status === 'in_progress' ? '#1890ff' : 
             '#d9d9d9',
      icon: index === 0 ? 'flag' : index === stages.length - 1 ? 'check-circle' : 'tool',
      manager: stage.manager?.name,
      notes: stage.notes
    }))

    return c.json({
      success: true,
      data: {
        currentStage: surveyInfo.currentStage,
        overallProgress: surveyInfo.stageProgress,
        timeline
      }
    })
  } catch (error: any) {
    console.error('Get timeline error:', error)
    return c.json({ success: false, message: '获取时间线失败' }, 500)
  }
})

// 更新项目整体进度（根据工序自动计算）
surveyRoutes.post('/update-progress/:projectId', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    
    const surveyInfo = await db.query.surveyProjects.findFirst({
      where: eq(surveyProjects.projectId, projectId)
    })

    if (!surveyInfo) {
      return c.json({ success: false, message: '测绘项目不存在' }, 404)
    }

    // 获取所有工序
    const stages = await db.query.surveyProjectStages.findMany({
      where: eq(surveyProjectStages.surveyProjectId, surveyInfo.id)
    })

    // 计算整体进度
    const totalStages = stages.length
    const completedStages = stages.filter((s: any) => s.status === 'completed').length
    const inProgressStages = stages.filter((s: any) => s.status === 'in_progress').length
    const overallProgress = Math.round((completedStages * 100 + inProgressStages * 50) / totalStages)

    // 确定当前阶段
    const currentStage = stages.find((s: any) => s.status === 'in_progress')?.stageName || 
                        stages.find((s: any) => s.status === 'pending')?.stageName ||
                        '已完成'

    // 更新测绘项目进度
    const stmt = sqlite.prepare(`
      UPDATE survey_projects 
      SET stage_progress = ?, current_stage = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    stmt.run(overallProgress, currentStage, surveyInfo.id)

    // 同步更新主项目进度
    const projectStmt = sqlite.prepare(`
      UPDATE projects 
      SET progress = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    projectStmt.run(overallProgress, projectId)

    return c.json({
      success: true,
      data: {
        overallProgress,
        currentStage,
        completedStages,
        totalStages
      }
    })
  } catch (error: any) {
    console.error('Update progress error:', error)
    return c.json({ success: false, message: '更新进度失败' }, 500)
  }
})

// ==================== 项目团队管理 ====================

// 获取项目团队成员
surveyRoutes.get('/projects/:projectId/team', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    
    // 获取项目成员列表
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      with: { owner: true }
    })

    if (!project) {
      return c.json({ success: false, message: '项目不存在' }, 404)
    }

    // 获取所有用户作为候选成员
    const allUsers = await db.query.users.findMany({
      where: eq(users.isActive, true)
    })

    // 获取测绘项目特定的工序负责人信息
    const surveyInfo = await db.query.surveyProjects.findFirst({
      where: eq(surveyProjects.projectId, projectId)
    })

    let stageManagers: any[] = []
    if (surveyInfo) {
      const stages = await db.query.surveyProjectStages.findMany({
        where: eq(surveyProjectStages.surveyProjectId, surveyInfo.id),
        with: { manager: true }
      })
      stageManagers = stages.filter((s: any) => s.manager).map((s: any) => ({
        stageId: s.id,
        stageName: s.stageName,
        userId: s.manager.id,
        userName: s.manager.name,
        role: 'stage_manager'
      }))
    }

    return c.json({
      success: true,
      data: {
        owner: project.owner,
        members: project.members || [],
        stageManagers,
        availableUsers: allUsers.map((u: any) => ({ id: u.id, name: u.name, department: u.departmentName }))
      }
    })
  } catch (error: any) {
    console.error('Get project team error:', error)
    return c.json({ success: false, message: '获取项目团队失败' }, 500)
  }
})

// 更新项目成员
surveyRoutes.post('/projects/:projectId/team', async (c) => {
  try {
    const projectId = c.req.param('projectId')
    const body = await c.req.json()
    
    const stmt = sqlite.prepare(`
      UPDATE projects 
      SET members = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    stmt.run(JSON.stringify(body.members || []), projectId)

    return c.json({ success: true, message: '项目成员更新成功' })
  } catch (error: any) {
    console.error('Update project team error:', error)
    return c.json({ success: false, message: '更新项目成员失败' }, 500)
  }
})

// 设置工序负责人
surveyRoutes.post('/stages/:stageId/assign', async (c) => {
  try {
    const stageId = c.req.param('stageId')
    const body = await c.req.json()
    
    const stmt = sqlite.prepare(`
      UPDATE survey_project_stages 
      SET manager_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    stmt.run(body.managerId, stageId)

    return c.json({ success: true, message: '负责人设置成功' })
  } catch (error: any) {
    console.error('Assign stage manager error:', error)
    return c.json({ success: false, message: '设置负责人失败' }, 500)
  }
})

// ==================== 设备管理 ====================

// 获取设备列表
surveyRoutes.get('/equipment', async (c) => {
  try {
    const status = c.req.query('status')
    const type = c.req.query('type')
    
    let query = db.query.surveyEquipment.findMany({
      with: { currentProject: true, keeper: true },
      orderBy: desc(surveyEquipment.createdAt)
    })

    let list = await query

    // 手动过滤（SQLite兼容）
    if (status) {
      list = list.filter((e: any) => e.status === status)
    }
    if (type) {
      list = list.filter((e: any) => e.type === type)
    }

    return c.json({ success: true, data: list })
  } catch (error: any) {
    console.error('Get equipment error:', error)
    return c.json({ success: false, message: '获取设备列表失败' }, 500)
  }
})

// 创建设备
surveyRoutes.post('/equipment', async (c) => {
  try {
    const body = await c.req.json()
    
    const stmt = sqlite.prepare(`
      INSERT INTO survey_equipment (
        id, name, model, serial_number, type, manufacturer, purchase_date,
        calibration_date, next_calibration_date, status, keeper_id, location, notes, created_at, updated_at
      ) VALUES (
        lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
      )
      RETURNING *
    `)
    
    const equipment = stmt.get(
      body.name,
      body.model || null,
      body.serialNumber || null,
      body.type || null,
      body.manufacturer || null,
      body.purchaseDate || null,
      body.calibrationDate || null,
      body.nextCalibrationDate || null,
      body.status || 'available',
      body.keeperId || null,
      body.location || null,
      body.notes || null
    )

    return c.json({ success: true, data: equipment })
  } catch (error: any) {
    console.error('Create equipment error:', error)
    return c.json({ success: false, message: '创建设备失败' }, 500)
  }
})

// 更新设备
surveyRoutes.put('/equipment/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    
    const stmt = sqlite.prepare(`
      UPDATE survey_equipment 
      SET name = ?, model = ?, serial_number = ?, type = ?, manufacturer = ?,
          calibration_date = ?, next_calibration_date = ?, status = ?, keeper_id = ?, location = ?, notes = ?,
          updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `)
    
    const equipment = stmt.get(
      body.name,
      body.model || null,
      body.serialNumber || null,
      body.type || null,
      body.manufacturer || null,
      body.calibrationDate || null,
      body.nextCalibrationDate || null,
      body.status || 'available',
      body.keeperId || null,
      body.location || null,
      body.notes || null,
      id
    )

    return c.json({ success: true, data: equipment })
  } catch (error: any) {
    console.error('Update equipment error:', error)
    return c.json({ success: false, message: '更新设备失败' }, 500)
  }
})

// 分配设备到项目
surveyRoutes.post('/equipment/:id/assign', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    
    const stmt = sqlite.prepare(`
      UPDATE survey_equipment 
      SET current_project_id = ?, status = 'in_use', updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `)
    
    const equipment = stmt.get(body.projectId, id)

    return c.json({ success: true, data: equipment })
  } catch (error: any) {
    console.error('Assign equipment error:', error)
    return c.json({ success: false, message: '分配设备失败' }, 500)
  }
})

// 归还设备
surveyRoutes.post('/equipment/:id/return', async (c) => {
  try {
    const id = c.req.param('id')
    
    const stmt = sqlite.prepare(`
      UPDATE survey_equipment 
      SET current_project_id = NULL, status = 'available', updated_at = datetime('now')
      WHERE id = ?
      RETURNING *
    `)
    
    const equipment = stmt.get(id)

    return c.json({ success: true, data: equipment })
  } catch (error: any) {
    console.error('Return equipment error:', error)
    return c.json({ success: false, message: '归还设备失败' }, 500)
  }
})

// 获取即将到期检定的设备
surveyRoutes.get('/equipment/calibration-alerts', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '30')
    
    const stmt = sqlite.prepare(`
      SELECT * FROM survey_equipment 
      WHERE next_calibration_date IS NOT NULL 
      AND next_calibration_date <= date('now', '+${days} days')
      AND status != 'retired'
      ORDER BY next_calibration_date ASC
    `)
    
    const list = stmt.all()

    return c.json({ success: true, data: list })
  } catch (error: any) {
    console.error('Get calibration alerts error:', error)
    return c.json({ success: false, message: '获取检定提醒失败' }, 500)
  }
})
