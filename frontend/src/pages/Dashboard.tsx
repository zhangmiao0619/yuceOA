// @ts-nocheck
import { Card, Row, Col, List, Tag, Button, Badge, Spin } from 'antd'
import {
  ProjectOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  FileDoneOutlined
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'

interface DashboardStats {
  projects: {
    total: number
    active: number
    completed: number
  }
  tasks: {
    total: number
    todo: number
    inProgress: number
    done: number
  }
  workflows: {
    pending: number
    myApplied: number
  }
  timeTracking: {
    todayHours: number
    weekHours: number
  }
}

interface RecentTask {
  id: string
  title: string
  priority: string
  dueDate: string
  projectName: string
  status: string
}

interface PendingWorkflow {
  id: string
  title: string
  applicantId: string
  createdAt: string
  formData: {
    taskTitle?: string
    taskId?: string
    projectId?: string
    reason?: string
  }
  definition: {
    type: string
    name: string
  }
}

export default function Dashboard() {
  // 获取统计数据
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    retry: false,
    queryFn: async () => {
      try {
        const [projectsRes, tasksRes, workflowsRes, timeRes] = await Promise.allSettled([
          api.get('/projects/stats'),
          api.get('/tasks/stats'),
          api.get('/workflows/stats'),
          api.get('/time-entries/stats/today')
        ])
        
        return {
          projects: projectsRes.status === 'fulfilled' ? projectsRes.value.data || { total: 0, active: 0, completed: 0 } : { total: 0, active: 0, completed: 0 },
          tasks: tasksRes.status === 'fulfilled' ? tasksRes.value.data || { total: 0, todo: 0, inProgress: 0, done: 0 } : { total: 0, todo: 0, inProgress: 0, done: 0 },
          workflows: workflowsRes.status === 'fulfilled' ? workflowsRes.value.data || { pending: 0, myApplied: 0 } : { pending: 0, myApplied: 0 },
          timeTracking: timeRes.status === 'fulfilled' ? timeRes.value.data || { todayHours: 0, weekHours: 0 } : { todayHours: 0, weekHours: 0 }
        }
      } catch (e) {
        return {
          projects: { total: 0, active: 0, completed: 0 },
          tasks: { total: 0, todo: 0, inProgress: 0, done: 0 },
          workflows: { pending: 0, myApplied: 0 },
          timeTracking: { todayHours: 0, weekHours: 0 }
        }
      }
    },
    refetchInterval: 60000 // 每分钟刷新
  })

