import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'admin' | 'manager' | 'member'

// 权限定义（与后端保持一致）
export const PERMISSION_DEFINITIONS = {
  // 项目管理权限
  'project:create': { label: '新建项目', category: 'project' },
  'project:edit': { label: '编辑项目', category: 'project' },
  'project:delete': { label: '删除项目', category: 'project' },
  'project:view': { label: '查看项目', category: 'project' },
  'project:archive': { label: '归档项目', category: 'project' },
  'project:pause': { label: '暂停/恢复项目', category: 'project' },
  'project:manageAll': { label: '管理所有项目', category: 'project' },
  
  // 任务管理权限
  'task:create': { label: '创建任务', category: 'task' },
  'task:edit': { label: '编辑任务', category: 'task' },
  'task:assign': { label: '分配任务', category: 'task' },
  'task:review': { label: '审核任务', category: 'task' },
  'task:statusChange': { label: '修改任务状态', category: 'task' },
  'task:view': { label: '查看任务', category: 'task' },
  
  // 人事管理权限
  'hr:view': { label: '查看人事信息', category: 'hr' },
  'hr:employee': { label: '员工管理', category: 'hr' },
  'hr:attendance': { label: '考勤管理', category: 'hr' },
  'hr:asset': { label: '资产管理', category: 'hr' },
  'hr:contract': { label: '合同管理', category: 'hr' },
  'hr:supplier': { label: '供应商管理', category: 'hr' },
  'hr:alert': { label: '智能预警', category: 'hr' },
  'hr:dailyReport': { label: '日报管理', category: 'hr' },
  'hr:outsourcing': { label: '委外管理', category: 'hr' },
  
  // 审批权限
  'workflow:submit': { label: '提交审批', category: 'workflow' },
  'workflow:approve': { label: '审批处理', category: 'workflow' },
  'workflow:manage': { label: '管理审批流程', category: 'workflow' },
  
  // 财务管理权限
  'finance:view': { label: '查看财务', category: 'finance' },
  'finance:manage': { label: '管理财务', category: 'finance' },
  'finance:approve': { label: '财务审批', category: 'finance' },

  // 系统权限
  'system:settings': { label: '系统设置', category: 'system' },
  'system:report': { label: '查看报表', category: 'system' },
  'system:userManage': { label: '用户权限管理', category: 'system' },
  'system:addressBook': { label: '通讯录管理', category: 'system' },
  'system:dataExport': { label: '数据导出', category: 'system' },
} as const

export type PermissionKey = keyof typeof PERMISSION_DEFINITIONS

// 权限分类
export const PERMISSION_CATEGORIES = [
  { key: 'project', label: '项目管理' },
  { key: 'task', label: '任务管理' },
  { key: 'hr', label: '人事管理' },
  { key: 'workflow', label: '审批流程' },
  { key: 'finance', label: '财务管理' },
  { key: 'system', label: '系统权限' },
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

interface User {
  id: string
  name: string
  email?: string
  avatar?: string
  isAdmin: boolean
  role: Role
  permissions?: PermissionKey[]
}

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null })
    }),
    {
      name: 'oa-auth-storage'
    }
  )
)

// 获取当前用户的权限列表
export function getUserPermissions(): PermissionKey[] {
  const user = useAuthStore.getState().user
  if (!user) return []
  
  if (user.isAdmin) {
    return Object.keys(PERMISSION_DEFINITIONS) as PermissionKey[]
  }
  
  // 如果用户有自定义权限
  if (user.permissions && user.permissions.length > 0) {
    return user.permissions
  }
  
  // 使用角色默认权限
  const role = user.role || 'member'
  return DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.member
}

// 旧权限到新权限的映射（兼容层）
const LEGACY_PERMISSION_MAP: Record<string, PermissionKey> = {
  'canManageProjects': 'project:manageAll',
  'canManageEquipment': 'hr:asset',
  'canViewReports': 'system:report',
  'canManageSettings': 'system:settings',
  'canApproveWorkflow': 'workflow:approve',
  'canViewAllData': 'project:manageAll',
  'canManageWorkflows': 'workflow:manage',
  'canManageAttendanceRules': 'hr:attendance',
  'canManageAddressBook': 'system:addressBook',
  'canManageSuppliers': 'hr:contract',
  'canManageUserPermissions': 'system:userManage',
}

// 检查是否有指定权限（支持新旧两种格式）
export function hasPermission(permission: PermissionKey | string): boolean {
  const user = useAuthStore.getState().user
  if (!user) return false
  if (user.isAdmin) return true
  
  const permissions = getUserPermissions()
  
  // 如果是新权限格式
  if (permissions.includes(permission as PermissionKey)) {
    return true
  }
  
  // 如果是旧权限格式，映射到新权限
  const mappedPermission = LEGACY_PERMISSION_MAP[permission]
  if (mappedPermission) {
    return permissions.includes(mappedPermission)
  }
  
  return false
}

// 检查是否有任意一个权限
export function hasAnyPermission(permissions: PermissionKey[]): boolean {
  const user = useAuthStore.getState().user
  if (!user) return false
  if (user.isAdmin) return true
  
  const userPerms = getUserPermissions()
  return permissions.some(p => userPerms.includes(p))
}

// 检查是否有所有权限
export function hasAllPermissions(permissions: PermissionKey[]): boolean {
  const user = useAuthStore.getState().user
  if (!user) return false
  if (user.isAdmin) return true
  
  const userPerms = getUserPermissions()
  return permissions.every(p => userPerms.includes(p))
}

// 检查是否为管理员
export function isAdmin(): boolean {
  const user = useAuthStore.getState().user
  return user?.isAdmin || false
}

// 兼容旧版权限（保留用于过渡）
export const PERMISSIONS = {
  admin: {
    canManageUsers: true,
    canManageProjects: true,
    canManageEquipment: true,
    canViewReports: true,
    canManageSettings: true,
    canApproveWorkflow: true,
    canViewAllData: true,
    canManageWorkflows: true,
    canManageAttendanceRules: true,
    canManageAddressBook: true,
    canManageSuppliers: true,
    canManageUserPermissions: true,
  },
  manager: {
    canManageUsers: false,
    canManageProjects: true,
    canManageEquipment: true,
    canViewReports: true,
    canManageSettings: false,
    canApproveWorkflow: true,
    canViewAllData: false,
    canManageWorkflows: false,
    canManageAttendanceRules: false,
    canManageAddressBook: true,
    canManageSuppliers: true,
    canManageUserPermissions: false,
  },
  member: {
    canManageUsers: false,
    canManageProjects: false,
    canManageEquipment: false,
    canViewReports: false,
    canManageSettings: false,
    canApproveWorkflow: false,
    canViewAllData: false,
    canManageWorkflows: false,
    canManageAttendanceRules: false,
    canManageAddressBook: false,
    canManageSuppliers: false,
    canManageUserPermissions: false,
  }
} as const

export function hasPermissionLegacy(permission: keyof typeof PERMISSIONS.admin): boolean {
  const user = useAuthStore.getState().user
  if (!user) return false
  if (user.isAdmin) return true
  
  const role = user.role || 'member'
  return PERMISSIONS[role]?.[permission] ?? false
}
