import { useState, useEffect, useRef } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber,
  message, Space, Popconfirm, Tabs, Upload, Drawer, Descriptions, Tag, Statistic, Row, Col
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  ImportOutlined, ExportOutlined, FileExcelOutlined, EyeOutlined, UserAddOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../lib/api'
import { hasPermission } from '../stores/auth'
import * as XLSX from 'xlsx'

const { Option } = Select

interface Supplier {
  id: string
  short_name: string
  full_name: string
  contact_person1?: string
  contact_person2?: string
  tax_id?: string
  address?: string
  phone?: string
  bank_name?: string
  bank_account?: string
  bank_code?: string
  advantages?: string
  remarks?: string
}

interface Contract {
  id: string
  project_name: string
  contract_date: string
  contract_no: string
  supplier_id: string
  supplier_short_name: string
  supplier_full_name: string
  unit_price: number
  workload: number
  contract_amount: number
  payment_method: string
  invoice_type: string
  tax_rate: number
  actual_workload: number
  total_invoiced_amount: number
  salesperson: string
  project_type: string
  gross_profit: number
  remarks: string
  created_at: string
}

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [isContractModalOpen, setIsContractModalOpen] = useState(false)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [isSupplierDrawerOpen, setIsSupplierDrawerOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [activeTab, setActiveTab] = useState('contracts')
  const [stats, setStats] = useState({ totalContracts: 0, totalAmount: 0, totalSuppliers: 0 })
  const [contractForm] = Form.useForm()
  const [supplierForm] = Form.useForm()
  const importInputRef = useRef<HTMLInputElement>(null)
  const supplierImportRef = useRef<HTMLInputElement>(null)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [supplierPagination, setSupplierPagination] = useState({ current: 1, pageSize: 10, total: 0 })

  const fetchContracts = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res: any = await api.get('/contracts', { params: { page, pageSize, keyword: searchKeyword } })
      if (res.success) {
        setContracts(res.data)
        setPagination({ current: page, pageSize, total: res.total || res.data.length })
      }
    } catch (error) {
      message.error('获取合同列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleContractTableChange = (paginationConfig: any) => {
    fetchContracts(paginationConfig.current, paginationConfig.pageSize)
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
      const res: any = await api.get('/contracts/stats/overview')
      if (res.success) {
        setStats(res.data)
      }
    } catch (error) {
      console.error('获取统计失败', error)
    }
  }

  useEffect(() => {
    fetchContracts(pagination.current, pagination.pageSize)
    fetchSuppliers()
    fetchStats()
  }, [])

  const handleCreateContract = () => {
    setEditingContract(null)
    contractForm.resetFields()
    setIsContractModalOpen(true)
  }

  const handleEditContract = (contract: Contract) => {
    setEditingContract(contract)
    contractForm.setFieldsValue({
      projectName: contract.project_name,
      contractDate: contract.contract_date ? dayjs(contract.contract_date) : null,
      contractNo: contract.contract_no,
      clientId: contract.supplier_id,
      unitPrice: contract.unit_price,
      workload: contract.workload,
      contractAmount: contract.contract_amount,
      paymentMethod: contract.payment_method,
      invoiceType: contract.invoice_type,
      taxRate: contract.tax_rate,
      actualWorkload: contract.actual_workload,
      totalInvoicedAmount: contract.total_invoiced_amount,
      salesperson: contract.salesperson,
      projectType: contract.project_type,
      grossProfit: contract.gross_profit,
      remarks: contract.remarks
    })
    setIsContractModalOpen(true)
  }

  const handleSaveContract = async (values: any) => {
    try {
      const payload = {
        ...values,
        contractDate: values.contractDate?.format('YYYY-MM-DD')
      }

      if (editingContract) {
        const res: any = await api.put(`/contracts/${editingContract.id}`, payload)
        if (res.success) {
          message.success('更新成功')
          setIsContractModalOpen(false)
          fetchContracts()
          fetchStats()
        }
      } else {
        const res: any = await api.post('/contracts', payload)
        if (res.success) {
          message.success('创建成功')
          setIsContractModalOpen(false)
          fetchContracts()
          fetchStats()
        }
      }
    } catch (error: any) {
      message.error(error?.message || '操作失败')
    }
  }

  const handleDeleteContract = async (id: string) => {
    try {
      const res: any = await api.delete(`/contracts/${id}`)
      if (res.success) {
        message.success('删除成功')
        fetchContracts()
        fetchStats()
      }
    } catch (error: any) {
      message.error(error?.message || '删除失败')
    }
  }

  const handleCreateSupplier = () => {
    supplierForm.resetFields()
    setIsSupplierModalOpen(true)
  }

  const handleSaveSupplier = async (values: any) => {
    try {
      const res: any = await api.post('/clients', values)
      if (res.success) {
        message.success('供应商创建成功')
        setIsSupplierModalOpen(false)
        fetchSuppliers()
      }
    } catch (error: any) {
      message.error(error?.message || '创建客户失败')
    }
  }

  const handleDeleteSupplier = async (id: string) => {
    try {
      const res: any = await api.delete(`/clients/${id}`)
      if (res.success) {
        message.success('删除成功')
        fetchSuppliers()
      }
    } catch (error: any) {
      message.error(error?.message || '删除失败')
    }
  }

  const handleSupplierSelect = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId)
    if (supplier) {
      contractForm.setFieldsValue({
        supplierShortName: supplier.short_name,
        supplierFullName: supplier.full_name
      })
    }
  }

  const handleExport = () => {
    const data = contracts.map(c => ({
      '项目名称': c.project_name,
      '合同签订日期': c.contract_date,
      '合同编号': c.contract_no,
      '供应商简称': c.supplier_short_name,
      '供应商名称': c.supplier_full_name,
      '单价': c.unit_price,
      '工作量': c.workload,
      '合同金额': c.contract_amount,
      '付款方式': c.payment_method,
      '发票票种': c.invoice_type,
      '税率': c.tax_rate,
      '实际确认工作量': c.actual_workload,
      '总开票金额': c.total_invoiced_amount,
      '销售人员': c.salesperson,
      '项目类型': c.project_type,
      '毛利润': c.gross_profit,
      '备注': c.remarks
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '项目合同')
    XLSX.writeFile(wb, `项目合同_${dayjs().format('YYYY-MM-DD')}.xlsx`)
  }

  const handleImportContracts = (file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(sheet)

        // 这里简化处理，实际需要映射字段
        message.success(`成功读取 ${jsonData.length} 条记录，请手动添加`)
      } catch (error) {
        message.error('导入失败，请检查文件格式')
      }
    }
    reader.readAsArrayBuffer(file)
    return false
  }

  const handleImportSuppliers = async (file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData: any[] = XLSX.utils.sheet_to_json(sheet)

        const clients = jsonData.map(row => ({
          shortName: row['供应商简称'] || row['shortName'] || row['short_name'],
          fullName: row['供应商名称'] || row['fullName'] || row['full_name'] || row['客户全称'],
          contactPerson: row['联系人'] || row['contactPerson'] || row['contact_person'],
          contactPhone: row['联系电话'] || row['contactPhone'] || row['contact_phone'],
          contactEmail: row['邮箱'] || row['contactEmail'] || row['contact_email'],
          address: row['地址'] || row['address'],
          taxId: row['税号'] || row['taxId'] || row['tax_id'],
          bankName: row['开户行'] || row['bankName'] || row['bank_name'],
          bankAccount: row['银行账号'] || row['bankAccount'] || row['bank_account'],
          remarks: row['备注'] || row['remarks']
        })).filter(c => c.shortName && c.fullName)

        if (clients.length === 0) {
          message.error('未找到有效的客户数据')
          return
        }

        const res: any = await api.post('/clients/import', { clients })
        if (res.success) {
          message.success(res.message)
          fetchSuppliers()
        }
      } catch (error: any) {
        message.error('导入失败: ' + (error?.message || '未知错误'))
      }
    }
    reader.readAsArrayBuffer(file)
    return false
  }

  const downloadSupplierTemplate = () => {
    const data = [{
      '供应商简称': '示例客户',
      '供应商名称': '示例客户有限公司',
      '联系人': '张三',
      '联系电话': '13800138000',
      '邮箱': 'test@example.com',
      '地址': '北京市朝阳区',
      '税号': '91110000XXXXXXXX',
      '开户行': '中国工商银行',
      '银行账号': '622202XXXXXXXX',
      '备注': ''
    }]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '供应商导入模板')
    XLSX.writeFile(wb, '供应商导入模板.xlsx')
  }

  const openDetail = (contract: Contract) => {
    setSelectedContract(contract)
    setIsDetailOpen(true)
  }

  const contractColumns: any[] = [
    { title: '项目名称', dataIndex: 'project_name', key: 'project_name', width: 200 },
    { title: '合同编号', dataIndex: 'contract_no', key: 'contract_no', width: 150 },
    { title: '供应商简称', dataIndex: 'supplier_short_name', key: 'supplier_short_name', width: 120 },
    { title: '供应商名称', dataIndex: 'supplier_full_name', key: 'supplier_full_name', width: 200 },
    {
      title: '合同金额',
      dataIndex: 'contract_amount',
      key: 'contract_amount',
      width: 120,
      render: (amount: number) => amount ? `¥${amount.toLocaleString()}` : '-'
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 100,
      render: (price: number) => price ? `¥${price.toLocaleString()}` : '-'
    },
    { title: '工作量', dataIndex: 'workload', key: 'workload', width: 100 },
    { title: '付款方式', dataIndex: 'payment_method', key: 'payment_method', width: 120 },
    {
      title: '发票票种',
      dataIndex: 'invoice_type',
      key: 'invoice_type',
      width: 100,
      render: (type: string) => type ? <Tag color={type === '专票' ? 'blue' : 'default'}>{type}</Tag> : '-'
    },
    { title: '税率', dataIndex: 'tax_rate', key: 'tax_rate', width: 80, render: (rate: number) => rate ? `${rate}%` : '-' },
    { title: '销售人员', dataIndex: 'salesperson', key: 'salesperson', width: 100 },
    { title: '项目类型', dataIndex: 'project_type', key: 'project_type', width: 120 },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: Contract) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>查看</Button>
          {hasPermission('canManageSuppliers') && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditContract(record)}>编辑</Button>
          )}
          {hasPermission('canManageSuppliers') && (
            <Popconfirm
              title="确定删除此合同？"
              onConfirm={() => handleDeleteContract(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  const supplierColumns = [
    { title: '供应商简称', dataIndex: 'short_name', key: 'short_name', width: 120 },
    { title: '供应商名称', dataIndex: 'full_name', key: 'full_name', width: 200 },
    { title: '联系人1', dataIndex: 'contact_person1', key: 'contact_person1', width: 100 },
    { title: '联系人2', dataIndex: 'contact_person2', key: 'contact_person2', width: 100 },
    { title: '税号', dataIndex: 'tax_id', key: 'tax_id', width: 150 },
    { title: '地址', dataIndex: 'address', key: 'address', width: 200 },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 120 },
    { title: '开户银行', dataIndex: 'bank_name', key: 'bank_name', width: 150 },
    { title: '银行账号', dataIndex: 'bank_account', key: 'bank_account', width: 180 },
    { title: '银行行号', dataIndex: 'bank_code', key: 'bank_code', width: 120 },
    { title: '供应商优势', dataIndex: 'advantages', key: 'advantages', width: 200 },
    { title: '备注', dataIndex: 'remarks', key: 'remarks', width: 150 },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right' as const,
      render: (_: any, record: Supplier) => (
        <Space>
          <Popconfirm
            title="确定删除此供应商？"
            onConfirm={() => handleDeleteSupplier(record.id)}
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
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            { key: 'contracts', label: '合同列表', children: (
              <>
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={8}>
                    <Card>
                      <Statistic title="合同总数" value={stats.totalContracts} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="合同总金额"
                        value={stats.totalAmount}
                        prefix="¥"
                        precision={2}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic title="客户总数" value={stats.totalSuppliers} />
                    </Card>
                  </Col>
                </Row>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Space>
                    <Input
                      placeholder="搜索项目名称、合同编号、客户"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      onPressEnter={() => fetchContracts(pagination.current, pagination.pageSize)}
                      style={{ width: 300 }}
                      prefix={<SearchOutlined />}
                    />
                    <Button onClick={() => fetchContracts(pagination.current, pagination.pageSize)}>搜索</Button>
                  </Space>
                  <Space>
                    <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
                    <Button icon={<ImportOutlined />} onClick={() => importInputRef.current?.click()}>导入</Button>
                    <input
                      type="file"
                      ref={importInputRef}
                      style={{ display: 'none' }}
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleImportContracts(e.target.files[0])
                        }
                      }}
                    />
                    {hasPermission('canManageSuppliers') && (
                      <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateContract}>
                        新增合同
                      </Button>
                    )}
                  </Space>
                </div>

                <Table
                  columns={contractColumns}
                  dataSource={contracts}
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
                    onChange: handleContractTableChange,
                  }}
                />
              </>
            ) },
            { key: 'clients', label: '供应商管理', children: (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Space>
                    <Button icon={<FileExcelOutlined />} onClick={downloadSupplierTemplate}>下载导入模板</Button>
                    <Button icon={<ImportOutlined />} onClick={() => supplierImportRef.current?.click()}>导入供应商</Button>
                    <input
                      type="file"
                      ref={supplierImportRef}
                      style={{ display: 'none' }}
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleImportSuppliers(e.target.files[0])
                        }
                      }}
                    />
                  </Space>
                  {hasPermission('canManageSuppliers') && (
                    <Button type="primary" icon={<UserAddOutlined />} onClick={handleCreateSupplier}>
                      添加供应商
                    </Button>
                  )}
                </div>

                <Table
                  columns={supplierColumns}
                  dataSource={suppliers}
                  rowKey="id"
                  scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
                  pagination={{
                    current: supplierPagination.current,
                    pageSize: supplierPagination.pageSize,
                    total: supplierPagination.total,
                    pageSizeOptions: ['10', '20', '50'],
                    showSizeChanger: true,
                    showTotal: (t: number) => `共 ${t} 条`,
                    onChange: (page, pageSize) => setSupplierPagination({ current: page, pageSize, total: supplierPagination.total })
                  }}
                />
              </>
            ) },
          ]} 
        />

      {/* 合同弹窗 */}
      <Modal
        title={editingContract ? '编辑合同' : '新增合同'}
        open={isContractModalOpen}
        onCancel={() => setIsContractModalOpen(false)}
        onOk={() => contractForm.submit()}
        width={800}
      >
        <Form form={contractForm} layout="vertical" onFinish={handleSaveContract}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="projectName" label="项目名称" rules={[{ required: true }]}>
                <Input placeholder="请输入项目名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contractNo" label="合同编号">
                <Input placeholder="请输入合同编号" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contractDate" label="合同签订日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supplierId" label="供应商简称" rules={[{ required: true }]}>
                <Select
                  placeholder="选择供应商"
                  showSearch
                  optionFilterProp="children"
                  onChange={handleSupplierSelect}
                  options={suppliers.map(s => ({
                    label: s.short_name,
                    value: s.id,
                    fullName: s.full_name
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="supplierShortName" label="供应商简称">
                <Input disabled placeholder="自动填充" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supplierFullName" label="供应商名称">
                <Input disabled placeholder="自动填充" />
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
              <Form.Item name="paymentMethod" label="付款方式">
                <Select placeholder="选择付款方式" allowClear>
                  <Option value="一次性付款">一次性付款</Option>
                  <Option value="分期付款">分期付款</Option>
                  <Option value="按进度付款">按进度付款</Option>
                  <Option value="验收后付款">验收后付款</Option>
                </Select>
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
            <Col span={8}>
              <Form.Item name="taxRate" label="税率">
                <InputNumber style={{ width: '100%' }} min={0} max={100} formatter={(value) => `${value}%`} parser={(value: any) => value?.replace('%', '') || 0} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="actualWorkload" label="实际确认工作量">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="totalInvoicedAmount" label="总开票金额">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="grossProfit" label="毛利润">
                <InputNumber style={{ width: '100%' }} precision={2} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="salesperson" label="销售人员">
                <Input placeholder="请输入销售人员" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="projectType" label="项目类型">
                <Select placeholder="选择项目类型" allowClear>
                  <Option value="测绘项目">测绘项目</Option>
                  <Option value="咨询项目">咨询项目</Option>
                  <Option value="技术服务">技术服务</Option>
                  <Option value="软件开发">软件开发</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 供应商弹窗 */}
      <Modal
        title="添加供应商"
        open={isSupplierModalOpen}
        onCancel={() => setIsSupplierModalOpen(false)}
        onOk={() => supplierForm.submit()}
        width={700}
      >
        <Form form={supplierForm} layout="vertical" onFinish={handleSaveSupplier}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="shortName" label="供应商简称" rules={[{ required: true, message: '供应商简称不能为空' }]}>
                <Input placeholder="请输入供应商简称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="fullName" label="供应商名称" rules={[{ required: true, message: '供应商名称不能为空' }]}>
                <Input placeholder="请输入供应商全称" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contactPerson1" label="联系人1">
                <Input placeholder="请输入联系人1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactPerson2" label="联系人2">
                <Input placeholder="请输入联系人2" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="电话">
                <Input placeholder="请输入电话" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="taxId" label="税号">
                <Input placeholder="请输入税号" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="address" label="地址">
            <Input placeholder="请输入地址" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="bankName" label="开户银行">
                <Input placeholder="请输入开户银行" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bankAccount" label="银行账号">
                <Input placeholder="请输入银行账号" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="bankCode" label="银行行号">
                <Input placeholder="请输入银行行号" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="advantages" label="供应商优势">
                <Input placeholder="请输入供应商优势" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remarks" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 合同详情弹窗 */}
      <Modal
        title="合同详情"
        open={isDetailOpen}
        onCancel={() => setIsDetailOpen(false)}
        footer={null}
        width={700}
      >
        {selectedContract && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="项目名称" span={2}>{selectedContract.project_name}</Descriptions.Item>
            <Descriptions.Item label="合同编号">{selectedContract.contract_no}</Descriptions.Item>
            <Descriptions.Item label="合同签订日期">{selectedContract.contract_date}</Descriptions.Item>
            <Descriptions.Item label="供应商简称">{selectedContract.supplier_short_name}</Descriptions.Item>
            <Descriptions.Item label="供应商名称" span={2}>{selectedContract.supplier_full_name}</Descriptions.Item>
            <Descriptions.Item label="单价">{selectedContract.unit_price ? `¥${selectedContract.unit_price.toLocaleString()}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="工作量">{selectedContract.workload || '-'}</Descriptions.Item>
            <Descriptions.Item label="合同金额">{selectedContract.contract_amount ? `¥${selectedContract.contract_amount.toLocaleString()}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="付款方式">{selectedContract.payment_method || '-'}</Descriptions.Item>
            <Descriptions.Item label="发票票种">{<Tag color={selectedContract.invoice_type === '专票' ? 'blue' : 'default'}>{selectedContract.invoice_type || '-'}</Tag>}</Descriptions.Item>
            <Descriptions.Item label="税率">{selectedContract.tax_rate ? `${selectedContract.tax_rate}%` : '-'}</Descriptions.Item>
            <Descriptions.Item label="实际确认工作量">{selectedContract.actual_workload || '-'}</Descriptions.Item>
            <Descriptions.Item label="总开票金额">{selectedContract.total_invoiced_amount ? `¥${selectedContract.total_invoiced_amount.toLocaleString()}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="销售人员">{selectedContract.salesperson || '-'}</Descriptions.Item>
            <Descriptions.Item label="项目类型">{selectedContract.project_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="毛利润">{selectedContract.gross_profit !== null && selectedContract.gross_profit !== undefined ? `¥${selectedContract.gross_profit.toLocaleString()}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{selectedContract.remarks || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