// 获取待签收项目
const { data: pendingClaimProjects, isLoading: projectsLoading } = useQuery<any[]>({
  queryKey: ['pendingClaimProjects', 'dashboard'],
  queryFn: async () => {
    const res = await api.get('/projects/pending-claim')
    return res.data || []
  }
})

  // 获取待审批事项
  const { data: pendingWorkflows, isLoading: workflowsLoading } = useQuery<PendingWorkflow[]>({
    queryKey: ['pendingWorkflows', 'dashboard'],
    queryFn: async () => {
      const res = await api.get('/workflows/instances?type=pending&limit=5')
      return res.data?.list || res.data || []
    }
  })

  // 获取即将到期的任务
  const { data: upcomingTasks, isLoading: upcomingLoading } = useQuery<RecentTask[]>({
    queryKey: ['upcomingTasks', 'dashboard'],
    queryFn: async () => {
      const res = await api.get('/tasks?assigneeId=me&status=todo&upcoming=true&limit=5')
      return res.data?.list || res.data || []
    }
  })

  const pendingClaimCount = (pendingClaimProjects || []).reduce((sum: number, p: any) => sum + (p.pending_count || 0), 0)

  const statCards = [
    {
      title: '进行中的项目',
      value: stats?.projects?.active || 0,
      total: stats?.projects?.total || 0,
      icon: <ProjectOutlined />,
      link: '/projects',
      color: '#1890ff'
    },
    {
      title: '待签收',
      value: pendingClaimCount,
      icon: <CheckCircleOutlined />,
      link: '/projects?tab=pending-claim',
      color: '#52c41a'
    },
    {
      title: '待审批',
      value: stats?.workflows?.pending || 0,
      badge: stats?.workflows?.pending ? { count: stats.workflows.pending, color: '#ff4d4f' } : null,
      icon: <FileTextOutlined />,
      link: '/workflows?tab=pending-review',
      color: '#fa8c16'
    },
    {
      title: '今日工时',
      value: `${stats?.timeTracking?.todayHours || 0}h`,
      weekTotal: `${stats?.timeTracking?.weekHours || 0}h`,
      icon: <ClockCircleOutlined />,
      link: '/time-tracking',
      color: '#722ed1'
    }
  ]

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px' }}>
      <h2 style={{ marginBottom: 24 }}>工作台</h2>
      
      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        {statCards.map((card, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Link to={card.link}>
              <Card 
                hoverable 
                style={{ height: '100%' }}
                bodyStyle={{ padding: '20px 24px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ color: '#8c8c8c', fontSize: 14, marginBottom: 8 }}>
                      {card.title}
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 'bold', color: card.color }}>
                      {card.badge ? (
                        <Badge count={card.badge.count} style={{ backgroundColor: card.badge.color }}>
                          <span style={{ marginRight: 8 }}>{card.value}</span>
                        </Badge>
                      ) : (
                        card.value
                      )}
                    </div>
                    {card.total !== undefined && card.total > 0 && (
                      <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
                        总计 {card.total}
                      </div>
                    )}
                    {card.weekTotal && (
                      <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
                        本周 {card.weekTotal}
                      </div>
                    )}
                  </div>
                  <div style={{ 
                    fontSize: 48, 
                    color: card.color,
                    opacity: 0.2
                  }}>
                    {card.icon}
                  </div>
                </div>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>

      {/* 快捷入口 */}
      <Card style={{ marginTop: 24 }} title="快捷入口">
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} lg={4}>
            <Link to="/projects?action=new">
              <Button block size="large" icon={<ProjectOutlined />} type="primary">
                新建项目
              </Button>
            </Link>
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Link to="/users?view=timeTracking">
              <Button block size="large" icon={<ClockCircleOutlined />}>
                工时打卡
              </Button>
            </Link>
          </Col>
        </Row>
      </Card>

      {/* 待办任务和审批 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <CheckCircleOutlined style={{ marginRight: 8, color: '#52c41a' }} />
                待我签收
              </span>
            }
            extra={<Link to="/projects?tab=pending-claim"><Button type="link">查看全部</Button></Link>}
          >
            {projectsLoading ? (
              <Spin />
            ) : pendingClaimProjects?.length > 0 ? (
              <List
                dataSource={pendingClaimProjects}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Link to={`/projects`} style={{ color: 'inherit' }}>
                          <span>
                            <ProjectOutlined style={{ marginRight: 8 }} />
                            {item.name || item.short_name || item.id}
                          </span>
                        </Link>
                      }
                      description={
                        <div>
                          <span style={{ color: '#fa8c16' }}>
                            {item.pending_count} 个子任务待签收
                          </span>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                <CheckCircleOutlined style={{ fontSize: 48, opacity: 0.3 }} />
                <p>暂无待签收项目</p>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <FileTextOutlined style={{ marginRight: 8, color: '#fa8c16' }} />
                待我审批
                {stats?.workflows?.pending > 0 && (
                  <Badge count={stats.workflows.pending} style={{ marginLeft: 8, backgroundColor: '#ff4d4f' }} />
                )}
              </span>
            }
            extra={<Link to="/workflows"><Button type="link">查看全部</Button></Link>}
          >
            {workflowsLoading ? (
              <Spin />
            ) : pendingWorkflows?.length > 0 ? (
              <List
                dataSource={pendingWorkflows}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Link to={`/workflows?tab=pending-review&instanceId=${item.id}`} style={{ color: 'inherit' }}>
                          {item.formData?.taskTitle || item.title}
                        </Link>
                      }
                      description={
                        <div>
                          <Tag color={item.definition?.type === 'subtask_delete' ? 'red' : 'processing'}>
                            {item.definition?.name || item.definition?.type || '审批'}
                          </Tag>
                          {item.formData?.reason && (
                            <div style={{ color: '#8c8c8c', marginTop: 4, fontSize: 12 }}>
                              原因: {item.formData.reason}
                            </div>
                          )}
                          <div style={{ color: '#8c8c8c', marginTop: 2, fontSize: 12 }}>
                            {dayjs(item.createdAt).fromNow()}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                <FileDoneOutlined style={{ fontSize: 48, opacity: 0.3 }} />
                <p>暂无待审批事项</p>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 即将到期 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card
            title={
              <span>
                <ClockCircleOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
                即将到期
              </span>
            }
          >
            {upcomingLoading ? (
              <Spin />
            ) : upcomingTasks?.length > 0 ? (
              <List
                dataSource={upcomingTasks}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Link to={`/tasks/${item.id}`}><Button type="link">查看</Button></Link>
                    ]}
                  >
                    <List.Item.Meta
                      title={item.title}
                      description={
                        <div>
                          <Tag color={getPriorityColor(item.priority)}>{getPriorityText(item.priority)}</Tag>
                          <span style={{ color: '#ff4d4f' }}>
                            截止: {dayjs(item.dueDate).format('YYYY-MM-DD')}
                          </span>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#8c8c8c' }}>
                近期无到期任务
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

function getPriorityColor(priority: string) {
  const map: Record<string, string> = {
    low: 'default',
    medium: 'blue',
    high: 'orange',
    urgent: 'red'
  }
  return map[priority] || 'default'
}

function getPriorityText(priority: string) {
  const map: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
    urgent: '紧急'
  }
  return map[priority] || priority
}

function isOverdue(dueDate: string) {
  return dayjs(dueDate).isBefore(dayjs(), 'day')
}
