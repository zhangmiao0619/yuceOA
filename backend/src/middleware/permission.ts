import { createMiddleware } from 'hono/factory'
import type { Context, Next } from 'hono'

// ==========================================
// 细粒度权限定义
// ==========================================
export const PERMISSION_DEFINITIONS = {
  // 项目管理权限
  'project:create': { label: '新建项目', category: 'project', description: '创建新项目' },
  'project:edit': { label: '编辑项目', category: 'project', description: '编辑已有项目信息' },
  'project:delete': { label: '删除项目', category: 'project', description: '删除项目' },
  'project:view': { label: '查看项目', category: 'project', description: '查看项目列表和详情' },
  'project:archive': { label: '归档项目', category: 'project', description: '归档已完成项目' },
  'project:pause': { label: '暂停/恢复项目', category: 'project', description: '申请暂停或恢复项目' },
  'project:manageAll': { label: '管理所有项目', category: 'project', description: '查看和管理所有人的项目' },
  
  // 任务管理权限
  'task:create': { label: '创建任务', category: 'task', description: '创建新任务' },
  'task:edit': { label: '编辑任务', category: 'task', description: '编辑任务信息' },
  'task:assign': { label: '分配任务', category: 'task', description: '给他人分配任务' },
  'task:review': { label: '审核任务', category: 'task', description: '审核任务提交' },
  'task:statusChange': { label: '修改任务状态', category: 'task', description: '修改任务执行状态' },
  'task:view': { label: '查看任务', category: 'task', description: '查看任务列表和详情' },
  
  // 人事管理权限
  'hr:view': { label: '查看人事信息', category: 'hr', description: '查看人事相关页面' },
  'hr:employee': { label: '员工管理', category: 'hr', description: '添加、编辑、删除员工' },
  'hr:attendance': { label: '考勤管理', category: 'hr', description: '管理考勤规则和记录' },
  'hr:asset': { label: '资产管理', category: 'hr', description: '管理公司资产' },
  'hr:contract': { label: '合同管理', category: 'hr', description: '管理项目合同' },
  'hr:supplier': { label: '供应商管理', category: 'hr', description: '管理供应商信息' },
  'hr:alert': { label: '智能预警', category: 'hr', description: '查看和处理预警' },
  'hr:dailyReport': { label: '日报管理', category: 'hr', description: '查看和管理日报' },
  'hr:outsourcing': { label: '委外管理', category: 'hr', description: '管理委外信息' },
  
  // 审批权限
  'workflow:submit': { label: '提交审批', category: 'workflow', description: '提交各类审批申请' },
  'workflow:approve': { label: '审批处理', category: 'workflow', description: '审批他人提交的申请' },
  'workflow:manage': { label: '管理审批流程', category: 'workflow', description: '配置和管理审批流程' },

  // 财务管理权限
  'finance:view': { label: '查看财务', category: 'finance', description: '查看财务数据' },
  'finance:manage': { label: '管理财务', category: 'finance', description: '管理财务数据' },
  'finance:approve': { label: '财务审批', category: 'finance', description: '审批报销申请' },

  // 系统权限
  'system:settings': { label: '系统设置', category: 'system', description: '系统配置和管理员设置' },
  'system:report': { label: '查看报表', category: 'system', description: '查看统计报表' },
  'system:userManage': { label: '用户权限管理', category: 'system', description: '管理用户和权限' },
  'system:addressBook': { label: '通讯录管理', category: 'system', description: '管理通讯录' },
  'system:dataExport': { label: '数据导出', category: 'system', description: '导出系统数据' },
} as const

export type PermissionKey = keyof typeof PERMISSION_DEFINITIONS

// 权限分类
export const PERMISSION_CATEGORIES = [
  { key: 'project', label: '项目管理', icon: 'ProjectOutlined' },
  { key: 'task', label: '任务管理', icon: 'CheckSquareOutlined' },
  { key: 'hr', label: '人事管理', icon: 'TeamOutlined' },
  { key: 'workflow', label: '审批流程', icon: 'FileTextOutlined' },
  { key: 'finance', label: '财务管理', icon: 'DollarOutlined' },
  { key: 'system', label: '系统权限', icon: 'SettingOutlined' },
]

