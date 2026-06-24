// @ts-nocheck
import { useState, useEffect } from 'react'
import { 
  Card, Button, Statistic, Row, Col, Table, Tag, Progress,
  DatePicker, Timeline, Empty, message, Modal, Form, 
  InputNumber, Select, Input, List, Avatar, Space, Tabs,
  Drawer, Descriptions
} from 'antd'
import { 
  ClockCircleOutlined, CheckCircleOutlined, PieChartOutlined,
  BarChartOutlined,
  PlusOutlined, PlayCircleOutlined, PauseCircleOutlined,
  HistoryOutlined, TeamOutlined, ProjectOutlined, CalendarOutlined,
  ExportOutlined
} from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuthStore } from '../stores/auth'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

export default function TimeTracking() {
  const [activeTab, setActiveTab] = useState('today')
  const [isCheckIn, setIsCheckIn] = useState(false)
  const [checkInTime, setCheckInTime] = useState<Date | null>(null)
  const [workingTime, setWorkingTime] = useState(0)
  const [isLogModalOpen, setIsLogModalOpen] = useState(false)
  const [logForm] = Form.useForm()
  const [dateRange, setDateRange] = useState<any>(null)
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<any>(null)
  const [teamDrawerVisible, setTeamDrawerVisible] = useState(false)
  const queryClient = useQueryClient()
  const isAdmin = useAuthStore((state) => state.user?.isAdmin)

  const { data: myStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['my-time-stats', dateRange],
    queryFn: () => {
      const params: any = {}
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD')
        params.endDate = dateRange[1].format('YYYY-MM-DD')
      }
      return api.get('/time-entries/my-stats', { params })
    }
  })

  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get('/tasks')
  })

  const { data: teamStats, isLoading: teamLoading, refetch: refetchTeam } = useQuery({
    queryKey: ['team-time-stats'],
    queryFn: () => api.get('/time-entries/team-stats'),
    enabled: !!isAdmin
  })

  const { data: projectStats } = useQuery({
    queryKey: ['project-time-stats'],
    queryFn: () => api.get('/time-entries/project-stats')
  })

  const logTimeMutation = useMutation({
    mutationFn: (data: any) => api.post('/time-entries', data),
    onSuccess: () => {
      message.success('工时记录成功')
      setIsLogModalOpen(false)
      logForm.resetFields()
      refetchStats()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/time-entries/${id}`),
    onSuccess: () => {
      message.success('删除成功')
      refetchStats()
    }
  })

  useEffect(() => {
    const saved = localStorage.getItem('checkInStatus')
    if (saved) {
      const { isCheckedIn, time } = JSON.parse(saved)
      setIsCheckIn(isCheckedIn)
      if (isCheckedIn && time) {
        setCheckInTime(new Date(time))
      }
    }
  }, [])

  useEffect(() => {
    if (!isCheckIn || !checkInTime) return
    
    const interval = setInterval(() => {
      const diff = Date.now() - checkInTime.getTime()
      setWorkingTime(Math.floor(diff / 1000 / 60))
    }, 60000)
    
    return () => clearInterval(interval)
  }, [isCheckIn, checkInTime])

  const handleCheckIn = () => {
    const now = new Date()
    setIsCheckIn(true)
    setCheckInTime(now)
    localStorage.setItem('checkInStatus', JSON.stringify({
      isCheckedIn: true,
      time: now.toISOString()
    }))
    message.success('打卡成功！开始工作')
  }

  const handleCheckOut = () => {
    setIsCheckIn(false)
    setCheckInTime(null)
    setWorkingTime(0)
    localStorage.setItem('checkInStatus', JSON.stringify({
      isCheckedIn: false,
      time: null
    }))
    message.success('已签退！辛苦了')
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}小时${mins}分钟`
  }

  const handleExport = () => {
    const data = myStats?.data?.records || []
    if (data.length === 0) {
      message.warning('没有数据可导出')
      return
    }
    
    const headers = ['日期', '任务', '工时(小时)', '状态', '备注']
    const rows = data.map((r: any) => [
      dayjs(r.date || r.createdAt).format('YYYY-MM-DD'),
      r.title || r.task?.title || '-',
      r.hours || r.actualHours || 0,
      r.status === 'done' ? '已完成' : '进行中',
      r.description || '-'
    ])
    
    const csv = [headers.join(','), ...rows.map((row: any[]) => row.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `工时记录_${dayjs().format('YYYYMMDD')}.csv`
    link.click()
    message.success('导出成功')
  }

  const timeColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '任务',
      dataIndex: 'title',
      key: 'title',
      render: (_: any, record: any) => record.task?.title || record.title || '-'
    },
    {
      title: '工时',
      dataIndex: 'hours',
      key: 'hours',
      render: (hours: number) => <Tag color="blue">{hours}小时</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const labels: Record<string, string> = {
          todo: '待办',
          in_progress: '进行中',
          review: '审核中',
          done: '已完成'
        }
        const colors: Record<string, string> = {
          todo: 'default',
          in_progress: 'processing',
          review: 'warning',
          done: 'success'
        }
        return <Tag color={colors[status]}>{labels[status] || status}</Tag>
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => {
          setSelectedRecord(record)
          setDetailDrawerVisible(true)
        }}>
          详情
        </Button>
      )
    }
  ]

  const teamColumns = [
    {
      title: '成员',
      key: 'user',
      render: (_: any, record: any) => (
        <Space>
          <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>
            {(record.userName || record.name || '?')[0]}
          </Avatar>
          {record.userName || record.name || '-'}
        </Space>
      )
    },
    {
      title: '本月工时',
      dataIndex: 'totalHours',
      key: 'totalHours',
      render: (hours: number) => <Tag color="blue">{hours || 0}小时</Tag>
    },
    {
      title: '完成任务数',
      dataIndex: 'completedTasks',
      key: 'completedTasks'
    },
    {
      title: '进行中任务',
      dataIndex: 'inProgressTasks',
      key: 'inProgressTasks'
    }
  ]

  const projectColumns = [
    {
      title: '项目',
      dataIndex: 'projectName',
      key: 'projectName'
    },
    {
      title: '总工时',
      dataIndex: 'totalHours',
      key: 'totalHours',
      render: (hours: number) => <Tag color="green">{hours || 0}小时</Tag>
    },
    {
      title: '任务数',
      dataIndex: 'taskCount',
      key: 'taskCount'
    },
    {
      title: '完成进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => <Progress percent={progress || 0} size="small" />
    }
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>工时管理</h2>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsLogModalOpen(true)}>
            记录工时
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出
          </Button>
          {isAdmin && (
            <Button icon={<TeamOutlined />} onClick={() => {
              refetchTeam()
              setTeamDrawerVisible(true)
            }}>
              团队统计
            </Button>
          )}
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="本月工时"
              value={myStats?.data?.totalHours || 0}
              suffix="小时"
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="已完成任务"
              value={myStats?.data?.completedTasks || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="进行中"
              value={myStats?.data?.inProgressTasks || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<PieChartOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <RangePicker 
            value={dateRange}
            onChange={setDateRange}
            placeholder={['开始日期', '结束日期']}
          />
          <Button onClick={() => refetchStats()}>刷新</Button>
        </Space>
        <Table
          columns={timeColumns}
          dataSource={myStats?.data?.records || []}
          loading={statsLoading}
          rowKey="id"
          scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
          pagination={{
            current: 1,
            pageSize: 10,
            pageSizeOptions: ['10', '20', '50'],
            showSizeChanger: true,
            showTotal: (t: number) => `共 ${t} 条`,
          }}
          locale={{ emptyText: <Empty description="暂无工时记录" /> }}
        />
      </Card>

      {projectStats?.data && Object.keys(projectStats.data).length > 0 && (
        <Card title="项目工时分布" style={{ marginTop: 16 }}>
          <Table
            columns={projectColumns}
            dataSource={Object.entries(projectStats.data).map(([id, stats]: [string, any]) => ({
              projectId: id,
              projectName: stats.projectName || `项目 ${id.slice(0, 8)}`,
              totalHours: stats.hours || 0,
              taskCount: stats.tasks || 0,
              progress: stats.progress || 0
            }))}
            rowKey="projectId"
            pagination={false}
          />
        </Card>
      )}

      <Modal
        title="记录工时"
        open={isLogModalOpen}
        onCancel={() => setIsLogModalOpen(false)}
        onOk={() => logForm.submit()}
        confirmLoading={logTimeMutation.isPending}
      >
        <Form form={logForm} layout="vertical" onFinish={(values) => {
          logTimeMutation.mutate({
            ...values,
            date: values.date?.format('YYYY-MM-DD')
          })
        }}>
          <Form.Item
            name="taskId"
            label="选择任务"
            rules={[{ required: true, message: '请选择任务' }]}
          >
            <Select placeholder="选择任务">
              {tasks?.data?.map((task: any) => (
                <Select.Option key={task.id} value={task.id}>
                  {task.title}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="hours"
            label="工时"
            rules={[{ required: true, message: '请输入工时' }]}
          >
            <InputNumber 
              min={0.5} 
              max={24} 
              step={0.5} 
              style={{ width: '100%' }}
              placeholder="小时"
            />
          </Form.Item>

          <Form.Item
            name="date"
            label="日期"
            initialValue={dayjs()}
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="description" label="备注">
            <Input.TextArea rows={2} placeholder="工作描述" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="工时记录详情"
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={500}
      >
        {selectedRecord && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="日期">
              {dayjs(selectedRecord.date || selectedRecord.createdAt).format('YYYY-MM-DD')}
            </Descriptions.Item>
            <Descriptions.Item label="任务">
              {selectedRecord.task?.title || selectedRecord.title || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="工时">
              {selectedRecord.hours || selectedRecord.actualHours || 0}小时
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {selectedRecord.status === 'done' ? '已完成' : '进行中'}
            </Descriptions.Item>
            <Descriptions.Item label="备注">
              {selectedRecord.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedRecord.createdAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      <Drawer
        title="团队工时统计"
        open={teamDrawerVisible}
        onClose={() => setTeamDrawerVisible(false)}
        width={700}
      >
        <Table
          columns={teamColumns}
          dataSource={teamStats?.data || []}
          loading={teamLoading}
          rowKey="userId"
          scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
          pagination={{
            current: 1,
            pageSize: 10,
            pageSizeOptions: ['10', '20', '50'],
            showSizeChanger: true,
            showTotal: (t: number) => `共 ${t} 条`,
          }}
          locale={{ emptyText: <Empty description="暂无团队数据" /> }}
        />
      </Drawer>
    </div>
  )
}
