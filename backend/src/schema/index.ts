import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, real, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// 枚举类型
export const taskStatusEnum = pgEnum('task_status', ['unassigned', 'assigned', 'pending_receive', 'received', 'submitted', 'completed', 'rejected'])
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent'])
export const projectStatusEnum = pgEnum('project_status', ['draft', 'assigned', 'in_progress', 'paused', 'completed', 'archived'])
export const workflowStatusEnum = pgEnum('workflow_status', ['pending', 'approved', 'rejected', 'processing'])
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'member'])
export const workflowTypeEnum = pgEnum('workflow_type', ['leave', 'expense', 'purchase', 'reimbursement', 'borrow', 'invoice', 'probation', 'resignation', 'transfer', 'contract_renewal', 'seal'])

// 用户表
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  wechatUserId: varchar('wechat_user_id', { length: 64 }).unique(),
  username: varchar('username', { length: 50 }).unique(), // 登录账号
  password: varchar('password', { length: 255 }), // 密码哈希
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  avatar: text('avatar'),
  departmentId: varchar('department_id', { length: 64 }),
  departmentName: varchar('department_name', { length: 100 }),
  role: userRoleEnum('role').default('member'), // 角色：admin管理员/manager经理/member普通成员
  isAdmin: boolean('is_admin').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// 项目表
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  shortName: varchar('short_name', { length: 100 }),
  description: text('description'),
  status: projectStatusEnum('status').default('assigned'),
  ownerId: uuid('owner_id').references(() => users.id),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  progress: integer('progress').default(0),
  members: jsonb('members').default([]),
  settings: jsonb('settings').default({}),
  isArchived: boolean('is_archived').default(false),
  archivedBy: uuid('archived_by').references(() => users.id),
  archivedAt: timestamp('archived_at'),
  clientShortName: varchar('client_short_name', { length: 100 }),
  workload: integer('workload'),
  workloadUnit: varchar('workload_unit', { length: 50 }),
  completedDate: timestamp('completed_date'),
  projectMaterials: jsonb('project_materials').default([]),
  remarks: text('remarks'),
  pauseRequestStatus: varchar('pause_request_status', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// 任务表（子任务）
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description'),
  status: taskStatusEnum('status').default('unassigned'),
  priority: taskPriorityEnum('priority').default('medium'),
  assigneeId: uuid('assignee_id').references(() => users.id),
  creatorId: uuid('creator_id').references(() => users.id).notNull(),
  parentId: uuid('parent_id'),
  startDate: timestamp('start_date'),
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  estimatedHours: integer('estimated_hours'),
  actualHours: integer('actual_hours'),
  projectName: varchar('project_name', { length: 100 }),
  workCycle: varchar('work_cycle', { length: 100 }),
  remarks: text('remarks'),
  deliverableFiles: jsonb('deliverable_files').default([]),
  deliverableUrl: text('deliverable_url'),
  reviewedAt: timestamp('reviewed_at'),
  reviewerId: uuid('reviewer_id').references(() => users.id),
  reviewComments: text('review_comments'),
  tags: jsonb('tags').default([]),
  attachments: jsonb('attachments').default([]),
  workload: real('workload'),
  workloadUnit: varchar('workload_unit', { length: 50 }),
  order: integer('order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// 审批流程定义表
export const workflowDefinitions = pgTable('workflow_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // leave, expense, purchase, etc.
  description: text('description'),
  formSchema: jsonb('form_schema').notNull(), // 表单字段定义
  flowConfig: jsonb('flow_config').notNull(), // 审批流程配置
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// 审批实例表
export const workflowInstances = pgTable('workflow_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  definitionId: uuid('definition_id').references(() => workflowDefinitions.id).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  applicantId: uuid('applicant_id').references(() => users.id).notNull(),
  formData: jsonb('form_data').notNull(),
  currentStep: integer('current_step').default(0),
  status: workflowStatusEnum('status').default('pending'),
  approvers: jsonb('approvers').default([]), // 审批历史
  result: jsonb('result'), // 审批结果
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at')
})

// 系统配置表
export const systemConfig = pgTable('system_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 100 }).unique().notNull(),
  value: jsonb('value'),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow()
})

// 通知表
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // task, workflow, system, reminder
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content'),
  link: text('link'), // 跳转链接
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow()
})

// ==================== 测绘项目管理相关表 ====================