// 默认权限配置（按角色）
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  admin: Object.keys(PERMISSION_DEFINITIONS) as PermissionKey[],
  manager: [
    'project:create', 'project:edit', 'project:view', 'project:pause',
    'task:create', 'task:edit', 'task:assign', 'task:review', 'task:view',
    'hr:view', 'hr:attendance', 'hr:asset', 'hr:contract', 'hr:alert', 'hr:dailyReport',
    'workflow:submit', 'workflow:approve',
    'finance:view', 'finance:manage', 'finance:approve',
    'system:report', 'system:addressBook',
  ],
  member: [
    'project:view',
    'task:view',
    'workflow:submit',
    'hr:view',
    'finance:view',
  ],
}

// 获取用户的权限列表
export function getUserPermissions(user: any): PermissionKey[] {
  if (!user) return []
  
  // 管理员拥有所有权限
  if (user.isAdmin) {
    return Object.keys(PERMISSION_DEFINITIONS) as PermissionKey[]
  }
  
  // 如果用户有自定义权限，使用自定义权限
  if (user.permissions) {
    try {
      const customPerms = typeof user.permissions === 'string' 
        ? JSON.parse(user.permissions) 
        : user.permissions
      if (Array.isArray(customPerms) && customPerms.length > 0) {
        return customPerms as PermissionKey[]
      }
    } catch (e) {
      console.error('解析用户权限失败:', e)
    }
  }
  
  // 否则使用角色默认权限
  const role = user.role || 'member'
  return DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.member
}

// 检查用户是否有指定权限
export function hasPermission(user: any, permission: PermissionKey): boolean {
  if (!user) return false
  if (user.isAdmin) return true
  
  const permissions = getUserPermissions(user)
  return permissions.includes(permission)
}

// 检查用户是否有任意一个权限
export function hasAnyPermission(user: any, permissions: PermissionKey[]): boolean {
  if (!user) return false
  if (user.isAdmin) return true
  
  const userPerms = getUserPermissions(user)
  return permissions.some(p => userPerms.includes(p))
}

// 检查用户是否有所有权限
export function hasAllPermissions(user: any, permissions: PermissionKey[]): boolean {
  if (!user) return false
  if (user.isAdmin) return true
  
  const userPerms = getUserPermissions(user)
  return permissions.every(p => userPerms.includes(p))
}

// Hono 中间件：检查单个权限
export const requirePermission = (permission: PermissionKey) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as any
    
    if (!user) {
      return c.json({ success: false, message: '未授权' }, 401)
    }
    
    if (!hasPermission(user, permission)) {
      return c.json({ success: false, message: `无权执行此操作，需要权限: ${PERMISSION_DEFINITIONS[permission]?.label || permission}` }, 403)
    }
    
    await next()
  }
}

// Hono 中间件：检查任意权限
export const requireAnyPermission = (...permissions: PermissionKey[]) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as any
    
    if (!user) {
      return c.json({ success: false, message: '未授权' }, 401)
    }
    
    if (!hasAnyPermission(user, permissions)) {
      return c.json({ success: false, message: '无权执行此操作' }, 403)
    }
    
    await next()
  }
}

// 仅管理员可用
export const requireAdmin = async (c: Context, next: Next) => {
  const user = c.get('user') as any
  
  if (!user) {
    return c.json({ success: false, message: '未授权' }, 401)
  }
  
  if (!user.isAdmin) {
    return c.json({ success: false, message: '需要管理员权限' }, 403)
  }
  
  await next()
}

// 管理员或经理可用
export const requireManagerOrAdmin = async (c: Context, next: Next) => {
  const user = c.get('user') as any
  
  if (!user) {
    return c.json({ success: false, message: '未授权' }, 401)
  }
  
  if (!user.isAdmin && user.role !== 'manager') {
    return c.json({ success: false, message: '需要管理员或经理权限' }, 403)
  }
  
  await next()
}
