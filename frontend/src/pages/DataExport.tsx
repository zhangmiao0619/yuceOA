// @ts-nocheck
import { useState, useEffect } from 'react'
import { Card, Table, Button, Select, DatePicker, message, Space, Tabs, Tag } from 'antd'
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import api from '../lib/api'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select

// 导出模块
const EXPORT_MODULES = [
  { value: 'projects', label: '项目管理', endpoint: '/projects' },
  { value: 'tasks', label: '任务管理', endpoint: '/tasks' },
  { value: 'survey-projects', label: '测绘项目', endpoint: '/survey/projects' },
  { value: 'equipment', label: '设备管理', endpoint: '/survey/equipment' },
  { value: 'attendance', label: '考勤记录', endpoint: '/attendance/records' },
  { value: 'workflows', label: '审批流程', endpoint: '/workflows/instances' },
]

// 字段名中英文映射
const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  name: '名称',
  title: '标题',
  description: '描述',
  status: '状态',
  priority: '优先级',
  type: '类型',
  model: '型号',
  serialNumber: '序列号',
  manufacturer: '制造商',
  location: '位置',
  notes: '备注',
  owner: '负责人',
  assignee: '负责人',
  creator: '创建人',
  projectId: '项目ID',
  projectName: '项目名称',
  startDate: '开始日期',
  endDate: '结束日期',
  dueDate: '截止日期',
  createdAt: '创建时间',
  updatedAt: '更新时间',
  progress: '进度',
  members: '成员',
  department: '部门',
  email: '邮箱',
  phone: '电话',
  role: '角色',
  calibrationDate: '检定日期',
  nextCalibrationDate: '下次检定',
  purchaseDate: '购置日期',
  keeper: '保管人',
  stageName: '工序名称',
  stageCode: '工序编号',
  contractNumber: '合同编号',
  clientName: '委托单位',
  contractAmount: '合同金额',
  qualityStatus: '质量状态',
  version: '版本',
  filePath: '文件路径',
  reviewer: '审核人',
  recordDate: '记录日期',
  weather: '天气',
  teamLeader: '组长',
  workContent: '工作内容',
  photos: '照片',
  issues: '问题',
  userId: '用户ID',
  userName: '用户名',
  user: '用户',
  isAdmin: '是否管理员',
  isActive: '是否启用',
  password: '密码',
  avatar: '头像',
  departmentName: '部门名称',
  departmentId: '部门ID',
  wechatUserId: '企微用户ID',
  actualHours: '实际工时',
  estimatedHours: '预估工时',
  tags: '标签',
  attachments: '附件',
  parentId: '父任务ID',
  settings: '设置',
  isArchived: '是否归档',
  projectType: '测绘类型',
  accuracy: '精度',
  scale: '比例尺',
  currentStage: '当前工序',
  stageProgress: '工序进度',
  clientContact: '联系人',
  clientPhone: '联系电话',
  plannedStartDate: '计划开始',
  plannedEndDate: '计划结束',
}

const getFieldLabel = (key: string): string => {
  return FIELD_LABELS[key] || FIELD_LABELS[key.replace(/([A-Z])/g, '_$1').toLowerCase()] || key
}

