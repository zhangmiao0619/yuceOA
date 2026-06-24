// @ts-nocheck
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db, sqlite } from '../db/index.js'
import { users, systemConfig } from '../schema/index.js'
import { eq } from 'drizzle-orm'
import { SignJWT } from 'jose'

export const authRoutes = new Hono()

// 企业微信配置 - 已禁用（2026-05-09）
// import { config } from 'dotenv'
// config({ path: './.env' })
// const WECHAT_CORP_ID = process.env.WECHAT_CORP_ID || ''
// const WECHAT_AGENT_ID = process.env.WECHAT_AGENT_ID || ''

// 普通用户名/密码登录
authRoutes.post('/login', zValidator('json', z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})), async (c) => {
  try {
    const { username, password } = c.req.valid('json')
    
    // 查找用户 - 使用原生SQL确保获取role字段
    const userRow = sqlite.prepare('SELECT * FROM users WHERE username = ?').get(username) as any
    
    if (!userRow) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401)
    }
    
    if (!userRow.is_active) {
      return c.json({ success: false, message: '账号已禁用' }, 403)
    }
    
    // 验证密码：优先使用数据库存储的密码，兼容旧规则 username + '123'
    const fallbackPassword = username + '123'
    const storedPassword = userRow.password || fallbackPassword
    if (password !== storedPassword && password !== fallbackPassword) {
      return c.json({ success: false, message: '用户名或密码错误' }, 401)
    }
    
    // 生成 JWT
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET not set')
      return c.json({ success: false, message: '服务器配置错误' }, 500)
    }
    
    const secret = new TextEncoder().encode(jwtSecret)
    const token = await new SignJWT({
      userId: userRow.id,
      username: userRow.username,
      isAdmin: !!userRow.is_admin
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret)
    
    const userPermissions = userRow.permissions 
      ? (typeof userRow.permissions === 'string' ? JSON.parse(userRow.permissions) : userRow.permissions)
      : null

    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: userRow.id,
          username: userRow.username,
          name: userRow.name,
          email: userRow.email,
          avatar: userRow.avatar,
          isAdmin: !!userRow.is_admin,
          departmentName: userRow.department_name,
          role: userRow.role || 'member',
          permissions: userPermissions
        }
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ success: false, message: '登录失败' }, 500)
  }
})

// 开发模式快速登录（仅用于测试）
authRoutes.post('/dev-login', async (c) => {
  try {
    // 查找或创建默认管理员
    let user = await db.query.users.findFirst({
      where: eq(users.username, 'admin')
    })
    
    if (!user) {
      const [newUser] = await db.insert(users).values({
        username: 'admin',
        password: 'admin123',
        name: '管理员',
        email: 'admin@example.com',
        isAdmin: true,
        isActive: true
      }).returning()
      user = newUser
      console.log('Created default admin user')
    }
    
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    const secret = new TextEncoder().encode(jwtSecret)
    const token = await new SignJWT({
      userId: user.id,
      username: user.username,
      isAdmin: user.isAdmin
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret)
    
    const userPermissions = user.permissions 
      ? (typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions)
      : null

    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          isAdmin: user.isAdmin,
          departmentName: user.departmentName,
          role: user.role || 'member',
          permissions: userPermissions
        }
      }
    })
  } catch (error) {
    console.error('Dev login error:', error)
    return c.json({ success: false, message: '登录失败' }, 500)
  }
})

