// @ts-nocheck
import { useState, useEffect } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, DatePicker, Select,
  Space, Tag, message, Row, Col, Statistic, Tabs, Popconfirm,
  Drawer, Descriptions, Divider, InputNumber, Alert
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, EyeOutlined,
  FileTextOutlined, DollarOutlined, BarChartOutlined,
  SearchOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, InfoCircleOutlined
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuthStore } from '../stores/auth'
import dayjs from 'dayjs'

const { TextArea } = Input
const { Option } = Select

export default function Finance() {
  const [activeTab, setActiveTab] = useState('reimbursements')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [categoryTableOpen, setCategoryTableOpen] = useState(false)
  const [currentItemIndex, setCurrentItemIndex] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [searchText, setSearchText] = useState('')
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const isAdmin = useAuthStore((state) => state.user?.isAdmin)
  const currentUser = useAuthStore((state) => state.user)

  // 费用类别数据
  const [expenseCategories, setExpenseCategories] = useState([])

  // 获取费用类别
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/finance/expense-categories')
        if (res.success) {
          setExpenseCategories(res.data)
        }
      } catch (error) {
        console.error('获取费用类别失败', error)
      }
    }
    fetchCategories()
  }, [])

  // 分页状态
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  // 获取报销列表
  const { data: reimbursementsRes, isLoading, refetch } = useQuery({
    queryKey: ['reimbursements', pagination.current, pagination.pageSize],
    queryFn: () => api.get('/finance/reimbursements', { params: { page: pagination.current, pageSize: pagination.pageSize } }),
  })

  // 更新总数
  useEffect(() => {
    if (reimbursementsRes?.total) {
      setPagination(prev => ({ ...prev, total: reimbursementsRes.total }))
    }
  }, [reimbursementsRes?.total])

  // 获取统计
  const { data: statistics } = useQuery({
    queryKey: ['finance-statistics'],
    queryFn: () => api.get('/finance/statistics')
  })

  // 创建报销
  const createMutation = useMutation({
    mutationFn: (data) => api.post('/finance/reimbursements', data),
    onSuccess: () => {
      message.success('报销申请提交成功')
      setIsModalOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] })
      queryClient.invalidateQueries({ queryKey: ['finance-statistics'] })
    },
    onError: (error) => {
      message.error(error?.message || '提交失败')
    }
  })

  // 删除报销
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/finance/reimbursements/${id}`),
    onSuccess: () => {
      message.success('删除成功')
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] })
      queryClient.invalidateQueries({ queryKey: ['finance-statistics'] })
    }
  })

  // 更新状态
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, remark }) =>
      api.put(`/finance/reimbursements/${id}/status`, { status, remark }),
    onSuccess: () => {
      message.success('状态更新成功')
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] })
      queryClient.invalidateQueries({ queryKey: ['finance-statistics'] })
    }
  })

  const handleSubmit = (values) => {
    const items = values.items || []
    if (items.length === 0) {
      message.error('至少需要一个报销明细')
      return
    }

    const data = {
      reimbursementDate: values.reimbursementDate?.format('YYYY-MM-DD'),
      reimbursementMonth: values.reimbursementMonth?.format('YYYY-MM'),
      projectName: values.projectName,
      items: items.map(item => ({
        expenseCategory: item.expenseCategory,
        expenseDetail: item.expenseDetail,
        description: item.description,
        amount: parseFloat(item.amount) || 0,
        invoiceCode: item.invoiceCode,
        remarks: item.remarks
      })),
      remarks: values.remarks
    }

    createMutation.mutate(data)
  }

  const handleView = (record) => {
    setSelectedRecord(record)
    setViewDrawerOpen(true)
  }

  const handleDelete = (id) => {
    deleteMutation.mutate(id)
  }

  const handleApprove = (id) => {
    updateStatusMutation.mutate({ id, status: 'approved', remark: '审批通过' })
  }

  const handleReject = (id) => {
    updateStatusMutation.mutate({ id, status: 'rejected', remark: '审批驳回' })
  }

  const openDetailModal = (index, category) => {
    setCurrentItemIndex(index)
    setSelectedCategory(category || '')
    setSearchText('')
    setDetailModalOpen(true)
  }

  const selectDetail = (detail) => {
    const items = form.getFieldValue('items') || []
    items[currentItemIndex] = {
      ...items[currentItemIndex],
      expenseDetail: detail.name,
      expenseCategory: selectedCategory
    }
    form.setFieldsValue({ items })
    setDetailModalOpen(false)
  }

  const statusColors = {
    pending: 'processing',
    approved: 'success',
    rejected: 'error'
  }

  const statusLabels = {
    pending: '待审批',
    approved: '已通过',
    rejected: '已驳回'
  }

  const columns = [
    {
      title: '报销日期',
      dataIndex: 'reimbursement_date',
      key: 'reimbursement_date',
      width: 120
    },
    {
      title: '报销年月',
      dataIndex: 'reimbursement_month',
      key: 'reimbursement_month',
      width: 100
    },
    {
      title: '项目名称',
      dataIndex: 'project_name',
      key: 'project_name',
      ellipsis: true
    },
    {
      title: '费用类别',
      dataIndex: 'items',
      key: 'categories',
      render: (items) => {
        if (!items || items.length === 0) return '-'
        const categories = [...new Set(items.map(item => item.expense_category))]
        return (
          <Space wrap>
            {categories.map(cat => (
              <Tag key={cat}>{cat}</Tag>
            ))}
          </Space>
        )
      }
    },
    {
      title: '报销笔数',
      dataIndex: 'invoice_count',
      key: 'invoice_count',
      width: 90
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      render: (amount) => `¥${(amount || 0).toFixed(2)}`
    },
    {
      title: '报销人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
      width: 100
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          {isAdmin && record.status === 'pending' && (
            <>
              <Button
                type="link"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                通过
              </Button>
              <Button
                type="link"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleReject(record.id)}
              >
                驳回
              </Button>
            </>
          )}
          {record.status === 'pending' && (
            <Popconfirm
              title="确定删除？"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  const expandedRowRender = (record) => {
    if (!record.items || record.items.length === 0) return null

    const itemColumns = [
      { title: '序号', key: 'index', render: (_, __, index) => index + 1, width: 60 },
      { title: '费用类别', dataIndex: 'expense_category', key: 'expense_category', width: 120 },
      { title: '费用明细', dataIndex: 'expense_detail', key: 'expense_detail', width: 120 },
      { title: '摘要', dataIndex: 'description', key: 'description', ellipsis: true },
      { title: '金额', dataIndex: 'amount', key: 'amount', width: 120, render: (amount) => `¥${(amount || 0).toFixed(2)}` },
      { title: '发票编码', dataIndex: 'invoice_code', key: 'invoice_code', width: 150 },
      { title: '备注', dataIndex: 'remarks', key: 'remarks', ellipsis: true }
    ]

    return (
      <Table
        columns={itemColumns}
        dataSource={record.items}
        pagination={false}
        rowKey="id"
        size="small"
        bordered
      />
    )
  }

  // 费用明细弹窗列
  const detailModalColumns = [
    {
      title: '费用类别',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      filters: expenseCategories.map(cat => ({
        text: cat.category,
        value: cat.category
      })),
      onFilter: (value, record) => record.category === value
    },
    {
      title: '费用明细',
      dataIndex: 'name',
      key: 'name',
      width: 120
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button type="primary" size="small" onClick={() => selectDetail(record)}>
          选择
        </Button>
      )
    }
  ]

  // 准备弹窗数据
  const detailModalData = expenseCategories.flatMap(cat =>
    cat.details.map(detail => ({
      ...detail,
      category: cat.category,
      key: `${cat.category}-${detail.name}`
    }))
  ).filter(item =>
    !searchText ||
    item.name.includes(searchText) ||
    item.category.includes(searchText) ||
    item.description?.includes(searchText)
  )

  const StatsCards = () => (
    <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col span={6}>
        <Card>
          <Statistic
            title="本月报销总额"
            value={statistics?.data?.statusStats?.reduce((sum, s) => sum + (s.total || 0), 0) || 0}
            prefix="¥"
            precision={2}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="待审批"
            value={statistics?.data?.statusStats?.find(s => s.status === 'pending')?.count || 0}
            valueStyle={{ color: '#faad14' }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="已通过"
            value={statistics?.data?.statusStats?.find(s => s.status === 'approved')?.count || 0}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="已驳回"
            value={statistics?.data?.statusStats?.find(s => s.status === 'rejected')?.count || 0}
            valueStyle={{ color: '#f5222d' }}
          />
        </Card>
      </Col>
    </Row>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>财务管理</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields()
            setIsModalOpen(true)
          }}
        >
          新增报销
        </Button>
      </div>

      <StatsCards />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'reimbursements',
            label: '报销管理',
            children: (
              <Table
                columns={columns}
                dataSource={reimbursementsRes?.data}
                loading={isLoading}
                rowKey="id"
                expandable={{ expandedRowRender }}
                scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  pageSizeOptions: ['10', '20', '50'],
                  onChange: (page, pageSize) => {
                    setPagination({ current: page, pageSize, total: pagination.total })
                  },
                  showSizeChanger: true,
                  showTotal: (t: number) => `共 ${t} 条`,
                }}
              />
            )
          },
          {
            key: 'category-guide',
            label: '费用类别说明',
            children: (
              <Card>
                <Alert
                  message="费用类别说明"
                  description="请点击下方按钮查看完整的费用类别和明细说明"
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Button
                  type="primary"
                  icon={<InfoCircleOutlined />}
                  onClick={() => setCategoryTableOpen(true)}
                >
                  查看费用类别说明表
                </Button>
              </Card>
            )
          }
        ]}
      />

      {/* 新增报销弹窗 */}
      <Modal
        title="新增报销申请"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        width={900}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="reimbursementDate"
                label="报销日期"
                rules={[
                  { required: true, message: '请选择报销日期' },
                  {
                    validator(_, value) {
                      if (!value || value.isBefore(dayjs().add(1, 'day'), 'day')) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error('报销日期不能为未来日期'))
                    }
                  }
                ]}
              >
                <DatePicker style={{ width: '100%' }} disabledDate={(current) => current && current > dayjs().endOf('day')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="reimbursementMonth"
                label="报销年月"
                rules={[{ required: true, message: '请选择报销年月' }]}
              >
                <DatePicker picker="month" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="projectName" label="项目名称">
                <Input placeholder="请输入项目名称" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">报销明细</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card
                    key={key}
                    size="small"
                    title={`报销明细 #${name + 1}`}
                    extra={
                      <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                      >
                        删除
                      </Button>
                    }
                    style={{ marginBottom: 16 }}
                  >
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'expenseCategory']}
                          label="费用类别"
                          rules={[{ required: true, message: '请选择费用类别' }]}
                        >
                          <Select
                            placeholder="选择费用类别"
                            onChange={(value) => {
                              setSelectedCategory(value)
                              const items = form.getFieldValue('items')
                              if (items[name]) {
                                items[name].expenseDetail = undefined
                                form.setFieldsValue({ items })
                              }
                            }}
                          >
                            {expenseCategories.map(cat => (
                              <Option key={cat.category} value={cat.category}>
                                {cat.category}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'expenseDetail']}
                          label="费用明细"
                          rules={[{ required: true, message: '请选择费用明细' }]}
                        >
                          <Input.Search
                            placeholder="点击选择费用明细"
                            readOnly
                            onSearch={() => {
                              const category = form.getFieldValue(['items', name, 'expenseCategory'])
                              openDetailModal(name, category)
                            }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'description']}
                          label="摘要"
                        >
                          <Input placeholder="请输入摘要" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'amount']}
                          label="金额"
                          rules={[
                            { required: true, message: '请输入金额' },
                            { type: 'number', min: 0, message: '金额不能为负数' }
                          ]}
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            placeholder="请输入金额"
                            min={0}
                            max={1000000}
                            precision={2}
                            prefix="¥"
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'invoiceCode']}
                          label="发票编码"
                        >
                          <Input placeholder="请输入发票编码" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'remarks']}
                          label="备注"
                        >
                          <Input placeholder="请输入备注" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add()}
                  block
                  icon={<PlusOutlined />}
                  style={{ marginBottom: 16 }}
                >
                  添加报销明细
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item name="remarks" label="整体备注">
            <TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                提交申请
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 费用明细选择弹窗 */}
      <Modal
        title="选择费用明细"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        width={800}
        footer={null}
      >
        <Alert
          message="提示"
          description="请先选择费用类别，然后在下方表格中选择具体的费用明细。可以使用搜索框快速查找。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Input.Search
          placeholder="搜索费用明细..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ marginBottom: 16 }}
          allowClear
        />
        <Table
          columns={detailModalColumns}
          dataSource={detailModalData}
          rowKey="key"
          scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
          pagination={{
            current: 1,
            pageSize: 10,
            pageSizeOptions: ['10', '20', '50'],
            showSizeChanger: true,
            showTotal: (t: number) => `共 ${t} 条`,
          }}
          size="small"
          bordered
        />
      </Modal>

      {/* 费用类别说明表格弹窗 */}
      <Modal
        title="费用类别说明表"
        open={categoryTableOpen}
        onCancel={() => setCategoryTableOpen(false)}
        width={900}
        footer={[
          <Button key="close" onClick={() => setCategoryTableOpen(false)}>
            关闭
          </Button>
        ]}
      >
        <Table
          columns={[
            { title: '费用类别', dataIndex: 'category', key: 'category', width: 120 },
            { title: '费用明细', dataIndex: 'name', key: 'name', width: 120 },
            { title: '说明', dataIndex: 'description', key: 'description' },
            { title: '备注', dataIndex: 'remark', key: 'remark' }
          ]}
          dataSource={detailModalData}
          rowKey="key"
          scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
          pagination={{
            current: 1,
            pageSize: 10,
            pageSizeOptions: ['10', '20', '50'],
            showSizeChanger: true,
            showTotal: (t: number) => `共 ${t} 条`,
          }}
          bordered
        />
      </Modal>

      {/* 查看详情抽屉 */}
      <Drawer
        title="报销详情"
        width={700}
        open={viewDrawerOpen}
        onClose={() => setViewDrawerOpen(false)}
      >
        {selectedRecord && (
          <>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="报销日期">{selectedRecord.reimbursement_date}</Descriptions.Item>
              <Descriptions.Item label="报销年月">{selectedRecord.reimbursement_month}</Descriptions.Item>
              <Descriptions.Item label="项目名称">{selectedRecord.project_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="报销人">{selectedRecord.applicant_name}</Descriptions.Item>
              <Descriptions.Item label="报销笔数">{selectedRecord.invoice_count}</Descriptions.Item>
              <Descriptions.Item label="总金额">¥{(selectedRecord.total_amount || 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColors[selectedRecord.status]}>
                  {statusLabels[selectedRecord.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {dayjs(selectedRecord.created_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <h4>报销明细</h4>
            {selectedRecord.items?.map((item, index) => (
              <Card key={item.id} size="small" style={{ marginBottom: 8 }}>
                <p><strong>#{index + 1}</strong> {item.expense_category} - {item.expense_detail}</p>
                <p>摘要: {item.description || '-'}</p>
                <p>金额: ¥{(item.amount || 0).toFixed(2)}</p>
                <p>发票编码: {item.invoice_code || '-'}</p>
                <p>备注: {item.remarks || '-'}</p>
              </Card>
            ))}

            {selectedRecord.remarks && (
              <>
                <Divider />
                <p><strong>整体备注:</strong> {selectedRecord.remarks}</p>
              </>
            )}
          </>
        )}
      </Drawer>
    </div>
  )
}
