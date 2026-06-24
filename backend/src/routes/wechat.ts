// @ts-nocheck
import { getUser } from '../types/user'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db, sqlite } from '../db/index.js'
import { users } from '../schema/index.js'
import { eq } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import { SignJWT } from 'jose'
import crypto from 'crypto'

// 企业微信配置
import { config } from 'dotenv'
config({ path: './.env' })

const WECHAT_CORP_ID = process.env.WECHAT_CORP_ID || ''
const WECHAT_AGENT_ID = process.env.WECHAT_AGENT_ID || ''
const WECHAT_SECRET = process.env.WECHAT_SECRET || ''

console.log('[WeChat] CORP_ID:', WECHAT_CORP_ID ? '已配置' : '未配置')
console.log('[WeChat] SECRET:', WECHAT_SECRET ? '已配置' : '未配置')

// 简单的内存缓存
let accessTokenCache: { token: string; expiresAt: number } | null = null

// 获取企业微信 AccessToken
async function getWechatAccessToken(): Promise<string | null> {
  // 检查缓存
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
    return accessTokenCache.token
  }
  
  if (!WECHAT_CORP_ID || !WECHAT_SECRET) {
    console.log('企业微信未配置')
    return null
  }
  
  try {
    const response = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${WECHAT_CORP_ID}&corpsecret=${WECHAT_SECRET}`
    )
    const data = await response.json()
    
    if (data.access_token) {
      accessTokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 300) * 1000 // 提前5分钟过期
      }
      return data.access_token
    }
  } catch (error) {
    console.error('获取企业微信 AccessToken 失败:', error)
  }
  
  return null
}

// 获取用户信息
async function getWechatUserInfo(userId: string, accessToken: string): Promise<any> {
  try {
    const response = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=${accessToken}&userid=${userId}`
    )
    return await response.json()
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return null
  }
}

// 发送消息给用户
async function sendWechatMessage(userId: string, message: { title: string; description: string; url?: string }): Promise<boolean> {
  const accessToken = await getWechatAccessToken()
  if (!accessToken) return false
  
  try {
    // 发送纯文本消息，不需要URL
    const response = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          touser: userId,
          msgtype: 'text',
          agentid: WECHAT_AGENT_ID,
          text: {
            content: `${message.title}\n\n${message.description}`
          }
        })
      }
    )
    
    const data = await response.json()
    return data.errcode === 0
  } catch (error) {
    console.error('发送消息失败:', error)
    return false
  }
}

export const wechatRoutes = new Hono()

// 企业微信 OAuth 登录
wechatRoutes.get('/auth', async (c) => {
  const redirectUri = encodeURIComponent(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/wechat/callback`)
  const state = crypto.randomUUID()
  
  const authUrl = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${WECHAT_CORP_ID}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_base&state=${state}#wechat_redirect`
  
  return c.redirect(authUrl)
})

// 企业微信登录回调
wechatRoutes.get('/callback', async (c) => {
  const code = c.req.query('code')
  
  if (!code) {
    return c.json({ success: false, message: '授权失败' }, 400)
  }
  
  const accessToken = await getWechatAccessToken()
  if (!accessToken) {
    return c.json({ success: false, message: '企业微信配置错误' }, 500)
  }
  
  try {
    // 获取用户 ID
    const response = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo?access_token=${accessToken}&code=${code}`
    )
    const data = await response.json()
    
    if (data.UserId) {
      // 查找或创建用户
      let user = await db.query.users.findFirst({
        where: eq(users.wechatUserId, data.UserId)
      })
      
      if (!user) {
        // 获取企业微信用户信息
        const wechatUser = await getWechatUserInfo(data.UserId, accessToken)
        
        // 创建新用户
        const [newUser] = await db.insert(users).values({
          wechatUserId: data.UserId,
          name: wechatUser?.name || '新用户',
          email: wechatUser?.email,
          phone: wechatUser?.mobile,
          departmentName: wechatUser?.department?.[0]?.name
        }).returning()
        
        user = newUser
      }
      
      // 生成 JWT
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')
      const token = await new SignJWT({ userId: user.id })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('24h')
        .sign(secret)
      
      // 重定向到前端，带上 token
      return c.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?token=${token}`)
    }
    
    return c.json({ success: false, message: '获取用户信息失败' }, 400)
  } catch (error) {
    console.error('企业微信登录失败:', error)
    return c.json({ success: false, message: '登录失败' }, 500)
  }
})

