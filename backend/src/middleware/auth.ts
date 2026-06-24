import { createMiddleware } from 'hono/factory'
import { jwtVerify } from 'jose'
import { db, sqlite } from '../db/index.js'
import { users } from '../schema/index.js'
import { eq } from 'drizzle-orm'

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, message: '未授权' }, 401)
  }
  
  const token = authHeader.substring(7)
  
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')
    const { payload } = await jwtVerify(token, secret)
    
    // 使用原生SQL确保获取所有字段
    const user = sqlite.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId as string) as any
    
    if (!user || !user.is_active) {
      return c.json({ success: false, message: '用户不存在或已禁用' }, 401)
    }
    
    // 设置完整的用户信息到 context
    c.set('user', {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      departmentId: user.department_id,
      departmentName: user.department_name,
      role: user.role || 'member',
      isAdmin: user.is_admin,
      isActive: user.is_active,
      permissions: user.permissions
    })
    await next()
  } catch (error: any) {
    console.error('[authMiddleware] jwtVerify failed:', error?.message || error)
    return c.json({ success: false, message: 'Token 无效' }, 401)
  }
})