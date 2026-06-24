// @ts-nocheck
import { useState, useEffect } from 'react'
import { Card, Table, Tag, Button, Modal, Form, Input, Select, Upload, message, Tabs, Space, Popconfirm, Descriptions, Drawer, InputNumber } from 'antd'
import { PlusOutlined, DeleteOutlined, EyeOutlined, CheckOutlined, CloseOutlined, UploadOutlined, EditOutlined, HistoryOutlined } from '@ant-design/icons'
import api from '../lib/api'

const { Dragger } = Upload

const { Option } = Select
const { TextArea } = Input

// 成果类型选项
const DELIVERABLE_TYPES = [
  { value: 'report', label: '报告', color: 'blue' },
  { value: 'drawing', label: '图纸', color: 'green' },
  { value: 'data', label: '数据', color: 'orange' },
  { value: 'photo', label: '照片', color: 'purple' },
  { value: 'video', label: '视频', color: 'cyan' },
  { value: 'model', label: '三维模型', color: 'geekblue' },
  { value: 'other', label: '其他', color: 'default' },
]

// 成果状态映射
const STATUS_MAP: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  pending_review: { color: 'processing', text: '待审核' },
  approved: { color: 'success', text: '已通过' },
  rejected: { color: 'error', text: '已驳回' },
}

// 文件格式映射
const FORMAT_ICONS: Record<string, string> = {
  pdf: '📄',
  doc: '📝',
  docx: '📝',
  dwg: '📐',
  dxf: '📐',
  jpg: '🖼️',
  jpeg: '🖼️',
  png: '🖼️',
  tif: '🖼️',
  mp4: '🎬',
  mov: '🎬',
  avi: '🎬',
  zip: '📦',
  rar: '📦',
}

