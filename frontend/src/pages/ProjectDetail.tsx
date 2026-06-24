// @ts-nocheck
import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Card, Tabs, Descriptions, Tag, Progress, Statistic, Row, Col,
  Button, Timeline, Avatar, List, Empty, Spin, message, Modal, Form,
  Input, DatePicker, Select, InputNumber, Table, Popconfirm, Upload, Space
} from 'antd'
import {
  EditOutlined, ArrowLeftOutlined, CheckCircleOutlined,
  ClockCircleOutlined, TeamOutlined, FileTextOutlined,
  PauseCircleOutlined, PlayCircleOutlined, CheckSquareOutlined,
  PlusOutlined, DeleteOutlined, EyeOutlined, UploadOutlined
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

const PROJECT_STATUS_MAP: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  assigned: { color: 'cyan', text: '已分配' },
  in_progress: { color: 'processing', text: '进行中' },
  paused: { color: 'warning', text: '已暂停' },
  completed: { color: 'success', text: '已完成' },
  archived: { color: 'default', text: '已归档' },
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editForm] = Form.useForm()
  const currentUser = useAuthStore.getState().user
  const highlightTaskId = searchParams.get('taskId')

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get(`/projects/${id}`)
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['project-stats', id],
    queryFn: () => api.get(`/projects/${id}/stats`),
    enabled: !!id,
    gcTime: 0,
    staleTime: 0
  })

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['project-tasks', id],
    queryFn: () => api.get(`/tasks?projectId=${id}`),
    enabled: !!id
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put(`/projects/${id}`, data),
    onSuccess: () => {
      message.success('项目更新成功')
      setIsEditModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project-stats', id] })
    },
    onError: () => {
      message.error('更新失败')
    }
  })

  const projectData = project?.data
  const statsData = stats?.data
  const isOwner = currentUser?.id === projectData?.ownerId
  const isAdmin = currentUser?.isAdmin

  const handleEdit = () => {
    editForm.setFieldsValue({
      name: projectData?.name,
      startDate: projectData?.startDate ? dayjs(projectData.startDate) : null,
      endDate: projectData?.endDate ? dayjs(projectData.endDate) : null,
      workload: projectData?.workload,
      workloadUnit: projectData?.workloadUnit,
      clientShortName: projectData?.clientShortName,
    })
    setIsEditModalOpen(true)
  }

  const handleEditSubmit = (values: any) => {
    updateMutation.mutate({
      ...values,
      startDate: values.startDate?.format('YYYY-MM-DD'),
      endDate: values.endDate?.format('YYYY-MM-DD')
    })
  }

  // 概览Tab内容
  const OverviewTab = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="任务总数"
              value={statsData?.totalTasks || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={statsData?.completedTasks || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckSquareOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="进行中"
              value={statsData?.inProgressTasks || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="项目成员"
              value={statsData?.memberCount || 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="项目进度">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Progress
            percent={projectData?.progress || 0}
            status={projectData?.progress === 100 ? 'success' : 'active'}
            style={{ flex: 1 }}
          />
          <Tag color={PROJECT_STATUS_MAP[projectData?.status]?.color}>
            {PROJECT_STATUS_MAP[projectData?.status]?.text}
          </Tag>
        </div>
      </Card>

      <Row gutter={16}>
        <Col span={16}>
          <Card
            title="项目信息"
            extra={
              <Button type="link" icon={<EditOutlined />} onClick={handleEdit}>
                编辑
              </Button>
            }
          >
            <Descriptions column={2}>
              <Descriptions.Item label="项目名称">
                {projectData?.name}
              </Descriptions.Item>
              <Descriptions.Item label="项目负责人">
                <Avatar size="small" src={projectData?.owner?.avatar} style={{ marginRight: 8 }} />
                {projectData?.owner?.name}
              </Descriptions.Item>
              <Descriptions.Item label="开始日期">
                {projectData?.startDate ? dayjs(projectData.startDate).format('YYYY-MM-DD') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="结束日期">
                {projectData?.endDate ? dayjs(projectData.endDate).format('YYYY-MM-DD') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {projectData?.createdAt ? dayjs(projectData.createdAt).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="项目描述" span={2}>
                {projectData?.description || '暂无描述'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col span={8}>
          <Card title="最近任务" extra={<a onClick={() => setActiveTab('tasks')}>查看全部</a>}>
            {tasksLoading ? (
              <Spin />
            ) : tasks?.data?.length > 0 ? (
              <List
                size="small"
                dataSource={tasks.data.slice(0, 5)}
                renderItem={(task: any) => (
                  <List.Item>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {task.status === 'completed' ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <ClockCircleOutlined style={{ color: '#1890ff' }} />
                      )}
                      <span style={{
                        textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {task.title}
                      </span>
                      <Tag size="small" color={SUBTASK_STATUS_MAP[task.status]?.color || 'default'}>
                        {SUBTASK_STATUS_MAP[task.status]?.text || task.status}
                      </Tag>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无任务" />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="项目动态">
        <Timeline
          items={[
            {
              children: (
                <div>
                  <p>项目创建</p>
                  <p style={{ color: '#999', fontSize: 12 }}>
                    {projectData?.createdAt ? dayjs(projectData.createdAt).format('YYYY-MM-DD HH:mm') : '-'}
                  </p>
                </div>
              )
            },
            {
              color: 'green',
              children: <p>项目状态更新为 {PROJECT_STATUS_MAP[projectData?.status]?.text}</p>
            }
          ]}
        />
      </Card>
    </div>
  )

  // 任务Tab内容
  const TasksTab = () => {
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
    const [taskForm] = Form.useForm()
    const [detailTask, setDetailTask] = useState<any>(null)
    const [reviewOpen, setReviewOpen] = useState(false)
    const [reviewForm] = Form.useForm()
    const [submitOpen, setSubmitOpen] = useState(false)
    const [submitForm] = Form.useForm()
    const [editTaskOpen, setEditTaskOpen] = useState(false)
    const [editTaskForm] = Form.useForm()
    const [editingTask, setEditingTask] = useState<any>(null)
    const [deleteRequestOpen, setDeleteRequestOpen] = useState(false)
    const [deletingTask, setDeletingTask] = useState<any>(null)
    const [deleteForm] = Form.useForm()

    const { data: users } = useQuery({
      queryKey: ['users'],
      queryFn: () => api.get('/users')
    })

    const createTaskMutation = useMutation({
      mutationFn: (data: any) => api.post('/tasks', data),
      onSuccess: () => {
        message.success('任务创建成功')
        setIsTaskModalOpen(false)
        taskForm.resetFields()
        queryClient.invalidateQueries({ queryKey: ['project-tasks', id] })
        queryClient.invalidateQueries({ queryKey: ['project-stats', id] })
        queryClient.invalidateQueries({ queryKey: ['project', id] })
      },
      onError: () => {
        message.error('创建失败')
      }
    })

    const deleteTaskMutation = useMutation({
      mutationFn: (data: { definitionId: string; title: string; formData: any }) => api.post('/workflows/instances', data),
      onSuccess: () => {
        message.success('删除申请已提交，等待管理员审批')
        setDeleteRequestOpen(false)
        deleteForm.resetFields()
        setDeletingTask(null)
        queryClient.invalidateQueries({ queryKey: ['project-tasks', id] })
        queryClient.invalidateQueries({ queryKey: ['project-stats', id] })
      },
      onError: () => {
        message.error('提交删除申请失败')
      }
    })

    const submitReviewMutation = useMutation({
      mutationFn: (data: any) => api.post(`/tasks/${detailTask?.id}/submit`, data),
      onSuccess: () => {
        message.success('提交审批成功')
        setSubmitOpen(false)
        submitForm.resetFields()
        queryClient.invalidateQueries({ queryKey: ['project-tasks', id] })
        setDetailTask(null)
      },
      onError: (err: any) => message.error(err?.message || '提交失败')
    })

    const reviewMutation = useMutation({
      mutationFn: (data: any) => api.post(`/tasks/${detailTask?.id}/review`, data),
      onSuccess: () => {
        message.success('审批处理成功')
        setReviewOpen(false)
        reviewForm.resetFields()
        queryClient.invalidateQueries({ queryKey: ['project-tasks', id] })
        queryClient.invalidateQueries({ queryKey: ['project-stats', id] })
        queryClient.invalidateQueries({ queryKey: ['project', id] })
        setDetailTask(null)
      },
      onError: (err: any) => message.error(err?.message || '审批失败')
    })

    const updateTaskMutation = useMutation({
      mutationFn: ({ taskId, data }: { taskId: string; data: any }) => api.put(`/tasks/${taskId}`, data),
      onSuccess: () => {
        message.success('任务更新成功')
        setEditTaskOpen(false)
        editTaskForm.resetFields()
        setEditingTask(null)
        queryClient.invalidateQueries({ queryKey: ['project-tasks', id] })
        queryClient.invalidateQueries({ queryKey: ['project-stats', id] })
        queryClient.invalidateQueries({ queryKey: ['project', id] })
      },
      onError: (err: any) => message.error(err?.message || '更新失败')
    })

    const handleCreateTask = (values: any) => {
      const priorityMap: Record<string, string> = { P0: 'urgent', P1: 'high', P2: 'medium', P3: 'low' }
      createTaskMutation.mutate({
        ...values,
        projectId: id,
        priority: priorityMap[values.priority] || 'medium',
        startDate: values.startDate?.format('YYYY-MM-DD'),
        dueDate: values.dueDate?.format('YYYY-MM-DD')
      })
    }

    const openDetail = (task: any) => {
      navigate(`/tasks/${task.id}`)
    }

    const taskColumns = [
      {
        title: '任务标题',
        dataIndex: 'title',
        key: 'title',
        render: (text: string, record: any) => (
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            {record.description && (
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                {record.description.slice(0, 50)}
                {record.description.length > 50 ? '...' : ''}
              </div>
            )}
          </div>
        )
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status: string) => (
          <Tag color={SUBTASK_STATUS_MAP[status]?.color || 'default'}>
            {SUBTASK_STATUS_MAP[status]?.text || status}
          </Tag>
        )
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        key: 'priority',
        width: 80,
        render: (priority: string) => {
          const colors: Record<string, string> = {
            low: 'default',
            medium: 'blue',
            high: 'orange',
            urgent: 'red'
          }
          const labels: Record<string, string> = {
            low: '低',
            medium: '中',
            high: '高',
            urgent: '紧急'
          }
          return <Tag color={colors[priority]}>{labels[priority]}</Tag>
        }
      },
      {
        title: '负责人',
        dataIndex: 'assignee',
        key: 'assignee',
        width: 100,
        render: (assignee: any) => assignee?.name || '-'
      },
      {
        title: '截止日期',
        dataIndex: 'dueDate',
        key: 'dueDate',
        width: 110,
        render: (date: string) => date ? dayjs(date).format('MM-DD') : '-'
      },
      {
        title: '操作',
        key: 'action',
        width: 200,
        render: (_: any, record: any) => {
          const isAssignee = record.assigneeId === currentUser?.id
          const canSubmit = isAssignee && ['received', 'rejected'].includes(record.status)
          const canReview = (isOwner || isAdmin) && record.status === 'submitted'
          const canEdit = isAssignee && !['completed', 'submitted'].includes(record.status)
          const showDelete = isOwner || isAdmin
          return (
            <Space>
              <Button type="link" size="small" onClick={() => openDetail(record)}>详情</Button>
              {canEdit && (
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => {
                  setEditingTask(record)
                  editTaskForm.setFieldsValue({
                    title: record.title,
                    description: record.description,
                    priority: record.priority,
                    dueDate: record.dueDate ? dayjs(record.dueDate) : null,
                    workCycle: record.workCycle
                  })
                  setEditTaskOpen(true)
                }}>编辑</Button>
              )}
              {canSubmit && (
                <Button type="primary" size="small" onClick={() => { setDetailTask(record); setSubmitOpen(true) }}>
                  申请结束任务
                </Button>
              )}
              {canReview && (
                <Button type="primary" size="small" danger ghost onClick={() => { setDetailTask(record); setReviewOpen(true) }}>
                  审批
                </Button>
              )}
              {showDelete && ['unassigned', 'pending_receive', 'received', 'rejected'].includes(record.status) && (
                <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => {
                  setDeletingTask(record)
                  deleteForm.setFieldsValue({ reason: '' })
                  setDeleteRequestOpen(true)
                }}>删除</Button>
              )}
            </Space>
          )
        }
      }
    ]

    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>项目子任务</h3>
          {(isOwner || isAdmin) && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsTaskModalOpen(true)}
            >
              新建子任务
            </Button>
          )}
        </div>

        <Table
          columns={taskColumns}
          dataSource={tasks?.data || []}
          loading={tasksLoading}
          rowKey="id"
          size="small"
          scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
          pagination={{
            current: 1,
            pageSize: 10,
            pageSizeOptions: ['10', '20', '50'],
            showSizeChanger: true,
            showTotal: (t: number) => `共 ${t} 条`,
          }}
          rowClassName={(record: any) => record.id === highlightTaskId ? 'highlighted-task-row' : ''}
          locale={{ emptyText: <Empty description="暂无子任务，点击上方按钮创建" /> }}
        />

        {/* 新建任务弹窗 */}
        <Modal
          title="新建子任务"
          open={isTaskModalOpen}
          onCancel={() => setIsTaskModalOpen(false)}
          onOk={() => taskForm.submit()}
          confirmLoading={createTaskMutation.isPending}
          width={640}
        >
          <Form form={taskForm} layout="vertical" onFinish={handleCreateTask}>
            <Form.Item
              name="title"
              label="子任务名称"
              rules={[{ required: true, message: '请输入子任务名称' }]}
            >
              <Input placeholder="请输入子任务名称" />
            </Form.Item>

            <Form.Item name="description" label="子任务描述">
              <TextArea rows={2} placeholder="请输入子任务描述" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="priority" label="任务级别" initialValue="P2">
                  <Select>
                    <Select.Option value="P0">P0</Select.Option>
                    <Select.Option value="P1">P1</Select.Option>
                    <Select.Option value="P2">P2</Select.Option>
                    <Select.Option value="P3">P3</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="assigneeId"
                  label="负责人"
                  rules={[{ required: true, message: '请选择负责人' }]}
                >
                  <Select placeholder="选择负责人" allowClear>
                    {users?.data?.map((user: any) => (
                      <Select.Option key={user.id} value={user.id}>
                        {user.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="startDate" label="计划开始时间">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="dueDate" label="预计结束时间">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="workload" label="工作量">
                  <Input type="number" step="0.01" min={0} placeholder="请输入工作量" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="workloadUnit" label="计量单位">
                  <Select placeholder="请选择计量单位" allowClear>
                    <Select.Option value="天">天</Select.Option>
                    <Select.Option value="平方米">平方米</Select.Option>
                    <Select.Option value="平方千米">平方千米</Select.Option>
                    <Select.Option value="米">米</Select.Option>
                    <Select.Option value="千米">千米</Select.Option>
                    <Select.Option value="亩">亩</Select.Option>
                    <Select.Option value="栋">栋</Select.Option>
                    <Select.Option value="宗">宗</Select.Option>
                    <Select.Option value="块">块</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="remarks" label="子任务备注">
              <Input placeholder="子任务备注" maxLength={200} />
            </Form.Item>
          </Form>
        </Modal>

        {/* 编辑任务弹窗 */}
        <Modal
          title="编辑子任务"
          open={editTaskOpen}
          onCancel={() => { setEditTaskOpen(false); setEditingTask(null) }}
          onOk={() => editTaskForm.submit()}
          confirmLoading={updateTaskMutation.isPending}
        >
          <Form form={editTaskForm} layout="vertical" onFinish={(vals) => {
            if (!editingTask) return
            updateTaskMutation.mutate({
              taskId: editingTask.id,
              data: {
                ...vals,
                dueDate: vals.dueDate?.format('YYYY-MM-DD')
              }
            })
          }}>
            <Form.Item
              name="title"
              label="任务标题"
              rules={[{ required: true, message: '请输入任务标题' }]}
            >
              <Input placeholder="请输入任务标题" />
            </Form.Item>

            <Form.Item name="description" label="任务描述">
              <TextArea rows={2} placeholder="请输入任务描述" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="priority" label="优先级">
                  <Select>
                    <Select.Option value="low">低</Select.Option>
                    <Select.Option value="medium">中</Select.Option>
                    <Select.Option value="high">高</Select.Option>
                    <Select.Option value="urgent">紧急</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="dueDate" label="截止日期">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="workCycle" label="工作周期">
              <Input placeholder="例如：2026-04-01 至 2026-04-15" />
            </Form.Item>
          </Form>
        </Modal>

        {/* 申请结束任务弹窗 */}
        <Modal
          title="申请结束任务"
          open={submitOpen}
          onCancel={() => { setSubmitOpen(false); submitForm.resetFields() }}
          onOk={() => submitForm.submit()}
          confirmLoading={submitReviewMutation.isPending}
        >
          <Form form={submitForm} layout="vertical" onFinish={async (vals) => {
            const projectMaterial1 = vals.uploadedFiles?.[0] || null
            const projectMaterial2 = vals.projectMaterial2 || null

            submitReviewMutation.mutate({
              completedDate: vals.completedDate?.format('YYYY-MM-DD'),
              projectMaterial1,
              projectMaterial2
            })
          }}>
            <Form.Item
              name="completedDate"
              label="完成日期"
              rules={[{ required: true, message: '请选择完成日期' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="项目资料1（上传文件）">
              <Upload
                customRequest={async ({ file, onSuccess, onError }: any) => {
                  try {
                    const formData = new FormData()
                    formData.append('file', file)
                    if (detailTask?.id) {
                      formData.append('taskId', detailTask.id)
                    }
                    const res = await api.upload('/api/uploads', formData)
                    if (res.success) {
                      onSuccess?.(res.data)
                      submitForm.setFieldValue('uploadedFiles', [res.data])
                      message.success('上传成功')
                    } else {
                      onError?.(new Error(res.message))
                    }
                  } catch (err: any) {
                    onError?.(err)
                    message.error(err?.message || '上传失败')
                  }
                }}
                onRemove={() => submitForm.setFieldValue('uploadedFiles', [])}
                fileList={submitForm.getFieldValue('uploadedFiles') || []}
                maxCount={1}
              >
                <Button icon={<UploadOutlined />}>点击上传文件</Button>
              </Upload>
            </Form.Item>

            <Form.Item
              name="projectMaterial2"
              label="项目资料2（文件路径）"
              rules={[{
                validator: (_, value) => {
                  const uploaded = submitForm.getFieldValue('uploadedFiles')
                  if (!value && (!uploaded || uploaded.length === 0)) {
                    return Promise.reject(new Error('请上传文件或填写文件路径'))
                  }
                  return Promise.resolve()
                }
              }]}
            >
              <Input placeholder="请输入服务器文件路径" />
            </Form.Item>
          </Form>
        </Modal>

        {/* 审批处理弹窗 */}
        <Modal
          title="审批子任务"
          open={reviewOpen}
          onCancel={() => setReviewOpen(false)}
          onOk={() => reviewForm.submit()}
          confirmLoading={reviewMutation.isPending}
        >
          <Form form={reviewForm} layout="vertical" onFinish={(vals) => reviewMutation.mutate(vals)}>
            <Form.Item name="action" label="审批结果" rules={[{ required: true }]} initialValue="approve">
              <Select>
                <Select.Option value="approve">同意</Select.Option>
                <Select.Option value="reject">驳回</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="comments" label="审批意见"
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (getFieldValue('action') === 'reject' && !value) {
                      return Promise.reject(new Error('驳回时请填写审批意见'))
                    }
                    return Promise.resolve()
                  }
                })
              ]}
            >
              <TextArea rows={3} placeholder="请输入审批意见（驳回时必填）" />
            </Form.Item>
          </Form>
        </Modal>

        {/* 删除申请弹窗 */}
        <Modal
          title="申请删除子任务"
          open={deleteRequestOpen}
          onCancel={() => { setDeleteRequestOpen(false); setDeletingTask(null); deleteForm.resetFields() }}
          onOk={() => deleteForm.submit()}
          confirmLoading={deleteTaskMutation.isPending}
        >
          <Form form={deleteForm} layout="vertical" onFinish={(vals) => {
            if (!deletingTask) return
            deleteTaskMutation.mutate({
              definitionId: '00000000-0000-0000-0000-000000000113',
              title: `删除子任务：${deletingTask.title}`,
              formData: {
                taskId: deletingTask.id,
                taskTitle: deletingTask.title,
                projectId: id,
                reason: vals.reason
              }
            })
          }}>
            <Form.Item label="任务名称">
              <Input value={deletingTask?.title} disabled />
            </Form.Item>
            <Form.Item
              name="reason"
              label="删除原因"
              rules={[{ required: true, message: '请填写删除原因' }]}
            >
              <TextArea rows={3} placeholder="请说明删除该子任务的原因" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    )
  }

  // 成员Tab内容
  const MembersTab = () => {
    const { data: usersRes } = useQuery({
      queryKey: ['users'],
      queryFn: () => api.get('/users')
    })

    const currentMembers = projectData?.members || []
    const memberUsers = usersRes?.data?.filter((u: any) => currentMembers.includes(u.id)) || []

    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>项目成员</h3>
          <p style={{ color: '#999', marginTop: 8 }}>
            成员由项目负责人和子任务负责人自动计算
          </p>
        </div>

        {memberUsers.length > 0 ? (
          <List
            dataSource={memberUsers}
            renderItem={(user: any) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar size={40} src={user.avatar} style={{ backgroundColor: '#1890ff' }}>{user.name?.[0]}</Avatar>}
                  title={user.name}
                  description={user.departmentName || '未分配部门'}
                />
                <Tag color={currentUser?.id === user.id ? 'blue' : 'default'}>{user.id === projectData?.ownerId ? '项目负责人' : '子任务负责人'}</Tag>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无项目成员" />
        )}
      </div>
    )
  }

  // 设置Tab内容
  const SettingsTab = () => {
    const navigate = useNavigate()

    const updateStatusMutation = useMutation({
      mutationFn: (status: string) => api.put(`/projects/${id}`, { status }),
      onSuccess: () => {
        message.success('状态更新成功')
        queryClient.invalidateQueries({ queryKey: ['project', id] })
      }
    })

    const deleteProjectMutation = useMutation({
      mutationFn: () => api.delete(`/projects/${id}`),
      onSuccess: () => {
        message.success('项目已删除')
        navigate('/projects')
      }
    })

    const canArchive = isAdmin && projectData?.progress === 100 && projectData?.status === 'completed'

    return (
      <div>
        <Card title="项目状态管理" style={{ marginBottom: 16 }}>
          <p style={{ color: '#666', marginBottom: 16 }}>
            更改项目当前状态
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(PROJECT_STATUS_MAP).map(([value, cfg]) => (
              <Button
                key={value}
                type={projectData?.status === value ? 'primary' : 'default'}
                onClick={() => updateStatusMutation.mutate(value)}
                loading={updateStatusMutation.isPending}
                disabled={value === 'archived' && !canArchive}
              >
                {cfg.text}
              </Button>
            ))}
          </div>
          {projectData?.status === 'archived' && (
            <p style={{ marginTop: 12, color: '#999' }}>
              归档人：{projectData?.archivedByName || currentUser?.name}，归档时间：{projectData?.archivedAt ? dayjs(projectData.archivedAt).format('YYYY-MM-DD HH:mm') : dayjs().format('YYYY-MM-DD HH:mm')}
            </p>
          )}
        </Card>

        <Card title="危险操作" style={{ borderColor: '#ff4d4f' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500, color: '#ff4d4f' }}>删除项目</div>
              <div style={{ color: '#999', fontSize: 12 }}>
                删除后无法恢复，请谨慎操作
              </div>
            </div>
            <Popconfirm
              title="确认删除项目"
              description="确定要删除这个项目吗？所有相关数据将被永久删除，无法恢复。"
              onConfirm={() => deleteProjectMutation.mutate()}
              okText="确定删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                danger
                loading={deleteProjectMutation.isPending}
              >
                删除项目
              </Button>
            </Popconfirm>
          </div>
        </Card>
      </div>
    )
  }

  if (projectLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')}>
          返回
        </Button>
        <h2 style={{ margin: 0 }}>{projectData?.name}</h2>
        <Tag color={PROJECT_STATUS_MAP[projectData?.status]?.color}>
          {PROJECT_STATUS_MAP[projectData?.status]?.text}
        </Tag>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'overview',
            label: '概览',
            children: <OverviewTab />
          },
          {
            key: 'tasks',
            label: '子任务',
            children: <TasksTab />
          }
        ]}
      />

      <Modal
        title="编辑项目"
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="startDate" label="开始日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endDate" label="结束日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="workload" label="工作量">
                <Input type="number" min={0} placeholder="请输入工作量" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="workloadUnit" label="计量单位">
                <Select placeholder="请选择计量单位" allowClear>
                  <Select.Option value="天">天</Select.Option>
                  <Select.Option value="平方米">平方米</Select.Option>
                  <Select.Option value="平方千米">平方千米</Select.Option>
                  <Select.Option value="米">米</Select.Option>
                  <Select.Option value="千米">千米</Select.Option>
                  <Select.Option value="亩">亩</Select.Option>
                  <Select.Option value="栋">栋</Select.Option>
                  <Select.Option value="宗">宗</Select.Option>
                  <Select.Option value="块">块</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
