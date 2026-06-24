import { useState, useEffect } from 'react'
import { Card, Empty, Button, Tag, List, Modal, Form, Input, DatePicker, message, Space, Tabs, Statistic, Row, Col, Popconfirm, Descriptions, Spin, Select } from 'antd'
import { PlusOutlined, FileTextOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ClockCircleOutlined, SendOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../lib/api'
import { useAuthStore } from '../stores/auth'

const { TextArea } = Input

interface DailyReport {
  id: string
  user_id: string
  user_name: string
  report_date: string
  content: string
  completed_tasks: string[]
  planned_tasks: string[]
  problems?: string
  status: 'draft' | 'submitted'
  cc_users: string[]
  submit_time?: string
  created_at: string
  updated_at: string
}

interface User {
  id: string
  name: string
}

export default function DailyReport() {
  const [reports, setReports] = useState<DailyReport[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ total: 0, submitted: 0, todayCount: 0 })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<DailyReport | null>(null)
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState('my')
  const isAdmin = useAuthStore((state) => state.user?.isAdmin)
  const currentUser = useAuthStore((state) => state.user)

  const fetchReports = async () => {
    setLoading(true)
    try {
      const res: any = await api.get('/daily-reports')
      if (res.success) {
        setReports(res.data)
      }
    } catch (error) {
      message.error('获取日报列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res: any = await api.get('/daily-reports/stats/overview')
      if (res.success) {
        setStats(res.data)
      }
    } catch (error) {
      console.error('获取统计失败', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const res: any = await api.get('/users')
      if (res.success) {
        setUsers(res.data || [])
      }
    } catch (error) {
      console.error('获取用户列表失败', error)
    }
  }

  useEffect(() => {
    fetchReports()
    fetchStats()
    fetchUsers()
  }, [])

  const handleCreate = () => {
    setEditingReport(null)
    form.resetFields()
    form.setFieldsValue({
      reportDate: dayjs(),
      completedTasks: [''],
      plannedTasks: [''],
      ccUsers: []
    })
    setIsModalOpen(true)
  }

  const handleEdit = (report: DailyReport) => {
    setEditingReport(report)
    form.setFieldsValue({
      reportDate: dayjs(report.report_date),
      content: report.content,
      completedTasks: report.completed_tasks?.length > 0 ? report.completed_tasks : [''],
      plannedTasks: report.planned_tasks?.length > 0 ? report.planned_tasks : [''],
      problems: report.problems,
      ccUsers: report.cc_users || []
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        reportDate: values.reportDate.format('YYYY-MM-DD'),
        content: values.content,
        completedTasks: (values.completedTasks || []).filter((t: string) => t.trim()),
        plannedTasks: (values.plannedTasks || []).filter((t: string) => t.trim()),
        problems: values.problems,
        ccUsers: values.ccUsers || []
      }

      if (editingReport) {
        const res: any = await api.put(`/daily-reports/${editingReport.id}`, payload)
        if (res.success) {
          message.success('更新成功')
          setIsModalOpen(false)
          fetchReports()
          fetchStats()
        }
      } else {
        const res: any = await api.post('/daily-reports', payload)
        if (res.success) {
          message.success('创建成功')
          setIsModalOpen(false)
          fetchReports()
          fetchStats()
        }
      }
    } catch (error: any) {
      message.error(error?.message || '操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res: any = await api.delete(`/daily-reports/${id}`)
      if (res.success) {
        message.success('删除成功')
        fetchReports()
        fetchStats()
      }
    } catch (error: any) {
      message.error(error?.message || '删除失败')
    }
  }

  const handleSubmitReport = async (report: DailyReport) => {
    try {
      const res: any = await api.post(`/daily-reports/${report.id}/submit`)
      if (res.success) {
        message.success('日报已提交')
        fetchReports()
        fetchStats()
      }
    } catch (error: any) {
      message.error(error?.message || '提交失败')
    }
  }

  const openDetail = (report: DailyReport) => {
    setSelectedReport(report)
    setIsDetailOpen(true)
  }

  const statusMap: Record<string, { text: string; color: string }> = {
    draft: { text: '草稿', color: 'default' },
    submitted: { text: '已提交', color: 'processing' }
  }

  const filteredReports = activeTab === 'my'
    ? reports.filter(r => r.user_id === currentUser?.id)
    : reports.filter(r => r.cc_users?.includes(currentUser?.id || ''))

  const renderReportCard = (report: DailyReport) => (
    <Card
      size="small"
      key={report.id}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <span>{report.user_name} - {report.report_date}</span>
            {report.user_id === currentUser?.id && (
              <Tag color="blue">我的</Tag>
            )}
            {report.cc_users?.includes(currentUser?.id || '') && report.user_id !== currentUser?.id && (
              <Tag color="orange">抄送我</Tag>
            )}
          </Space>
          <Tag color={statusMap[report.status]?.color || 'default'}>
            {statusMap[report.status]?.text || report.status}
          </Tag>
        </div>
      }
      actions={[
        <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openDetail(report)}>查看</Button>,
        report.user_id === currentUser?.id && report.status === 'draft' && (
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(report)}>编辑</Button>
        ),
        report.user_id === currentUser?.id && report.status === 'draft' && (
          <Button type="text" size="small" icon={<SendOutlined />} onClick={() => handleSubmitReport(report)}>提交</Button>
        ),
        report.user_id === currentUser?.id && report.status === 'draft' && (
          <Popconfirm
            title="确定删除此日报？"
            onConfirm={() => handleDelete(report.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        )
      ].filter(Boolean)}
    >
      <p style={{ color: '#666', marginBottom: 12, whiteSpace: 'pre-wrap' }}>
        {report.content?.substring(0, 100)}{report.content?.length > 100 ? '...' : ''}
      </p>
      
      {report.completed_tasks?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>已完成：</div>
          <div>
            {report.completed_tasks.slice(0, 2).map((task, idx) => (
              <Tag key={idx} style={{ marginRight: 4, marginBottom: 4 }}>{task}</Tag>
            ))}
            {report.completed_tasks.length > 2 && (
              <Tag>+{report.completed_tasks.length - 2}</Tag>
            )}
          </div>
        </div>
      )}
      
      <div style={{ fontSize: 12, color: '#999' }}>
        提交时间: {dayjs(report.created_at).format('YYYY-MM-DD HH:mm')}
      </div>
    </Card>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h3 style={{ margin: 0 }}>工作日报</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          写日报
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总日报数"
              value={stats.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="已提交"
              value={stats.submitted}
              valueStyle={{ color: '#1890ff' }}
              prefix={<SendOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="今日日报"
              value={stats.todayCount}
              valueStyle={{ color: '#722ed1' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            { key: 'my', label: '我的日报', children: (
              <Spin spinning={loading}>
                {filteredReports.length > 0 ? (
                  <List
                    grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
                    dataSource={filteredReports}
                    renderItem={(report) => (
                      <List.Item>{renderReportCard(report)}</List.Item>
                    )}
                  />
                ) : (
                  <Empty description="暂无日报记录" />
                )}
              </Spin>
            ) },
            { key: 'cc', label: '抄送我的', children: (
              <Spin spinning={loading}>
                {filteredReports.length > 0 ? (
                  <List
                    grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
                    dataSource={filteredReports}
                    renderItem={(report) => (
                      <List.Item>{renderReportCard(report)}</List.Item>
                    )}
                  />
                ) : (
                  <Empty description="暂无抄送给我的日报" />
                )}
              </Spin>
            ) },
          ]} 
        />

      {/* 创建/编辑日报弹窗 */}
      <Modal
        title={editingReport ? '编辑日报' : '写日报'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="reportDate"
            label="日期"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="content"
            label="工作内容"
            rules={[{ required: true, message: '请填写工作内容' }]}
          >
            <TextArea rows={6} placeholder="请描述今天的工作内容、完成情况..." />
          </Form.Item>

          <Form.Item label="已完成任务">
            <Form.List name="completedTasks">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item {...restField} name={name} noStyle>
                        <Input placeholder="输入已完成的任务" />
                      </Form.Item>
                      <Button type="text" danger onClick={() => remove(name)}>删除</Button>
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} block>
                    添加已完成任务
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item label="计划任务">
            <Form.List name="plannedTasks">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item {...restField} name={name} noStyle>
                        <Input placeholder="输入明天的计划任务" />
                      </Form.Item>
                      <Button type="text" danger onClick={() => remove(name)}>删除</Button>
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} block>
                    添加计划任务
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item name="problems" label="遇到的问题">
            <TextArea rows={3} placeholder="描述遇到的问题或需要的支持（可选）" />
          </Form.Item>

          <Form.Item name="ccUsers" label="抄送给">
            <Select
              mode="multiple"
              placeholder="选择抄送人员"
              allowClear
              options={users
                .filter(u => u.id !== currentUser?.id)
                .map(u => ({ label: u.name, value: u.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 日报详情弹窗 */}
      <Modal
        title="日报详情"
        open={isDetailOpen}
        onCancel={() => setIsDetailOpen(false)}
        footer={null}
        width={600}
      >
        {selectedReport && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="提交人">{selectedReport.user_name}</Descriptions.Item>
            <Descriptions.Item label="日期">{selectedReport.report_date}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusMap[selectedReport.status]?.color}>
                {statusMap[selectedReport.status]?.text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="工作内容">
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{selectedReport.content}</pre>
            </Descriptions.Item>
            
            {selectedReport.completed_tasks?.length > 0 && (
              <Descriptions.Item label="已完成任务">
                <Space direction="vertical">
                  {selectedReport.completed_tasks.map((task, idx) => (
                    <Tag key={idx} color="success">{task}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
            
            {selectedReport.planned_tasks?.length > 0 && (
              <Descriptions.Item label="计划任务">
                <Space direction="vertical">
                  {selectedReport.planned_tasks.map((task, idx) => (
                    <Tag key={idx} color="processing">{task}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
            
            {selectedReport.problems && (
              <Descriptions.Item label="遇到的问题">{selectedReport.problems}</Descriptions.Item>
            )}
            
            {selectedReport.cc_users?.length > 0 && (
              <Descriptions.Item label="抄送人">
                <Space>
                  {selectedReport.cc_users.map((uid) => {
                    const u = users.find(user => user.id === uid)
                    return <Tag key={uid}>{u?.name || uid}</Tag>
                  })}
                </Space>
              </Descriptions.Item>
            )}
            
            {selectedReport.submit_time && (
              <Descriptions.Item label="提交时间">{dayjs(selectedReport.submit_time).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            )}
            
            <Descriptions.Item label="创建时间">{dayjs(selectedReport.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
