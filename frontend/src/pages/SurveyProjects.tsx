// @ts-nocheck
import { useState, useEffect } from 'react'
import { Card, Table, Tag, Progress, Button, Modal, Form, Input, Select, DatePicker, message, Tabs, Timeline, Descriptions } from 'antd'
import { useParams } from 'react-router-dom'
import api from '../lib/api'
import moment from 'moment'

const { Option } = Select

// 项目类型选项
const PROJECT_TYPES = [
  { value: 'topographic', label: '地形测量', color: 'blue' },
  { value: 'engineering', label: '工程测量', color: 'green' },
  { value: 'real_estate', label: '不动产测绘', color: 'orange' },
  { value: 'boundary', label: '界线测绘', color: 'purple' },
  { value: 'aerial', label: '航空摄影', color: 'cyan' },
  { value: 'uav', label: '无人机测绘', color: 'geekblue' },
  { value: 'lidar', label: '激光雷达', color: 'magenta' },
  { value: 'hydrographic', label: '海洋测绘', color: 'volcano' },
  { value: 'geophysical', label: '物探测量', color: 'gold' },
]

// 工序状态标签
const STAGE_STATUS_MAP: Record<string, { color: string; text: string }> = {
  pending: { color: 'default', text: '待开始' },
  in_progress: { color: 'processing', text: '进行中' },
  completed: { color: 'success', text: '已完成' },
  cancelled: { color: 'error', text: '已取消' },
}

