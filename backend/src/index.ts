import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { join, extname, dirname } from 'path'
import { fileURLToPath } from 'url'

// 加载环境变量
config({ path: './.env' })

import { projectRoutes } from './routes/projects.js'
import { taskRoutes } from './routes/tasks.js'
import { authRoutes } from './routes/auth.js'
import { userRoutes } from './routes/users.js'
import { workflowRoutes } from './routes/workflows.js'
import { timeTrackingRoutes } from './routes/timeTracking.js'
import { reportRoutes } from './routes/reports.js'
import { wechatRoutes } from './routes/wechat.js'
import { uploadRoutes } from './routes/uploads.js'
import { notificationRoutes } from './routes/notifications.js'
import { surveyRoutes } from './routes/survey.js'
import { attendanceRoutes } from './routes/attendance.js'
import { assetRoutes } from './routes/assets.js'
import { alertRoutes } from './routes/alerts.js'
import { dailyReportRoutes } from './routes/dailyReports.js'
import { supplierRoutes } from './routes/suppliers.js'
import { contractRoutes } from './routes/contracts.js'
import { outsourcingRoutes } from './routes/outsourcing.js'
import { financeRoutes } from './routes/finance.js'
import { clientRoutes } from './routes/clients.js'
import { hrRequestRoutes } from './routes/hrRequests.js'
import cropAudit from './plugins/crop-audit/index.js'

const app = new Hono()

// 中间件
app.use('*', logger())
app.use('*', cors({
  origin: '*',
  credentials: true
}))

// 健康检查
app.get('/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }))

// 路由
app.route('/api/auth', authRoutes)
app.route('/api/projects', projectRoutes)
app.route('/api/tasks', taskRoutes)
app.route('/api/users', userRoutes)
app.route('/api/workflows', workflowRoutes)
app.route('/api/time-entries', timeTrackingRoutes)
app.route('/api/reports', reportRoutes)
app.route('/api/wechat', wechatRoutes)
app.route('/api/uploads', uploadRoutes)
app.route('/api/notifications', notificationRoutes)
app.route('/api/survey', surveyRoutes)
app.route('/api/attendance', attendanceRoutes)
app.route('/api/assets', assetRoutes)
app.route('/api/alerts', alertRoutes)
app.route('/api/daily-reports', dailyReportRoutes)
app.route('/api/suppliers', supplierRoutes)
app.route('/api/contracts', contractRoutes)
app.route('/api/outsourcing', outsourcingRoutes)
app.route('/api/finance', financeRoutes)
app.route('/api/clients', clientRoutes)
app.route('/api/hr-requests', hrRequestRoutes)
app.route('/api/crop-audit', cropAudit)

// 静态文件服务（上传的文件）
app.use('/uploads/*', async (c, next) => {
  const { UPLOAD_DIR } = await import('./routes/uploads.js')
  const filePath = c.req.path.replace('/uploads/', '')
  
  try {
    const fs = await import('fs/promises')
    
    const fullPath = join(UPLOAD_DIR, filePath)
    const file = await fs.readFile(fullPath)
    
    const ext = filePath.split('.').pop()?.toLowerCase()
    const contentTypeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      pdf: 'application/pdf',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
    }
    
    return new Response(file, {
      headers: {
        'Content-Type': contentTypeMap[ext || ''] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000'
      }
    })
  } catch {
    return c.json({ success: false, message: '文件不存在' }, 404)
  }
})

// 企业微信验证
app.use('*', async (c, next) => {
  const path = c.req.path
  if (path.startsWith('/WW_verify_')) {
    return c.text('jIjysYzqz5HiOfqw')
  }
  await next()
})

// 前端静态文件（SPA）
const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIST = join(__dirname, '../../frontend/dist')

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

app.get('*', (c) => {
  const reqPath = c.req.path

  // 跳过 API 和上传路径
  if (reqPath.startsWith('/api/') || reqPath.startsWith('/uploads/') || reqPath.startsWith('/WW_verify_')) {
    return c.notFound()
  }

  let filePath = join(FRONTEND_DIST, reqPath === '/' ? 'index.html' : reqPath)

  try {
    const content = readFileSync(filePath)
    const ext = extname(filePath)
    return c.body(content, 200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream'
    })
  } catch {
    // SPA 兜底：前端路由交给 index.html
    const indexHtml = readFileSync(join(FRONTEND_DIST, 'index.html'))
    return c.html(indexHtml.toString())
  }
})

const port = parseInt(process.env.PORT || '3000')

console.log(`🚀 OA Server starting on port ${port}`)

serve({
  fetch: app.fetch,
  port,
})