export default function DataExport() {
  const [loading, setLoading] = useState(false)
  const [selectedModule, setSelectedModule] = useState<string>('projects')
  const [dateRange, setDateRange] = useState<any>(null)
  const [data, setData] = useState<any[]>([])

  // 获取数据
  const fetchData = async () => {
    setLoading(true)
    try {
      let endpoint = EXPORT_MODULES.find(m => m.value === selectedModule)?.endpoint || '/projects'
      
      // 添加日期筛选
      if (dateRange && dateRange.length === 2) {
        const params = new URLSearchParams({
          startDate: dateRange[0].format('YYYY-MM-DD'),
          endDate: dateRange[1].format('YYYY-MM-DD'),
        })
        endpoint += `?${params}`
      }
      
      const res: any = await api.get(endpoint)
      if (res.success) {
        setData(res.data || [])
      }
    } catch (error) {
      message.error('获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedModule])

  // 导出为 CSV
  const handleExportCSV = () => {
    if (data.length === 0) {
      message.warning('没有数据可导出')
      return
    }

    // 获取表头并转换为中文
    const headers = Object.keys(data[0])
    const chineseHeaders = headers.map(h => getFieldLabel(h))
    
    // 生成 CSV 内容
    const csvContent = [
      chineseHeaders.join(','),
      ...data.map(row => 
        headers.map(header => {
          let value = row[header]
          // 处理嵌套对象
          if (value && typeof value === 'object') {
            if (value.name) value = value.name
            else value = JSON.stringify(value)
          }
          // 处理日期
          if (value && typeof value === 'string' && value.includes('T')) {
            value = dayjs(value).format('YYYY-MM-DD HH:mm:ss')
          }
          // 转义逗号和引号
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            value = `"${value.replace(/"/g, '""')}"`
          }
          return value || ''
        }).join(',')
      )
    ].join('\n')

    // 下载文件
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${selectedModule}_${dayjs().format('YYYYMMDD')}.csv`
    link.click()

    message.success('导出成功')
  }

  // 导出为 JSON
  const handleExportJSON = () => {
    if (data.length === 0) {
      message.warning('没有数据可导出')
      return
    }

    const jsonContent = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${selectedModule}_${dayjs().format('YYYYMMDD')}.json`
    link.click()

    message.success('导出成功')
  }

  // 预览表格列
  const getPreviewColumns = () => {
    if (!data || data.length === 0) return []
    
    const firstRow = data[0]
    const keys = Object.keys(firstRow).slice(0, 6) // 只显示前6列
    
    return keys.map((key: string) => ({
      title: getFieldLabel(key),
      dataIndex: key,
      key,
      render: (value: any) => {
        if (value && typeof value === 'object') {
          if (value.name) return value.name
          return JSON.stringify(value).slice(0, 20) + '...'
        }
        if (value && typeof value === 'string' && value.includes('T')) {
          return dayjs(value).format('YYYY-MM-DD')
        }
        return String(value || '-')
      }
    }))
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Tabs defaultActiveKey="export" items={[
          { key: 'export', label: <span><DownloadOutlined /> 数据导出</span>, children: (
            <>
              <div style={{ marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <Select
                  placeholder="选择导出模块"
                  style={{ width: 200 }}
                  value={selectedModule}
                  onChange={(value) => setSelectedModule(value)}
                >
                  {EXPORT_MODULES.map(m => (
                    <Option key={m.value} value={m.value}>{m.label}</Option>
                  ))}
                </Select>
                
                <RangePicker 
                  onChange={(dates) => setDateRange(dates)}
                  placeholder={['开始日期', '结束日期']}
                />
                
                <Button onClick={fetchData} loading={loading}>
                  刷新数据
                </Button>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <Space>
                  <Button 
                    type="primary" 
                    icon={<FileExcelOutlined />} 
                    onClick={handleExportCSV}
                    disabled={data.length === 0}
                  >
                    导出 CSV
                  </Button>
                  <Button 
                    icon={<FilePdfOutlined />} 
                    onClick={handleExportJSON}
                    disabled={data.length === 0}
                  >
                    导出 JSON
                  </Button>
                </Space>
                <span style={{ marginLeft: '16px', color: '#999' }}>
                  共 {data.length} 条数据
                </span>
              </div>

              <Table
                columns={getPreviewColumns()}
                dataSource={data}
                rowKey="id"
                loading={loading}
                scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
                size="small"
                pagination={{
                  current: 1,
                  pageSize: 10,
                  pageSizeOptions: ['10', '20', '50'],
                  showSizeChanger: true,
                  showTotal: (t: number) => `共 ${t} 条`,
                }}
              />
            </>
          ) },
          { key: 'batch', label: <span><FileExcelOutlined /> 批量导出</span>, children: (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
              批量导出功能开发中...<br/>
              计划支持：定时自动导出、邮件发送、多模块合并导出
            </div>
          ) },
        ]} />
      </Card>
    </div>
  )
}
