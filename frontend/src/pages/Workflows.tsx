// @ts-nocheck
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { 
  Card, Tabs, Button, Table, Tag, Statistic, Row, Col, 
  Modal, Form, Input, Select, DatePicker, InputNumber, 
  Steps, Timeline, Empty, message, Descriptions, Divider,
  Space, Popconfirm, Drawer, Transfer, Checkbox, Alert, Switch
} from 'antd'
import { 
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, FileTextOutlined, UserOutlined,
  ArrowRightOutlined, CheckOutlined, CloseOutlined,
  SwapOutlined, BellOutlined, HistoryOutlined, CheckSquareOutlined
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuthStore } from '../stores/auth'
import dayjs from 'dayjs'

const { TextArea } = Input

export default function Workflows() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || 'my-applications'
  })
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null)
  const [viewInstance, setViewInstance] = useState<any>(null)
  const instanceIdParam = searchParams.get('instanceId')
  const [applyForm] = Form.useForm()
  const [approvalForm] = Form.useForm()
  const [rejectForm] = Form.useForm()
  const queryClient = useQueryClient()
  const isAdmin = useAuthStore((state) => state.user?.isAdmin)

  // 流程设置相关
  const [editDefinitionModalVisible, setEditDefinitionModalVisible] = useState(false)
  const [editingDefinition, setEditingDefinition] = useState<any>(null)
  const [definitionForm] = Form.useForm()
  const [formFields, setFormFields] = useState<any[]>([])
  const [flowSteps, setFlowSteps] = useState<any[]>([])

  const [batchDrawerVisible, setBatchDrawerVisible] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<any[]>([])
  const [transferDrawerVisible, setTransferDrawerVisible] = useState(false)
  const [transferTarget, setTransferTarget] = useState<any>(null)
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false)
  const [instanceHistory, setInstanceHistory] = useState<any[]>([])
  const [selectedInstance, setSelectedInstance] = useState<any>(null)
  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [transferModalVisible, setTransferModalVisible] = useState(false)
  const [transferForm] = Form.useForm()
  const [users, setUsers] = useState<any[]>([])

  // 获取流程定义列表
  const { data: definitions, isLoading: defLoading } = useQuery({
    queryKey: ['workflow-definitions'],
    queryFn: () => api.get('/workflows/definitions')
  })

  // 获取审批统计
  const { data: stats } = useQuery({
    queryKey: ['workflow-stats'],
    queryFn: () => api.get('/workflows/stats')
  })

  // 更新流程定义
  const updateDefinitionMutation = useMutation({
    mutationFn: (data: any) => api.put(`/workflows/definitions/${data.id}`, data),
    onSuccess: () => {
      message.success('流程定义更新成功')
      setEditDefinitionModalVisible(false)
      setEditingDefinition(null)
      definitionForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['workflow-definitions'] })
    },
    onError: (error: any) => {
      message.error(error?.message || '更新失败')
    }
  })

  // 获取我的申请
  const { data: myApplications, isLoading: appLoading } = useQuery({
    queryKey: ['workflow-instances', 'applied'],
    queryFn: () => api.get('/workflows/instances?type=applied')
  })

  // 获取待我审批
  const { data: pendings, isLoading: pendingLoading } = useQuery({
    queryKey: ['workflow-instances', 'pending'],
    queryFn: () => api.get('/workflows/instances?type=pending')
  })

  // 提交申请
  const applyMutation = useMutation({
    mutationFn: (data: any) => api.post('/workflows/instances', data),
    onSuccess: () => {
      message.success('申请提交成功')
      setIsApplyModalOpen(false)
      applyForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] })
      queryClient.invalidateQueries({ queryKey: ['workflow-stats'] })
    },
    onError: () => {
      message.error('提交失败')
    }
  })

  // 审批操作
  const reviewMutation = useMutation({
    mutationFn: ({ id, action, comment }: { id: string; action: string; comment?: string }) =>
      api.put(`/workflows/instances/${id}/approve`, { action, comment }),
    onSuccess: () => {
      message.success('审批完成')
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] })
      queryClient.invalidateQueries({ queryKey: ['workflow-stats'] })
    }
  })

  // 从 URL 参数自动打开审批弹窗
  useEffect(() => {
    if (instanceIdParam && pendings?.data && !viewInstance) {
      const found = pendings.data.find((item: any) => item.id === instanceIdParam)
      if (found) {
        setViewInstance(found)
      }
    }
  }, [instanceIdParam, pendings])

  // 撤销申请
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.put(`/workflows/instances/${id}/cancel`),
    onSuccess: () => {
      message.success('申请已撤销')
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] })
    }
  })

  // 批量审批
  const batchApproveMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: string }) => 
      api.post('/workflows/instances/batch-approve', { ids, action }),
    onSuccess: () => {
      message.success('批量审批完成')
      setBatchDrawerVisible(false)
      setSelectedRowKeys([])
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] })
      queryClient.invalidateQueries({ queryKey: ['workflow-stats'] })
    },
    onError: () => {
      message.error('批量审批失败')
    }
  })

  // 转交申请
  const transferMutation = useMutation({
    mutationFn: ({ id, targetUserId, reason }: { id: string; targetUserId: string; reason?: string }) =>
      api.post(`/workflows/instances/${id}/transfer`, { targetUserId, reason }),
    onSuccess: () => {
      message.success('申请已转交')
      setTransferModalVisible(false)
      transferForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] })
    },
    onError: (error: any) => {
      message.error(error?.message || '转交失败')
    }
  })

  // 催办
  const remindMutation = useMutation({
    mutationFn: (id: string) => api.post(`/workflows/instances/${id}/remind`),
    onSuccess: () => {
      message.success('已发送催办提醒')
    },
    onError: () => {
      message.error('催办失败')
    }
  })

  // 获取历史记录
  const fetchHistory = async (instanceId: string) => {
    try {
      const res: any = await api.get(`/workflows/instances/${instanceId}/history`)
      if (res.success) {
        setInstanceHistory(res.data || [])
      }
    } catch (error) {
      console.error('获取历史失败', error)
    }
  }

  // 获取用户列表
  const fetchUsers = async () => {
    try {
      const res: any = await api.get('/users')
      if (res.success) {
        setUsers(res.data || [])
      }
    } catch (error) {
      console.error('获取用户列表失败', error)
    }
  }

  const openHistoryDrawer = async (instance: any) => {
    setSelectedInstance(instance)
    await fetchHistory(instance.id)
    setHistoryDrawerVisible(true)
  }

  const openTransferModal = (instance: any) => {
    setTransferTarget(instance)
    fetchUsers()
    setTransferModalVisible(true)
  }

  const handleTransfer = async () => {
    if (!transferTarget) return
    try {
      const values = await transferForm.validateFields()
      transferMutation.mutate({
        id: transferTarget.id,
        targetUserId: values.targetUserId,
        reason: values.reason
      })
    } catch (error) {
      console.error('表单验证失败', error)
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'processing',
    approved: 'success',
    rejected: 'error',
    cancelled: 'default',
    processing: 'warning'
  }

  const statusLabels: Record<string, string> = {
    pending: '审批中',
    approved: '已通过',
    rejected: '已拒绝',
    cancelled: '已撤销',
    processing: '处理中'
  }

  // 统计卡片
  const StatsCards = () => (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col span={6}>
        <Card>
          <Statistic
            title="我的申请"
            value={stats?.data?.myApplied?.total || 0}
            prefix={<FileTextOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="审批中"
            value={stats?.data?.myApplied?.pending || 0}
            valueStyle={{ color: '#1890ff' }}
            prefix={<ClockCircleOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="已通过"
            value={stats?.data?.myApplied?.approved || 0}
            valueStyle={{ color: '#52c41a' }}
            prefix={<CheckCircleOutlined />}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="待我审批"
            value={stats?.data?.pending || 0}
            valueStyle={{ color: '#faad14' }}
            prefix={<UserOutlined />}
          />
        </Card>
      </Col>
    </Row>
  )

  // 申请表格列
  const applicationColumns = [
    {
      title: '申请标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {record.definition?.name}
          </div>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      )
    },
    {
      title: '当前步骤',
      key: 'step',
      width: 120,
      render: (_: any, record: any) => {
        const steps = record.definition?.flowConfig?.steps || []
        const current = steps[record.currentStep]
        return current?.name || '-'
      }
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => (
        <div>
          <Button type="link" size="small" onClick={() => setViewInstance(record)}>
            查看
          </Button>
          {record.status === 'pending' && (
            <Button 
              type="link" 
              size="small" 
              danger
              onClick={() => cancelMutation.mutate(record.id)}
            >
              撤销
            </Button>
          )}
        </div>
      )
    }
  ]

  // 待审批表格列
  const pendingColumns = [
    {
      title: '申请标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {record.applicant?.name} · {record.definition?.name}
          </div>
        </div>
      )
    },
    {
      title: '申请类型',
      dataIndex: ['definition', 'name'],
      key: 'type',
      width: 120
    },
    {
      title: '当前步骤',
      key: 'step',
      width: 120,
      render: (_: any, record: any) => {
        const steps = record.definition?.flowConfig?.steps || []
        const current = steps[record.currentStep]
        return current?.name || '-'
      }
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => dayjs(date).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" onClick={() => setViewInstance(record)}>
            审批
          </Button>
          <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => openTransferModal(record)}>
            转交
          </Button>
          <Button type="link" size="small" icon={<BellOutlined />} onClick={() => remindMutation.mutate(record.id)}>
            催办
          </Button>
          <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => openHistoryDrawer(record)}>
            历史
          </Button>
        </Space>
      )
    }
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: any) => setSelectedRowKeys(keys)
  }

  // 渲染表单字段
  const renderFormField = (field: any) => {
    switch (field.type) {
      case 'select':
        return (
          <Select placeholder={`请选择${field.label}`}>
            {field.options?.map((opt: any) => (
              <Select.Option key={opt.value} value={opt.value}>
                {opt.label}
              </Select.Option>
            ))}
          </Select>
        )
      case 'date':
        return <DatePicker style={{ width: '100%' }} />
      case 'datetime':
        return <DatePicker showTime style={{ width: '100%' }} />
      case 'number':
        return <InputNumber style={{ width: '100%' }} min={0} />
      case 'textarea':
        return <TextArea rows={3} />
      case 'file':
        return <Input placeholder="请输入文件链接" />
      default:
        return <Input />
    }
  }

  // 提交申请
  const handleApplySubmit = (values: any) => {
    if (!selectedWorkflow) return
    
    const formData: any = {}
    selectedWorkflow.formSchema?.fields?.forEach((field: any) => {
      if (values[field.name] !== undefined) {
        if (field.type === 'date' || field.type === 'datetime') {
          formData[field.name] = values[field.name]?.format('YYYY-MM-DD')
        } else {
          formData[field.name] = values[field.name]
        }
      }
    })

    applyMutation.mutate({
      definitionId: selectedWorkflow.id,
      title: values.title || `${selectedWorkflow.name}-${dayjs().format('MM-DD')}`,
      formData
    })
  }

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>审批流程</h2>
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => setIsApplyModalOpen(true)}
        >
          提交申请
        </Button>
      </div>

      <StatsCards />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'my-applications',
            label: `我的申请 (${stats?.data?.myApplied?.total || 0})`,
            children: (
              <Table
                columns={applicationColumns}
                dataSource={myApplications?.data}
                loading={appLoading}
                rowKey="id"
                scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
                pagination={{
                  current: 1,
                  pageSize: 10,
                  pageSizeOptions: ['10', '20', '50'],
                  showSizeChanger: true,
                  showTotal: (t: number) => `共 ${t} 条`,
                }}
                locale={{ emptyText: <Empty description="暂无申请记录" /> }}
              />
            )
          },
          {
            key: 'pending-review',
            label: `待我审批 (${stats?.data?.pending || 0})`,
            children: (
              <>
                {selectedRowKeys.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Space>
                      <span>已选择 {selectedRowKeys.length} 项</span>
                      <Button type="primary" icon={<CheckOutlined />} onClick={() => setBatchDrawerVisible(true)}>
                        批量审批
                      </Button>
                      <Button onClick={() => setSelectedRowKeys([])}>取消选择</Button>
                    </Space>
                  </div>
                )}
                <Table
                  columns={pendingColumns}
                  dataSource={pendings?.data}
                  loading={pendingLoading}
                  rowKey="id"
                  rowSelection={rowSelection}
                  scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
                  pagination={{
                    current: 1,
                    pageSize: 10,
                    pageSizeOptions: ['10', '20', '50'],
                    showSizeChanger: true,
                    showTotal: (t: number) => `共 ${t} 条`,
                  }}
                  locale={{ emptyText: <Empty description="暂无待审批申请" /> }}
                />
              </>
            )
          },
          ...(isAdmin ? [{
            key: 'settings',
            label: '流程设置',
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#666' }}>管理审批流程定义</span>
                </div>
                <Table
                  columns={[
                    { title: '流程名称', dataIndex: 'name', key: 'name' },
                    { title: '类型', dataIndex: 'type', key: 'type' },
                    { title: '描述', dataIndex: 'description', key: 'description', render: (v: string) => v || '-' },
                    { title: '状态', dataIndex: 'isActive', key: 'isActive', render: (v: boolean) => v ? <Tag color="success">启用</Tag> : <Tag color="default">禁用</Tag> },
                    {
                      title: '操作',
                      key: 'action',
                      render: (_: any, record: any) => (
                        <Button
                          type="link"
                          onClick={() => {
                            setEditingDefinition(record)
                            definitionForm.setFieldsValue({
                              name: record.name,
                              type: record.type,
                              description: record.description,
                              isActive: record.isActive
                            })
                            setFormFields(record.formSchema?.fields || [])
                            setFlowSteps(record.flowConfig?.steps || [])
                            setEditDefinitionModalVisible(true)
                          }}
                        >
                          编辑
                        </Button>
                      )
                    }
                  ]}
                  dataSource={definitions?.data || []}
                  rowKey="id"
                  loading={defLoading}
                  scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
                  pagination={{
                    current: 1,
                    pageSize: 10,
                    pageSizeOptions: ['10', '20', '50'],
                    showSizeChanger: true,
                    showTotal: (t: number) => `共 ${t} 条`,
                  }}
                />
              </div>
            )
          }] : [])
        ]}
      />

      {/* 提交申请弹窗 */}
      <Modal
        title="选择审批类型"
        open={isApplyModalOpen && !selectedWorkflow}
        onCancel={() => setIsApplyModalOpen(false)}
        footer={null}
        width={600}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {definitions?.data?.map((def: any) => (
            <Card
              key={def.id}
              hoverable
              style={{ width: 'calc(50% - 8px)', cursor: 'pointer' }}
              onClick={() => {
                setSelectedWorkflow(def)
                applyForm.setFieldValue('title', `${def.name}-${dayjs().format('MM-DD')}`)
              }}
            >
              <div style={{ fontWeight: 500, fontSize: 16 }}>{def.name}</div>
              <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                {def.description}
              </div>
            </Card>
          ))}
          {(!definitions?.data || definitions.data.length === 0) && (
            <Empty description="暂无可用审批流程" style={{ width: '100%' }} />
          )}
        </div>
      </Modal>

      {/* 填写申请表单 */}
      <Modal
        title={selectedWorkflow?.name}
        open={!!selectedWorkflow}
        onCancel={() => {
          setSelectedWorkflow(null)
          applyForm.resetFields()
        }}
        onOk={() => applyForm.submit()}
        confirmLoading={applyMutation.isPending}
        width={600}
      >
        <Form form={applyForm} layout="vertical" onFinish={handleApplySubmit}>
          <Form.Item
            name="title"
            label="申请标题"
            rules={[{ required: true, message: '请输入申请标题' }]}
          >
            <Input placeholder="请输入申请标题" />
          </Form.Item>

          {selectedWorkflow?.formSchema?.fields?.map((field: any) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              rules={field.required ? [{ required: true, message: `请输入${field.label}` }] : []}
            >
              {renderFormField(field)}
            </Form.Item>
          ))}
        </Form>
      </Modal>

      {/* 查看/审批详情 */}
      <Modal
        title="申请详情"
        open={!!viewInstance}
        onCancel={() => setViewInstance(null)}
        footer={null}
        width={700}
      >
        {viewInstance && (
          <div>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="申请标题" span={2}>
                {viewInstance.title}
              </Descriptions.Item>
              <Descriptions.Item label="申请类型">
                {viewInstance.definition?.name}
              </Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={statusColors[viewInstance.status]}>
                  {statusLabels[viewInstance.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="申请人">
                {viewInstance.applicant?.name}
              </Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {dayjs(viewInstance.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <h4>审批进度</h4>
              <Steps
                current={viewInstance.currentStep}
                items={viewInstance.definition?.flowConfig?.steps?.map((step: any) => ({
                  title: step.name
                }))}
              />
            </div>

            {viewInstance.approvers?.length > 0 && (
              <>
                <Divider />
                <div style={{ marginBottom: 16 }}>
                  <h4>审批记录</h4>
                  <Timeline
                    items={viewInstance.approvers.map((record: any) => ({
                      color: record.action === 'approve' ? 'green' : 'red',
                      children: (
                        <div>
                          <div>
                            <strong>{record.userName}</strong> 
                            {record.action === 'approve' ? ' 批准' : ' 拒绝'}
                          </div>
                          {record.comment && (
                            <div style={{ color: '#666', marginTop: 4 }}>
                              备注: {record.comment}
                            </div>
                          )}
                          <div style={{ fontSize: 12, color: '#999' }}>
                            {dayjs(record.time).format('MM-DD HH:mm')}
                          </div>
                        </div>
                      )
                    }))}
                  />
                </div>
              </>
            )}

            {/* 表单数据展示 */}
            {viewInstance.formData && (
              <>
                <Divider />
                <div>
                  <h4>申请内容</h4>
                  <Descriptions column={2} bordered size="small">
                    {Object.entries(viewInstance.formData).map(([key, value]: [string, any]) => (
                      <Descriptions.Item key={key} label={key}>
                        {String(value)}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </div>
              </>
            )}

            {/* 审批操作 */}
            {viewInstance.status === 'pending' && activeTab === 'pending-review' && (
              <>
                <Divider />
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    size="large"
                    onClick={() => {
                      reviewMutation.mutate({ id: viewInstance.id, action: 'approve' })
                      setViewInstance(null)
                    }}
                    loading={reviewMutation.isPending}
                  >
                    批准
                  </Button>
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    size="large"
                    onClick={() => {
                      reviewMutation.mutate({ id: viewInstance.id, action: 'reject' })
                      setViewInstance(null)
                    }}
                    loading={reviewMutation.isPending}
                  >
                    拒绝
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* 批量审批抽屉 */}
      <Drawer
        title="批量审批"
        open={batchDrawerVisible}
        onClose={() => setBatchDrawerVisible(false)}
        width={500}
      >
        <Alert 
          message={`已选择 ${selectedRowKeys.length} 项申请`} 
          type="info" 
          showIcon 
          style={{ marginBottom: 16 }}
        />
        <div style={{ marginBottom: 24 }}>
          <h4>选中的申请：</h4>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            {pendings?.data?.filter((r: any) => selectedRowKeys.includes(r.id)).map((record: any) => (
              <div key={record.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ fontWeight: 500 }}>{record.title}</div>
                <div style={{ fontSize: 12, color: '#999' }}>
                  {record.applicant?.name} · {dayjs(record.createdAt).format('MM-DD HH:mm')}
                </div>
              </div>
            ))}
          </div>
        </div>
        <Space style={{ width: '100%', justifyContent: 'center' }}>
          <Button 
            type="primary" 
            icon={<CheckOutlined />} 
            size="large"
            onClick={() => batchApproveMutation.mutate({ ids: selectedRowKeys, action: 'approve' })}
            loading={batchApproveMutation.isPending}
          >
            全部批准
          </Button>
          <Button 
            danger 
            icon={<CloseOutlined />} 
            size="large"
            onClick={() => batchApproveMutation.mutate({ ids: selectedRowKeys, action: 'reject' })}
            loading={batchApproveMutation.isPending}
          >
            全部拒绝
          </Button>
        </Space>
      </Drawer>

      {/* 转交弹窗 */}
      <Modal
        title="转交申请"
        open={transferModalVisible}
        onCancel={() => {
          setTransferModalVisible(false)
          setTransferTarget(null)
          transferForm.resetFields()
        }}
        onOk={handleTransfer}
        confirmLoading={transferMutation.isPending}
      >
        <Form form={transferForm} layout="vertical">
          <Form.Item label="转交的申请">
            <Input value={transferTarget?.title} disabled />
          </Form.Item>
          <Form.Item 
            name="targetUserId" 
            label="转交给" 
            rules={[{ required: true, message: '请选择转交对象' }]}
          >
            <Select placeholder="选择转交对象" showSearch>
              {users.map((user: any) => (
                <Select.Option key={user.id} value={user.id}>
                  {user.name || user.username}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="reason" label="转交原因">
            <TextArea rows={2} placeholder="请输入转交原因（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 历史记录抽屉 */}
      <Drawer
        title="审批历史"
        open={historyDrawerVisible}
        onClose={() => setHistoryDrawerVisible(false)}
        width={600}
      >
        {selectedInstance && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="申请标题" span={2}>{selectedInstance.title}</Descriptions.Item>
              <Descriptions.Item label="申请人">{selectedInstance.applicant?.name}</Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {dayjs(selectedInstance.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>
            
            <h4>审批记录：</h4>
            {instanceHistory.length === 0 ? (
              <Empty description="暂无审批记录" />
            ) : (
              <Timeline
                items={instanceHistory.map((record: any) => ({
                  color: record.action === 'approve' ? 'green' : record.action === 'reject' ? 'red' : 'blue',
                  children: (
                    <div>
                      <div>
                        <strong>{record.userName || record.user?.name || '系统'}</strong>
                        {' '}
                        {record.action === 'approve' ? '批准' : record.action === 'reject' ? '拒绝' : '提交'}
                      </div>
                      {record.comment && (
                        <div style={{ color: '#666', marginTop: 4 }}>备注: {record.comment}</div>
                      )}
                      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                        {dayjs(record.time || record.createdAt).format('YYYY-MM-DD HH:mm')}
                      </div>
                    </div>
                  )
                }))}
              />
            )}
          </>
        )}
      </Drawer>

      {/* 编辑流程定义弹窗 */}
      <Modal
        title="编辑流程定义"
        open={editDefinitionModalVisible}
        onCancel={() => {
          setEditDefinitionModalVisible(false)
          setEditingDefinition(null)
          definitionForm.resetFields()
        }}
        onOk={() => definitionForm.submit()}
        confirmLoading={updateDefinitionMutation.isPending}
        width={700}
      >
        <Form
          form={definitionForm}
          layout="vertical"
          onFinish={(values) => {
            if (!editingDefinition) return
            updateDefinitionMutation.mutate({
              id: editingDefinition.id,
              ...values,
              formSchema: { fields: formFields },
              flowConfig: { steps: flowSteps }
            })
          }}
        >
          <Form.Item name="name" label="流程名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="流程类型" rules={[{ required: true }]}>
            <Input disabled />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="isActive" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Divider />
          <div style={{ marginBottom: 16 }}>
            <h4>表单字段</h4>
            {formFields.map((field, index) => (
              <Card key={index} size="small" style={{ marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                  <Input
                    placeholder="字段名"
                    value={field.name}
                    onChange={(e) => {
                      const newFields = [...formFields]
                      newFields[index].name = e.target.value
                      setFormFields(newFields)
                    }}
                  />
                  <Input
                    placeholder="字段标签"
                    value={field.label}
                    onChange={(e) => {
                      const newFields = [...formFields]
                      newFields[index].label = e.target.value
                      setFormFields(newFields)
                    }}
                  />
                  <Button
                    type="text"
                    danger
                    onClick={() => {
                      const newFields = formFields.filter((_, i) => i !== index)
                      setFormFields(newFields)
                    }}
                  >
                    删除
                  </Button>
                </div>
              </Card>
            ))}
            <Button
              type="dashed"
              onClick={() => setFormFields([...formFields, { name: '', label: '', type: 'text' }])}
              block
            >
              + 添加字段
            </Button>
          </div>

          <Divider />
          <div style={{ marginBottom: 16 }}>
            <h4>审批步骤</h4>
            {flowSteps.map((step, index) => (
              <Card key={index} size="small" style={{ marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                  <Input
                    placeholder="步骤名称"
                    value={step.name}
                    onChange={(e) => {
                      const newSteps = [...flowSteps]
                      newSteps[index].name = e.target.value
                      setFlowSteps(newSteps)
                    }}
                  />
                  <Select
                    placeholder="审批人角色"
                    value={step.approver}
                    onChange={(value) => {
                      const newSteps = [...flowSteps]
                      newSteps[index].approver = value
                      setFlowSteps(newSteps)
                    }}
                  >
                    <Select.Option value="manager">部门主管</Select.Option>
                    <Select.Option value="hr">HR</Select.Option>
                    <Select.Option value="finance">财务</Select.Option>
                    <Select.Option value="ceo">总经理</Select.Option>
                    <Select.Option value="admin">行政</Select.Option>
                  </Select>
                  <Button
                    type="text"
                    danger
                    onClick={() => {
                      const newSteps = flowSteps.filter((_, i) => i !== index)
                      setFlowSteps(newSteps)
                    }}
                  >
                    删除
                  </Button>
                </div>
              </Card>
            ))}
            <Button
              type="dashed"
              onClick={() => setFlowSteps([...flowSteps, { name: '', approver: 'manager' }])}
              block
            >
              + 添加步骤
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
