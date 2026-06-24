// @ts-nocheck
import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card, Descriptions, Tag, Progress, Button, Spin, message, Modal, Form,
  Input, DatePicker, Upload, Space
} from 'antd'
import {
  ArrowLeftOutlined, UploadOutlined
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import dayjs from 'dayjs'
import { useAuthStore } from '../stores/auth'

const { TextArea } = Input

const SUBTASK_STATUS_MAP: Record<string, { color: string; text: string }> = {
  unassigned: { color: 'default', text: '未分配' },
  pending_receive: { color: 'processing', text: '待签收' },
  received: { color: 'blue', text: '已签收' },
  submitted: { color: 'warning', text: '待审批' },
  completed: { color: 'success', text: '已完成' },
  rejected: { color: 'error', text: '审批驳回' },
}

export default function SubTaskDetail() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const currentUser = useAuthStore.getState().user
  const isEditMode = searchParams.get('edit') === '1'

  const [submitForm] = Form.useForm()
  const [uploadedFileList, setUploadedFileList] = useState<any[]>([])

  const { data: taskRes, isLoading } = useQuery({
    queryKey: ['task-detail', taskId],
    queryFn: () => api.get(`/tasks/${taskId}`),
    enabled: !!taskId
  })

  const task = taskRes?.data
  const project = task?.project
  const canSubmit = task?.assigneeId === currentUser?.id && ['received', 'rejected'].includes(task?.status)

  const submitDeliverableMutation = useMutation({
    mutationFn: (data: any) => api.post(`/tasks/${taskId}/submit`, data),
    onSuccess: () => {
      message.success('提交审批成功')
      submitForm.resetFields()
      setUploadedFileList([])
      queryClient.invalidateQueries({ queryKey: ['task-detail', taskId] })
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
      navigate(-1)
    },
    onError: (err: any) => message.error(err?.message || '提交失败')
  })

  // 审批驳回时，回填上次提交的文件
  useEffect(() => {
    if (task?.id && isEditMode && task.status === 'rejected' && task.deliverableFiles) {
      const files = typeof task.deliverableFiles === 'string' ? JSON.parse(task.deliverableFiles) : task.deliverableFiles
      if (Array.isArray(files) && files.length > 0) {
        setUploadedFileList(files.map((f: any) => ({ ...f, uid: f.id || f.uid, name: f.name, status: 'done', url: f.url })))
      }
    }
  }, [task?.id, isEditMode])

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}><Spin size="large" /></div>
  }

  if (!task) {
    return <div style={{ padding: 24, textAlign: 'center' }}>任务不存在</div>
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')}>返回</Button>
        <h2 style={{ margin: 0 }}>子任务详情</h2>
        <Tag color={SUBTASK_STATUS_MAP[task.status]?.color}>
          {SUBTASK_STATUS_MAP[task.status]?.text || task.status}
        </Tag>
      </div>

      {/* 主任务详情 */}
      <Card title="主任务详情" style={{ marginBottom: 24 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="项目名称" span={2}>
            {project?.name || task.projectName || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="开始日期">
            {project?.startDate ? dayjs(project.startDate).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建日期">
            {project?.createdAt ? dayjs(project.createdAt).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="项目描述" span={2}>
            {project?.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="项目负责人">
            {project?.owner?.name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="结束日期">
            {project?.endDate ? dayjs(project.endDate).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="项目进度" span={2}>
            <Progress percent={project?.progress || 0} size="small" style={{ width: 200 }} />
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 子任务详情 */}
      <Card title="子任务详情" style={{ marginBottom: 24 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="子任务名称" span={2}>
            {task.title}
          </Descriptions.Item>
          <Descriptions.Item label="子任务负责人">
            {task.assignee?.name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="工作内容">
            {task.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="工作量">
            {project?.workload !== null && project?.workload !== undefined
              ? `${project.workload}${project.workloadUnit || ''}`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="开始时间">
            {task.startDate ? dayjs(task.startDate).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="完成时间">
            {task.completedAt ? dayjs(task.completedAt).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="备注">
            {task.remarks || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="优先级">
            <Tag>{task.priority === 'urgent' ? '紧急' : task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="任务状态">
            <Tag color={SUBTASK_STATUS_MAP[task.status]?.color}>
              {SUBTASK_STATUS_MAP[task.status]?.text || task.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="任务描述">
            {task.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="预计完成时间">
            {task.dueDate ? dayjs(task.dueDate).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="项目成果 1" span={2}>
            {(() => {
              const files = typeof task.deliverableFiles === 'string' ? JSON.parse(task.deliverableFiles) : (task.deliverableFiles || [])
              return Array.isArray(files) && files.length > 0 ? (
                files.map((f: any, i: number) => (
                  <div key={i}>
                    <a href={f.url} target="_blank" rel="noreferrer">{f.name || '查看文件'}</a>
                  </div>
                ))
              ) : task.projectMaterial1 ? (
                typeof task.projectMaterial1 === 'string'
                  ? <span>{task.projectMaterial1}</span>
                  : <a href={task.projectMaterial1.url} target="_blank" rel="noreferrer">{task.projectMaterial1.name || '查看文件'}</a>
              ) : '-'
            })()}
          </Descriptions.Item>
          <Descriptions.Item label="项目成果 2" span={2}>
            {task.projectMaterial2 || task.deliverableUrl || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 交付物编辑区域（仅可编辑模式 + 已接收/驳回状态） */}
      {isEditMode && canSubmit && (
        <Card title="提交成果" style={{ marginBottom: 24 }}>
          <Form
            form={submitForm}
            layout="vertical"
            initialValues={{
              completedDate: task?.status === 'rejected' && task?.completedAt
                ? dayjs(task.completedAt) : undefined,
              projectMaterial2: task?.status === 'rejected' && task?.deliverableUrl
                ? task.deliverableUrl : ''
            }}
          >
            <Form.Item
              name="completedDate"
              label="完成日期"
              rules={[{ required: true, message: '请选择完成日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="项目成果 1（上传文件，最多 5 个文件，总大小不超过 3G）">
              <Upload
                action="/api/uploads"
                data={() => taskId ? { taskId } : {}}
                headers={{ Authorization: `Bearer ${useAuthStore.getState().token}` }}
                fileList={uploadedFileList}
                onChange={(info: any) => {
                  setUploadedFileList(info.fileList)
                  if (info.file.status === 'done' && info.file.response?.success) {
                    message.success(`${info.file.name} 上传成功`)
                  } else if (info.file.status === 'error') {
                    message.error(`${info.file.name} 上传失败`)
                  }
                }}
                beforeUpload={(file: any) => {
                  const totalSize = uploadedFileList.reduce((sum: number, f: any) => sum + (f.size || 0), 0)
                  if (totalSize + file.size > 3221225472) {
                    message.error('文件总大小超过 3G 限制')
                    return Upload.LIST_IGNORE
                  }
                  return true
                }}
                maxCount={5}
              >
                <Button icon={<UploadOutlined />}>选择文件</Button>
              </Upload>
            </Form.Item>

            <Form.Item name="projectMaterial2" label="项目成果 2（文件路径）">
              <Input placeholder="请输入服务器文件路径" />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                size="large"
                onClick={() => {
                  submitForm.validateFields().then((vals) => {
                    const fileList = uploadedFileList
                    const uploadingFiles = fileList.filter((f: any) => f.status === 'uploading')
                    if (uploadingFiles.length > 0) {
                      message.warning('请等待文件上传完成')
                      return
                    }
                    const projectMaterials = fileList
                      .filter((f: any) => f.status === 'done')
                      .map((f: any) => f.response?.data || f)
                    const projectMaterial2 = vals.projectMaterial2 || null
                    if (projectMaterials.length === 0 && !projectMaterial2) {
                      message.warning('请上传成果文件或填写文件路径')
                      return
                    }
                    Modal.confirm({
                      title: '确认提交审批？',
                      content: '提交后任务将进入审批流程，请确保成果已上传完毕。',
                      onOk: () => {
                        const payload: any = {
                          completedDate: vals.completedDate?.format('YYYY-MM-DD'),
                          projectMaterials
                        }
                        if (projectMaterial2) payload.projectMaterial2 = projectMaterial2
                        submitDeliverableMutation.mutate(payload)
                      }
                    })
                  }).catch(() => {})
                }}
                loading={submitDeliverableMutation.isPending}
              >
                提交审批
              </Button>
            </Form.Item>
          </Form>
        </Card>
      )}
    </div>
  )
}
