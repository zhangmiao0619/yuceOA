// @ts-nocheck
import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Space, message, Tag, DatePicker, Tabs, Popconfirm } from 'antd'
import { PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuthStore } from '../stores/auth'
import api from '../lib/api'

const STATUS_MAP = {
  pending: { text: '待审批', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已驳回', color: 'red' },
}

export default function OutgoingRequests() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState('my')
  const [pendingList, setPendingList] = useState([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.isAdmin

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const res = await api.get('/hr-requests/outgoing')
      if (res.success) setRecords(res.data)
    } catch { message.error('获取外出记录失败') }
    finally { setLoading(false) }
  }

  const fetchPending = async () => {
    if (!isAdmin) return
    setPendingLoading(true)
    try {
      const res = await api.get('/hr-requests/admin/outgoing-pending')
      if (res.success) setPendingList(res.data)
    } catch { message.error('获取待审批列表失败') }
    finally { setPendingLoading(false) }
  }

  useEffect(() => { fetchRecords() }, [])

  const handleCreate = async (values) => {
    try {
      const payload = {
        ...values,
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
      }
      const res = await api.post('/hr-requests/outgoing', payload)
      if (res.success) {
        message.success('外出申请已提交')
        setModalVisible(false)
        form.resetFields()
        fetchRecords()
      }
    } catch { message.error('提交失败') }
  }

  const handleApprove = async (id, approved, notes) => {
    try {
      const res = await api.put(`/hr-requests/admin/outgoing/${id}/approve`, { approved, notes })
      if (res.success) {
        message.success(approved ? '已通过' : '已驳回')
        fetchPending()
        fetchRecords()
      }
    } catch { message.error('操作失败') }
  }

  const columns = [
    { title: '目的地', dataIndex: 'destination', key: 'destination' },
    { title: '开始日期', dataIndex: 'start_date', key: 'start_date', render: (v) => v || '-' },
    { title: '结束日期', dataIndex: 'end_date', key: 'end_date', render: (v) => v || '-' },
    { title: '外出目的', dataIndex: 'purpose', key: 'purpose', render: (v) => v || '-' },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s) => {
        const info = STATUS_MAP[s] || { text: s, color: 'default' }
        return <Tag color={info.color}>{info.text}</Tag>
      }
    },
    { title: '申请时间', dataIndex: 'created_at', key: 'created_at', render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-' },
  ]

  const pendingColumns = [
    { title: '申请人', dataIndex: 'user_name', key: 'user_name' },
    { title: '部门', dataIndex: 'department_name', key: 'department_name', render: (v) => v || '-' },
    { title: '目的地', dataIndex: 'destination', key: 'destination' },
    { title: '时间段', key: 'period', render: (_, r) => `${r.start_date} ~ ${r.end_date}` },
    { title: '外出目的', dataIndex: 'purpose', key: 'purpose', render: (v) => v || '-' },
    {
      title: '操作', key: 'action',
      render: (_, record) => (
        <Space>
          <Popconfirm title="确定通过此申请？" onConfirm={() => handleApprove(record.id, true, '')}>
            <Button type="link" size="small" icon={<CheckOutlined />} style={{ color: '#52c41a' }}>通过</Button>
          </Popconfirm>
          <Popconfirm title="确定驳回此申请？" onConfirm={() => handleApprove(record.id, false, '')}>
            <Button type="link" size="small" danger icon={<CloseOutlined />}>驳回</Button>
          </Popconfirm>
        </Space>
      )
    },
  ]

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: 'my', label: '我的外出申请',
          children: (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalVisible(true) }}>
                  提交外出申请
                </Button>
              </div>
              <Table columns={columns} dataSource={records} rowKey="id" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />
            </div>
          )
        },
        ...(isAdmin ? [{
          key: 'pending', label: '待审批',
          children: (
            <Table columns={pendingColumns} dataSource={pendingList} rowKey="id" loading={pendingLoading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }} />
          )
        }] : []),
      ]} />

      <Modal title="提交外出申请" open={modalVisible} onCancel={() => setModalVisible(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="destination" label="目的地" rules={[{ required: true, message: '请输入目的地' }]}>
            <Input placeholder="请输入外出目的地" />
          </Form.Item>
          <Form.Item name="dateRange" label="外出日期" rules={[{ required: true, message: '请选择外出日期' }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="purpose" label="外出目的" rules={[{ required: true, message: '请输入外出目的' }]}>
            <Input.TextArea rows={3} placeholder="请输入外出目的" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