// 获取企业微信配置（供前端使用 JS-SDK）
wechatRoutes.get('/config', async (c) => {
  const url = c.req.query('url') || ''
  
  if (!WECHAT_CORP_ID) {
    return c.json({ success: false, message: '企业微信未配置' }, 500)
  }
  
  const accessToken = await getWechatAccessToken()
  if (!accessToken) {
    return c.json({ success: false, message: '获取 AccessToken 失败' }, 500)
  }
  
  try {
    // 获取 jsapi_ticket
    const ticketResponse = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/get_jsapi_ticket?access_token=${accessToken}`
    )
    const ticketData = await ticketResponse.json()
    
    if (ticketData.ticket) {
      const nonceStr = crypto.randomUUID().replace(/-/g, '')
      const timestamp = Math.floor(Date.now() / 1000)
      const string1 = `jsapi_ticket=${ticketData.ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`
      const signature = crypto.createHash('sha1').update(string1).digest('hex')
      
      return c.json({
        success: true,
        data: {
          corpId: WECHAT_CORP_ID,
          agentId: WECHAT_AGENT_ID,
          timestamp,
          nonceStr,
          signature
        }
      })
    }
  } catch (error) {
    console.error('获取 JS-SDK 配置失败:', error)
  }
  
  return c.json({ success: false, message: '获取配置失败' }, 500)
})

// 发送消息（测试用）
wechatRoutes.post('/send', zValidator('json', z.object({
  userId: z.string(),
  title: z.string(),
  description: z.string(),
  url: z.string().optional()
})), async (c) => {
  const body = c.req.valid('json')
  const success = await sendWechatMessage(body.userId, {
    title: body.title,
    description: body.description,
    url: body.url
  })
  
  return c.json({ success, message: success ? '发送成功' : '发送失败' })
})

// 获取部门列表
wechatRoutes.get('/departments', async (c) => {
  const accessToken = await getWechatAccessToken()
  if (!accessToken) {
    return c.json({ success: false, message: '企业微信配置错误' }, 500)
  }
  
  try {
    const response = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/department/list?access_token=${accessToken}`
    )
    const data = await response.json()
    
    if (data.errcode === 0) {
      return c.json({ success: true, data: data.department })
    }
    return c.json({ success: false, message: data.errmsg }, 500)
  } catch (error) {
    console.error('获取部门列表失败:', error)
    return c.json({ success: false, message: '获取部门列表失败' }, 500)
  }
})

// 获取部门成员
wechatRoutes.get('/department-users/:id', async (c) => {
  const deptId = c.req.param('id')
  const accessToken = await getWechatAccessToken()
  if (!accessToken) {
    return c.json({ success: false, message: '企业微信配置错误' }, 500)
  }
  
  try {
    // 获取部门所有成员（包括子部门）
    const response = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/user/list?access_token=${accessToken}&department_id=${deptId}&fetch_child=1&status=0`
    )
    const data = await response.json()
    
    if (data.errcode === 0) {
      return c.json({ success: true, data: data.userlist })
    }
    return c.json({ success: false, message: data.errmsg }, 500)
  } catch (error) {
    console.error('获取部门成员失败:', error)
    return c.json({ success: false, message: '获取部门成员失败' }, 500)
  }
})

// 同步通讯录（从企业微信拉取用户）
wechatRoutes.post('/sync-address-book', authMiddleware, async (c) => {
  const currentUser = getUser(c)
  if (!currentUser.isAdmin) {
    return c.json({ success: false, message: '无权限' }, 403)
  }

  const accessToken = await getWechatAccessToken()
  if (!accessToken) {
    return c.json({ success: false, message: '企业微信配置错误' }, 500)
  }

  try {
    // 1. 获取所有部门
    const deptResponse = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/department/list?access_token=${accessToken}`
    )
    const deptData = await deptResponse.json()

    if (deptData.errcode !== 0) {
      return c.json({ success: false, message: deptData.errmsg }, 500)
    }

    const departments = deptData.department || []
    const allUsers: any[] = []

    // 2. 获取每个部门的成员（加延迟避免触发企业微信频率限制）
    for (const dept of departments) {
      await new Promise(r => setTimeout(r, 200))
      const userResponse = await fetch(
        `https://qyapi.weixin.qq.com/cgi-bin/user/list?access_token=${accessToken}&department_id=${dept.id}&fetch_child=1&status=0`
      )
      const userData = await userResponse.json()

      if (userData.errcode === 0 && userData.userlist) {
        allUsers.push(...userData.userlist.map((u: any) => ({
          ...u,
          departmentName: dept.name
        })))
      } else if (userData.errcode !== 0) {
        console.warn(`获取部门 ${dept.id} 成员失败:`, userData.errmsg)
      }
    }

    // 3. 同步到本地数据库（全部使用原生SQL避免Drizzle ORM问题）
    let created = 0
    let updated = 0
    const now = new Date().toISOString()

    for (const wechatUser of allUsers) {
      // 检查用户是否已存在
      const existingUser = await db.query.users.findFirst({
        where: eq(users.wechatUserId, wechatUser.userid)
      })

      if (existingUser) {
        // 只同步姓名、手机、邮箱、部门，不覆盖本地已激活状态
        sqlite.prepare(`
          UPDATE users SET name = ?, phone = ?, email = ?, avatar = ?, department_name = ?, updated_at = ?
          WHERE id = ?
        `).run(
          wechatUser.name,
          wechatUser.mobile || existingUser.phone,
          wechatUser.email || existingUser.email,
          wechatUser.avatar || null,
          wechatUser.department?.name || wechatUser.departmentName || null,
          now,
          existingUser.id
        )
        updated++
      } else {
        // 使用原生SQL插入
        const id = crypto.randomUUID()
        sqlite.prepare(`
          INSERT INTO users (id, wechat_user_id, name, phone, email, avatar, department_name, is_active, is_admin, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 'member', ?, ?)
        `).run(
          id,
          wechatUser.userid,
          wechatUser.name,
          wechatUser.mobile || null,
          wechatUser.email || null,
          wechatUser.avatar || null,
          wechatUser.department?.name || wechatUser.departmentName || null,
          now,
          now
        )
        created++
      }
    }

    return c.json({
      success: true,
      data: {
        total: allUsers.length,
        created,
        updated,
        departments: departments.length
      }
    })
  } catch (error) {
    console.error('同步通讯录失败:', error)
    return c.json({ success: false, message: '同步通讯录失败' }, 500)
  }
})

// 导出函数供其他模块使用
export { getWechatAccessToken, sendWechatMessage }
