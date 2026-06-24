// @ts-nocheck
import { useState, useEffect } from 'react'
import { Card, Table, Button, Tag, Space, Modal, Form, Input, Select, DatePicker, message, Tabs, Descriptions, Alert, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, ToolOutlined, CheckCircleOutlined, WarningOutlined, DeleteOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import dayjs from 'dayjs'

const { Option } = Select

// 设备类型选项
const EQUIPMENT_TYPES = [
  { value: 'gnss', label: 'GNSS接收机', color: 'blue' },
  { value: 'total_station', label: '全站仪', color: 'green' },
  { value: 'level', label: '水准仪', color: 'orange' },
  { value: 'uav', label: '无人机', color: 'geekblue' },
  { value: 'lidar', label: '激光雷达', color: 'purple' },
  { value: 'theodolite', label: '经纬仪', color: 'cyan' },
  { value: 'tablet', label: '测绘平板', color: 'gold' },
  { value: 'scanner', label: '三维扫描仪', color: 'magenta' },
]

// 设备状态
const EQUIPMENT_STATUS = {
  available: { color: 'success', text: '可用' },
  in_use: { color: 'processing', text: '使用中' },
  maintenance: { color: 'warning', text: '维修中' },
  retired: { color: 'default', text: '已报废' },
}

export default function EquipmentManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('all')
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  // 获取设备列表
  const { data: equipmentList, isLoading } = useQuery({
    queryKey: ['survey-equipment', activeTab],
    queryFn: () => {
      const params: any = {}
      if (activeTab !== 'all') params.status = activeTab
      return api.get('/survey/equipment', { params })
    }
  })

  // 获取检定提醒
  const { data: calibrationAlerts } = useQuery({
    queryKey: ['calibration-alerts'],
    queryFn: () => api.get('/survey/equipment/calibration-alerts?days=30')
  })

  // 创建/更新设备
  const saveMutation = useMutation({
    mutationFn: (data: any) => {
      if (editingEquipment) {
        return api.put(`/survey/equipment/${editingEquipment.id}`, data)
      }
      return api.post('/survey/equipment', data)
    },
    onSuccess: () => {
      message.success(editingEquipment ? '更新成功' : '创建成功')
      setIsModalOpen(false)
      setEditingEquipment(null)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['survey-equipment'] })
      queryClient.invalidateQueries({ queryKey: ['calibration-alerts'] })
    },
    onError: () => {
      message.error('操作失败')
    }
  })

  // 归还设备
  const returnMutation = useMutation({
    mutationFn: (id: string) => api.post(`/survey/equipment/${id}/return`),
    onSuccess: () => {
      message.success('设备已归还')
      queryClient.invalidateQueries({ queryKey: ['survey-equipment'] })
    }
  })

  // 删除设备
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/survey/equipment/${id}`),
    onSuccess: () => {
      message.success('设备删除成功')
      queryClient.invalidateQueries({ queryKey: ['survey-equipment'] })
      queryClient.invalidateQueries({ queryKey: ['calibration-alerts'] })
    },
    onError: () => {
      message.error('删除失败')
    }
  })

  const handleSubmit = (values: any) => {
    saveMutation.mutate({
      ...values,
      purchaseDate: values.purchaseDate?.format('YYYY-MM-DD'),
      calibrationDate: values.calibrationDate?.format('YYYY-MM-DD'),
      nextCalibrationDate: values.nextCalibrationDate?.format('YYYY-MM-DD'),
    })
  }

  const handleEdit = (record: any) => {
    setEditingEquipment(record)
    form.setFieldsValue({
      ...record,
      purchaseDate: record.purchaseDate ? dayjs(record.purchaseDate) : null,
      calibrationDate: record.calibrationDate ? dayjs(record.calibrationDate) : null,
      nextCalibrationDate: record.nextCalibrationDate ? dayjs(record.nextCalibrationDate) : null,
    })
    setIsModalOpen(true)
  }

  const columns = [
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
    },
    {
      title: '序列号',
      dataIndex: 'serialNumber',
      key: 'serialNumber',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const config = EQUIPMENT_TYPES.find(t => t.value === type)
        return <Tag color={config?.color}>{config?.label || type}</Tag>
      }
    },
    {
      title: '制造商',
      dataIndex: 'manufacturer',
      key: 'manufacturer',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = EQUIPMENT_STATUS[status as keyof typeof EQUIPMENT_STATUS]
        return <Tag color={config?.color}>{config?.text}</Tag>
      }
    },
    {
      title: '下次检定',
      dataIndex: 'nextCalibrationDate',
      key: 'nextCalibrationDate',
      render: (date: string) => {
        if (!date) return '-'
        const days = dayjs(date).diff(dayjs(), 'days')
        if (days < 0) return <Tag color="error">已过期</Tag>
        if (days <= 30) return <Tag color="warning">{days}天后</Tag>
        return dayjs(date).format('YYYY-MM-DD')
      }
    },
    {
      title: '保管人',
      dataIndex: ['keeper', 'name'],
      key: 'keeper',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          {record.status === 'in_use' && (
            <Button type="link" onClick={() => returnMutation.mutate(record.id)}>归还</Button>
          )}
          <Popconfirm
            title="确定删除此设备吗？"
            description="删除后无法恢复"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  const alertCount = calibrationAlerts?.data?.length || 0

  return (
    <div style={{ padding: 24 }}>
      {alertCount > 0 && (
        <Alert
          message={`有 ${alertCount} 台设备需要检定/校准`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" type="link" onClick={() => setActiveTab('alerts')}>
              查看详情
            </Button>
          }
        />
      )}

      <Card
        title={
          <Space>
            <ToolOutlined />
            <span>设备管理</span>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setEditingEquipment(null)
            form.resetFields()
            setIsModalOpen(true)
          }}>
            新增设备
          </Button>
        }
      >
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            { key: 'all', label: '全部设备' },
            { key: 'available', label: '可用' },
            { key: 'in_use', label: '使用中' },
            { key: 'maintenance', label: '维修中' },
            { 
              key: 'alerts', 
              label: (
                <span>
                  检定提醒
                  {alertCount > 0 && <Tag color="error" style={{ marginLeft: 4 }}>{alertCount}</Tag>}
                </span>
              )
            },
          ]} 
        />

        {activeTab === 'alerts' ? (
          <Table
            columns={columns}
            dataSource={calibrationAlerts?.data}
            loading={!calibrationAlerts}
            rowKey="id"
            scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
            pagination={{
              current: 1,
              pageSize: 10,
              pageSizeOptions: ['10', '20', '50'],
              showSizeChanger: true,
              showTotal: (t: number) => `共 ${t} 条`,
            }}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={equipmentList?.data}
            loading={isLoading}
            rowKey="id"
            scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
            pagination={{
              current: 1,
              pageSize: 10,
              pageSizeOptions: ['10', '20', '50'],
              showSizeChanger: true,
              showTotal: (t: number) => `共 ${t} 条`,
            }}
          />
        )}
      </Card>

      <Modal
        title={editingEquipment ? '编辑设备' : '新增设备'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false)
          setEditingEquipment(null)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        confirmLoading={saveMutation.isPending}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="设备名称" rules={[{ required: true, message: '请输入设备名称' }]}>
            <Input placeholder="如：南方测绘GPS接收机" />
          </Form.Item>
          
          <Form.Item name="type" label="设备类型" rules={[{ required: true, message: '请选择设备类型' }]}>
            <Select placeholder="选择设备类型">
              {EQUIPMENT_TYPES.map(type => (
                <Option key={type.value} value={type.value}>{type.label}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="model" label="型号">
            <Input placeholder="如：S82-2013" />
          </Form.Item>
          
          <Form.Item name="serialNumber" label="序列号">
            <Input placeholder="设备序列号" />
          </Form.Item>
          
          <Form.Item name="manufacturer" label="制造商">
            <Input placeholder="如：南方测绘" />
          </Form.Item>
          
          <Form.Item name="purchaseDate" label="购置日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item name="calibrationDate" label="检定日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item name="nextCalibrationDate" label="下次检定日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select placeholder="选择状态">
              <Option value="available">可用</Option>
              <Option value="in_use">使用中</Option>
              <Option value="maintenance">维修中</Option>
              <Option value="retired">已报废</Option>
            </Select>
          </Form.Item>
          
          <Form.Item name="location" label="存放位置">
            <Input placeholder="如：设备室A柜" />
          </Form.Item>
          
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="其他备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
