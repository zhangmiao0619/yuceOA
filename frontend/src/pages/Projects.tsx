// @ts-nocheck
import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Table, Button, Tag, Space, Modal, Form, Input, DatePicker, Select, message, Tabs, Timeline, Progress, Card, Descriptions, Popconfirm, Row, Col, Collapse, Badge, Upload, Tooltip
} from 'antd'
import { PlusOutlined, EditOutlined, EyeOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import dayjs from 'dayjs'
import { hasPermission, useAuthStore } from '../stores/auth'

const { Option } = Select
const SUBTASK_STATUS_MAP: Record<string, { color: string; text: string }> = {
  unassigned: { color: 'default', text: '未分配' },
  pending_receive: { color: 'processing', text: '待签收' },
  received: { color: 'blue', text: '已签收' },
  submitted: { color: 'warning', text: '待审批' },
  completed: { color: 'success', text: '已完成' },
  rejected: { color: 'error', text: '驳回' },
}

const PROJECT_STATUS_MAP: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  assigned: { color: 'cyan', text: '已分配' },
  in_progress: { color: 'blue', text: '进行中' },
  paused: { color: 'orange', text: '已暂停' },
  completed: { color: 'green', text: '已完成' },
  archived: { color: 'default', text: '已归档' },
}

const TASK_PRIORITY_MAP: Record<string, { color: string; text: string }> = {
  urgent: { color: 'red', text: 'P0' },
  high:   { color: 'green', text: 'P1' },
  medium: { color: 'cyan', text: 'P2' },
  low:    { color: 'blue', text: 'P3' },
}

