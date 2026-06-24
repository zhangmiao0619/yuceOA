// @ts-nocheck
import { useState } from 'react'
import { 
  Card, Tabs, Table, Tag, Statistic, Row, Col, DatePicker,
  Progress, Empty, Select, Button, Space, message
} from 'antd'
import { 
  PieChartOutlined, BarChartOutlined, TeamOutlined,
  ProjectOutlined, CheckSquareOutlined, FileTextOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Pie, Column, Line } from '@ant-design/plots'
import api from '../lib/api'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker

export default function Reports() {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined)

  const exportToCSV = (data: any[], filename: string, headers: Record<string, string>) => {
    if (!data || data.length === 0) {
      message.warning('没有数据可导出')
      return
    }
    
    const headerLabels = Object.keys(headers)
    const headerNames = Object.values(headers)
    
    const rows = data.map(item => 
      headerLabels.map(key => {
        let value = item[key]
        if (value === null || value === undefined) return ''
        if (typeof value === 'object') return JSON.stringify(value)
        return String(value)
      }).join(',')
    )
    
    const csv = [headerNames.join(','), ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}_${dayjs().format('YYYYMMDD')}.csv`
    link.click()
    message.success('导出成功')
  }

  const handleExportProjects = () => {
    exportToCSV(projectReport?.data || [], '项目报表', {
      name: '项目名称',
      status: '状态',
      progress: '进度',
      totalTasks: '总任务数',
      completedTasks: '已完成任务',
      completionRate: '完成率',
      totalHours: '总工时'
    })
  }

  const handleExportWorkload = () => {
    exportToCSV(workloadReport?.data || [], '员工工时', {
      name: '姓名',
      department: '部门',
      totalHours: '总工时',
      completedTasks: '已完成任务',
      inProgressTasks: '进行中任务',
      pendingTasks: '待办任务'
    })
  }

  // 获取项目列表
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects')
  })

  // 项目报表
  const { data: projectReport, isLoading: projectLoading } = useQuery({
    queryKey: ['report-projects'],
    queryFn: () => api.get('/reports/projects')
  })

  // 任务报表
  const { data: taskReport, isLoading: taskLoading } = useQuery({
    queryKey: ['report-tasks', selectedProject],
    queryFn: () => api.get(`/reports/tasks?projectId=${selectedProject || ''}`)
  })

  // 员工工作量
  const { data: workloadReport, isLoading: workloadLoading } = useQuery({
    queryKey: ['report-workload'],
    queryFn: () => api.get('/reports/workload')
  })

  // 审批统计
  const { data: workflowReport, isLoading: workflowLoading } = useQuery({
    queryKey: ['report-workflows'],
    queryFn: () => api.get('/reports/workflows')
  })

  // 项目报表列
  const projectColumns = [
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          draft: 'default',
          assigned: 'cyan',
          in_progress: 'processing',
          paused: 'warning',
          completed: 'success',
          archived: 'default'
        }
        const labels: Record<string, string> = {
          draft: '草稿',
          assigned: '已分配',
          in_progress: '进行中',
          paused: '已暂停',
          completed: '已完成',
          archived: '已归档'
        }
        return <Tag color={colors[status]}>{labels[status]}</Tag>
      }
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => (
        <Progress percent={progress} size="small" />
      )
    },
    {
      title: '任务',
      key: 'tasks',
      render: (_: any, record: any) => `${record.completedTasks}/${record.totalTasks}`
    },
    {
      title: '完成率',
      dataIndex: 'completionRate',
      key: 'completionRate',
      render: (rate: number) => <Tag color={rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'error'}>{rate}%</Tag>
    },
    {
      title: '工时',
      key: 'hours',
      render: (_: any, record: any) => `${record.totalHours}h`
    }
  ]

  // 员工工作量列
  const workloadColumns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      render: (dept: string) => dept || '-'
    },
    {
      title: '总工时',
      dataIndex: 'totalHours',
      key: 'totalHours',
      sorter: (a: any, b: any) => a.totalHours - b.totalHours
    },
    {
      title: '任务统计',
      key: 'tasks',
      render: (_: any, record: any) => (
        <div>
          <Tag color="success">完成 {record.completedTasks}</Tag>
          <Tag color="processing">进行中 {record.inProgressTasks}</Tag>
          <Tag>待办 {record.pendingTasks}</Tag>
        </div>
      )
    }
  ]

  // 任务状态饼图配置
  const taskStatusPieConfig = taskReport?.data?.statusCount ? {
    data: Object.entries(taskReport.data.statusCount).map(([key, value]) => ({
      type: { todo: '待办', in_progress: '进行中', review: '审核中', done: '已完成', cancelled: '已取消' }[key] || key,
      value
    })),
    angleField: 'value',
    colorField: 'type',
    label: {
      text: 'value',
      style: { fontWeight: 'bold' }
    },
    legend: { position: 'right' }
  } : null

  // 任务优先级饼图配置
  const taskPriorityPieConfig = taskReport?.data?.priorityCount ? {
    data: Object.entries(taskReport.data.priorityCount).map(([key, value]) => ({
      type: { low: '低', medium: '中', high: '高', urgent: '紧急' }[key] || key,
      value
    })),
    angleField: 'value',
    colorField: 'type',
    color: ['#52c41a', '#1890ff', '#faad14', '#ff4d4f'],
    label: {
      text: 'value',
      style: { fontWeight: 'bold' }
    },
    legend: { position: 'right' }
  } : null

  // 审批类型柱状图
  const workflowColumnConfig = workflowReport?.data?.typeStats ? {
    data: Object.entries(workflowReport.data.typeStats).map(([type, count]) => ({
      type: { leave: '请假', expense: '报销', purchase: '采购' }[type] || type,
      count
    })),
    xField: 'type',
    yField: 'count',
    label: { text: 'count' }
  } : null

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>报表中心</h2>
        <RangePicker onChange={(dates) => setDateRange(dates as any)} />
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="项目总数"
              value={projectReport?.data?.length || 0}
              prefix={<ProjectOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="任务总数"
              value={taskReport?.data?.total || 0}
              prefix={<CheckSquareOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总工时"
              value={taskReport?.data?.totalHours || 0}
              suffix="h"
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="审批总数"
              value={workflowReport?.data?.total || 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'projects',
            label: '项目报表',
            children: (
              <Card>
                <Space style={{ marginBottom: 16 }}>
                  <Button icon={<DownloadOutlined />} onClick={handleExportProjects}>
                    导出项目报表
                  </Button>
                </Space>
                <Table
                  columns={projectColumns}
                  dataSource={projectReport?.data}
                  loading={projectLoading}
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
            )
          },
          {
            key: 'tasks',
            label: '任务统计',
            children: (
              <div>
                <Card style={{ marginBottom: 16 }}>
                  <Select
                    placeholder="筛选项目"
                    allowClear
                    style={{ width: 200 }}
                    onChange={setSelectedProject}
                  >
                    {projects?.data?.map((p: any) => (
                      <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
                    ))}
                  </Select>
                </Card>
                
                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="任务状态分布">
                      {taskStatusPieConfig ? (
                        <Pie {...taskStatusPieConfig} height={300} />
                      ) : (
                        <Empty />
                      )}
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="任务优先级分布">
                      {taskPriorityPieConfig ? (
                        <Pie {...taskPriorityPieConfig} height={300} />
                      ) : (
                        <Empty />
                      )}
                    </Card>
                  </Col>
                </Row>

                {taskReport?.data?.overdueCount > 0 && (
                  <Card title={`逾期任务 (${taskReport.data.overdueCount})`} style={{ marginTop: 16 }}>
                    <div style={{ color: '#ff4d4f' }}>
                      有 {taskReport.data.overdueCount} 个任务已逾期，请及时处理！
                    </div>
                  </Card>
                )}
              </div>
            )
          },
          {
            key: 'workload',
            label: '员工工作量',
            children: (
              <Card>
                <Space style={{ marginBottom: 16 }}>
                  <Button icon={<DownloadOutlined />} onClick={handleExportWorkload}>
                    导出工时报表
                  </Button>
                </Space>
                <Table
                  columns={workloadColumns}
                  dataSource={workloadReport?.data}
                  loading={workloadLoading}
                  rowKey="userId"
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
            )
          },
          {
            key: 'workflows',
            label: '审批统计',
            children: (
              <Row gutter={16}>
                <Col span={12}>
                  <Card title="审批类型分布">
                    {workflowColumnConfig ? (
                      <Column {...workflowColumnConfig} height={300} />
                    ) : (
                      <Empty />
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="审批状态统计">
                    <div style={{ padding: 20 }}>
                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Statistic 
                            title="审批中" 
                            value={workflowReport?.data?.statusCount?.pending || 0}
                            valueStyle={{ color: '#1890ff' }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic 
                            title="已通过" 
                            value={workflowReport?.data?.statusCount?.approved || 0}
                            valueStyle={{ color: '#52c41a' }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic 
                            title="已拒绝" 
                            value={workflowReport?.data?.statusCount?.rejected || 0}
                            valueStyle={{ color: '#ff4d4f' }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic 
                            title="平均审批时长" 
                            value={workflowReport?.data?.avgDurationHours || 0}
                            suffix="小时"
                          />
                        </Col>
                      </Row>
                    </div>
                  </Card>
                </Col>
              </Row>
            )
          }
        ]}
      />
    </div>
  )
}