// 测绘项目类型枚举
export const surveyProjectTypeEnum = pgEnum('survey_project_type', [
  'topographic',      // 地形测量
  'engineering',      // 工程测量
  'real_estate',      // 不动产测绘
  'boundary',         // 界线测绘
  'aerial',           // 航空摄影
  'uav',              // 无人机测绘
  'lidar',            // 激光雷达
  'hydrographic',     // 海洋测绘
  'geophysical',      // 物探测量
  'other'             // 其他
])

// 测绘项目扩展表（关联projects表）
export const surveyProjects = pgTable('survey_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id).notNull().unique(),
  projectType: surveyProjectTypeEnum('project_type').default('topographic'),
  // 项目基本信息
  contractNumber: varchar('contract_number', { length: 100 }), // 合同编号
  clientName: varchar('client_name', { length: 200 }), // 委托单位
  clientContact: varchar('client_contact', { length: 100 }), // 联系人
  clientPhone: varchar('client_phone', { length: 20 }), // 联系电话
  // 项目地点
  location: text('location'), // 项目地点描述
  areaSize: varchar('area_size', { length: 50 }), // 测区面积
  coordinates: jsonb('coordinates'), // 测区坐标范围
  // 技术要求
  scale: varchar('scale', { length: 50 }), // 测图比例尺
  accuracy: varchar('accuracy', { length: 50 }), // 精度要求
  coordinateSystem: varchar('coordinate_system', { length: 100 }), // 坐标系统
  elevationSystem: varchar('elevation_system', { length: 100 }), // 高程系统
  // 项目进度
  currentStage: varchar('current_stage', { length: 50 }).default('preparation'), // 当前工序
  stageProgress: integer('stage_progress').default(0), // 当前工序进度
  // 质量信息
  qualityInspector: varchar('quality_inspector', { length: 100 }), // 质检员
  qualityStatus: varchar('quality_status', { length: 50 }).default('pending'), // 质检状态
  // 财务信息
  contractAmount: integer('contract_amount'), // 合同金额（元）
  receivedAmount: integer('received_amount').default(0), // 已收款
  // 时间信息
  plannedStartDate: timestamp('planned_start_date'), // 计划开工日期
  plannedEndDate: timestamp('planned_end_date'), // 计划完工日期
  actualStartDate: timestamp('actual_start_date'), // 实际开工日期
  actualEndDate: timestamp('actual_end_date'), // 实际完工日期
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// 测绘工序模板表（预定义各类型项目的标准工序）
export const surveyStageTemplates = pgTable('survey_stage_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectType: surveyProjectTypeEnum('project_type').notNull(),
  stageName: varchar('stage_name', { length: 100 }).notNull(), // 工序名称
  stageCode: varchar('stage_code', { length: 50 }).notNull(), // 工序编码
  description: text('description'), // 工序说明
  order: integer('order').default(0), // 排序
  estimatedDays: integer('estimated_days'), // 预计工期（天）
  requiredDeliverables: jsonb('required_deliverables').default([]), // 必备成果清单
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow()
})