// 企业微信扫码登录 - 已禁用（2026-05-09）
// 如需重新启用，请恢复以下代码并配置 backend/.env 中的企业微信参数
/*
authRoutes.post('/wechat-login', zValidator('json', z.object({
  code: z.string()
})), async (c) => {
  try {
    const { code } = c.req.valid('json')
    const accessToken = await getWechatAccessToken()
    if (!accessToken) {
      return c.json({ success: false, message: '企业微信未配置或授权失败' }, 500)
    }
    const response = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo?access_token=${accessToken}&code=${code}`
    )
    const data = await response.json()
    if (!data.UserId) {
      console.log('企业微信返回:', data)
      return c.json({ success: false, message: '获取用户信息失败' }, 400)
    }
    const wechatUserId = data.UserId
    const userInfo = await getWechatUserInfo(wechatUserId, accessToken)
    if (!userInfo || userInfo.errcode !== 0) {
      return c.json({ success: false, message: '获取用户详情失败' }, 500)
    }
    let user = await db.query.users.findFirst({
      where: eq(users.wechatUserId, wechatUserId)
    })
    if (!user) {
      const [newUser] = await db.insert(users).values({
        wechatUserId: wechatUserId,
        name: userInfo.name || '未设置姓名',
        avatar: userInfo.avatar || '',
        departmentId: userInfo.department?.[0]?.toString() || '',
        departmentName: userInfo.department?.[1] || '',
        isActive: true
      }).returning()
      user = newUser
      console.log('自动注册新用户:', user.name)
    } else if (!user.isActive) {
      return c.json({ success: false, message: '账号已被禁用' }, 403)
    }
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
    const secret = new TextEncoder().encode(jwtSecret)
    const token = await new SignJWT({
      userId: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      wechatUserId: user.wechatUserId
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret)
    const userPermissions = user.permissions
      ? (typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions)
      : null
    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          isAdmin: user.isAdmin,
          departmentName: user.departmentName,
          role: user.role || 'member',
          permissions: userPermissions
        }
      }
    })
  } catch (error) {
    console.error('Wechat login error:', error)
    return c.json({ success: false, message: '企业微信登录失败' }, 500)
  }
})

authRoutes.get('/wechat-qr-url', async (c) => {
  try {
    const redirectUri = encodeURIComponent(process.env.REACT_APP_API_URL
      ? `${process.env.REACT_APP_API_URL}/api/auth/wechat-callback`
      : 'http://localhost:3000/api/auth/wechat-callback')
    const appId = WECHAT_CORP_ID
    const agentId = WECHAT_AGENT_ID
    const qrUrl = `https://open.work.weixin.qq.com/wwopen/sso/3rd_qrConnect?appid=${appId}&redirect_uri=${redirectUri}&state=wechat_login&usertype=member`
    return c.json({
      success: true,
      data: { qrUrl, appId, agentId }
    })
  } catch (error) {
    console.error('Get wechat QR URL error:', error)
    return c.json({ success: false, message: '获取二维码失败' }, 500)
  }
})

authRoutes.get('/wechat-callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  if (!code) {
    return c.html(`
      <html><head><meta charset="utf-8"></head><body>
        <h2>授权失败</h2><p>未获取到授权码，请重试</p><p><a href="/login">返回登录页</a></p>
      </body></html>
    `)
  }
  try {
    const response = await fetch('http://localhost:3000/api/auth/wechat-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
    const data = await response.json()
    if (data.success) {
      return c.redirect(`/?token=${data.data.token}&user=${encodeURIComponent(JSON.stringify(data.data.user))}`)
    } else {
      return c.html(`
        <html><head><meta charset="utf-8"></head><body>
          <h2>登录失败</h2><p>${data.message}</p><p><a href="/login">返回登录页</a></p>
        </body></html>
      `)
    }
  } catch (error) {
    return c.html(`
      <html><head><meta charset="utf-8"></head><body>
        <h2>登录出错</h2><p><a href="/login">返回登录页</a></p>
      </body></html>
    `)
  }
})

authRoutes.get('/wechat-config', async (c) => {
  try {
    const corpId = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'wechat_corp_id')
    })
    const agentId = await db.query.systemConfig.findFirst({
      where: eq(systemConfig.key, 'wechat_agent_id')
    })
    return c.json({
      success: true,
      data: {
        corpId: corpId?.value || '',
        agentId: agentId?.value || ''
      }
    })
  } catch (error) {
    console.error('Get wechat config error:', error)
    return c.json({ success: false, message: '获取配置失败' }, 500)
  }
})
*/