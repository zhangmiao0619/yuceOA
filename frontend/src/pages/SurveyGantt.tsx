// @ts-nocheck
import { useState, useEffect } from 'react'
import { Card, Row, Col, Progress, Table, Tag, Spin, Empty, Space, Statistic, message } from 'antd'
import {
  BarChartOutlined, ProjectOutlined, CheckCircleOutlined, ClockCircleOutlined,
  PlayCircleOutlined, PauseCircleOutlined, PlusCircleOutlined,
} from '@ant-design/icons'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import api from '../lib/api'
import dayjs from 'dayjs'

const STATUS_CFG = {
  draft:       { color: '#d9d9d9', text: '草稿' },
  assigned:    { color: '#1890ff', text: '已指派' },
  in_progress: { color: '#52c41a', text: '进行中' },
  paused:      { color: '#faad14', text: '已暂停' },
  completed:   { color: '#1677ff', text: '已完成' },
  archived:    { color: '#d9d9d9', text: '已归档' },
}

const PIE_COLORS = ['#d9d9d9', '#1890ff', '#52c41a', '#faad14', '#1677ff', '#d9d9d9']

export default function SurveyGantt() {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState([])

  useEffect(() => {
    let mounted = true
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [projRes] = await Promise.all([
          api.get('/projects', { params: { pageSize: 999 } }).catch(() => null),
        ])
        if (!mounted) return
        const list = projRes?.data?.list || []
        setProjects(list)
      } catch (e) {
        message.error('获取数据失败')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchAll()
    return () => { mounted = false }
  }, [])

  const safe = (arr) => (Array.isArray(arr) ? arr : [])

  // ── 按状态统计 ──
  const statusCounts = {}
  projects.forEach(p => {
    const s = p.status || 'unknown'
    statusCounts[s] = (statusCounts[s] || 0) + 1
  })

  const total = projects.length
  const active = projects.filter(p => p.status === 'in_progress').length
  const completed = projects.filter(p => p.status === 'completed').length
  const paused = projects.filter(p => p.status === 'paused').length
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  // ── 饼图数据 ──
  const pieData = Object.entries(statusCounts).map(([k, v]) => ({
    name: STATUS_CFG[k]?.text || k,
    value: v,
    color: STATUS_CFG[k]?.color || '#d9d9d9',
  }))

  // ── 月度柱状图 ──
  const monthMap = {}
  projects.forEach(p => {
    if (!p.created_at) return
    const m = dayjs(p.created_at).format('YYYY-MM')
    monthMap[m] = (monthMap[m] || 0) + 1
  })
  const barData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, count]) => ({ month: month.slice(5), count }))

  // ── 解析 members JSON ──
  const parseMembers = (val) => {
    if (!val) return []
    if (Array.isArray(val)) return val
    try { return JSON.parse(val) } catch { return [] }
  }

  // ── 项目进度表格 ──
  const projectColumns = [
    {
      title: '项目名称', dataIndex: 'name', key: 'name', width: 200,
      render: v => v || '-',
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: s => {
        const cfg = STATUS_CFG[s] || { text: s || '—', color: 'default' }
        return <Tag color={cfg.color}>{cfg.text}</Tag>
      },
    },
    {
      title: '负责人', key: 'owner', width: 100,
      render: (_, r) => r?.owner?.name || r?.owner_name || '-',
    },
    {
      title: '项目成员', key: 'members', width: 160,
      render: (_, r) => {
        const members = parseMembers(r.members)
        if (!members.length) return '-'
        return members.map(m => m?.name || m).join(', ')
      },
    },
    {
      title: '进度', key: 'progress', width: 200,
      render: (_, record) => {
        if (!record) return null
        const pct = ['completed', 'archived'].includes(record.status) ? 100
          : record.status === 'in_progress' ? 55
          : record.status === 'assigned' ? 15
          : 0
        const color = record.status === 'completed' ? '#52c41a'
          : record.status === 'archived' ? '#d9d9d9'
          : record.status === 'in_progress' ? '#1890ff'
          : '#faad14'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress percent={pct} size="small" strokeColor={color} style={{ flex: 1, margin: 0 }} />
            <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>{pct}%</span>
          </div>
        )
      },
    },
    {
      title: '时间线', key: 'timeline', width: 320,
      render: (_, record) => {
        if (!record) return null
        const start = record.created_at ? dayjs(record.created_at) : null
        const end = record.end_date ? dayjs(record.end_date)
          : record.status === 'completed' || record.status === 'archived'
            ? dayjs().subtract(1, 'day')
            : dayjs().add(30, 'day')
        if (!start) return <span style={{ color: '#999' }}>—</span>
        const daysTotal = Math.max(1, end.diff(start, 'day'))
        const daysElapsed = dayjs().diff(start, 'day')
        const pct = Math.min(100, Math.round((daysElapsed / daysTotal) * 100))
        const barColor = pct >= 100 ? '#52c41a' : '#1890ff'
        return (
          <div style={{ position: 'relative', height: 24, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`,
              background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`, borderRadius: 4,
              transition: 'width 0.3s',
            }} />
            <span style={{
              position: 'absolute', left: 8, top: 3, fontSize: 11,
              color: pct > 50 ? '#fff' : '#666', whiteSpace: 'nowrap',
            }}>
              {start.format('YYYY/MM/DD')} → {end.format('YYYY/MM/DD')}
            </span>
          </div>
        )
      },
    },
    {
      title: '客户', dataIndex: 'client_short_name', key: 'client', width: 120,
      render: v => v || '-',
    },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      {/* ── 统计卡片 ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card hoverable>
            <Statistic title="项目总数" value={total} prefix={<ProjectOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable>
            <Statistic title="进行中" value={active} prefix={<PlayCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable>
            <Statistic title="已完成" value={completed} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#1677ff' }} />
            <Progress percent={completionRate} size="small" strokeColor="#1677ff" style={{ marginTop: 8 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable>
            <Statistic title="已暂停" value={paused} prefix={<PauseCircleOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
      </Row>

      {/* ── 图表行 ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card title="项目状态分布" bodyStyle={{ padding: '16px 8px 8px' }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name} ${value}`}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty description="暂无数据" />}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="月度项目创建趋势" bodyStyle={{ padding: '16px 8px 8px' }}>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="项目数" fill="#1890ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description="暂无数据" />}
          </Card>
        </Col>
      </Row>

      {/* ── 项目进度明细表 ── */}
      <Card title={<span><BarChartOutlined /> 项目进度明细</span>}>
        <Table
          columns={projectColumns}
          dataSource={projects}
          rowKey="id"
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 个项目` }}
          scroll={{ x: 'max-content' }}
          size="middle"
          locale={{ emptyText: <Empty description="暂无项目数据" /> }}
        />
      </Card>
    </div>
  )
}
