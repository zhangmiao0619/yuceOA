import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from '../schema/index.js'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const DB_PATH = process.env.DB_PATH || './data/oa_system.db'

// 确保数据目录存在
const dbDir = dirname(DB_PATH)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

const sqlite = new Database(DB_PATH)

// 启用外键
sqlite.exec('PRAGMA foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

// 初始化表
export function initTables() {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      wechat_user_id TEXT UNIQUE,
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
    INSERT OR IGNORE INTO users (id, name, email, is_admin) 
    VALUES ('00000000-0000-0000-0000-000000000001', '管理员', 'admin@example.com', 1);
  `
  
  sqlite.exec(sql)
  console.log('✅ 数据库表初始化完成')
}

// 初始化表
initTables()
