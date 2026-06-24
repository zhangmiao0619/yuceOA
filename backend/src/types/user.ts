export interface User {
  id: string
  username: string
  name: string
  email: string | null
  phone: string | null
  avatar: string | null
  departmentId: string | null
  departmentName: string | null
  role: 'admin' | 'manager' | 'member'
  isAdmin: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const getUser = (c: any): User | undefined => c.get('user') as User | undefined