// 测绘项目工序实例表（实际项目的工序跟踪）
export const surveyProjectStages = pgTable('survey_project_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  surveyProjectId: uuid('survey_project_id').references(() => surveyProjects.id).notNull(),
  stageName: varchar('stage_name', { length: 100 }).notNull(),
  stageCode: varchar('stage_code', { length: 50 }).notNull(),
  description: text('description'),
  order: integer('order').default(0),
  // 状态
  status: varchar('status', { length: 50 }).default('pending'), // pending, in_progress, completed, cancelled
  progress: integer('progress').default(0), // 0-100
  // 负责人
  managerId: uuid('manager_id').references(() => users.id), // 工序负责人
  teamMembers: jsonb('team_members').default([]), // 参与人员
  // 时间
  plannedStartDate: timestamp('planned_start_date'),
  plannedEndDate: timestamp('planned_end_date'),
  actualStartDate: timestamp('actual_start_date'),
  actualEndDate: timestamp('actual_end_date'),
  // 工作量
  estimatedWorkload: varchar('estimated_workload', { length: 100 }), // 预计工作量
  actualWorkload: varchar('actual_workload', { length: 100 }), // 实际工作量
  // 备注
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// 测绘成果表
export const surveyDeliverables = pgTable('survey_deliverables', {
  id: uuid('id').primaryKey().defaultRandom(),
  surveyProjectId: uuid('survey_project_id').references(() => surveyProjects.id).notNull(),
  stageId: uuid('stage_id').references(() => surveyProjectStages.id), // 关联工序
  // 成果信息
  name: varchar('name', { length: 200 }).notNull(), // 成果名称
  type: varchar('type', { length: 50 }).notNull(), // 成果类型：report, drawing, data, photo, video, etc.
  format: varchar('format', { length: 50 }), // 文件格式
  description: text('description'), // 成果说明
  // 文件信息
  filePath: text('file_path'), // 文件路径
  fileSize: integer('file_size'), // 文件大小
  fileHash: varchar('file_hash', { length: 64 }), // 文件哈希（完整性校验）
  // 版本管理
  version: varchar('version', { length: 20 }).default('1.0'), // 版本号
  isLatest: boolean('is_latest').default(true), // 是否最新版本
  previousVersionId: uuid('previous_version_id'), // 上一版本ID
  // 审核状态
  status: varchar('status', { length: 50 }).default('draft'), // draft, pending_review, approved, rejected
  reviewerId: uuid('reviewer_id').references(() => users.id), // 审核人
  reviewDate: timestamp('review_date'), // 审核日期
  reviewComments: text('review_comments'), // 审核意见
  // 提交信息
  submittedBy: uuid('submitted_by').references(() => users.id),
  submittedAt: timestamp('submitted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// 测绘设备/仪器表
export const surveyEquipment = pgTable('survey_equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(), // 设备名称
  model: varchar('model', { length: 100 }), // 型号
  serialNumber: varchar('serial_number', { length: 100 }).unique(), // 序列号
  type: varchar('type', { length: 50 }), // 设备类型：gps, total_station, level, uav, etc.
  manufacturer: varchar('manufacturer', { length: 100 }), // 制造商
  purchaseDate: timestamp('purchase_date'), // 购置日期
  calibrationDate: timestamp('calibration_date'), // 校准日期
  nextCalibrationDate: timestamp('next_calibration_date'), // 下次校准日期
  status: varchar('status', { length: 50 }).default('available'), // available, in_use, maintenance, retired
  currentProjectId: uuid('current_project_id').references(() => surveyProjects.id), // 当前使用项目
  keeperId: uuid('keeper_id').references(() => users.id), // 保管人
  location: varchar('location', { length: 200 }), // 存放位置
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// 外业记录表（外业测量日志）
export const surveyFieldRecords = pgTable('survey_field_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  surveyProjectId: uuid('survey_project_id').references(() => surveyProjects.id).notNull(),
  stageId: uuid('stage_id').references(() => surveyProjectStages.id),
  // 记录信息
  recordDate: timestamp('record_date').notNull(), // 记录日期
  weather: varchar('weather', { length: 50 }), // 天气情况
  temperature: varchar('temperature', { length: 20 }), // 温度
  // 人员
  teamLeader: varchar('team_leader', { length: 100 }), // 组长
  teamMembers: jsonb('team_members').default([]), // 组员
  // 设备
  equipmentUsed: jsonb('equipment_used').default([]), // 使用设备列表
  // 工作内容
  workContent: text('work_content'), // 工作内容
  workArea: text('work_area'), // 作业区域
  progress: text('progress'), // 进度情况
  // 问题记录
  issues: text('issues'), // 遇到的问题
  solutions: text('solutions'), // 解决方案
  // 附件
  photos: jsonb('photos').default([]), // 现场照片
  attachments: jsonb('attachments').default([]), // 附件
  // 记录人
  recorderId: uuid('recorder_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// 关系定义
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  assignedTasks: many(tasks, { relationName: 'assignee' }),
  createdTasks: many(tasks, { relationName: 'creator' }),
  workflowInstances: many(workflowInstances)
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id]
  }),
  tasks: many(tasks)
}))

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id]
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: 'assignee'
  }),
  creator: one(users, {
    fields: [tasks.creatorId],
    references: [users.id],
    relationName: 'creator'
  }),
  reviewer: one(users, {
    fields: [tasks.reviewerId],
    references: [users.id],
    relationName: 'reviewer'
  })
}))

export const workflowDefinitionsRelations = relations(workflowDefinitions, ({ many }) => ({
  instances: many(workflowInstances)
}))

export const workflowInstancesRelations = relations(workflowInstances, ({ one }) => ({
  definition: one(workflowDefinitions, {
    fields: [workflowInstances.definitionId],
    references: [workflowDefinitions.id]
  }),
  applicant: one(users, {
    fields: [workflowInstances.applicantId],
    references: [users.id]
  })
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id]
  })
}))

