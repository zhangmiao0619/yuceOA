import { useState, useEffect, useRef } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber,
  message, Space, Popconfirm, Tabs, Tag, Statistic, Row, Col, Switch, Descriptions
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  ImportOutlined, ExportOutlined, EyeOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../lib/api'
import * as XLSX from 'xlsx'

const { Option } = Select

interface Supplier {
  id: string
  short_name: string
  full_name: string
}

interface OutsourcingRecord {
  id: string
  project_name: string
  contract_name: string
  is_repeated: number
  sign_date: string
  supplier_id: string
  supplier_name: string
  supplier_short_name?: string
  task_description: string
  unit_price: number
  workload: number
  contract_amount: number
  confirmed_workload: number
  confirmed_amount: number
  invoice_type: string
  tax_rate: number
  total_invoiced_amount: number
  total_paid_amount: number
  payment_ratio: number
  unpaid_invoice_amount: number
  accounts_payable: number
  remarks: string
  payment_terms: string
  contract_no: string
  created_at: string
}

export default function Outsourcing() {
  const [records, setRecords] = useState<OutsourcingRecord[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<OutsourcingRecord | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<OutsourcingRecord | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalContractAmount: 0,
    totalConfirmedAmount: 0,
    totalPaidAmount: 0,
    totalPayable: 0
  })
  const [form] = Form.useForm()
  const importInputRef = useRef<HTMLInputElement>(null)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })

  const fetchRecords = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res: any = await api.get('/outsourcing', { params: { page, pageSize, keyword: searchKeyword } })
      if (res.success) {
        setRecords(res.data)
        setPagination({ current: page, pageSize, total: res.total || res.data.length })
      }
    } catch (error) {
      message.error('获取委外信息列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleTableChange = (paginationConfig: any) => {
    fetchRecords(paginationConfig.current, paginationConfig.pageSize)
  }

  const fetchSuppliers = async () => {
    try {
      const res: any = await api.get('/suppliers')
      if (res.success) {
        setSuppliers(res.data)
      }
    } catch (error) {
      message.error('获取供应商列表失败')
    }
  }

  const fetchStats = async () => {
    try {
      const res: any = await api.get('/outsourcing/stats/overview')
      if (res.success) {
        setStats(res.data)
      }
    } catch (error) {
      console.error('获取统计失败', error)
    }
  }

  useEffect(() => {
    fetchRecords(pagination.current, pagination.pageSize)
    fetchSuppliers()
    fetchStats()
  }, [])

  const handleCreate = () => {
    setEditingRecord(null)
    form.resetFields()
    form.setFieldsValue({ isRepeated: false })
    setIsModalOpen(true)
  }

  const handleEdit = (record: OutsourcingRecord) => {
    setEditingRecord(record)
    form.setFieldsValue({
      projectName: record.project_name,
      contractName: record.contract_name,
      isRepeated: record.is_repeated === 1,
      signDate: record.sign_date ? dayjs(record.sign_date) : null,
      supplierId: record.supplier_id,
      taskDescription: record.task_description,
      unitPrice: record.unit_price,
      workload: record.workload,
      contractAmount: record.contract_amount,
      confirmedWorkload: record.confirmed_workload,
      confirmedAmount: record.confirmed_amount,
      invoiceType: record.invoice_type,
      taxRate: record.tax_rate,
      totalInvoicedAmount: record.total_invoiced_amount,
      totalPaidAmount: record.total_paid_amount,
      paymentRatio: record.payment_ratio,
      unpaidInvoiceAmount: record.unpaid_invoice_amount,
      accountsPayable: record.accounts_payable,
      remarks: record.remarks,
      paymentTerms: record.payment_terms,
      contractNo: record.contract_no
    })
    setIsModalOpen(true)
  }

  const handleSave = async (values: any) => {
    try {
      const payload = {
        ...values,
        signDate: values.signDate?.format('YYYY-MM-DD'),
        isRepeated: values.isRepeated ? 1 : 0
      }

      if (editingRecord) {
        const res: any = await api.put(`/outsourcing/${editingRecord.id}`, payload)
        if (res.success) {
          message.success('更新成功')
          setIsModalOpen(false)
          fetchRecords()
          fetchStats()
        }
      } else {
        const res: any = await api.post('/outsourcing', payload)
        if (res.success) {
          message.success('创建成功')
          setIsModalOpen(false)
          fetchRecords()
          fetchStats()
        }
      }
    } catch (error: any) {
      message.error(error?.message || '操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res: any = await api.delete(`/outsourcing/${id}`)
      if (res.success) {
        message.success('删除成功')
        fetchRecords()
        fetchStats()
      }
    } catch (error: any) {
      message.error(error?.message || '删除失败')
    }
  }

  const handleExport = () => {
    const data = records.map(r => ({
      '项目名称': r.project_name,
      '外包合同名称': r.contract_name,
      '重复': r.is_repeated ? '是' : '否',
      '签订日期': r.sign_date,
      '供应商名称': r.supplier_name,
      '任务描述': r.task_description,
      '单价': r.unit_price,
      '工作量': r.workload,
      '合同金额': r.contract_amount,
      '确认工作量': r.confirmed_workload,
      '确认金额': r.confirmed_amount,
      '发票票种': r.invoice_type,
      '税率': r.tax_rate,
      '总收票金额': r.total_invoiced_amount,
      '总付款金额': r.total_paid_amount,
      '付款比例': r.payment_ratio,
      '未收票金额': r.unpaid_invoice_amount,
      '应付账款': r.accounts_payable,
      '备注': r.remarks,
      '付款条件': r.payment_terms,
      '合同编号': r.contract_no
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '委外信息')
    XLSX.writeFile(wb, `委外信息_${dayjs().format('YYYY-MM-DD')}.xlsx`)
  }

  const openDetail = (record: OutsourcingRecord) => {
    setSelectedRecord(record)
    setIsDetailOpen(true)
  }

  const columns: any[] = [
    { title: '项目名称', dataIndex: 'project_name', key: 'project_name', width: 150, fixed: 'left' as const },
    { title: '外包合同名称', dataIndex: 'contract_name', key: 'contract_name', width: 150 },
    {
      title: '重复',
      dataIndex: 'is_repeated',
      key: 'is_repeated',
      width: 80,
      render: (v: number) => v === 1 ? <Tag color="orange">是</Tag> : <Tag>否</Tag>
    },
    { title: '签订日期', dataIndex: 'sign_date', key: 'sign_date', width: 110 },
    { title: '供应商名称', dataIndex: 'supplier_name', key: 'supplier_name', width: 150 },
    { title: '任务描述', dataIndex: 'task_description', key: 'task_description', width: 150, ellipsis: true },
    {
      title: '单价',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 100,
      render: (v: number) => v ? `¥${v.toLocaleString()}` : '-'
    },
    { title: '工作量', dataIndex: 'workload', key: 'workload', width: 80 },
    {
      title: '合同金额',
      dataIndex: 'contract_amount',
      key: 'contract_amount',
      width: 120,
      render: (v: number) => v ? `¥${v.toLocaleString()}` : '-'
    },
    { title: '确认工作量', dataIndex: 'confirmed_workload', key: 'confirmed_workload', width: 100 },
    {
      title: '确认金额',
      dataIndex: 'confirmed_amount',
      key: 'confirmed_amount',
      width: 120,
      render: (v: number) => v ? `¥${v.toLocaleString()}` : '-'
    },
    {
      title: '发票票种',
      dataIndex: 'invoice_type',
      key: 'invoice_type',
      width: 90,
      render: (v: string) => v ? <Tag color={v === '专票' ? 'blue' : 'default'}>{v}</Tag> : '-'
    },
    { title: '税率', dataIndex: 'tax_rate', key: 'tax_rate', width: 70, render: (v: number) => v ? `${v}%` : '-' },
    {
      title: '总收票金额',
      dataIndex: 'total_invoiced_amount',
      key: 'total_invoiced_amount',
      width: 120,
      render: (v: number) => v ? `¥${v.toLocaleString()}` : '-'
    },
    {
      title: '总付款金额',
      dataIndex: 'total_paid_amount',
      key: 'total_paid_amount',
      width: 120,
      render: (v: number) => v ? `¥${v.toLocaleString()}` : '-'
    },
    { title: '付款比例', dataIndex: 'payment_ratio', key: 'payment_ratio', width: 90, render: (v: number) => v ? `${v}%` : '-' },
    {
      title: '未收票金额',
      dataIndex: 'unpaid_invoice_amount',
      key: 'unpaid_invoice_amount',
      width: 120,
      render: (v: number) => v ? `¥${v.toLocaleString()}` : '-'
    },
    {
      title: '应付账款',
      dataIndex: 'accounts_payable',
      key: 'accounts_payable',
      width: 120,
      render: (v: number) => v ? `¥${v.toLocaleString()}` : '-'
    },
    { title: '合同编号', dataIndex: 'contract_no', key: 'contract_no', width: 120 },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: OutsourcingRecord) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>查看</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm
            title="确定删除此记录？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic title="记录总数" value={stats.totalRecords} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="合同总金额" value={stats.totalContractAmount} prefix="¥" precision={2} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="确认总金额" value={stats.totalConfirmedAmount} prefix="¥" precision={2} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="总付款金额" value={stats.totalPaidAmount} prefix="¥" precision={2} />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic title="应付账款" value={stats.totalPayable} prefix="¥" precision={2} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="搜索项目名称、合同名称、合同编号"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={() => fetchRecords(pagination.current, pagination.pageSize)}
            style={{ width: 300 }}
            prefix={<SearchOutlined />}
          />
          <Button onClick={() => fetchRecords(pagination.current, pagination.pageSize)}>搜索</Button>
        </Space>
        <Space>
          <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增委外信息
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          pageSizeOptions: ['10', '20', '50'],
          showSizeChanger: true,
          showTotal: (t: number) => `共 ${t} 条`,
          onChange: handleTableChange,
        }}
      />

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑委外信息' : '新增委外信息'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        width={900}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="projectName" label="项目名称" rules={[{ required: true, message: '项目名称不能为空' }]}>
                <Input placeholder="请输入项目名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contractName" label="外包合同名称">
                <Input placeholder="请输入外包合同名称" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="isRepeated" label="重复" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="signDate" label="签订日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contractNo" label="合同编号">
                <Input placeholder="请输入合同编号" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="supplierId" label="供应商名称" rules={[{ required: true, message: '请选择供应商' }]}>
                <Select
                  placeholder="选择供应商"
                  showSearch
                  optionFilterProp="children"
                  options={suppliers.map(s => ({
                    label: `${s.short_name} - ${s.full_name}`,
                    value: s.id
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="taskDescription" label="任务描述">
                <Input placeholder="请输入任务描述" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="unitPrice" label="单价">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="workload" label="工作量">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contractAmount" label="合同金额">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="confirmedWorkload" label="确认工作量">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="confirmedAmount" label="确认金额">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="invoiceType" label="发票票种">
                <Select placeholder="选择发票类型" allowClear>
                  <Option value="普票">普票</Option>
                  <Option value="专票">专票</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="taxRate" label="税率">
                <InputNumber style={{ width: '100%' }} min={0} max={100} formatter={(value) => `${value}%`} parser={(value: any) => value?.replace('%', '') || 0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="totalInvoicedAmount" label="总收票金额">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="totalPaidAmount" label="总付款金额">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="paymentRatio" label="付款比例">
                <InputNumber style={{ width: '100%' }} min={0} max={100} formatter={(value) => `${value}%`} parser={(value: any) => value?.replace('%', '') || 0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unpaidInvoiceAmount" label="未收票金额">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="accountsPayable" label="应付账款">
                <InputNumber style={{ width: '100%' }} precision={2} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="paymentTerms" label="付款条件">
                <Input placeholder="请输入付款条件" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="remarks" label="备注">
                <Input placeholder="请输入备注" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="委外信息详情"
        open={isDetailOpen}
        onCancel={() => setIsDetailOpen(false)}
        footer={null}
        width={800}
      >
        {selectedRecord && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="项目名称" span={2}>{selectedRecord.project_name}</Descriptions.Item>
            <Descriptions.Item label="外包合同名称">{selectedRecord.contract_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="重复">{selectedRecord.is_repeated === 1 ? <Tag color="orange">是</Tag> : <Tag>否</Tag>}</Descriptions.Item>
            <Descriptions.Item label="签订日期">{selectedRecord.sign_date || '-'}</Descriptions.Item>
            <Descriptions.Item label="合同编号">{selectedRecord.contract_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="供应商名称" span={2}>{selectedRecord.supplier_name}</Descriptions.Item>
            <Descriptions.Item label="任务描述" span={2}>{selectedRecord.task_description || '-'}</Descriptions.Item>
            <Descriptions.Item label="单价">{selectedRecord.unit_price ? `¥${selectedRecord.unit_price.toLocaleString()}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="工作量">{selectedRecord.workload || '-'}</Descriptions.Item>
            <Descriptions.Item label="合同金额">{selectedRecord.contract_amount ? `¥${selectedRecord.contract_amount.toLocaleString()}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="确认工作量">{selectedRecord.confirmed_workload || '-'}</Descriptions.Item>
            <Descriptions.Item label="确认金额">{selectedRecord.confirmed_amount ? `¥${selectedRecord.confirmed_amount.toLocaleString()}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="发票票种">{<Tag color={selectedRecord.invoice_type === '专票' ? 'blue' : 'default'}>{selectedRecord.invoice_type || '-'}</Tag>}</Descriptions.Item>
            <Descriptions.Item label="税率">{selectedRecord.tax_rate ? `${selectedRecord.tax_rate}%` : '-'}</Descriptions.Item>
            <Descriptions.Item label="总收票金额">{selectedRecord.total_invoiced_amount ? `¥${selectedRecord.total_invoiced_amount.toLocaleString()}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="总付款金额">{selectedRecord.total_paid_amount ? `¥${selectedRecord.total_paid_amount.toLocaleString()}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="付款比例">{selectedRecord.payment_ratio ? `${selectedRecord.payment_ratio}%` : '-'}</Descriptions.Item>
            <Descriptions.Item label="未收票金额">{selectedRecord.unpaid_invoice_amount ? `¥${selectedRecord.unpaid_invoice_amount.toLocaleString()}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="应付账款">{selectedRecord.accounts_payable ? `¥${selectedRecord.accounts_payable.toLocaleString()}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="付款条件" span={2}>{selectedRecord.payment_terms || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{selectedRecord.remarks || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