export default function Projects() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<any>(null)
  const currentUser = useAuthStore.getState().user
  const canCreate = !!(hasPermission('project:create') || currentUser?.isAdmin)

  // 筛选状态
  const [filterName, setFilterName] = useState('')
  const [filterStartDate, setFilterStartDate] = useState<string | null>(null)
  const [filterEndDate, setFilterEndDate] = useState<string | null>(null)
  const [filterTimeRange, setFilterTimeRange] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [taskStatusFilter, setTaskStatusFilter] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const { data: usersRes } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users')
  })
  const users = usersRes?.data || []

  const { data: suppliersRes } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers')
  })
  const suppliers = suppliersRes?.data || []

  // 普通员工：自己的子任务
  const { data: myTasksRes, isLoading: myTasksLoading } = useQuery({
    queryKey: ['my-tasks', currentUser?.id],
    queryFn: () => api.get('/tasks', { params: { assigneeId: currentUser?.id, limit: 200 } }),
    enabled: !canCreate
  })
  const myTasks = myTasksRes?.data || []

  // 分页状态
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })

  const { data: projectsRes, isLoading } = useQuery({
    queryKey: ['projects', filterName, filterStartDate, filterEndDate, filterTimeRange, filterStatus, pagination.current, pagination.pageSize],
    queryFn: () => api.get('/projects', {
      params: {
        name: filterName || undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
        timeRange: filterTimeRange || undefined,
        status: filterStatus === 'pending_claim' ? undefined : filterStatus || undefined,
        pendingClaim: filterStatus === 'pending_claim' ? 'true' : undefined,
        page: pagination.current,
        pageSize: pagination.pageSize
      }
    })
  })
  const projectList = projectsRes?.data?.list || []
  const total = projectsRes?.data?.total || 0



  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/projects', data),
    onSuccess: () => {
      message.success('项目创建成功')
      setIsModalOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: () => {
      message.error('创建失败')
    }
  })

  const saveDraftMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = processFormValues(data)
      return api.post('/projects', { ...payload, status: 'draft' })
    },
    onSuccess: () => {
      message.success('草稿保存成功')
      setIsModalOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err: any) => {
      message.error(err?.message || '草稿保存失败')
    }
  })

  const submitProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const payload = processFormValues(data)
      await api.put(`/projects/${id}`, { ...payload, status: 'assigned' })
    },
    onSuccess: () => {
      message.success('项目提交成功')
      setIsModalOpen(false)
      setEditingProject(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: () => {
      message.error('项目提交失败')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/projects/${id}`, data),
    onSuccess: () => {
      message.success('项目更新成功')
      setIsModalOpen(false)
      setEditingProject(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: () => {
      message.error('更新失败')
    }
  })

  const pauseRequestMutation = useMutation({
    mutationFn: (id: string) => api.post(`/projects/${id}/pause-request`),
    onSuccess: () => {
      message.success('暂停申请已提交')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: () => {
      message.error('暂停申请失败')
    }
  })

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) => api.delete(`/projects/${projectId}`),
    onSuccess: () => {
      message.success('项目删除成功')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: () => {
      message.error('删除失败')
    }
  })

  const fetchProjectDetail = async (projectId: string) => {
    window.location.href = `/projects/${projectId}`
  }

  // 处理 URL 参数
  useEffect(() => {
    const action = searchParams.get('action')
    if (action === 'new' && !isModalOpen) {
      setEditingProject(null)
      setIsModalOpen(true)
      setSearchParams({})
    }
    const tab = searchParams.get('tab')
    if (tab === 'pending-claim') {
      if (!canCreate) {
        setTaskStatusFilter('pending_receive')
      } else {
        setFilterStatus('pending_claim')
      }
      setSearchParams({})
    }
  }, [searchParams])

  useEffect(() => {
    if (isModalOpen && editingProject) {
      const projectMaterials = editingProject.projectMaterials?.map((name: string, index: number) => ({
        uid: `-${index}`,
        name,
        status: 'done',
      })) || []

      form.setFieldsValue({
        ...editingProject,
        startDate: editingProject.startDate ? dayjs(editingProject.startDate) : null,
        endDate: editingProject.endDate ? dayjs(editingProject.endDate) : null,
        completedDate: editingProject.completedDate ? dayjs(editingProject.completedDate) : null,
        projectMaterials,
        subTasks: editingProject.subTasks?.map((st: any) => ({
          ...st,
          startDate: st.startDate ? dayjs(st.startDate) : null,
          dueDate: st.dueDate ? dayjs(st.dueDate) : null,
          priority: TASK_PRIORITY_MAP[st.priority]?.text || st.priority,
        })) || [],
      })
    } else if (isModalOpen && !editingProject) {
      form.resetFields()
    }
  }, [isModalOpen, editingProject, form])

  const expandedRowRender = (record: any) => {
    let subTasks = record.subTasks || []
    if (!canCreate && currentUser?.id) {
      subTasks = subTasks.filter((st: any) => st.assigneeId === currentUser.id)
    }
    if (subTasks.length === 0) {
      return <div style={{ padding: 16, color: '#999' }}>暂无子任务</div>
    }
    return (
      <Table
        dataSource={subTasks}
        rowKey="id"
        pagination={false}
        size="small"
        columns={[
          {
            title: '子任务名称',
            key: 'taskName',
            width: 220,
            render: (_: any, st: any) => {
              const projectPart = st.projectName || record.shortName || record.name || ''
              const taskId = st.id
              return (
                <Link to={`/projects/${record.id}?tab=tasks&taskId=${taskId}`} style={{ color: '#1890ff' }}>
                  {projectPart} — {st.title || '-'}
                </Link>
              )
            }
          },
          { title: '负责人', dataIndex: ['assignee', 'name'], key: 'assignee', width: 80, render: (v: string) => v || '-' },
          {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 110,
            render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD') : '-'
          },
          {
            title: '工作周期',
            key: 'workCycle',
            width: 210,
            render: (_: any, st: any) => {
              const start = st.startDate ? dayjs(st.startDate).format('YYYY-MM-DD') : '-'
              const end = st.dueDate ? dayjs(st.dueDate).format('YYYY-MM-DD') : '-'
              return `${start} ~ ${end}`
            }
          },
          {
            title: '任务状态',
            dataIndex: 'status',
            key: 'status',
            width: 90,
            render: (status: string) => {
              const cfg = SUBTASK_STATUS_MAP[status] || { color: 'default', text: status }
              return <Tag color={cfg.color}>{cfg.text}</Tag>
            }
          },
          {
            title: '子任务描述',
            dataIndex: 'description',
            key: 'description',
            width: 220,
            ellipsis: true,
          },
          {
            title: '任务级别',
            dataIndex: 'priority',
            key: 'priority',
            width: 80,
            render: (priority: string) => {
              const cfg = TASK_PRIORITY_MAP[priority] || { color: 'default', text: priority }
              return <Tag color={cfg.color}>{cfg.text}</Tag>
            }
          },
        ]}
      />
    )
  }

  const columns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 140,
      render: (text: string, record: any) => (
        <a onClick={() => fetchProjectDetail(record.id)} style={{ color: '#1890ff', cursor: 'pointer' }}>
          {text}
        </a>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'createdAt',
      width: 100,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-'
    },
    {
      title: '客户简称',
      dataIndex: 'clientShortName',
      key: 'clientShortName',
      width: 100,
      render: (v: string) => v || '-'
    },
    {
      title: '项目总负责人',
      dataIndex: ['owner', 'name'],
      key: 'owner',
      width: 90,
      render: (v: string) => v || '-'
    },
    {
      title: '项目状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const cfg = PROJECT_STATUS_MAP[status]
        return <Tag color={cfg?.color}>{cfg?.text}</Tag>
      }
    },
    {
      title: '项目描述',
      dataIndex: 'description',
      key: 'description',
      width: 160,
      render: (text: string) => text ? (
        <Tooltip title={text} placement="topLeft">
          <div style={{
            lineHeight: '18px',
            maxHeight: '54px',
            overflow: 'hidden',
            wordBreak: 'break-all',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            fontSize: '12px'
          }}>
            {text}
          </div>
        </Tooltip>
      ) : '-'
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      width: 160,
      render: (text: string) => text ? (
        <Tooltip title={text} placement="topLeft">
          <div style={{
            lineHeight: '18px',
            maxHeight: '54px',
            overflow: 'hidden',
            wordBreak: 'break-all',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            fontSize: '12px'
          }}>
            {text}
          </div>
        </Tooltip>
      ) : '-'
    },
    {
      title: '工作量',
      key: 'workload',
      width: 90,
      render: (_: any, record: any) => `${record.workload || '-'} ${record.workloadUnit || ''}`
    },
    {
      title: '预计完成日期',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 100,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-'
    },
    {
      title: '实际完成日期',
      dataIndex: 'actualEndDate',
      key: 'actualEndDate',
      width: 100,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-'
    },
    {
      title: '项目进度',
      key: 'progress',
      width: 100,
      render: (_: any, record: any) => (
        <Progress percent={record.progress || 0} size="small" style={{ width: 80 }} />
      )
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => fetchProjectDetail(record.id)}>
            查看
          </Button>
          {hasPermission('project:edit') && record.status === 'draft' && (
            <Button type="link" icon={<EditOutlined />} onClick={() => {
              setEditingProject(record)
              setIsModalOpen(true)
            }}>编辑</Button>
          )}
          {hasPermission('project:edit') && record.status === 'draft' && (
            <Popconfirm
              title="确定提交此项目？提交后将无法编辑"
              onConfirm={() => submitProjectMutation.mutate({ id: record.id, data: record })}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" style={{ color: '#1890ff' }}>提交项目</Button>
            </Popconfirm>
          )}
          {hasPermission('project:pause') && record.pauseRequestStatus === 'pending' ? (
            <Tag color="orange">暂停申请中</Tag>
          ) : (
            hasPermission('project:pause') && !['draft', 'paused', 'archived', 'completed'].includes(record.status) && (
              <Popconfirm
                title="确定申请暂停此项目吗？"
                onConfirm={() => pauseRequestMutation.mutate(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link">暂停</Button>
              </Popconfirm>
            )
          )}
        </Space>
      )
    }
  ]

  const priorityMapReverse: Record<string, string> = {
    'P0': 'urgent',
    'P1': 'high',
    'P2': 'medium',
    'P3': 'low',
  }

  const processFormValues = (values: any) => {
    const workloadValue = values.workload !== undefined && values.workload !== '' ? Number(values.workload) : undefined
    const formatDate = (d: any) => {
      if (!d) return undefined
      if (typeof d === 'string') return d
      if (d.format) return d.format('YYYY-MM-DD')
      return d
    }
    return {
      ...values,
      startDate: formatDate(values.startDate),
      endDate: formatDate(values.endDate),
      completedDate: formatDate(values.completedDate),
      clientShortName: values.clientShortName,
      workload: workloadValue,
      workloadUnit: values.workloadUnit,
      remarks: values.remarks,
      subTasks: values.subTasks?.map((st: any) => ({
        ...st,
        startDate: formatDate(st.startDate),
        dueDate: formatDate(st.dueDate),
        priority: priorityMapReverse[st.priority] || st.priority,
        workload: st.workload !== undefined && st.workload !== '' ? Number(st.workload) : undefined,
      }))
    }
  }

  const handleSubmit = (values: any) => {
    const payload = processFormValues(values)
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const validateSubtaskWorkload = (_: any, value: any) => {
    if (value === undefined || value === null || value === '') return Promise.resolve()
    const totalWorkload = Number(value)
    const subTasks = form.getFieldValue('subTasks') || []
    const subtaskTotal = subTasks.reduce((sum: number, st: any) => {
      return sum + (st.workload !== undefined && st.workload !== '' ? Number(st.workload) : 0)
    }, 0)
    if (subtaskTotal > totalWorkload) {
      return Promise.reject(new Error(`子任务总工作量(${subtaskTotal})不能超过项目总工作量(${totalWorkload})`))
    }
    return Promise.resolve()
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 筛选区域 */}
      <Card size="small" style={{ marginBottom: 16, flexShrink: 0 }}>
        <Row gutter={16} align="middle">
          <Col><h2 style={{ margin: 0 }}>项目管理</h2></Col>
          <Col>
            <Input
              placeholder="项目名称"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              allowClear
              style={{ width: 180 }}
            />
          </Col>
          <Col>
            <DatePicker
              placeholder="开始时间"
              value={filterStartDate ? dayjs(filterStartDate) : null}
              onChange={(d) => setFilterStartDate(d ? d.format('YYYY-MM-DD') : null)}
              style={{ width: 140 }}
            />
          </Col>
          <Col>
            <DatePicker
              placeholder="结束时间"
              value={filterEndDate ? dayjs(filterEndDate) : null}
              onChange={(d) => setFilterEndDate(d ? d.format('YYYY-MM-DD') : null)}
              style={{ width: 140 }}
            />
          </Col>
          <Col>
            <Select
              placeholder="时间范围"
              allowClear
              style={{ width: 140 }}
              value={filterTimeRange}
              onChange={setFilterTimeRange}
            >
              <Option value="1month">近一个月</Option>
              <Option value="3months">近三个月</Option>
              <Option value="6months">近半年</Option>
              <Option value="1year">近一年</Option>
            </Select>
          </Col>
          <Col>
            <Select
              placeholder="项目状态"
              allowClear
              style={{ width: 120 }}
              value={filterStatus}
              onChange={setFilterStatus}
            >
              <Option value="pending_claim">待签收</Option>
              <Option value="assigned">已分配</Option>
              <Option value="in_progress">进行中</Option>
              <Option value="paused">已暂停</Option>
              <Option value="completed">已完成</Option>
              <Option value="archived">已归档</Option>
            </Select>
          </Col>
          <Col>
            <Button onClick={() => {
              setFilterName('')
              setFilterStartDate(null)
              setFilterEndDate(null)
              setFilterTimeRange(null)
              setFilterStatus(null)
              setSearchParams({})
              setPagination(prev => ({ ...prev, current: 1 }))
            }}>重置</Button>
          </Col>
          {canCreate && (
            <Col style={{ marginLeft: 'auto' }}>
              <Space.Compact>
                <Button type={viewMode === 'list' ? 'primary' : 'default'} onClick={() => setViewMode('list')}>
                  列表
                </Button>
                <Button type={viewMode === 'kanban' ? 'primary' : 'default'} onClick={() => setViewMode('kanban')}>
                  看板
                </Button>
              </Space.Compact>
            </Col>
          )}
          {canCreate && (
            <Col>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                setEditingProject(null)
                setIsModalOpen(true)
              }}>
                新建项目
              </Button>
            </Col>
          )}
        </Row>
      </Card>

      {filterStatus === 'pending_claim' && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color="processing">待签收</Tag>
          <span style={{ color: '#666' }}>仅显示包含待签收子任务的项目</span>
          <Button size="small" onClick={() => {
            setFilterStatus(null)
            setPagination(prev => ({ ...prev, current: 1 }))
          }}>
            清除筛选
          </Button>
        </div>
      )}

      {!canCreate ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {(taskStatusFilter || filterStatus === 'pending_claim') && (
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag color="processing">待签收</Tag>
              <span style={{ color: '#666' }}>仅显示待签收的子任务</span>
              <Button size="small" onClick={() => {
                setTaskStatusFilter(null)
                setFilterStatus(null)
              }}>
                清除筛选
              </Button>
            </div>
          )}
          <Table
            columns={[
              {
                title: '项目名称',
                key: 'projectName',
                width: 140,
                fixed: 'left',
                render: (_: any, record: any) => record.project?.name || record.projectName || '-'
              },
              {
                title: '项目负责人',
                key: 'projectOwner',
                width: 100,
                render: (_: any, record: any) => record.project?.owner?.name || '-'
              },
              {
                title: '任务状态',
                dataIndex: 'status',
                key: 'status',
                width: 100,
                render: (status: string) => (
                  <Tag color={SUBTASK_STATUS_MAP[status]?.color || 'default'}>
                    {SUBTASK_STATUS_MAP[status]?.text || status}
                  </Tag>
                )
              },
              {
                title: '子任务名称',
                dataIndex: 'title',
                key: 'title',
                width: 140,
                render: (text: string) => text || '-'
              },
              {
                title: '子任务负责人',
                key: 'assignee',
                width: 100,
                render: (_: any, record: any) => record.assignee?.name || '-'
              },
              {
                title: '创建时间',
                dataIndex: 'createdAt',
                key: 'createdAt',
                width: 120,
                render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-'
              },
              {
                title: '工作量',
                key: 'workload',
                width: 90,
                render: (_: any, record: any) => record.project?.workload ?? '-'
              },
              {
                title: '操作',
                key: 'action',
                width: 140,
                fixed: 'right',
                render: (_: any, record: any) => {
                  const canEdit = ['received', 'rejected'].includes(record.status)
                  return (
                    <Space>
                      <Button type="link" size="small" onClick={() => navigate(`/tasks/${record.id}`)}>查看</Button>
                      {canEdit && (
                        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/tasks/${record.id}?edit=1`)}>编辑</Button>
                      )}
                    </Space>
                  )
                }
              }
            ]}
            dataSource={taskStatusFilter ? myTasks.filter((t: any) => t.status === taskStatusFilter) : myTasks}
            loading={myTasksLoading}
            rowKey="id"
            size="small"
            scroll={{ x: 'max-content', y: 'calc(100vh - 360px)' }}
          />
        </div>
      ) : viewMode === 'list' ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Table
            columns={columns}
            dataSource={projectList}
            loading={isLoading}
            rowKey="id"
            expandable={{ expandedRowRender }}
            scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
            pagination={filterStatus === 'pending_claim' || total === 0 ? false : {
              current: pagination.current,
              pageSize: pagination.pageSize,
              total,
              pageSizeOptions: ['10', '20', '50'],
              showSizeChanger: true,
              showTotal: (t: number) => `共 ${t} 条`,
              onChange: (page, pageSize) => {
                setPagination({ current: page, pageSize })
              }
            }}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
          {[
            { key: 'draft', title: '草稿', color: '#bfbfbf' },
            { key: 'assigned', title: '已分配', color: '#722ed1' },
            { key: 'in_progress', title: '进行中', color: '#1890ff' },
            { key: 'paused', title: '已暂停', color: '#fa8c16' },
            { key: 'completed', title: '已完成', color: '#1890ff' },
            { key: 'archived', title: '已归档', color: '#bfbfbf' },
          ].map((col) => {
            const colProjects = projectList.filter((p: any) => p.status === col.key)
            return (
              <div key={col.key} style={{ minWidth: 280, maxWidth: 320, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '8px 12px', background: col.color, color: '#fff', borderRadius: '4px 4px 0 0', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{col.title}</span>
                  <Badge count={colProjects.length} style={{ backgroundColor: '#fff', color: col.color }} />
                </div>
                <div style={{ flex: 1, background: '#f5f5f5', padding: 12, borderRadius: '0 0 4px 4px', minHeight: 400, overflowY: 'auto' }}>
                  {colProjects.map((project: any) => (
                    <Card
                      key={project.id}
                      size="small"
                      style={{ marginBottom: 12, cursor: 'pointer' }}
                      onClick={() => fetchProjectDetail(project.id)}
                      hoverable
                      title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 500, fontSize: 14 }}>{project.name}</span>
                        </div>
                      }
                    >
                      <div style={{ marginBottom: 8 }}>
                        <Tag color={PROJECT_STATUS_MAP[project.status]?.color}>
                          {PROJECT_STATUS_MAP[project.status]?.text}
                        </Tag>
                        {project.pauseRequestStatus === 'pending' && (
                          <Tag color="orange">暂停申请中</Tag>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                        负责人：{project.owner?.name || '-'} | 客户：{project.clientShortName || '-'}
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                        工作量：{project.workload || '-'} {project.workloadUnit || ''}
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <Progress percent={project.progress || 0} size="small" />
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        子任务：{project.subTasks?.length || 0} 个
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Button type="link" size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); fetchProjectDetail(project.id) }}>查看</Button>
                        {hasPermission('project:edit') && project.status === 'draft' && (
                          <>
                            <Button type="link" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); setEditingProject(project); setIsModalOpen(true) }}>编辑</Button>
                            <Button type="link" size="small" style={{ color: '#1890ff' }} onClick={(e) => { e.stopPropagation(); submitProjectMutation.mutate({ id: project.id, data: project }) }}>提交</Button>
                          </>
                        )}
                      </div>
                    </Card>
                  ))}
                  {colProjects.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>暂无项目</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}



      {/* 创建项目模态框 */}
      <Modal
        title={editingProject ? '编辑草稿项目' : '新建项目'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false)
          setEditingProject(null)
        }}
        width={900}
        destroyOnHidden
        maskClosable={false}
        forceRender
        footer={
          editingProject?.status === 'draft'
            ? [
                <Button key="cancel" onClick={() => { setIsModalOpen(false); setEditingProject(null) }}>
                  取消
                </Button>,
                <Button
                  key="submit"
                  type="primary"
                  loading={updateMutation.isPending}
                  onClick={() => {
                    form.validateFields().then((values) => {
                      submitProjectMutation.mutate({ id: editingProject.id, data: { ...values, status: 'assigned' } })
                    })
                  }}
                >
                  提交项目
                </Button>
              ]
            : [
                <Button key="cancel" onClick={() => { setIsModalOpen(false); setEditingProject(null) }}>
                  取消
                </Button>,
                <Button key="draft" onClick={() => form.validateFields().then((values) => saveDraftMutation.mutate(values))} loading={saveDraftMutation.isPending}>
                  保存草稿
                </Button>,
                <Button key="submit" type="primary" onClick={() => form.submit()} loading={createMutation.isPending}>
                  保存并提交
                </Button>
              ]
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} preserve={false}>
          <Form.Item
            name="name"
            label="项目名称"
            rules={[
              { required: true, message: '请输入项目名称' },
              { max: 50, message: '项目名称不能超过50个字' }
            ]}
          >
            <Input placeholder="请输入项目名称" maxLength={50} showCount />
          </Form.Item>
          <Form.Item
            name="ownerId"
            label="项目负责人"
            rules={[{ required: true, message: '请选择项目负责人' }]}
          >
            <Select
              showSearch
              placeholder="请选择项目负责人"
              allowClear
              optionFilterProp="label"
              options={users.map((u: any) => ({ label: u.name || u.username, value: u.id }))}
            />
          </Form.Item>
          <Form.Item
            name="shortName"
            label="项目简称"
            rules={[
              { max: 50, message: '项目简称不能超过50个字' }
            ]}
          >
            <Input placeholder="请输入项目简称" maxLength={50} showCount />
          </Form.Item>
          <Form.Item name="clientShortName" label="客户简称" rules={[{ required: true, message: '请选择客户简称' }]}>
            <Select
              showSearch
              placeholder="请选择客户简称"
              allowClear
              optionFilterProp="children"
              options={suppliers.map((s: any) => ({ label: s.short_name || s.full_name, value: s.short_name || s.full_name }))}
            />
          </Form.Item>
          <Form.Item
            name="description"
            label="项目描述"
            rules={[
              { required: true, message: '请输入项目描述' },
              { max: 500, message: '项目描述不能超过500个字' }
            ]}
          >
            <Input.TextArea rows={2} placeholder="请输入项目描述" maxLength={500} showCount />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="startDate" label="开始时间">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endDate"
                label="预计结束时间"
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const startDate = getFieldValue('startDate')
                      if (!value || !startDate || !value.isBefore(startDate, 'day')) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error('预计结束时间不能早于开始时间'))
                    }
                  })
                ]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          {editingProject && editingProject.actualEndDate && (
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Form.Item label="实际结束时间">
                  <span>{dayjs(editingProject.actualEndDate).format('YYYY-MM-DD')}</span>
                </Form.Item>
              </Col>
            </Row>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="workload"
                label="工作量"
                rules={[
                  { validator: validateSubtaskWorkload },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (value === undefined || value === null || value === '') {
                        return Promise.resolve()
                      }
                      const num = Number(value)
                      if (isNaN(num)) {
                        return Promise.reject(new Error('请输入有效数字'))
                      }
                      if (num < 0) {
                        return Promise.reject(new Error('工作量不能为负数'))
                      }
                      if (num > 9999999) {
                        return Promise.reject(new Error('工作量数值过大'))
                      }
                      return Promise.resolve()
                    }
                  })
                ]}
              >
                <Input type="number" placeholder="请输入工作量" min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="workloadUnit" label="计量单位">
                <Select placeholder="请选择计量单位" allowClear>
                  <Option value="天">天</Option>
                  <Option value="平方米">平方米</Option>
                  <Option value="平方千米">平方千米</Option>
                  <Option value="米">米</Option>
                  <Option value="千米">千米</Option>
                  <Option value="亩">亩</Option>
                  <Option value="栋">栋</Option>
                  <Option value="宗">宗</Option>
                  <Option value="块">块</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="备注" rules={[{ max: 500, message: '备注不能超过500个字' }]}>
            <Input.TextArea rows={2} placeholder="请输入备注" maxLength={500} showCount />
          </Form.Item>

          <Card title="子任务分配" size="small" style={{ marginTop: 8 }}>
            <Form.List name="subTasks">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <div key={key} style={{ marginBottom: 8, padding: 8, background: '#fafafa', borderRadius: 4 }}>
                      <Row gutter={8} align="middle">
                        <Col span={5}>
                          <Form.Item
                            {...restField}
                            name={[name, 'title']}
                            rules={[{ required: true, message: '请输入子任务名称' }]}
                            noStyle
                          >
                            <Input placeholder="子任务名称" />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item {...restField} name={[name, 'assigneeId']} noStyle rules={[{ required: true, message: '请选择负责人' }]}>
                            <Select
                              placeholder="负责人"
                              allowClear
                              options={users.map((u: any) => ({ label: u.name, value: u.id }))}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item {...restField} name={[name, 'startDate']} noStyle>
                            <DatePicker placeholder="计划开始时间" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item
                            {...restField}
                            name={[name, 'dueDate']}
                            rules={[
                              ({ getFieldValue }) => ({
                                validator(_, value) {
                                  const startDate = getFieldValue(['subTasks', name, 'startDate'])
                                  if (!value || !startDate || !value.isBefore(startDate, 'day')) {
                                    return Promise.resolve()
                                  }
                                  return Promise.reject(new Error('结束时间不能早于开始时间'))
                                }
                              })
                            ]}
                            noStyle
                          >
                            <DatePicker placeholder="预计结束时间" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={3}>
                          <Form.Item {...restField} name={[name, 'priority']} noStyle>
                            <Select
                              placeholder="任务级别"
                              allowClear
                              options={[
                                { label: 'P0', value: 'P0' },
                                { label: 'P1', value: 'P1' },
                                { label: 'P2', value: 'P2' },
                                { label: 'P3', value: 'P3' },
                              ]}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={3}>
                          <Form.Item
                            {...restField}
                            name={[name, 'description']}
                            noStyle
                            rules={[
                              { max: 200, message: '子任务描述不能超过200个字' }
                            ]}
                          >
                            <Input placeholder="子任务描述" maxLength={200} />
                          </Form.Item>
                        </Col>
                        <Col span={1}>
                          <Button type="link" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                        </Col>
                      </Row>
                      <Row gutter={8} style={{ marginTop: 8 }}>
                        <Col span={4}>
                          <Form.Item {...restField} name={[name, 'workload']} noStyle>
                            <Input type="number" step="0.01" min={0} placeholder="工作量" />
                          </Form.Item>
                        </Col>
                        <Col span={4}>
                          <Form.Item {...restField} name={[name, 'workloadUnit']} noStyle>
                            <Select placeholder="计量单位" allowClear>
                              <Option value="天">天</Option>
                              <Option value="平方米">平方米</Option>
                              <Option value="平方千米">平方千米</Option>
                              <Option value="米">米</Option>
                              <Option value="千米">千米</Option>
                              <Option value="亩">亩</Option>
                              <Option value="栋">栋</Option>
                              <Option value="宗">宗</Option>
                              <Option value="块">块</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item {...restField} name={[name, 'remarks']} noStyle>
                            <Input placeholder="子任务备注" maxLength={200} />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加子任务
                  </Button>
                </>
              )}
            </Form.List>
          </Card>
        </Form>
      </Modal>
    </div>
  )
}
