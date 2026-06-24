import { useState, useEffect } from 'react'
import {
  Table, Button, Modal, Form, Input, message, Space, Popconfirm, Tag
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import api from '../lib/api'
import type { Rule } from 'antd/es/form'

interface Supplier {
  id: string
  short_name: string
  full_name: string
  contact_person1?: string
  contact_person2?: string
  phone?: string
  tax_id?: string
  address?: string
  bank_name?: string
  bank_account?: string
  bank_code?: string
  advantages?: string
  remarks?: string
}

export default function SupplierManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })

  const fetchSuppliers = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res: any = await api.get('/suppliers', { params: { page, pageSize } })
      if (res.success) {
        setSuppliers(res.data)
        setPagination({ current: page, pageSize, total: res.total || res.data.length })
      }
    } catch (error) {
      message.error('获取供应商列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleTableChange = (paginationConfig: any) => {
    fetchSuppliers(paginationConfig.current, paginationConfig.pageSize)
  }

  useEffect(() => {
    fetchSuppliers(pagination.current, pagination.pageSize)
  }, [])

  const handleSave = async (values: any) => {
    try {
      const res: any = await api.post('/suppliers', values)
      if (res.success) {
        message.success('供应商创建成功')
        setModalVisible(false)
        form.resetFields()
        fetchSuppliers()
      }
    } catch (error: any) {
      message.error(error?.message || '创建失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res: any = await api.delete(`/suppliers/${id}`)
      if (res.success) {
        message.success('删除成功')
        fetchSuppliers()
      }
    } catch (error: any) {
      message.error(error?.message || '删除失败')
    }
  }

  const columns = [
    { title: '简称', dataIndex: 'short_name', key: 'short_name', width: 120 },
    { title: '全称', dataIndex: 'full_name', key: 'full_name', width: 200 },
    { title: '联系人1', dataIndex: 'contact_person1', key: 'contact_person1', render: (v: string) => v || '-' },
    { title: '联系人2', dataIndex: 'contact_person2', key: 'contact_person2', render: (v: string) => v || '-' },
    { title: '电话', dataIndex: 'phone', key: 'phone', render: (v: string) => v || '-' },
    { title: '税号', dataIndex: 'tax_id', key: 'tax_id', render: (v: string) => v || '-' },
    { title: '开户银行', dataIndex: 'bank_name', key: 'bank_name', render: (v: string) => v || '-' },
    { title: '银行账号', dataIndex: 'bank_account', key: 'bank_account', render: (v: string) => v || '-' },
    { title: '银行行号', dataIndex: 'bank_code', key: 'bank_code', render: (v: string) => v || '-' },
    { title: '优势', dataIndex: 'advantages', key: 'advantages', render: (v: string) => v || '-' },
    { title: '备注', dataIndex: 'remarks', key: 'remarks', render: (v: string) => v || '-' },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: Supplier) => (
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      )
    }
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#666' }}>供应商信息管理</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalVisible(true); }}>
          添加供应商
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={suppliers}
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

      <Modal
        title="添加供应商"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="shortName"
              label="供应商简称"
              rules={[
                { required: true, message: '请输入供应商简称' },
                { max: 50, message: '供应商简称不能超过50个字' }
              ]}
            >
              <Input placeholder="请输入简称" maxLength={50} showCount />
            </Form.Item>
            <Form.Item
              name="fullName"
              label="供应商名称"
              rules={[
                { required: true, message: '请输入供应商名称' },
                { max: 200, message: '供应商名称不能超过200个字' }
              ]}
            >
              <Input placeholder="请输入全称" maxLength={200} showCount />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="contactPerson1"
              label="联系人1"
              rules={[
                { max: 50, message: '联系人姓名不能超过50个字' }
              ]}
            >
              <Input placeholder="请输入联系人1" maxLength={50} />
            </Form.Item>
            <Form.Item
              name="contactPerson2"
              label="联系人2"
              rules={[
                { max: 50, message: '联系人姓名不能超过50个字' }
              ]}
            >
              <Input placeholder="请输入联系人2" maxLength={50} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="phone"
              label="电话"
              rules={[
                {
                  pattern: /^1[3-9]\d{9}$/,
                  message: '请输入正确的手机号码（11位数字）'
                }
              ]}
            >
              <Input placeholder="请输入电话" maxLength={11} />
            </Form.Item>
            <Form.Item
              name="taxId"
              label="税号"
              rules={[
                {
                  pattern: /^[A-Z0-9]{15,20}$/,
                  message: '请输入正确的税号（15-20位字母或数字）'
                }
              ]}
            >
              <Input placeholder="请输入税号" maxLength={20} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
          </div>
          <Form.Item
            name="address"
            label="地址"
            rules={[
              { max: 200, message: '地址不能超过200个字' }
            ]}
          >
            <Input placeholder="请输入地址" maxLength={200} showCount />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="bankName"
              label="开户银行"
              rules={[
                { max: 100, message: '开户银行不能超过100个字' }
              ]}
            >
              <Input placeholder="请输入开户银行" maxLength={100} />
            </Form.Item>
            <Form.Item
              name="bankAccount"
              label="银行账号"
              rules={[
                {
                  pattern: /^\d{10,23}$/,
                  message: '请输入正确的银行账号（10-23位数字）'
                }
              ]}
            >
              <Input placeholder="请输入银行账号" maxLength={23} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="bankCode"
              label="银行行号"
              rules={[
                {
                  pattern: /^\d{12}$/,
                  message: '请输入正确的银行行号（12位数字）'
                }
              ]}
            >
              <Input placeholder="请输入银行行号" maxLength={12} />
            </Form.Item>
            <Form.Item
              name="advantages"
              label="供应商优势"
              rules={[
                { max: 500, message: '供应商优势不能超过500个字' }
              ]}
            >
              <Input.TextArea placeholder="请输入优势" maxLength={500} showCount rows={2} />
            </Form.Item>
          </div>
          <Form.Item name="remarks" label="备注" rules={[{ max: 500, message: '备注不能超过500个字' }]}>
            <Input.TextArea rows={2} placeholder="请输入备注" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