// ==================== 测绘项目关系定义 ====================

export const surveyProjectsRelations = relations(surveyProjects, ({ one, many }) => ({
  project: one(projects, {
    fields: [surveyProjects.projectId],
    references: [projects.id]
  }),
  stages: many(surveyProjectStages),
  deliverables: many(surveyDeliverables),
  fieldRecords: many(surveyFieldRecords),
  equipments: many(surveyEquipment)
}))

export const surveyProjectStagesRelations = relations(surveyProjectStages, ({ one, many }) => ({
  surveyProject: one(surveyProjects, {
    fields: [surveyProjectStages.surveyProjectId],
    references: [surveyProjects.id]
  }),
  manager: one(users, {
    fields: [surveyProjectStages.managerId],
    references: [users.id]
  }),
  deliverables: many(surveyDeliverables),
  fieldRecords: many(surveyFieldRecords)
}))

export const surveyDeliverablesRelations = relations(surveyDeliverables, ({ one }) => ({
  surveyProject: one(surveyProjects, {
    fields: [surveyDeliverables.surveyProjectId],
    references: [surveyProjects.id]
  }),
  stage: one(surveyProjectStages, {
    fields: [surveyDeliverables.stageId],
    references: [surveyProjectStages.id]
  }),
  reviewer: one(users, {
    fields: [surveyDeliverables.reviewerId],
    references: [users.id]
  }),
  submitter: one(users, {
    fields: [surveyDeliverables.submittedBy],
    references: [users.id]
  })
}))

export const surveyEquipmentRelations = relations(surveyEquipment, ({ one }) => ({
  currentProject: one(surveyProjects, {
    fields: [surveyEquipment.currentProjectId],
    references: [surveyProjects.id]
  }),
  keeper: one(users, {
    fields: [surveyEquipment.keeperId],
    references: [users.id]
  })
}))

export const surveyFieldRecordsRelations = relations(surveyFieldRecords, ({ one }) => ({
  surveyProject: one(surveyProjects, {
    fields: [surveyFieldRecords.surveyProjectId],
    references: [surveyProjects.id]
  }),
  stage: one(surveyProjectStages, {
    fields: [surveyFieldRecords.stageId],
    references: [surveyProjectStages.id]
  }),
  recorder: one(users, {
    fields: [surveyFieldRecords.recorderId],
    references: [users.id]
  })
}))

// ==================== 人事管理模块 Schema ====================

export const employmentStatusEnum = pgEnum('employment_status', ['active', 'probation', 'resigned', 'transferred', 'suspended'])
export const workRecordTypeEnum = pgEnum('work_record_type', ['entry', 'transfer', 'promotion', 'demotion', 'resignation', 'reinstate'])
export const exceptionTypeEnum = pgEnum('exception_type', ['late', 'early_leave', 'absent', 'missing_clock_in', 'missing_clock_out', 'location_abnormal'])
export const exceptionStatusEnum = pgEnum('exception_status', ['pending', 'approved', 'rejected'])
export const assetTypeEnum = pgEnum('asset_type', ['fixed', 'intangible'])
export const assetCategoryEnum = pgEnum('asset_category', ['equipment', 'vehicle', 'office', 'it', 'survey_qualification', 'work_permit', 'software', 'patent', 'other'])
export const assetStatusEnum = pgEnum('asset_status', ['in_use', 'idle', 'maintenance', 'retired', 'transferred'])
export const assetRecordTypeEnum = pgEnum('asset_record_type', ['purchase', 'allocate', 'return', 'transfer', 'maintenance', 'repair', 'scrap', 'check'])
export const alertTypeEnum = pgEnum('alert_type', ['contract_renewal', 'probation_end', 'title_declaration', 'qualification_renewal', 'work_permit_renewal', 'asset_maintenance', 'birthday'])
export const alertStatusEnum = pgEnum('alert_status', ['pending', 'notified', 'resolved'])

