// @ts-nocheck
import { useState } from 'react'
import { Card, Table, Tag, Button, Space, message, Row, Col, Statistic, Badge, Modal, Form, Input } from 'antd'
import { BellOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuthStore } from '../stores/auth'
import dayjs from 'dayjs'

export default function Alerts() {
  const isAdmin = useAuthStore((state) => state.user?.isAdmin)
  const queryClient = useQueryClient()
  const [resolveModalVisible, setResolveModalVisible] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<any>(null)
  const [form] = Form.useForm()

  const { data: stats } = useQuery({
    queryKey: ['alert-stats'],
    queryFn: () => api.get('/alerts/stats')
  })

  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.get('/alerts')
  })

  const scanMutation = useMutation({
    mutationFn: () => api.post('/alerts/scan'),
    onSuccess: (res: any) => {
      message.success(`扫描完成，新增 ${res.data?.length || 0} 条预警`)
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alert-stats'] })
    }
  })

  const resolveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => api.put(`/alerts/${id}/resolve`, { notes }),
    onSuccess: () => {
      message.success('预警已标记为已处理')
      setResolveModalVisible(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alert-stats'] })
    }
  })

  const alertTypeMap: Record<string, { label: string; color: string }> = {
    contract_renewal: { label: '合同续签', color: 'red' },
    probation_end: { label: '试用期结束', color: 'orange' },
    title_declaration: { label: '职称申报', color: 'blue' },
    qualification_renewal: { label: '资质续期', color: 'purple' },
    work_permit_renewal: { label: '工作证续期', color: 'cyan' },
    asset_maintenance: { label: '资产维保', color: 'geekblue' },
    birthday: { label: '生日', color: 'green' }
  }

  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: '待处理', color: 'error' },
    notified: { label: '已通知', color: 'warning' },
    resolved: { label: '已处理', color: 'success' }
  }

  const columns = [
    {
      title: '预警类型',
      dataIndex: 'alert_type',
      key: 'alertType',
      width: 120,
      render: (type: string) => {
        const info = alertTypeMap[type] || { label: type, color: 'default' }
        return <Tag color={info.color}>{info.label}</Tag>
      }
    },
    {
      title: '对象名称',
      dataIndex: 'target_name',
      key: 'targetName'
    },
    {
      title: '对象类型',
      dataIndex: 'target_type',
      key: 'targetType',
      width: 90,
      render: (t: string) => t === 'user' ? '员工' : '资产'
    },
    {
      title: '到期日',
      dataIndex: 'due_date',
      key: 'dueDate',
      width: 120,
      render: (d: string) => d ? dayjs(d).format('YYYY-MM-DD') : '-'
    },
    {
      title: '剩余天数',
      dataIndex: 'days_remaining',
      key: 'daysRemaining',
      width: 100,
      render: (days: number) => (
        <Badge
          count={days !== null && days !== undefined ? `${days}天` : '-'}
          style={{
            backgroundColor: days <= 7 ? '#ff4d4f' : days <= 30 ? '#faad14' : '#52c41a'
          }}
        />
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => {
        const info = statusMap[s] || { label: s, color: 'default' }
        return <Tag color={info.color}>{info.label}</Tag>
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'createdAt',
      width: 160,
      render: (d: string) => dayjs(d).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          {record.status !== 'resolved' && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => {
                setSelectedAlert(record)
                setResolveModalVisible(true)
              }}
            >
              处理
            </Button>
          )}
        </Space>
      )
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>智能预警看板</h2>
        {isAdmin && (
          <Button type="primary" icon={<ReloadOutlined />} onClick={() => scanMutation.mutate()} loading={scanMutation.isPending}>
            立即扫描
          </Button>
        )}
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理"
              value={stats?.data?.pending || 0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<BellOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已通知"
              value={stats?.data?.notified || 0}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已处理"
              value={stats?.data?.resolved || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="7天内紧急"
              value={stats?.data?.urgent || 0}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="预警列表">
        <Table
          columns={columns}
          dataSource={alertsData?.data}
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
      </Card>

      <Modal
        title="处理预警"
        open={resolveModalVisible}
        onCancel={() => { setResolveModalVisible(false); setSelectedAlert(null); form.resetFields(); }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={(values) => {
          if (selectedAlert) {
            resolveMutation.mutate({ id: selectedAlert.id, notes: values.notes })
          }
        }}>
          <Form.Item name="notes" label="处理备注">
            <Input.TextArea rows={3} placeholder="请输入处理备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
