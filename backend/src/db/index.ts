// SQLite 数据库配置（开发环境使用）
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from '../schema/index.js'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { randomUUID } from 'crypto'

const DB_PATH = process.env.DB_PATH || './data/oa_system.db'

// 确保数据目录存在
const dbDir = dirname(DB_PATH)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

const sqlite = new Database(DB_PATH)

// 启用外键
sqlite.exec('PRAGMA foreign_keys = ON')

// 为 SQLite 注册 gen_random_uuid 函数，兼容 Drizzle ORM 的 uuid().defaultRandom()
sqlite.function('gen_random_uuid', () => randomUUID())

// 为 SQLite 注册 now() 函数，兼容 Drizzle ORM 的 timestamp().defaultNow()
sqlite.function('now', { deterministic: false }, () => new Date().toISOString())

export const db = drizzle(sqlite, { schema })
export { sqlite }

// 初始化表
function initTables() {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      wechat_user_id TEXT UNIQUE,
      username TEXT UNIQUE,
      password TEXT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      avatar TEXT,
      department_id TEXT,
      department_name TEXT,
      is_admin INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'assigned',
      owner_id TEXT REFERENCES users(id),
      start_date DATETIME,
      end_date DATETIME,
      progress INTEGER DEFAULT 0,
      members TEXT DEFAULT '[]',
      settings TEXT DEFAULT '{}',
      is_archived INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      project_id TEXT NOT NULL REFERENCES projects(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      assignee_id TEXT REFERENCES users(id),
      creator_id TEXT NOT NULL REFERENCES users(id),
      parent_id TEXT,
      start_date DATETIME,
      due_date DATETIME,
      completed_at DATETIME,
      estimated_hours INTEGER,
      actual_hours INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      attachments TEXT DEFAULT '[]',
      "order" INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workflow_definitions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      type TEXT NOT NULL UNIQUE,
      description TEXT,
      form_schema TEXT NOT NULL,
      flow_config TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workflow_instances (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      definition_id TEXT NOT NULL REFERENCES workflow_definitions(id),
      title TEXT NOT NULL,
      applicant_id TEXT NOT NULL REFERENCES users(id),
      form_data TEXT NOT NULL,
      current_step INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      approvers TEXT DEFAULT '[]',
      result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      read_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_config (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 插入默认管理员用户
    INSERT OR IGNORE INTO users (id, username, password, name, email, is_admin) 
    VALUES ('00000000-0000-0000-0000-000000000001', 'admin', 'admin123', '管理员', 'admin@example.com', 1);

    -- 插入默认审批流程定义
    INSERT OR IGNORE INTO workflow_definitions (id, name, type, description, form_schema, flow_config, is_active)
    VALUES 
    ('00000000-0000-0000-0000-000000000101', '请假申请', 'leave', '员工请假审批流程', 
     '{"fields":[{"name":"leaveType","label":"请假类型","type":"select","options":["年假","病假","事假","婚假","产假","陪产假","丧假","调休假","其他"]},{"name":"startDate","label":"开始日期","type":"date"},{"name":"endDate","label":"结束日期","type":"date"},{"name":"reason","label":"请假事由","type":"textarea"}]}',
     '{"steps":[{"name":"部门主管审批","approver":"manager"},{"name":"HR审批","approver":"hr"}]}',
     1),
    ('00000000-0000-0000-0000-000000000102', '费用报销', 'expense', '费用报销审批流程',
     '{"fields":[{"name":"amount","label":"报销金额","type":"number"},{"name":"category","label":"费用类别","type":"select","options":["差旅费","办公费","招待费","其他"]},{"name":"receipts","label":"发票附件","type":"file"},{"name":"description","label":"费用说明","type":"textarea"}]}',
     '{"steps":[{"name":"部门主管审批","approver":"manager"},{"name":"财务审批","approver":"finance"}]}',
     1),
    ('00000000-0000-0000-0000-000000000103', '采购申请', 'purchase', '采购申请审批流程',
     '{"fields":[{"name":"itemName","label":"物品名称","type":"text"},{"name":"quantity","label":"数量","type":"number"},{"name":"budget","label":"预算金额","type":"number"},{"name":"reason","label":"采购理由","type":"textarea"}]}',
     '{"steps":[{"name":"部门主管审批","approver":"manager"},{"name":"财务审批","approver":"finance"},{"name":"总经理审批","approver":"ceo"}]}',
     1),
    ('00000000-0000-0000-0000-000000000104', '外出申请', 'outgoing', '外出/出差审批流程',
     '{"fields":[{"name":"destination","label":"目的地","type":"text"},{"name":"startDate","label":"开始日期","type":"date"},{"name":"endDate","label":"结束日期","type":"date"},{"name":"purpose","label":"外出目的","type":"textarea"}]}',
     '{"steps":[{"name":"部门主管审批","approver":"manager"}]}',
     1);

    -- ==================== 测绘项目相关表 ====================
    
    -- 测绘项目扩展表
    CREATE TABLE IF NOT EXISTS survey_projects (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      project_id TEXT NOT NULL UNIQUE REFERENCES projects(id),
      project_type TEXT DEFAULT 'topographic',
      contract_number TEXT,
      client_name TEXT,
      client_contact TEXT,
      client_phone TEXT,
      location TEXT,
      area_size TEXT,
      coordinates TEXT,
      scale TEXT,
      accuracy TEXT,
      coordinate_system TEXT,
      elevation_system TEXT,
      current_stage TEXT DEFAULT 'preparation',
      stage_progress INTEGER DEFAULT 0,
      quality_inspector TEXT,
      quality_status TEXT DEFAULT 'pending',
      contract_amount INTEGER,
      received_amount INTEGER DEFAULT 0,
      planned_start_date DATETIME,
      planned_end_date DATETIME,
      actual_start_date DATETIME,
      actual_end_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 测绘工序模板表
    CREATE TABLE IF NOT EXISTS survey_stage_templates (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      project_type TEXT NOT NULL,
      stage_name TEXT NOT NULL,
      stage_code TEXT NOT NULL,
      description TEXT,
      "order" INTEGER DEFAULT 0,
      estimated_days INTEGER,
      required_deliverables TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 测绘项目工序实例表
    CREATE TABLE IF NOT EXISTS survey_project_stages (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      survey_project_id TEXT NOT NULL REFERENCES survey_projects(id),
      stage_name TEXT NOT NULL,
      stage_code TEXT NOT NULL,
      description TEXT,
      "order" INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      manager_id TEXT REFERENCES users(id),
      team_members TEXT DEFAULT '[]',
      planned_start_date DATETIME,
      planned_end_date DATETIME,
      actual_start_date DATETIME,
      actual_end_date DATETIME,
      estimated_workload TEXT,
      actual_workload TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 测绘成果表
    CREATE TABLE IF NOT EXISTS survey_deliverables (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      survey_project_id TEXT NOT NULL REFERENCES survey_projects(id),
      stage_id TEXT REFERENCES survey_project_stages(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      format TEXT,
      description TEXT,
      file_path TEXT,
      file_size INTEGER,
      file_hash TEXT,
      version TEXT DEFAULT '1.0',
      is_latest INTEGER DEFAULT 1,
      previous_version_id TEXT,
      status TEXT DEFAULT 'draft',
      reviewer_id TEXT REFERENCES users(id),
      review_date DATETIME,
      review_comments TEXT,
      submitted_by TEXT REFERENCES users(id),
      submitted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 测绘设备表
    CREATE TABLE IF NOT EXISTS survey_equipment (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      name TEXT NOT NULL,
      model TEXT,
      serial_number TEXT UNIQUE,
      type TEXT,
      manufacturer TEXT,
      purchase_date DATETIME,
      calibration_date DATETIME,
      next_calibration_date DATETIME,
      status TEXT DEFAULT 'available',
      current_project_id TEXT REFERENCES survey_projects(id),
      keeper_id TEXT REFERENCES users(id),
      location TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 外业记录表
    CREATE TABLE IF NOT EXISTS survey_field_records (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      survey_project_id TEXT NOT NULL REFERENCES survey_projects(id),
      stage_id TEXT REFERENCES survey_project_stages(id),
      record_date DATETIME NOT NULL,
      weather TEXT,
      temperature TEXT,
      team_leader TEXT,
      team_members TEXT DEFAULT '[]',
      equipment_used TEXT DEFAULT '[]',
      work_content TEXT,
      work_area TEXT,
      progress TEXT,
      issues TEXT,
      solutions TEXT,
      photos TEXT DEFAULT '[]',
      attachments TEXT DEFAULT '[]',
      recorder_id TEXT REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 插入测绘工序模板数据（地形测量）
    INSERT OR IGNORE INTO survey_stage_templates (id, project_type, stage_name, stage_code, description, "order", estimated_days, required_deliverables)
    VALUES
    ('00000000-0000-0000-0000-000000000201', 'topographic', '项目立项', 'preparation', '项目合同签订、任务书下达、组建项目团队', 1, 2, '["项目任务书","合同文件"]'),
    ('00000000-0000-0000-0000-000000000202', 'topographic', '技术设计', 'design', '编制技术设计书、制定作业方案', 2, 3, '["技术设计书","作业指导书"]'),
    ('00000000-0000-0000-0000-000000000203', 'topographic', '控制测量', 'control', '首级控制网布设、水准测量', 3, 5, '["控制点成果表","控制网图"]'),
    ('00000000-0000-0000-0000-000000000204', 'topographic', '图根测量', 'root_control', '图根控制点布设与测量', 4, 3, '["图根点成果表"]'),
    ('00000000-0000-0000-0000-000000000205', 'topographic', '外业采集', 'field_work', '全站仪、RTK、无人机等外业数据采集', 5, 10, '["外业观测记录","现场照片"]'),
    ('00000000-0000-0000-0000-000000000206', 'topographic', '内业处理', 'processing', '数据整理、地形图编绘', 6, 7, '["地形图数据","数字高程模型"]'),
    ('00000000-0000-0000-0000-000000000207', 'topographic', '质量检查', 'quality', '两级检查（自检、专检）', 7, 3, '["质量检查报告","检查记录表"]'),
    ('00000000-0000-0000-0000-000000000208', 'topographic', '成果整理', 'deliverables', '成果资料整理、装订', 8, 2, '["成果报告","图件资料"]'),
    ('00000000-0000-0000-0000-000000000209', 'topographic', '成果验收', 'acceptance', '提交验收、整改完善', 9, 2, '["验收报告","整改记录"]');

    -- 插入测绘工序模板数据（工程测量）
    INSERT OR IGNORE INTO survey_stage_templates (id, project_type, stage_name, stage_code, description, "order", estimated_days, required_deliverables)
    VALUES
    ('00000000-0000-0000-0000-000000000301', 'engineering', '项目立项', 'preparation', '项目合同签订、任务书下达', 1, 2, '["项目任务书"]'),
    ('00000000-0000-0000-0000-000000000302', 'engineering', '现场踏勘', 'survey', '现场踏勘、技术交底', 2, 1, '["踏勘记录"]'),
    ('00000000-0000-0000-0000-000000000303', 'engineering', '控制测量', 'control', '施工控制网布设', 3, 3, '["控制点成果"]'),
    ('00000000-0000-0000-0000-000000000304', 'engineering', '施工放样', 'staking', '建筑物/构筑物放样', 4, 7, '["放样记录","放样略图"]'),
    ('00000000-0000-0000-0000-000000000305', 'engineering', '变形监测', 'monitoring', '沉降、位移等变形观测', 5, 30, '["监测报告","变形曲线图"]'),
    ('00000000-0000-0000-0000-000000000306', 'engineering', '竣工测量', 'completion', '工程竣工测量', 6, 5, '["竣工图","竣工测量报告"]'),
    ('00000000-0000-0000-0000-000000000307', 'engineering', '质量检查', 'quality', '成果质量检查', 7, 2, '["检查报告"]'),
    ('00000000-0000-0000-0000-000000000308', 'engineering', '成果提交', 'deliverables', '成果资料提交验收', 8, 2, '["成果报告"]');

    -- 插入测绘工序模板数据（无人机测绘）
    INSERT OR IGNORE INTO survey_stage_templates (id, project_type, stage_name, stage_code, description, "order", estimated_days, required_deliverables)
    VALUES
    ('00000000-0000-0000-0000-000000000401', 'uav', '任务接收', 'preparation', '任务接收、合同签订', 1, 1, '["任务书"]'),
    ('00000000-0000-0000-0000-000000000402', 'uav', '空域申请', 'airspace', '飞行空域申请与审批', 2, 3, '["空域批文"]'),
    ('00000000-0000-0000-0000-000000000403', 'uav', '现场踏勘', 'survey', '现场踏勘、航线规划', 3, 1, '["踏勘报告","航线规划图"]'),
    ('00000000-0000-0000-0000-000000000404', 'uav', '像控测量', 'control', '像片控制点布设与测量', 4, 2, '["像控点成果"]'),
    ('00000000-0000-0000-0000-000000000405', 'uav', '航摄飞行', 'flight', '无人机航摄飞行', 5, 2, '["航摄影像","飞行记录"]'),
    ('00000000-0000-0000-0000-000000000406', 'uav', '数据处理', 'processing', '空三加密、DEM/DSM生成、正射影像制作', 6, 5, '["空三报告","正射影像图"]'),
    ('00000000-0000-0000-0000-000000000407', 'uav', '立体测图', 'mapping', '立体采集、地形图编绘', 7, 5, '["地形图数据"]'),
    ('00000000-0000-0000-0000-000000000408', 'uav', '质量检查', 'quality', '航摄质量、成果质量检查', 8, 2, '["质量检查报告"]'),
    ('00000000-0000-0000-0000-000000000409', 'uav', '成果提交', 'deliverables', '成果整理与提交', 9, 2, '["成果报告","影像图"]');

    -- 插入示例测绘设备
    INSERT OR IGNORE INTO survey_equipment (id, name, model, serial_number, type, manufacturer, status, location)
    VALUES
    ('00000000-0000-0000-0000-000000000501', 'GNSS接收机', '南方S86', 'S86-2024001', 'gps', '南方测绘', 'available', '仪器室'),
    ('00000000-0000-0000-0000-000000000502', '全站仪', '徕卡TS16', 'TS16-2024001', 'total_station', '徕卡', 'available', '仪器室'),
    ('00000000-0000-0000-0000-000000000503', '水准仪', '天宝DINI03', 'DINI03-001', 'level', '天宝', 'available', '仪器室'),
    ('00000000-0000-0000-0000-000000000504', '无人机', '大疆M300 RTK', 'M300-2024001', 'uav', '大疆', 'available', '无人机库房'),
    ('00000000-0000-0000-0000-000000000505', '激光雷达', '大疆禅思L1', 'L1-2024001', 'lidar', '大疆', 'available', '无人机库房');
  `
  
  try {
    sqlite.exec(sql)
    console.log('✅ 数据库表初始化完成')
  } catch (err) {
    console.error('数据库初始化错误:', err)
  }

  // 迁移：为 projects 表添加新列
  try {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN short_name TEXT`)
  } catch (e) { /* 已存在则忽略 */ }
  try {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN archived_by TEXT REFERENCES users(id)`)
  } catch (e) { /* 已存在则忽略 */ }
  try {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN archived_at DATETIME`)
  } catch (e) { /* 已存在则忽略 */ }

  // 迁移：为 tasks 表添加新列（支持子任务状态流转）
  try {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN project_name TEXT`)
  } catch (e) { /* 已存在则忽略 */ }
  try {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN work_cycle TEXT`)
  } catch (e) { /* 已存在则忽略 */ }
  try {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN deliverable_files TEXT DEFAULT '[]'`)
  } catch (e) { /* 已存在则忽略 */ }
  try {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN deliverable_url TEXT`)
  } catch (e) { /* 已存在则忽略 */ }
  try {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN reviewed_at DATETIME`)
  } catch (e) { /* 已存在则忽略 */ }
  try {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN reviewer_id TEXT REFERENCES users(id)`)
  } catch (e) { /* 已存在则忽略 */ }
  try {
    sqlite.exec(`ALTER TABLE tasks ADD COLUMN review_comments TEXT`)
  } catch (e) { /* 已存在则忽略 */ }

  // 迁移：为 projects 表添加业务新字段
  try {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN client_short_name TEXT`)
  } catch (e) { /* 已存在则忽略 */ }
  try {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN workload REAL`)
  } catch (e) { /* 已存在则忽略 */ }
  try {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN workload_unit TEXT`)
  } catch (e) { /* 已存在则忽略 */ }
  try {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN completed_date DATETIME`)
  } catch (e) { /* 已存在则忽略 */ }
  try {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN project_materials TEXT DEFAULT '[]'`)
  } catch (e) { /* 已存在则忽略 */ }
  try {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN remarks TEXT`)
  } catch (e) { /* 已存在则忽略 */ }
  try {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN pause_request_status TEXT`)
  } catch (e) { /* 已存在则忽略 */ }

  // ==================== 人事管理模块扩展 ====================
  
  // users 表扩展人事字段
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN employee_no TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN id_card TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN gender TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN birth_date TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN address TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN emergency_contact TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN emergency_phone TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN education TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN major TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN graduation_school TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN graduation_date TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN entry_date TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN probation_end_date TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN formal_date TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN contract_start_date TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN contract_end_date TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN resignation_date TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN resignation_reason TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN employment_status TEXT DEFAULT 'active'`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN position TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN job_level TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN salary_base REAL`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN bank_account TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN bank_name TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN social_security_no TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN provident_fund_no TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN qualifications TEXT DEFAULT '[]'`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN professional_title TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN title_declaration_date TEXT`) } catch (e) {}

  // 新增员工档案字段
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN personnel_category TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN native_place TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN home_address TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN ethnicity TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN bank_branch TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN bank_code TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN cert_name TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN cert_no TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN cert_issue_date TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN probation_salary REAL`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN formal_salary REAL`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN seniority_allowance REAL`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN contract_no TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN contract_term TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN contract_count INTEGER DEFAULT 1`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN ss_start_date TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN emergency_relation TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN id_card_expiry TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN documents TEXT DEFAULT '[]'`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN remarks TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN latest_contract_start TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN latest_contract_end TEXT`) } catch (e) {}
  
  // 用户权限字段（JSON格式存储权限列表）
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[]'`) } catch (e) {}

  // 门禁指纹编号
  try { sqlite.exec(`ALTER TABLE users ADD COLUMN fingerprint_id TEXT`) } catch (e) {}

  // 人事变动记录表（入转调离）
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS user_work_records (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id),
        record_type TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        effective_date TEXT NOT NULL,
        reason TEXT,
        approver_id TEXT REFERENCES users(id),
        status TEXT DEFAULT 'active',
        attachments TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {}

  // 考勤记录表扩展（如果尚未创建，则完整创建）
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id),
        date TEXT NOT NULL,
        check_in_time DATETIME,
        check_out_time DATETIME,
        check_in_location TEXT,
        check_out_location TEXT,
        check_in_latitude REAL,
        check_in_longitude REAL,
        check_out_latitude REAL,
        check_out_longitude REAL,
        check_in_device TEXT,
        check_out_device TEXT,
        check_in_type TEXT DEFAULT 'office',
        check_out_type TEXT DEFAULT 'office',
        work_hours REAL DEFAULT 0,
        overtime_hours REAL DEFAULT 0,
        status TEXT DEFAULT 'normal',
        exception_type TEXT,
        exception_status TEXT DEFAULT 'normal',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {}
  
  // 考勤异常申诉表
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS attendance_exceptions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id),
        record_date TEXT NOT NULL,
        exception_type TEXT NOT NULL,
        description TEXT NOT NULL,
        evidence TEXT DEFAULT '[]',
        status TEXT DEFAULT 'pending',
        handler_id TEXT REFERENCES users(id),
        handler_notes TEXT,
        handled_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {}

  // 考勤配置表（完整创建）
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS attendance_config (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {}

  // 请假/调休申请表（兼容现有 leave_requests）
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id),
        leave_type TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        days REAL NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        approver_id TEXT REFERENCES users(id),
        approved_at DATETIME,
        approver_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {}

  // 加班申请表
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS overtime_requests (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id),
        date TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        hours REAL NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        approver_id TEXT REFERENCES users(id),
        approved_at DATETIME,
        approver_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {}

  // 外出申请表
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS outgoing_requests (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id),
        destination TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        purpose TEXT,
        status TEXT DEFAULT 'pending',
        approver_id TEXT REFERENCES users(id),
        approved_at DATETIME,
        approver_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {}

  // 出差申请表
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS business_trip_requests (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id),
        destination TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        transport TEXT DEFAULT '汽车',
        purpose TEXT,
        status TEXT DEFAULT 'pending',
        approver_id TEXT REFERENCES users(id),
        approved_at DATETIME,
        approver_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {}

  // 资产管理表（固定资产+无形资产）
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        asset_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        asset_type TEXT NOT NULL,
        model TEXT,
        manufacturer TEXT,
        serial_number TEXT,
        purchase_date TEXT,
        purchase_price REAL,
        current_value REAL,
        status TEXT DEFAULT 'in_use',
        location TEXT,
        keeper_id TEXT REFERENCES users(id),
        department_name TEXT,
        warranty_expiry TEXT,
        maintenance_date TEXT,
        next_maintenance_date TEXT,
        license_no TEXT,
        issuing_authority TEXT,
        valid_from TEXT,
        valid_until TEXT,
        renewal_reminder_date TEXT,
        description TEXT,
        attachments TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {}

  // 资产流转记录表
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS asset_records (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        asset_id TEXT NOT NULL REFERENCES assets(id),
        record_type TEXT NOT NULL,
        from_user_id TEXT REFERENCES users(id),
        to_user_id TEXT REFERENCES users(id),
        from_location TEXT,
        to_location TEXT,
        record_date TEXT NOT NULL,
        reason TEXT,
        operator_id TEXT REFERENCES users(id),
        attachments TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {}

  // 智能预警表
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        alert_type TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        target_name TEXT NOT NULL,
        due_date TEXT,
        days_remaining INTEGER,
        status TEXT DEFAULT 'pending',
        notified_users TEXT DEFAULT '[]',
        resolved_at DATETIME,
        resolved_by TEXT REFERENCES users(id),
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {}

  // 工作日报表
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS daily_reports (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id),
        report_date TEXT NOT NULL,
        content TEXT NOT NULL,
        completed_tasks TEXT DEFAULT '[]',
        planned_tasks TEXT DEFAULT '[]',
        problems TEXT,
        status TEXT DEFAULT 'draft',
        reviewer_id TEXT REFERENCES users(id),
        review_comment TEXT,
        reviewed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {}

  // ==================== 考勤规则相关表 ====================

  // 单双休基准规则表
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS attendance_rules (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        reference_date TEXT NOT NULL,
        week_type TEXT NOT NULL,
        description TEXT,
        created_by TEXT REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {}

  // 节假日表（含法定节假日和补班）
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS holidays (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        date TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        year INTEGER,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  } catch (e) {}
  try { sqlite.exec(`ALTER TABLE holidays ADD COLUMN description TEXT`) } catch (e) {}
  try { sqlite.exec(`ALTER TABLE holidays ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`) } catch (e) {}

  // 插入默认单双休规则（如果没有）
  try {
    sqlite.exec(`
      INSERT OR IGNORE INTO attendance_rules (id, reference_date, week_type, description)
      VALUES (lower(hex(randomblob(16))), date('now'), 'double', '默认双休规则')
    `)
  } catch (e) {}

  // 插入2024年法定节假日（示例数据）
  try {
    sqlite.exec(`
      INSERT OR IGNORE INTO holidays (id, date, name, type, description) VALUES
      (lower(hex(randomblob(16))), '2024-01-01', '元旦', 'holiday', '元旦节'),
      (lower(hex(randomblob(16))), '2024-02-09', '除夕', 'holiday', '春节假期'),
      (lower(hex(randomblob(16))), '2024-02-10', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2024-02-11', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2024-02-12', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2024-02-13', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2024-02-14', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2024-02-15', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2024-02-16', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2024-02-17', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2024-04-04', '清明节', 'holiday', '清明节'),
      (lower(hex(randomblob(16))), '2024-04-05', '清明节', 'holiday', '清明节'),
      (lower(hex(randomblob(16))), '2024-04-06', '清明节', 'holiday', '清明节'),
      (lower(hex(randomblob(16))), '2024-05-01', '劳动节', 'holiday', '劳动节'),
      (lower(hex(randomblob(16))), '2024-05-02', '劳动节', 'holiday', '劳动节'),
      (lower(hex(randomblob(16))), '2024-05-03', '劳动节', 'holiday', '劳动节'),
      (lower(hex(randomblob(16))), '2024-05-04', '劳动节', 'holiday', '劳动节'),
      (lower(hex(randomblob(16))), '2024-05-05', '劳动节', 'holiday', '劳动节'),
      (lower(hex(randomblob(16))), '2024-06-10', '端午节', 'holiday', '端午节'),
      (lower(hex(randomblob(16))), '2024-09-15', '中秋节', 'holiday', '中秋节'),
      (lower(hex(randomblob(16))), '2024-09-16', '中秋节', 'holiday', '中秋节'),
      (lower(hex(randomblob(16))), '2024-09-17', '中秋节', 'holiday', '中秋节'),
      (lower(hex(randomblob(16))), '2024-10-01', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2024-10-02', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2024-10-03', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2024-10-04', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2024-10-05', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2024-10-06', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2024-10-07', '国庆节', 'holiday', '国庆节'),
      -- 2024年补班
      (lower(hex(randomblob(16))), '2024-02-04', '春节补班', 'workday', '春节调休补班'),
      (lower(hex(randomblob(16))), '2024-02-18', '春节补班', 'workday', '春节调休补班'),
      (lower(hex(randomblob(16))), '2024-04-07', '清明补班', 'workday', '清明节调休补班'),
      (lower(hex(randomblob(16))), '2024-04-28', '劳动节补班', 'workday', '劳动节调休补班'),
      (lower(hex(randomblob(16))), '2024-05-11', '劳动节补班', 'workday', '劳动节调休补班'),
      (lower(hex(randomblob(16))), '2024-09-14', '中秋补班', 'workday', '中秋节调休补班'),
      (lower(hex(randomblob(16))), '2024-09-29', '国庆补班', 'workday', '国庆节调休补班'),
      (lower(hex(randomblob(16))), '2024-10-12', '国庆补班', 'workday', '国庆节调休补班')
    `)
  } catch (e) {}

  // 插入2025年法定节假日
  try {
    sqlite.exec(`
      INSERT OR IGNORE INTO holidays (id, date, name, type, description) VALUES
      (lower(hex(randomblob(16))), '2025-01-01', '元旦', 'holiday', '元旦节'),
      (lower(hex(randomblob(16))), '2025-01-28', '除夕', 'holiday', '春节假期'),
      (lower(hex(randomblob(16))), '2025-01-29', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2025-01-30', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2025-01-31', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2025-02-01', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2025-02-02', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2025-02-03', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2025-02-04', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2025-04-04', '清明节', 'holiday', '清明节'),
      (lower(hex(randomblob(16))), '2025-04-05', '清明节', 'holiday', '清明节'),
      (lower(hex(randomblob(16))), '2025-04-06', '清明节', 'holiday', '清明节'),
      (lower(hex(randomblob(16))), '2025-05-01', '劳动节', 'holiday', '劳动节'),
      (lower(hex(randomblob(16))), '2025-05-02', '劳动节', 'holiday', '劳动节'),
      (lower(hex(randomblob(16))), '2025-05-03', '劳动节', 'holiday', '劳动节'),
      (lower(hex(randomblob(16))), '2025-05-04', '劳动节', 'holiday', '劳动节'),
      (lower(hex(randomblob(16))), '2025-05-05', '劳动节', 'holiday', '劳动节'),
      (lower(hex(randomblob(16))), '2025-05-31', '端午节', 'holiday', '端午节'),
      (lower(hex(randomblob(16))), '2025-06-01', '端午节', 'holiday', '端午节'),
      (lower(hex(randomblob(16))), '2025-06-02', '端午节', 'holiday', '端午节'),
      (lower(hex(randomblob(16))), '2025-10-01', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2025-10-02', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2025-10-03', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2025-10-04', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2025-10-05', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2025-10-06', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2025-10-07', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2025-10-08', '国庆节', 'holiday', '国庆节'),
      -- 2025年补班
      (lower(hex(randomblob(16))), '2025-01-26', '春节补班', 'workday', '春节调休补班'),
      (lower(hex(randomblob(16))), '2025-02-08', '春节补班', 'workday', '春节调休补班'),
      (lower(hex(randomblob(16))), '2025-04-27', '劳动节补班', 'workday', '劳动节调休补班'),
      (lower(hex(randomblob(16))), '2025-05-10', '劳动节补班', 'workday', '劳动节调休补班'),
      (lower(hex(randomblob(16))), '2025-10-11', '国庆补班', 'workday', '国庆节调休补班')
    `)
  } catch (e) {}

  // 插入2026年法定节假日
  try {
    sqlite.exec(`
      INSERT OR IGNORE INTO holidays (id, date, name, type, description) VALUES
      (lower(hex(randomblob(16))), '2026-01-01', '元旦', 'holiday', '元旦节'),
      (lower(hex(randomblob(16))), '2026-01-01', '元旦', 'holiday', '元旦节'),
      (lower(hex(randomblob(16))), '2026-02-17', '除夕', 'holiday', '春节假期'),
      (lower(hex(randomblob(16))), '2026-02-18', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2026-02-19', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2026-02-20', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2026-02-21', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2026-02-22', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2026-02-23', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2026-02-24', '春节', 'holiday', '春节'),
      (lower(hex(randomblob(16))), '2026-04-04', '清明节', 'holiday', '清明节'),
      (lower(hex(randomblob(16))), '2026-04-05', '清明节', 'holiday', '清明节'),
      (lower(hex(randomblob(16))), '2026-04-06', '清明节', 'holiday', '清明节'),
      (lower(hex(randomblob(16))), '2026-05-01', '劳动节', 'holiday', '劳动节'),
      (lower(hex(randomblob(16))), '2026-05-02', '劳动节', 'holiday', '劳动节'),
      (lower(hex(randomblob(16))), '2026-05-03', '劳动节', 'holiday', '劳动节'),
      (lower(hex(randomblob(16))), '2026-05-04', '劳动节', 'holiday', '劳动节'),
      (lower(hex(randomblob(16))), '2026-05-05', '劳动节', 'holiday', '劳动节'),
      (lower(hex(randomblob(16))), '2026-06-19', '端午节', 'holiday', '端午节'),
      (lower(hex(randomblob(16))), '2026-06-20', '端午节', 'holiday', '端午节'),
      (lower(hex(randomblob(16))), '2026-06-21', '端午节', 'holiday', '端午节'),
      (lower(hex(randomblob(16))), '2026-09-25', '中秋节', 'holiday', '中秋节'),
      (lower(hex(randomblob(16))), '2026-09-26', '中秋节', 'holiday', '中秋节'),
      (lower(hex(randomblob(16))), '2026-09-27', '中秋节', 'holiday', '中秋节'),
      (lower(hex(randomblob(16))), '2026-10-01', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2026-10-02', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2026-10-03', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2026-10-04', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2026-10-05', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2026-10-06', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2026-10-07', '国庆节', 'holiday', '国庆节'),
      (lower(hex(randomblob(16))), '2026-10-08', '国庆节', 'holiday', '国庆节'),
      -- 2026年补班
      (lower(hex(randomblob(16))), '2026-02-15', '春节补班', 'workday', '春节调休补班'),
      (lower(hex(randomblob(16))), '2026-02-28', '春节补班', 'workday', '春节调休补班'),
      (lower(hex(randomblob(16))), '2026-04-11', '清明补班', 'workday', '清明节调休补班'),
      (lower(hex(randomblob(16))), '2026-04-25', '劳动节补班', 'workday', '劳动节调休补班'),
      (lower(hex(randomblob(16))), '2026-05-09', '劳动节补班', 'workday', '劳动节调休补班'),
      (lower(hex(randomblob(16))), '2026-09-12', '中秋补班', 'workday', '中秋节调休补班'),
      (lower(hex(randomblob(16))), '2026-10-10', '国庆补班', 'workday', '国庆节调休补班')
    `)
  } catch (e) {}

  // 插入默认考勤配置
  try {
    sqlite.exec(`
      INSERT OR IGNORE INTO attendance_config (id, key, value, description) VALUES 
      (lower(hex(randomblob(16))), 'work_start_time', '09:00', '上班时间'),
      (lower(hex(randomblob(16))), 'work_end_time', '18:00', '下班时间'),
      (lower(hex(randomblob(16))), 'late_threshold', '09:10', '迟到阈值'),
      (lower(hex(randomblob(16))), 'early_leave_threshold', '17:50', '早退阈值'),
      (lower(hex(randomblob(16))), 'work_hours_per_day', '8', '每日工作时长'),
      (lower(hex(randomblob(16))), 'rest_start', '12:00', '午休开始'),
      (lower(hex(randomblob(16))), 'rest_end', '13:00', '午休结束'),
      (lower(hex(randomblob(16))), 'check_in_radius', '500', '打卡半径（米）'),
      (lower(hex(randomblob(16))), 'office_latitude', '30.5928', '办公地点纬度'),
      (lower(hex(randomblob(16))), 'office_longitude', '114.3055', '办公地点经度')
    `)
  } catch (e) {}

  // 插入更多默认审批流程
  try {
    sqlite.exec(`
      INSERT OR IGNORE INTO workflow_definitions (id, name, type, description, form_schema, flow_config, is_active) VALUES
      ('00000000-0000-0000-0000-000000000105', '加班申请', 'overtime', '员工加班审批流程',
       '{"fields":[{"name":"date","label":"加班日期","type":"date"},{"name":"startTime","label":"开始时间","type":"time"},{"name":"endTime","label":"结束时间","type":"time"},{"name":"reason","label":"加班原因","type":"textarea"}]}',
       '{"steps":[{"name":"部门主管审批","approver":"manager"}]}',
       1),
      ('00000000-0000-0000-0000-000000000106', '补卡申请', 'makeup_clock', '考勤补卡审批流程',
       '{"fields":[{"name":"date","label":"补卡日期","type":"date"},{"name":"clockType","label":"补卡类型","type":"select","options":["上班","下班"]},{"name":"reason","label":"补卡原因","type":"textarea"}]}',
       '{"steps":[{"name":"部门主管审批","approver":"manager"}]}',
       1),
      ('00000000-0000-0000-0000-000000000107', '出差申请', 'business_trip', '出差审批流程',
       '{"fields":[{"name":"destination","label":"目的地","type":"text"},{"name":"startDate","label":"开始日期","type":"date"},{"name":"endDate","label":"结束日期","type":"date"},{"name":"transport","label":"交通工具","type":"select","options":["飞机","高铁","汽车","其他"]},{"name":"purpose","label":"出差目的","type":"textarea"}]}',
       '{"steps":[{"name":"部门主管审批","approver":"manager"},{"name":"财务审批","approver":"finance"}]}',
       1),
      ('00000000-0000-0000-0000-000000000108', '用车申请', 'vehicle', '用车审批流程',
       '{"fields":[{"name":"usageDate","label":"用车日期","type":"date"},{"name":"usageTime","label":"用车时段","type":"text"},{"name":"destination","label":"目的地","type":"text"},{"name":"passengers","label":"乘车人数","type":"number"},{"name":"purpose","label":"用车事由","type":"textarea"}]}',
       '{"steps":[{"name":"行政审批","approver":"admin"}]}',
       1),
      ('00000000-0000-0000-0000-000000000109', '物品领用', 'item_request', '办公物品领用审批',
       '{"fields":[{"name":"itemName","label":"物品名称","type":"text"},{"name":"quantity","label":"领用数量","type":"number"},{"name":"usage","label":"用途说明","type":"textarea"}]}',
       '{"steps":[{"name":"部门主管审批","approver":"manager"}]}',
       1),
      ('00000000-0000-0000-0000-000000000110', '调休申请', 'time_off', '调休审批流程',
       '{"fields":[{"name":"startDate","label":"开始日期","type":"date"},{"name":"endDate","label":"结束日期","type":"date"},{"name":"hours","label":"调休时长（小时）","type":"number"},{"name":"reason","label":"调休原因","type":"textarea"}]}',
       '{"steps":[{"name":"部门主管审批","approver":"manager"}]}',
       1),
      ('00000000-0000-0000-0000-000000000111', '转岗申请', 'transfer', '员工转岗审批流程',
       '{"fields":[{"name":"fromDepartment","label":"原部门","type":"text"},{"name":"toDepartment","label":"目标部门","type":"text"},{"name":"fromPosition","label":"原岗位","type":"text"},{"name":"toPosition","label":"目标岗位","type":"text"},{"name":"effectiveDate","label":"生效日期","type":"date"},{"name":"reason","label":"转岗原因","type":"textarea"}]}',
       '{"steps":[{"name":"原部门主管审批","approver":"manager"},{"name":"目标部门主管审批","approver":"manager"},{"name":"HR审批","approver":"hr"}]}',
       1),
      ('00000000-0000-0000-0000-000000000112', '离职申请', 'resignation', '员工离职审批流程',
       '{"fields":[{"name":"lastWorkingDate","label":"最后工作日","type":"date"},{"name":"resignationReason","label":"离职原因","type":"textarea"},{"name":"handoverPerson","label":"交接人","type":"text"}]}',
       '{"steps":[{"name":"部门主管审批","approver":"manager"},{"name":"HR审批","approver":"hr"},{"name":"财务审批","approver":"finance"}]}',
       1),
      ('00000000-0000-0000-0000-000000000113', '子任务删除', 'subtask_delete', '子任务删除审批流程',
       '{"fields":[{"name":"taskId","label":"任务ID","type":"text"},{"name":"taskTitle","label":"任务标题","type":"text"},{"name":"projectId","label":"项目ID","type":"text"},{"name":"reason","label":"删除原因","type":"textarea"}]}',
       '{"steps":[{"name":"管理员审批","approver":"admin"}]}',
       1)
     `)
  } catch (e) {}

  // ==================== 财务管理 - 报销表 ====================
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS expense_reimbursements (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        applicant_id TEXT NOT NULL REFERENCES users(id),
        applicant_name TEXT,
        reimbursement_date DATE NOT NULL,
        reimbursement_month TEXT NOT NULL,
        project_name TEXT,
        total_amount REAL NOT NULL DEFAULT 0,
        invoice_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expense_items (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        reimbursement_id TEXT NOT NULL REFERENCES expense_reimbursements(id) ON DELETE CASCADE,
        expense_category TEXT NOT NULL,
        expense_detail TEXT NOT NULL,
        description TEXT,
        amount REAL NOT NULL DEFAULT 0,
        invoice_code TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)
  } catch (e) {
    console.error('Create expense tables error:', e)
  }
}

// 初始化表
initTables()