// 人事变动记录表
export const userWorkRecords = pgTable('user_work_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  recordType: workRecordTypeEnum('record_type').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  effectiveDate: timestamp('effective_date').notNull(),
  reason: text('reason'),
  approverId: uuid('approver_id').references(() => users.id),
  status: varchar('status', { length: 50 }).default('active'),
  attachments: jsonb('attachments').default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// 考勤异常申诉表
export const attendanceExceptions = pgTable('attendance_exceptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  recordDate: timestamp('record_date').notNull(),
  exceptionType: exceptionTypeEnum('exception_type').notNull(),
  description: text('description').notNull(),
  evidence: jsonb('evidence').default([]),
  status: exceptionStatusEnum('status').default('pending'),
  handlerId: uuid('handler_id').references(() => users.id),
  handlerNotes: text('handler_notes'),
  handledAt: timestamp('handled_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// 资产管理表
export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetNo: varchar('asset_no', { length: 100 }).unique().notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  category: assetCategoryEnum('category').notNull(),
  assetType: assetTypeEnum('asset_type').notNull(),
  model: varchar('model', { length: 100 }),
  manufacturer: varchar('manufacturer', { length: 100 }),
  serialNumber: varchar('serial_number', { length: 100 }),
  purchaseDate: timestamp('purchase_date'),
  purchasePrice: integer('purchase_price'),
  currentValue: integer('current_value'),
  status: assetStatusEnum('status').default('in_use'),
  location: varchar('location', { length: 200 }),
  keeperId: uuid('keeper_id').references(() => users.id),
  departmentName: varchar('department_name', { length: 100 }),
  warrantyExpiry: timestamp('warranty_expiry'),
  maintenanceDate: timestamp('maintenance_date'),
  nextMaintenanceDate: timestamp('next_maintenance_date'),
  licenseNo: varchar('license_no', { length: 100 }),
  issuingAuthority: varchar('issuing_authority', { length: 100 }),
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),
  renewalReminderDate: timestamp('renewal_reminder_date'),
  description: text('description'),
  attachments: jsonb('attachments').default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// 资产流转记录表
export const assetRecords = pgTable('asset_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').references(() => assets.id).notNull(),
  recordType: assetRecordTypeEnum('record_type').notNull(),
  fromUserId: uuid('from_user_id').references(() => users.id),
  toUserId: uuid('to_user_id').references(() => users.id),
  fromLocation: varchar('from_location', { length: 200 }),
  toLocation: varchar('to_location', { length: 200 }),
  recordDate: timestamp('record_date').notNull(),
  reason: text('reason'),
  operatorId: uuid('operator_id').references(() => users.id),
  attachments: jsonb('attachments').default([]),
  createdAt: timestamp('created_at').defaultNow()
})

// 智能预警表
export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  alertType: alertTypeEnum('alert_type').notNull(),
  targetType: varchar('target_type', { length: 50 }).notNull(), // user, asset
  targetId: varchar('target_id', { length: 100 }).notNull(),
  targetName: varchar('target_name', { length: 200 }).notNull(),
  dueDate: timestamp('due_date'),
  daysRemaining: integer('days_remaining'),
  status: alertStatusEnum('status').default('pending'),
  notifiedUsers: jsonb('notified_users').default([]),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// 关系定义
export const userWorkRecordsRelations = relations(userWorkRecords, ({ one }) => ({
  user: one(users, {
    fields: [userWorkRecords.userId],
    references: [users.id]
  }),
  approver: one(users, {
    fields: [userWorkRecords.approverId],
    references: [users.id]
  })
}))

export const attendanceExceptionsRelations = relations(attendanceExceptions, ({ one }) => ({
  user: one(users, {
    fields: [attendanceExceptions.userId],
    references: [users.id]
  }),
  handler: one(users, {
    fields: [attendanceExceptions.handlerId],
    references: [users.id]
  })
}))

export const assetsRelations = relations(assets, ({ one, many }) => ({
  keeper: one(users, {
    fields: [assets.keeperId],
    references: [users.id]
  }),
  records: many(assetRecords)
}))

export const assetRecordsRelations = relations(assetRecords, ({ one }) => ({
  asset: one(assets, {
    fields: [assetRecords.assetId],
    references: [assets.id]
  }),
  fromUser: one(users, {
    fields: [assetRecords.fromUserId],
    references: [users.id]
  }),
  toUser: one(users, {
    fields: [assetRecords.toUserId],
    references: [users.id]
  }),
  operator: one(users, {
    fields: [assetRecords.operatorId],
    references: [users.id]
  })
}))

export const alertsRelations = relations(alerts, ({ one }) => ({
  resolver: one(users, {
    fields: [alerts.resolvedBy],
    references: [users.id]
  })
}))