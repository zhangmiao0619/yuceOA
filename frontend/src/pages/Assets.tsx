import { useState, useEffect } from 'react'
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, DatePicker, message, Tabs, Row, Col, Statistic, Descriptions, Timeline, Popconfirm, Alert, InputNumber } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SwapOutlined, ToolOutlined, CheckCircleOutlined, WarningOutlined, SearchOutlined, HistoryOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuthStore } from '../stores/auth'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input
const { RangePicker } = DatePicker

// 资产类型
const ASSET_TYPES = [
  { value: 'fixed', label: '固定资产', color: 'blue' },
  { value: 'intangible', label: '无形资产', color: 'purple' },
]

// 固定资产分类
const FIXED_CATEGORIES = [
  { value: 'vehicle', label: '交通设备', color: 'cyan' },
  { value: 'smart_device', label: '智能设备', color: 'geekblue' },
  { value: 'office_equipment', label: '办公设备', color: 'blue' },
  { value: 'office_furniture', label: '办公家具', color: 'gold' },
  { value: 'mechanical', label: '机电设备', color: 'orange' },
  { value: 'other_fixed', label: '其他固定资产', color: 'default' },
]

// 无形资产分类
const INTANGIBLE_CATEGORIES = [
  { value: 'intellectual_property', label: '知识产权', color: 'purple' },
  { value: 'enterprise_qualification', label: '企业资质', color: 'magenta' },
  { value: 'equity_asset', label: '权益类资产', color: 'processing' },
  { value: 'other_intangible', label: '其他无形资产', color: 'default' },
]

const CATEGORY_MAP: Record<string, string> = {}
for (const c of [...FIXED_CATEGORIES, ...INTANGIBLE_CATEGORIES]) {
  CATEGORY_MAP[c.value] = c.label
}

const STATUS_MAP: Record<string, { color: string; text: string }> = {
  idle: { color: 'default', text: '闲置' },
  in_use: { color: 'success', text: '在用' },
  maintenance: { color: 'warning', text: '维修中' },
  scrapped: { color: 'error', text: '已报废' },
  lost: { color: 'red', text: '挂失' },
  checking: { color: 'processing', text: '盘点中' },
}

const INTANGIBLE_STATUS_MAP: Record<string, { color: string; text: string }> = {
  valid: { color: 'success', text: '有效' },
  expiring: { color: 'warning', text: '即将过期' },
  expired: { color: 'error', text: '已过期' },
  cancelled: { color: 'default', text: '已注销' },
}

const DEPRECIATION_STATUS_MAP: Record<string, { color: string; text: string }> = {
  normal: { color: 'success', text: '正常折旧' },
  stopped: { color: 'warning', text: '停止折旧' },
  completed: { color: 'default', text: '已折旧完毕' },
}