export default function SurveyDeliverables() {
  const [deliverables, setDeliverables] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false)
  const [versionModalVisible, setVersionModalVisible] = useState(false)
  const [selectedDeliverable, setSelectedDeliverable] = useState<any>(null)
  const [editingDeliverable, setEditingDeliverable] = useState<any>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [versionForm] = Form.useForm()

  // 获取成果列表
  const fetchDeliverables = async (projectId?: string) => {
    setLoading(true)
    try {
      const url = projectId ? `/survey/deliverables?projectId=${projectId}` : '/survey/deliverables'
      const res: any = await api.get(url)
      if (res.success) {
        setDeliverables(res.data)
      }
    } catch (error) {
      message.error('获取成果列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 获取项目列表（用于筛选）
  const fetchProjects = async () => {
    try {
      const res: any = await api.get('/survey/projects')
      if (res.success) {
        setProjects(res.data)
      }
    } catch (error) {
      console.error('获取项目列表失败', error)
    }
  }

  useEffect(() => {
    fetchDeliverables()
    fetchProjects()
  }, [])

  // 项目筛选变化
  const handleProjectChange = (value: string | null) => {
    setSelectedProjectId(value ?? null)
    fetchDeliverables(value || undefined)
  }

  // 创建成果
  const handleCreate = async (values: any) => {
    try {
      let filePath = null
      let fileSize = null
      
      // 如果有文件，先上传
      if (values.file && values.file.length > 0) {
        const file = values.file[0]
        const formData = new FormData()
        formData.append('file', file.originFileObj || file)
        
        const uploadRes: any = await api.upload('/uploads', formData)
        if (uploadRes.success) {
          filePath = uploadRes.data.path
          fileSize = uploadRes.data.size
        }
      }
      
      const res: any = await api.post('/survey/deliverables', {
        ...values,
        surveyProjectId: values.surveyProjectId,
        stageId: values.stageId || null,
        filePath,
        fileSize,
      })
      if (res.success) {
        message.success('创建成功')
        setModalVisible(false)
        form.resetFields()
        fetchDeliverables(selectedProjectId || undefined)
      }
    } catch (error) {
      message.error('创建失败')
    }
  }

  // 删除成果
  const handleDelete = async (id: string) => {
    try {
      const res: any = await api.delete(`/survey/deliverables/${id}`)
      if (res.success) {
        message.success('删除成功')
        fetchDeliverables(selectedProjectId || undefined)
      }
    } catch (error) {
      message.error('删除失败')
    }
  }

  // 审核成果
  const handleReview = async (id: string, status: 'approved' | 'rejected', comments?: string) => {
    try {
      const res: any = await api.put(`/survey/deliverables/${id}/review`, {
        status,
        comments,
      })
      if (res.success) {
        message.success(status === 'approved' ? '审核通过' : '已驳回')
        fetchDeliverables(selectedProjectId || undefined)
      }
    } catch (error) {
      message.error('审核操作失败')
    }
  }

  // 查看详情
  const handleView = (record: any) => {
    setSelectedDeliverable(record)
    setDetailVisible(true)
  }

  // 编辑成果
  const handleEdit = (record: any) => {
    setEditingDeliverable(record)
    editForm.setFieldsValue({
      name: record.name,
      type: record.type,
      format: record.format,
      version: record.version,
      description: record.description
    })
    setEditModalVisible(true)
  }

  // 保存编辑
  const handleSaveEdit = async (values: any) => {
    if (!editingDeliverable) return
    try {
      const res: any = await api.put(`/survey/deliverables/${editingDeliverable.id}`, values)
      if (res.success) {
        message.success('更新成功')
        setEditModalVisible(false)
        editForm.resetFields()
        setEditingDeliverable(null)
        fetchDeliverables(selectedProjectId || undefined)
      }
    } catch (error) {
      message.error('更新失败')
    }
  }

  // 上传新版本
  const handleNewVersion = async (values: any) => {
    if (!editingDeliverable) return
    try {
      let filePath = null
      let fileSize = null
      
      if (values.file && values.file.length > 0) {
        const file = values.file[0]
        const formData = new FormData()
        formData.append('file', file.originFileObj || file)
        const uploadRes: any = await api.upload('/uploads', formData)
        if (uploadRes.success) {
          filePath = uploadRes.data.path
          fileSize = uploadRes.data.size
        }
      }
      
      const res: any = await api.post('/survey/deliverables', {
        ...values,
        surveyProjectId: editingDeliverable.surveyProjectId || selectedProjectId,
        filePath,
        fileSize,
      })
      if (res.success) {
        message.success('新版本上传成功')
        setVersionModalVisible(false)
        versionForm.resetFields()
        fetchDeliverables(selectedProjectId || undefined)
      }
    } catch (error) {
      message.error('上传失败')
    }
  }

  // 下载成果
  const handleDownload = (record: any) => {
    if (!record.filePath) {
      message.warning('暂无文件可下载')
      return
    }
    window.open(record.filePath, '_blank')
  }

  // 表格列定义
  const columns = [
    {
      title: '成果名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Space>
          <span>{FORMAT_ICONS[record.format] || '📁'}</span>
          <a onClick={() => handleView(record)}>{text}</a>
        </Space>
      ),
    },
    {
      title: '所属项目',
      dataIndex: ['surveyProject', 'name'],
      key: 'projectName',
      render: (text: string, record: any) => text || '-',
    },
    {
      title: '成果类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeInfo = DELIVERABLE_TYPES.find(t => t.value === type)
        return <Tag color={typeInfo?.color || 'default'}>{typeInfo?.label || type}</Tag>
      },
    },
    {
      title: '格式',
      dataIndex: 'format',
      key: 'format',
      render: (format: string) => format?.toUpperCase() || '-',
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusInfo = STATUS_MAP[status] || STATUS_MAP.draft
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>
      },
    },
    {
      title: '大小',
      dataIndex: 'fileSize',
      key: 'fileSize',
      render: (size: number) => size ? `${(size / 1024 / 1024).toFixed(2)} MB` : '-',
    },
    {
      title: '提交人',
      dataIndex: ['submittedByUser', 'name'],
      key: 'submittedBy',
      render: (text: string) => text || '-',
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      render: (date: string) => date ? new Date(date).toLocaleDateString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleView(record)}>
            <EyeOutlined /> 详情
          </Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            <EditOutlined /> 编辑
          </Button>
          <Button type="link" size="small" onClick={() => {
            setEditingDeliverable(record)
            setVersionModalVisible(true)
          }}>
            <HistoryOutlined /> 新版本
          </Button>
          {record.filePath && (
            <Button type="link" size="small" onClick={() => handleDownload(record)}>
              下载
            </Button>
          )}
          <Popconfirm title="确定删除此成果吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger>
              <DeleteOutlined />
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // 统计信息
  const stats = {
    total: deliverables.length,
    pending: deliverables.filter(d => d.status === 'pending_review').length,
    approved: deliverables.filter(d => d.status === 'approved').length,
    rejected: deliverables.filter(d => d.status === 'rejected').length,
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Tabs defaultActiveKey="list" items={[
          { key: 'list', label: '成果列表', children: (
            <>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <Card size="small" style={{ flex: 1 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.total}</div>
                    <div>总成果数</div>
                  </div>
                </Card>
                <Card size="small" style={{ flex: 1 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>{stats.pending}</div>
                    <div>待审核</div>
                  </div>
                </Card>
                <Card size="small" style={{ flex: 1 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>{stats.approved}</div>
                    <div>已通过</div>
                  </div>
                </Card>
                <Card size="small" style={{ flex: 1 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>{stats.rejected}</div>
                    <div>已驳回</div>
                  </div>
                </Card>
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                <Space>
                  <Select
                    placeholder="筛选项目"
                    allowClear
                    style={{ width: 250 }}
                    value={selectedProjectId}
                    onChange={handleProjectChange}
                  >
                    {projects.map((p: any) => (
                      <Option key={p.id} value={p.id}>{p.name}</Option>
                    ))}
                  </Select>
                </Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
                  上传成果
                </Button>
              </div>

              <Table
                columns={columns}
                dataSource={deliverables}
                rowKey="id"
                loading={loading}
                scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
                pagination={{
                  current: 1,
                  pageSize: 10,
                  pageSizeOptions: ['10', '20', '50'],
                  showSizeChanger: true,
                  showTotal: (t: number) => `共 ${t} 条`,
                }}
              />
            </>
          ) },
          { key: 'stats', label: '统计报表', children: (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
              统计报表功能开发中...
            </div>
          ) },
        ]} />
      </Card>

      {/* 上传成果弹窗 */}
      <Modal
        title="上传成果"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="surveyProjectId" label="所属项目" rules={[{ required: true }]}>
            <Select placeholder="选择项目">
              {projects.map((p: any) => (
                <Option key={p.id} value={p.id}>{p.name}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="name" label="成果名称" rules={[{ required: true }]}>
            <Input placeholder="请输入成果名称" />
          </Form.Item>

          <Form.Item name="type" label="成果类型" rules={[{ required: true }]}>
            <Select placeholder="选择成果类型">
              {DELIVERABLE_TYPES.map(t => (
                <Option key={t.value} value={t.value}>{t.label}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="format" label="文件格式">
            <Input placeholder="如：pdf, dwg, jpg" />
          </Form.Item>

          <Form.Item name="description" label="成果说明">
            <TextArea rows={3} placeholder="请输入成果说明" />
          </Form.Item>

          <Form.Item name="version" label="版本号">
            <Input placeholder="如：1.0" />
          </Form.Item>

          <Form.Item name="file" label="上传文件" valuePropName="fileList" getValueFromEvent={(e) => Array.isArray(e) ? e : e?.fileList}>
            <Upload name="file" maxCount={1} beforeUpload={() => false}>
              <Button icon={<UploadOutlined />}>点击上传文件</Button>
            </Upload>
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 成果详情弹窗 */}
      <Modal
        title="成果详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>关闭</Button>,
        ]}
        width={600}
      >
        {selectedDeliverable && (
          <div>
            <p><strong>成果名称：</strong>{selectedDeliverable.name}</p>
            <p><strong>所属项目：</strong>{selectedDeliverable.surveyProject?.name || '-'}</p>
            <p><strong>成果类型：</strong>{selectedDeliverable.type}</p>
            <p><strong>文件格式：</strong>{selectedDeliverable.format}</p>
            <p><strong>版本号：</strong>{selectedDeliverable.version}</p>
            <p><strong>状态：</strong>
              <Tag color={STATUS_MAP[selectedDeliverable.status]?.color}>
                {STATUS_MAP[selectedDeliverable.status]?.text}
              </Tag>
            </p>
            <p><strong>文件大小：</strong>{selectedDeliverable.fileSize ? `${(selectedDeliverable.fileSize / 1024 / 1024).toFixed(2)} MB` : '-'}</p>
            <p><strong>提交人：</strong>{selectedDeliverable.submittedByUser?.name || '-'}</p>
            <p><strong>提交时间：</strong>{selectedDeliverable.submittedAt ? new Date(selectedDeliverable.submittedAt).toLocaleString('zh-CN') : '-'}</p>
            {selectedDeliverable.description && (
              <p><strong>成果说明：</strong>{selectedDeliverable.description}</p>
            )}
            {selectedDeliverable.reviewComments && (
              <p><strong>审核意见：</strong>{selectedDeliverable.reviewComments}</p>
            )}
          </div>
        )}
      </Modal>

      {/* 编辑成果弹窗 */}
      <Modal
        title="编辑成果"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false)
          editForm.resetFields()
          setEditingDeliverable(null)
        }}
        onOk={() => editForm.submit()}
        width={500}
      >
        <Form form={editForm} layout="vertical" onFinish={handleSaveEdit}>
          <Form.Item name="name" label="成果名称" rules={[{ required: true, message: '请输入成果名称' }]}>
            <Input placeholder="请输入成果名称" />
          </Form.Item>
          <Form.Item name="type" label="成果类型" rules={[{ required: true, message: '请选择成果类型' }]}>
            <Select placeholder="选择成果类型">
              {DELIVERABLE_TYPES.map(t => (
                <Option key={t.value} value={t.value}>{t.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="format" label="文件格式">
            <Input placeholder="如：pdf, dwg, jpg" />
          </Form.Item>
          <Form.Item name="version" label="版本号">
            <Input placeholder="如：1.0" />
          </Form.Item>
          <Form.Item name="description" label="成果说明">
            <TextArea rows={3} placeholder="请输入成果说明" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 上传新版本弹窗 */}
      <Modal
        title="上传新版本"
        open={versionModalVisible}
        onCancel={() => {
          setVersionModalVisible(false)
          versionForm.resetFields()
        }}
        onOk={() => versionForm.submit()}
        width={500}
      >
        <Form form={versionForm} layout="vertical" onFinish={handleNewVersion}>
          <Form.Item label="成果名称">
            <Input value={editingDeliverable?.name} disabled />
          </Form.Item>
          <Form.Item name="version" label="新版本号" rules={[{ required: true, message: '请输入版本号' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="如：1.1" />
          </Form.Item>
          <Form.Item name="description" label="版本说明">
            <TextArea rows={3} placeholder="请输入版本更新说明" />
          </Form.Item>
          <Form.Item name="file" label="上传文件" valuePropName="fileList" getValueFromEvent={(e) => Array.isArray(e) ? e : e?.fileList}>
            <Upload name="file" maxCount={1} beforeUpload={() => false}>
              <Button icon={<UploadOutlined />}>点击上传文件</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