export default function SurveyProjects() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [stages, setStages] = useState<any[]>([])
  const [form] = Form.useForm()
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 })

  const fetchProjects = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res: any = await api.get('/survey/projects', { params: { page, pageSize } })
      if (res.success) {
        setProjects(res.data)
        setPagination({ current: page, pageSize, total: res.total || res.data.length })
      }
    } catch (error) {
      message.error('获取项目列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleTableChange = (paginationConfig: any) => {
    fetchProjects(paginationConfig.current, paginationConfig.pageSize)
  }

  // 获取项目详情
  const fetchProjectDetail = async (projectId: string) => {
    try {
      const res: any = await api.get(`/survey/projects/${projectId}`)
      if (res.success) {
        setSelectedProject(res.data)
        setStages(res.data.stages || [])
        setDetailModalVisible(true)
      }
    } catch (error) {
      message.error('获取项目详情失败')
    }
  }

  // 创建项目
  const handleCreate = async (values: any) => {
    try {
      const res: any = await api.post('/survey/projects', {
        ...values,
        plannedStartDate: values.plannedStartDate?.format('YYYY-MM-DD'),
        plannedEndDate: values.plannedEndDate?.format('YYYY-MM-DD'),
      })
      if (res.success) {
        message.success('创建成功')
        setModalVisible(false)
        form.resetFields()
        fetchProjects()
      }
    } catch (error) {
      message.error('创建失败')
    }
  }

  // 更新工序状态
  const handleStageUpdate = async (stageId: string, values: any) => {
    try {
      const res: any = await api.put(`/survey/stages/${stageId}`, values)
      if (res.success) {
        message.success('更新成功')
        // 刷新项目详情
        if (selectedProject) {
          fetchProjectDetail(selectedProject.id)
        }
      }
    } catch (error) {
      message.error('更新失败')
    }
  }

  useEffect(() => {
    fetchProjects(pagination.current, pagination.pageSize)
  }, [])

  const columns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <Button type="link" onClick={() => fetchProjectDetail(record.id)}>
          {text}
        </Button>
      ),
    },
    {
      title: '项目类型',
      dataIndex: ['surveyInfo', 'projectType'],
      key: 'projectType',
      render: (type: string) => {
        const config = PROJECT_TYPES.find(t => t.value === type)
        return <Tag color={config?.color}>{config?.label || type}</Tag>
      },
    },
    {
      title: '委托单位',
      dataIndex: ['surveyInfo', 'clientName'],
      key: 'clientName',
    },
    {
      title: '合同金额',
      dataIndex: ['surveyInfo', 'contractAmount'],
      key: 'contractAmount',
      render: (amount: number) => amount ? `¥${amount.toLocaleString()}` : '-',
    },
    {
      title: '当前工序',
      dataIndex: ['surveyInfo', 'currentStage'],
      key: 'currentStage',
      render: (stage: string) => stage || '未开始',
    },
    {
      title: '整体进度',
      dataIndex: ['surveyInfo', 'stageProgress'],
      key: 'progress',
      render: (progress: number) => (
        <Progress percent={progress || 0} size="small" />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          assigned: { color: 'default', text: '已分配' },
          in_progress: { color: 'processing', text: '进行中' },
          completed: { color: 'success', text: '已完成' },
        }
        const config = statusMap[status]
        return <Tag color={config?.color}>{config?.text}</Tag>
      },
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="测绘项目管理"
        extra={
          <Button type="primary" onClick={() => setModalVisible(true)}>
            新建测绘项目
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={projects}
          loading={loading}
          rowKey="id"
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
      </Card>

      {/* 创建项目模态框 */}
      <Modal
        title="新建测绘项目"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={800}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
            <Input placeholder="请输入项目名称" />
          </Form.Item>
          <Form.Item name="projectType" label="项目类型" rules={[{ required: true }]}>
            <Select placeholder="选择项目类型">
              {PROJECT_TYPES.map(type => (
                <Option key={type.value} value={type.value}>{type.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="contractNumber" label="合同编号">
            <Input placeholder="如：CH-2026-001" />
          </Form.Item>
          <Form.Item name="clientName" label="委托单位">
            <Input placeholder="委托单位名称" />
          </Form.Item>
          <Form.Item name="clientContact" label="联系人">
            <Input placeholder="联系人姓名" />
          </Form.Item>
          <Form.Item name="clientPhone" label="联系电话">
            <Input placeholder="联系电话" />
          </Form.Item>
          <Form.Item name="location" label="项目地点">
            <Input placeholder="项目所在地点" />
          </Form.Item>
          <Form.Item name="areaSize" label="测区面积">
            <Input placeholder="如：20平方公里" />
          </Form.Item>
          <Form.Item name="scale" label="测图比例尺">
            <Input placeholder="如：1:500" />
          </Form.Item>
          <Form.Item name="accuracy" label="精度要求">
            <Input placeholder="如：图上0.1mm" />
          </Form.Item>
          <Form.Item name="coordinateSystem" label="坐标系统">
            <Input placeholder="如：CGCS2000" />
          </Form.Item>
          <Form.Item name="elevationSystem" label="高程系统">
            <Input placeholder="如：1985国家高程基准" />
          </Form.Item>
          <Form.Item name="contractAmount" label="合同金额（元）" rules={[{ type: 'number', min: 0, message: '金额不能为负数' }]}>
            <Input type="number" placeholder="合同金额" min={0} />
          </Form.Item>
          <Form.Item name="plannedStartDate" label="计划开始日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="plannedEndDate"
            label="计划结束日期"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const startDate = getFieldValue('plannedStartDate')
                  if (!value || !startDate || !value.isBefore(startDate, 'day')) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('结束日期不能早于开始日期'))
                }
              })
            ]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea rows={3} placeholder="项目描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 项目详情模态框 */}
      <Modal
        title="项目详情"
        visible={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={1000}
      >
        {selectedProject && (
          <Tabs defaultActiveKey="1" items={[
            { key: '1', label: '基本信息', children: (
              <>
                <Descriptions bordered column={2}>
                  <Descriptions.Item label="项目名称">{selectedProject.name}</Descriptions.Item>
                  <Descriptions.Item label="项目类型">
                    {PROJECT_TYPES.find(t => t.value === selectedProject.surveyInfo?.projectType)?.label}
                  </Descriptions.Item>
                  <Descriptions.Item label="合同编号">{selectedProject.surveyInfo?.contractNumber}</Descriptions.Item>
                  <Descriptions.Item label="委托单位">{selectedProject.surveyInfo?.clientName}</Descriptions.Item>
                  <Descriptions.Item label="联系人">{selectedProject.surveyInfo?.clientContact}</Descriptions.Item>
                  <Descriptions.Item label="联系电话">{selectedProject.surveyInfo?.clientPhone}</Descriptions.Item>
                  <Descriptions.Item label="项目地点">{selectedProject.surveyInfo?.location}</Descriptions.Item>
                  <Descriptions.Item label="测区面积">{selectedProject.surveyInfo?.areaSize}</Descriptions.Item>
                  <Descriptions.Item label="比例尺">{selectedProject.surveyInfo?.scale}</Descriptions.Item>
                  <Descriptions.Item label="精度要求">{selectedProject.surveyInfo?.accuracy}</Descriptions.Item>
                  <Descriptions.Item label="坐标系统">{selectedProject.surveyInfo?.coordinateSystem}</Descriptions.Item>
                  <Descriptions.Item label="高程系统">{selectedProject.surveyInfo?.elevationSystem}</Descriptions.Item>
                  <Descriptions.Item label="合同金额">¥{selectedProject.surveyInfo?.contractAmount?.toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="已收款">¥{selectedProject.surveyInfo?.receivedAmount?.toLocaleString()}</Descriptions.Item>
                </Descriptions>
              </>
            ) },
            { key: '2', label: '工序管理', children: (
              <>
                <Card title="工序进度" extra={<Tag color="blue">共 {stages.length} 道工序</Tag>}>
                  <Timeline mode="left">
                    {stages.map((stage: any, index: number) => (
                      <Timeline.Item
                        key={stage.id}
                        color={stage.status === 'completed' ? 'green' : stage.status === 'in_progress' ? 'blue' : 'gray'}
                        label={`第${index + 1}步`}
                      >
                        <Card size="small" style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong>{stage.stageName}</strong>
                              <Tag color={STAGE_STATUS_MAP[stage.status]?.color} style={{ marginLeft: 8 }}>
                                {STAGE_STATUS_MAP[stage.status]?.text}
                              </Tag>
                            </div>
                            <Progress percent={stage.progress || 0} size="small" style={{ width: 100 }} />
                          </div>
                          <p style={{ margin: '8px 0', color: '#666' }}>{stage.description}</p>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Select
                              value={stage.status}
                              style={{ width: 120 }}
                              onChange={(value) => handleStageUpdate(stage.id, { status: value })}
                            >
                              <Option value="pending">待开始</Option>
                              <Option value="in_progress">进行中</Option>
                              <Option value="completed">已完成</Option>
                            </Select>
                            <Input
                              type="number"
                              value={stage.progress || 0}
                              style={{ width: 80 }}
                              onChange={(e) => handleStageUpdate(stage.id, { progress: parseInt(e.target.value) })}
                              suffix="%"
                            />
                          </div>
                        </Card>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </Card>
              </>
            ) },
            { key: '3', label: '甘特图', children: (
              <>
                <Card title="项目甘特图">
                  <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>
                    <p>甘特图可视化区域</p>
                    <p>建议集成 dhtmlx-gantt 或 gantt-task-react 组件</p>
                    <p>后端API: GET /api/survey/gantt/{'{projectId}'}</p>
                  </div>
                </Card>
              </>
            ) },
          ]} />
        )}
      </Modal>
    </div>
  )
}