export default function Assets() {
  const [activeTab, setActiveTab] = useState('fixed')
  const [assetType, setAssetType] = useState<'fixed' | 'intangible'>('fixed')
  const [modalVisible, setModalVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [transferVisible, setTransferVisible] = useState(false)
  const [maintenanceVisible, setMaintenanceVisible] = useState(false)
  const [editingAsset, setEditingAsset] = useState<any>(null)
  const [selectedAsset, setSelectedAsset] = useState<any>(null)
  const [form] = Form.useForm()
  const [transferForm] = Form.useForm()
  const [maintenanceForm] = Form.useForm()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const currentUser = useAuthStore((s) => s.user)
  const isAdmin = currentUser?.isAdmin
  const queryClient = useQueryClient()

  const { data: stats } = useQuery({
    queryKey: ['asset-stats'],
    queryFn: () => api.get('/assets/stats/overview'),
  })

  const { data: assetsRes, isLoading } = useQuery({
    queryKey: ['assets', assetType, pagination.current, pagination.pageSize, searchKeyword],
    queryFn: () => api.get('/assets', {
      params: {
        assetType,
        page: pagination.current,
        pageSize: pagination.pageSize,
        keyword: searchKeyword || undefined,
      }
    }),
  })

  useEffect(() => {
    if (assetsRes?.total) {
      setPagination(prev => ({ ...prev, total: assetsRes.total }))
    }
  }, [assetsRes?.total])

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/assets', data),
    onSuccess: () => {
      message.success('资产录入成功')
      setModalVisible(false)
      form.resetFields()
      setEditingAsset(null)
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset-stats'] })
    },
    onError: (err: any) => message.error(err?.message || '操作失败'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/assets/${id}`, data),
    onSuccess: () => {
      message.success('更新成功')
      setModalVisible(false)
      form.resetFields()
      setEditingAsset(null)
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset-stats'] })
    },
    onError: (err: any) => message.error(err?.message || '更新失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/assets/${id}`),
    onSuccess: () => {
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset-stats'] })
    },
  })

  const transferMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.post(`/assets/${id}/transfer`, data),
    onSuccess: () => {
      message.success('操作成功')
      setTransferVisible(false)
      transferForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset-stats'] })
    },
  })

  const maintenanceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.post(`/assets/${id}/maintenance`, data),
    onSuccess: () => {
      message.success('维保记录已保存')
      setMaintenanceVisible(false)
      maintenanceForm.resetFields()
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    setAssetType(key === 'fixed' ? 'fixed' : 'intangible')
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const openDetail = async (asset: any) => {
    const res = await api.get(`/assets/${asset.id}`)
    if (res.success) {
      setSelectedAsset(res.data)
      setDetailVisible(true)
    }
  }

  const handleSubmit = (values: any) => {
    const data = {
      ...values,
      assetType: assetType,
      purchaseDate: values.purchaseDate?.format('YYYY-MM-DD'),
      warrantyExpiry: values.warrantyExpiry?.format('YYYY-MM-DD'),
      maintenanceDate: values.maintenanceDate?.format('YYYY-MM-DD'),
      nextMaintenanceDate: values.nextMaintenanceDate?.format('YYYY-MM-DD'),
      validFrom: values.validFrom?.format('YYYY-MM-DD'),
      validUntil: values.validUntil?.format('YYYY-MM-DD'),
      renewalReminderDate: values.renewalReminderDate?.format('YYYY-MM-DD'),
    }
    if (editingAsset) {
      updateMutation.mutate({ id: editingAsset.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleTransfer = (values: any) => {
    if (!selectedAsset) return
    transferMutation.mutate({
      id: selectedAsset.id,
      data: {
        ...values,
        recordDate: values.recordDate?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
      }
    })
  }

  const handleMaintenance = (values: any) => {
    if (!selectedAsset) return
    maintenanceMutation.mutate({
      id: selectedAsset.id,
      data: {
        ...values,
        startDate: values.maintenanceRange?.[0]?.format('YYYY-MM-DD'),
        endDate: values.maintenanceRange?.[1]?.format('YYYY-MM-DD'),
      }
    })
  }

  const isFixed = assetType === 'fixed'

  const columns = isFixed ? [
    { title: '资产编号', dataIndex: 'asset_no', key: 'assetNo', width: 150 },
    { title: '资产名称', dataIndex: 'name', key: 'name', width: 180, render: (t: string, r: any) => (
      <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(r)}>{t}</Button>
    )},
    { title: '分类', dataIndex: 'category', key: 'category', width: 100, render: (c: string) => <Tag>{CATEGORY_MAP[c] || c}</Tag> },
    { title: '型号', dataIndex: 'model', key: 'model', width: 120, render: (t: string) => t || '-' },
    { title: '序列号', dataIndex: 'serial_number', key: 'serialNumber', width: 130 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (s: string) => {
      const info = STATUS_MAP[s] || { color: 'default', text: s }
      return <Tag color={info.color}>{info.text}</Tag>
    }},
    { title: '责任人', dataIndex: 'keeper_name', key: 'keeper', width: 90, render: (t: string) => t || '-' },
    { title: '部门', dataIndex: 'department_name', key: 'dept', width: 100, render: (t: string) => t || '-' },
    { title: '存放地点', dataIndex: 'location', key: 'location', width: 120, render: (t: string) => t || '-' },
    { title: '购置日期', dataIndex: 'purchase_date', key: 'purchaseDate', width: 110, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD') : '-' },
    { title: '原值', dataIndex: 'purchase_price', key: 'purchasePrice', width: 100, render: (p: number) => p != null ? `¥${p.toLocaleString()}` : '-' },
    {
      title: '操作', key: 'action', width: 220, fixed: 'right',
      render: (_: any, r: any) => (
        <Space>
          <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => openDetail(r)}>溯源</Button>
          {isAdmin && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => {
                setEditingAsset(r)
                form.setFieldsValue({
                  ...r,
                  purchaseDate: r.purchase_date ? dayjs(r.purchase_date) : null,
                  warrantyExpiry: r.warranty_expiry ? dayjs(r.warranty_expiry) : null,
                  maintenanceDate: r.maintenance_date ? dayjs(r.maintenance_date) : null,
                  nextMaintenanceDate: r.next_maintenance_date ? dayjs(r.next_maintenance_date) : null,
                })
                setModalVisible(true)
              }}>编辑</Button>
              <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => { setSelectedAsset(r); setTransferVisible(true) }}>流转</Button>
              <Button type="link" size="small" icon={<ToolOutlined />} onClick={() => { setSelectedAsset(r); setMaintenanceVisible(true) }}>维保</Button>
              <Popconfirm title="确定删除？" onConfirm={() => deleteMutation.mutate(r.id)}>
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ] : [
    { title: '资产编号', dataIndex: 'asset_no', key: 'assetNo', width: 150 },
    { title: '资产名称', dataIndex: 'name', key: 'name', width: 200, render: (t: string, r: any) => (
      <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(r)}>{t}</Button>
    )},
    { title: '分类', dataIndex: 'category', key: 'category', width: 110, render: (c: string) => <Tag>{CATEGORY_MAP[c] || c}</Tag> },
    { title: '证书编号', dataIndex: 'license_no', key: 'licenseNo', width: 150, render: (t: string) => t || '-' },
    { title: '发证机构', dataIndex: 'issuing_authority', key: 'issuingAuthority', width: 130, render: (t: string) => t || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 90, render: (s: string) => {
      const info = INTANGIBLE_STATUS_MAP[s] || { color: 'default', text: s }
      return <Tag color={info.color}>{info.text}</Tag>
    }},
    { title: '责任人', dataIndex: 'keeper_name', key: 'keeper', width: 90, render: (t: string) => t || '-' },
    { title: '生效日', dataIndex: 'valid_from', key: 'validFrom', width: 110, render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD') : '-' },
    { title: '到期日', dataIndex: 'valid_until', key: 'validUntil', width: 110, render: (d: string) => {
      if (!d) return '-'
      const days = dayjs(d).diff(dayjs(), 'days')
      if (days < 0) return <Tag color="error">已过期 {Math.abs(days)}天</Tag>
      if (days <= 30) return <Tag color="warning">{days}天后到期</Tag>
      return dayjs(d).format('YYYY-MM-DD')
    }},
    {
      title: '操作', key: 'action', width: 200, fixed: 'right',
      render: (_: any, r: any) => (
        <Space>
          <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => openDetail(r)}>溯源</Button>
          {isAdmin && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => {
                setEditingAsset(r)
                form.setFieldsValue({
                  ...r,
                  validFrom: r.valid_from ? dayjs(r.valid_from) : null,
                  validUntil: r.valid_until ? dayjs(r.valid_until) : null,
                  renewalReminderDate: r.renewal_reminder_date ? dayjs(r.renewal_reminder_date) : null,
                })
                setModalVisible(true)
              }}>编辑</Button>
              <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => { setSelectedAsset(r); setTransferVisible(true) }}>调拨</Button>
              <Popconfirm title="确定删除？" onConfirm={() => deleteMutation.mutate(r.id)}>
                <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ]

  const statsData = stats?.data || {}
  const statsCards = isFixed ? [
    { title: '固定资产总数', value: statsData.fixed || 0, color: '#1890ff' },
    { title: '在用', value: statsData.inUse || 0, color: '#52c41a' },
    { title: '维修中', value: statsData.maintenance || 0, color: '#faad14' },
    { title: '即将到期/预警', value: statsData.nearExpiry || 0, color: '#ff4d4f' },
  ] : [
    { title: '无形资产总数', value: statsData.intangible || 0, color: '#722ed1' },
    { title: '有效', value: (statsData.intangible || 0) - (statsData.nearExpiry || 0), color: '#52c41a' },
    { title: '即将到期', value: statsData.nearExpiry || 0, color: '#faad14' },
    { title: '资产总计', value: (statsData.fixed || 0) + (statsData.intangible || 0), color: '#1890ff' },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
        <h2 style={{ margin: 0 }}>资产管理</h2>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <Tabs activeKey={activeTab} onChange={handleTabChange}
          tabBarExtraContent={isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingAsset(null); form.resetFields(); setModalVisible(true) }}>录入资产</Button>}
          items={[
            { key: 'fixed', label: '固定资产台账',
              children: <>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  {statsCards.map((s, i) => (
                    <Col span={6} key={i}>
                      <Card size="small"><Statistic title={s.title} value={s.value} valueStyle={{ color: s.color }} /></Card>
                    </Col>
                  ))}
                </Row>
                <Card size="small" title={
                  <Space>
                    <Input.Search placeholder="搜索资产名称/编号/序列号" allowClear
                      onSearch={setSearchKeyword} style={{ width: 300 }} />
                  </Space>
                }>
                  <Table columns={columns} dataSource={assetsRes?.data} loading={isLoading} rowKey="id"
                    scroll={{ x: 1400, y: 'calc(100vh - 380px)' }}
                    pagination={{
                      current: pagination.current, pageSize: pagination.pageSize, total: pagination.total,
                      pageSizeOptions: ['10', '20', '50'],
                      onChange: (page, pageSize) => setPagination({ current: page, pageSize, total: pagination.total }),
                      showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
                    }}
                  />
                </Card>
              </>
            },
            { key: 'intangible', label: '无形资产台账',
              children: <>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  {statsCards.map((s, i) => (
                    <Col span={6} key={i}>
                      <Card size="small"><Statistic title={s.title} value={s.value} valueStyle={{ color: s.color }} /></Card>
                    </Col>
                  ))}
                </Row>
                <Card size="small" title={
                  <Space>
                    <Input.Search placeholder="搜索资产名称/编号/证书号" allowClear
                      onSearch={setSearchKeyword} style={{ width: 300 }} />
                  </Space>
                }>
                  <Table columns={columns} dataSource={assetsRes?.data} loading={isLoading} rowKey="id"
                    scroll={{ x: 1400, y: 'calc(100vh - 380px)' }}
                    pagination={{
                      current: pagination.current, pageSize: pagination.pageSize, total: pagination.total,
                      pageSizeOptions: ['10', '20', '50'],
                      onChange: (page, pageSize) => setPagination({ current: page, pageSize, total: pagination.total }),
                      showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
                    }}
                  />
                </Card>
              </>
            },
          ]}
        />

        {/* 录入/编辑资产 */}
        <Modal title={editingAsset ? '编辑资产' : '录入资产'} open={modalVisible} width={800}
          onCancel={() => { setModalVisible(false); setEditingAsset(null); form.resetFields() }}
          onOk={() => form.submit()} confirmLoading={createMutation.isPending || updateMutation.isPending}>
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Descriptions title={isFixed ? '基础信息' : '基本信息'} size="small" column={1} />
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="name" label="资产名称" rules={[{ required: true }]}><Input /></Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="category" label="资产分类" rules={[{ required: true }]}>
                  <Select placeholder="选择分类">
                    {(isFixed ? FIXED_CATEGORIES : INTANGIBLE_CATEGORIES).map(c => (
                      <Option key={c.value} value={c.value}>{c.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="status" label="状态" rules={[{ required: true }]}>
                  <Select>
                    {isFixed ? (
                      <>
                        <Option value="idle">闲置</Option>
                        <Option value="in_use">在用</Option>
                        <Option value="maintenance">维修中</Option>
                        <Option value="scrapped">已报废</Option>
                        <Option value="lost">挂失</Option>
                        <Option value="checking">盘点中</Option>
                      </>
                    ) : (
                      <>
                        <Option value="valid">有效</Option>
                        <Option value="expiring">即将过期</Option>
                        <Option value="expired">已过期</Option>
                        <Option value="cancelled">已注销</Option>
                      </>
                    )}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            {isFixed && (
              <>
                <Row gutter={16}>
                  <Col span={8}><Form.Item name="model" label="规格型号"><Input /></Form.Item></Col>
                  <Col span={8}><Form.Item name="serialNumber" label="序列号/SN码"><Input /></Form.Item></Col>
                  <Col span={8}><Form.Item name="manufacturer" label="生产厂家"><Input /></Form.Item></Col>
                </Row>
                <Descriptions title="归属信息" size="small" column={1} />
                <Row gutter={16}>
                  <Col span={8}><Form.Item name="departmentName" label="所属部门"><Input /></Form.Item></Col>
                  <Col span={8}><Form.Item name="location" label="存放地点"><Input /></Form.Item></Col>
                  <Col span={8}><Form.Item name="keeperId" label="使用责任人">
                    <Select allowClear showSearch placeholder="选择人员" filterOption={(input, option) => (option?.children as any)?.includes(input)}>
                      {/* Users loaded from context - simplified */}
                    </Select>
                  </Form.Item></Col>
                </Row>
                <Descriptions title="财务信息" size="small" column={1} />
                <Row gutter={16}>
                  <Col span={8}><Form.Item name="purchasePrice" label="资产原值"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                  <Col span={8}><Form.Item name="purchaseDate" label="采购时间"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                  <Col span={8}><Form.Item name="warrantyExpiry" label="保修到期"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
              </>
            )}
            {!isFixed && (
              <>
                <Row gutter={16}>
                  <Col span={8}><Form.Item name="licenseNo" label="证书编号/授权编号"><Input /></Form.Item></Col>
                  <Col span={8}><Form.Item name="issuingAuthority" label="发证机构"><Input /></Form.Item></Col>
                  <Col span={8}><Form.Item name="departmentName" label="所属部门"><Input /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}><Form.Item name="validFrom" label="生效时间"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                  <Col span={8}><Form.Item name="validUntil" label="到期时间"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                  <Col span={8}><Form.Item name="renewalReminderDate" label="提醒日期"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
              </>
            )}
            <Form.Item name="description" label="备注"><TextArea rows={2} /></Form.Item>
          </Form>
        </Modal>

        {/* 资产详情/溯源 */}
        <Modal title="资产详情" open={detailVisible} width={700}
          onCancel={() => { setDetailVisible(false); setSelectedAsset(null) }} footer={null}>
          {selectedAsset && (
            <div>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="资产编号">{selectedAsset.asset_no}</Descriptions.Item>
                <Descriptions.Item label="资产名称">{selectedAsset.name}</Descriptions.Item>
                <Descriptions.Item label="分类">{CATEGORY_MAP[selectedAsset.category] || selectedAsset.category}</Descriptions.Item>
                <Descriptions.Item label="类型">{ASSET_TYPES.find(t => t.value === selectedAsset.asset_type)?.label}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={STATUS_MAP[selectedAsset.status]?.color || INTANGIBLE_STATUS_MAP[selectedAsset.status]?.color}>
                    {STATUS_MAP[selectedAsset.status]?.text || INTANGIBLE_STATUS_MAP[selectedAsset.status]?.text || selectedAsset.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="责任人">{selectedAsset.keeper_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="所属部门">{selectedAsset.department_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="存放地点">{selectedAsset.location || '-'}</Descriptions.Item>
                {isFixed && (
                  <>
                    <Descriptions.Item label="型号">{selectedAsset.model || '-'}</Descriptions.Item>
                    <Descriptions.Item label="序列号">{selectedAsset.serial_number || '-'}</Descriptions.Item>
                    <Descriptions.Item label="购置日期">{selectedAsset.purchase_date ? dayjs(selectedAsset.purchase_date).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
                    <Descriptions.Item label="资产原值">{selectedAsset.purchase_price != null ? `¥${selectedAsset.purchase_price.toLocaleString()}` : '-'}</Descriptions.Item>
                  </>
                )}
                {!isFixed && (
                  <>
                    <Descriptions.Item label="证书编号">{selectedAsset.license_no || '-'}</Descriptions.Item>
                    <Descriptions.Item label="发证机构">{selectedAsset.issuing_authority || '-'}</Descriptions.Item>
                    <Descriptions.Item label="生效日">{selectedAsset.valid_from ? dayjs(selectedAsset.valid_from).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
                    <Descriptions.Item label="到期日">{selectedAsset.valid_until ? dayjs(selectedAsset.valid_until).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
                  </>
                )}
                <Descriptions.Item label="备注" span={2}>{selectedAsset.description || '-'}</Descriptions.Item>
              </Descriptions>

              <h4 style={{ marginTop: 24, marginBottom: 12 }}>全生命周期记录</h4>
              {selectedAsset.records?.length > 0 ? (
                <Timeline items={selectedAsset.records.map((r: any) => ({
                  color: r.record_type === 'purchase' ? 'green' : r.record_type === 'scrap' ? 'red' : r.record_type === 'maintenance' ? 'orange' : 'blue',
                  children: (
                    <div>
                      <div style={{ fontWeight: 500 }}>{r.record_type === 'purchase' ? '录入' : r.record_type === 'transfer' ? '调拨' : r.record_type === 'allocate' ? '领用' : r.record_type === 'return' ? '归还' : r.record_type === 'maintenance' ? '维保' : r.record_type === 'repair' ? '维修' : r.record_type === 'scrap' ? '报废' : r.record_type === 'check' ? '盘点' : r.record_type} · {dayjs(r.record_date).format('YYYY-MM-DD')}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {r.from_user_name && r.to_user_name ? `${r.from_user_name} → ${r.to_user_name}` : ''}
                        {r.from_location && r.to_location && r.from_location !== r.to_location ? ` (${r.from_location} → ${r.to_location})` : ''}
                        {r.to_user_name && !r.from_user_name ? `责任人: ${r.to_user_name}` : ''}
                        {r.to_location && !r.from_location ? `位置: ${r.to_location}` : ''}
                      </div>
                      {r.reason && <div style={{ fontSize: 12, color: '#999' }}>{r.reason}</div>}
                      <div style={{ fontSize: 11, color: '#bbb' }}>操作人: {r.operator_name || '-'}</div>
                    </div>
                  )
                }))} />
              ) : <div style={{ color: '#999', padding: 16 }}>暂无操作记录</div>}
            </div>
          )}
        </Modal>

        {/* 流转/调拨 */}
        <Modal title={isFixed ? '资产流转' : '资产调拨'} open={transferVisible} width={500}
          onCancel={() => { setTransferVisible(false); transferForm.resetFields() }}
          onOk={() => transferForm.submit()} confirmLoading={transferMutation.isPending}>
          <Form form={transferForm} layout="vertical" onFinish={handleTransfer}>
            <Form.Item name="recordType" label="操作类型" rules={[{ required: true }]}>
              <Select>
                <Option value="allocate">领用分配</Option>
                <Option value="transfer">调拨</Option>
                {isFixed && <Option value="return">归还</Option>}
                <Option value="scrap">报废</Option>
              </Select>
            </Form.Item>
            <Form.Item name="toLocation" label="新位置"><Input /></Form.Item>
            <Form.Item name="reason" label="原因说明" rules={[{ required: true }]}><TextArea rows={2} /></Form.Item>
            <Form.Item name="recordDate" label="操作日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
          </Form>
        </Modal>

        {/* 维保记录（固定资产专属） */}
        {isFixed && (
          <Modal title="维保记录" open={maintenanceVisible} width={500}
            onCancel={() => { setMaintenanceVisible(false); maintenanceForm.resetFields() }}
            onOk={() => maintenanceForm.submit()} confirmLoading={maintenanceMutation.isPending}>
            <Form form={maintenanceForm} layout="vertical" onFinish={handleMaintenance}>
              <Form.Item name="maintenanceType" label="维保类型" rules={[{ required: true }]}>
                <Select>
                  <Option value="repair">维修</Option>
                  <Option value="maintenance">保养</Option>
                  <Option value="inspection">年检</Option>
                </Select>
              </Form.Item>
              <Form.Item name="maintenanceRange" label="维保时间" rules={[{ required: true }]}>
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="vendor" label="维保单位"><Input /></Form.Item>
              <Form.Item name="cost" label="维保费用"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
              <Form.Item name="reason" label="维保原因" rules={[{ required: true }]}><TextArea rows={2} /></Form.Item>
            </Form>
          </Modal>
        )}
      </div>
    </div>
  )
}
