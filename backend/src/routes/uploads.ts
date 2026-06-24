// @ts-nocheck
import { getUser } from '../types/user'
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db/index.js'
import { tasks } from '../schema/index.js'
import { eq } from 'drizzle-orm'
import { authMiddleware } from '../middleware/auth.js'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '3221225472') // 3GB
const MAX_TOTAL_SIZE = 3221225472 // 3GB 总大小限制

// 确保上传目录存在
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

// 生成文件路径
function generateFilePath(originalName: string): { fileName: string; filePath: string } {
  const ext = path.extname(originalName)
  const baseName = crypto.randomUUID()
  const fileName = `${baseName}${ext}`
  const filePath = path.join(UPLOAD_DIR, fileName)
  return { fileName, filePath }
}

// 获取文件类型
function getFileType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document'
  if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'spreadsheet'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'presentation'
  return 'other'
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const uploadRoutes = new Hono()

uploadRoutes.use('*', authMiddleware)

// 上传文件
uploadRoutes.post('/', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  
  await ensureUploadDir()
  
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    const taskId = formData.get('taskId') as string
    
    if (!file) {
      return c.json({ success: false, message: '没有选择文件' }, 400)
    }
    
    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      return c.json({ 
        success: false, 
        message: `文件过大，最大允许 ${formatFileSize(MAX_FILE_SIZE)}` 
      }, 400)
    }
    
    // 生成文件路径
    const { fileName, filePath } = generateFilePath(file.name)
    
    // 保存文件
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)
    
    // 构建文件信息
    const fileInfo = {
      id: crypto.randomUUID(),
      name: file.name,
      fileName: fileName,
      size: file.size,
      formattedSize: formatFileSize(file.size),
      type: getFileType(file.type),
      mimeType: file.type,
      url: `/uploads/${fileName}`,
      uploadedBy: user.id,
      uploadedAt: new Date().toISOString()
    }
    
    // 如果指定了任务 ID，更新任务的 attachments
    if (taskId) {
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId)
      })
      
      if (task) {
        const existing = task.attachments || []
        const totalSize = existing.reduce((sum: number, f: any) => sum + (f.size || 0), 0) + file.size
        if (totalSize > MAX_TOTAL_SIZE) {
          await fs.unlink(filePath)
          return c.json({ success: false, message: '任务附件总大小超过 3G 限制' }, 400)
        }
        const attachments = [...existing, fileInfo]
        await db.update(tasks)
          .set({ attachments, updatedAt: new Date() })
          .where(eq(tasks.id, taskId))
      }
    }
    
    return c.json({ success: true, data: fileInfo }, 201)
  } catch (error) {
    console.error('上传文件失败:', error)
    return c.json({ success: false, message: '上传失败' }, 500)
  }
})

// 获取文件
uploadRoutes.get('/:fileName', async (c) => {
  const fileName = c.req.param('fileName')
  const filePath = path.join(UPLOAD_DIR, fileName)
  
  try {
    const file = await fs.readFile(filePath)
    const ext = path.extname(fileName).toLowerCase()
    
    // 设置 Content-Type
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    }
    
    const contentType = contentTypeMap[ext] || 'application/octet-stream'
    
    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000'
      }
    })
  } catch {
    return c.json({ success: false, message: '文件不存在' }, 404)
  }
})

// 删除文件
uploadRoutes.delete('/:fileName', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  const fileName = c.req.param('fileName')
  const filePath = path.join(UPLOAD_DIR, fileName)
  
  try {
    await fs.unlink(filePath)
    return c.json({ success: true, message: '删除成功' })
  } catch {
    return c.json({ success: false, message: '文件不存在' }, 404)
  }
})

// 批量上传
uploadRoutes.post('/batch', async (c) => {
  const user = getUser(c)
    if (!user) {
      return c.json({ success: false, message: "未登录" }, 401)
    }
  
  await ensureUploadDir()
  
  try {
    const formData = await c.req.formData()
    const files = formData.getAll('files') as File[]
    const taskId = formData.get('taskId') as string
    
    if (!files || files.length === 0) {
      return c.json({ success: false, message: '没有选择文件' }, 400)
    }
    
    const uploadedFiles = []
    const attachments = []
    
    for (const file of files) {
      // 检查文件大小
      if (file.size > MAX_FILE_SIZE) {
        continue // 跳过过大的文件
      }
      
      const { fileName, filePath } = generateFilePath(file.name)
      const buffer = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(filePath, buffer)
      
      const fileInfo = {
        id: crypto.randomUUID(),
        name: file.name,
        fileName: fileName,
        size: file.size,
        formattedSize: formatFileSize(file.size),
        type: getFileType(file.type),
        mimeType: file.type,
        url: `/uploads/${fileName}`,
        uploadedBy: user.id,
        uploadedAt: new Date().toISOString()
      }
      
      uploadedFiles.push(fileInfo)
      attachments.push(fileInfo)
    }
    
    // 更新任务附件
    if (taskId && attachments.length > 0) {
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId)
      })
      
      if (task) {
        const existingAttachments = task.attachments || []
        const existingSize = existingAttachments.reduce((sum: number, f: any) => sum + (f.size || 0), 0)
        const newSize = attachments.reduce((sum: number, f: any) => sum + (f.size || 0), 0)
        if (existingSize + newSize > MAX_TOTAL_SIZE) {
          // 删除已上传的文件
          for (const f of attachments) {
            try { await fs.unlink(path.join(UPLOAD_DIR, f.fileName)) } catch {}
          }
          return c.json({ success: false, message: '任务附件总大小超过 3G 限制' }, 400)
        }
        await db.update(tasks)
          .set({ 
            attachments: [...existingAttachments, ...attachments], 
            updatedAt: new Date() 
          })
          .where(eq(tasks.id, taskId))
      }
    }
    
    return c.json({ success: true, data: uploadedFiles }, 201)
  } catch (error) {
    console.error('批量上传失败:', error)
    return c.json({ success: false, message: '上传失败' }, 500)
  }
})

export { UPLOAD_DIR }
