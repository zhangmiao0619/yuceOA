import { useState, useEffect } from 'react'
import { Card, Tabs, Button, Statistic, Row, Col, Badge, message, Table, Space, DatePicker, Modal, Form, Input, Select, Alert } from 'antd'
import { ClockCircleOutlined, EnvironmentOutlined, CalendarOutlined, ExclamationCircleOutlined, TeamOutlined, PlusOutlined, SettingOutlined, CarOutlined } from '@ant-design/icons'
import api from '../lib/api'
import { useAuthStore, hasPermission } from '../stores/auth'
import dayjs from 'dayjs'
import AttendanceRuleSettings from './AttendanceRuleSettings'

const { RangePicker } = DatePicker
const { TextArea } = Input
const { Option } = Select

export default function Attendance() {
  const [activeTab, setActiveTab] = useState('checkin')
  const [todayRecord, setTodayRecord] = useState<any>(null)
  const [records, setRecords] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const [currentLocation, setCurrentLocation] = useState<any>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const isAdmin = useAuthStore((state) => state.user?.isAdmin)
  const canApproveLeave = hasPermission('hr:attendance')
  const [dateRange, setDateRange] = useState<any>(null)
  
  // 请假相关
  const [leaveRecords, setLeaveRecords] = useState<any[]>([])
  const [leaveModalVisible, setLeaveModalVisible] = useState(false)
  const [leaveForm] = Form.useForm()
  
  // 加班相关
  const [overtimeRecords, setOvertimeRecords] = useState<any[]>([])
  const [overtimeModalVisible, setOvertimeModalVisible] = useState(false)
  const [overtimeForm] = Form.useForm()
  
  // 异常相关
  const [myExceptions, setMyExceptions] = useState<any[]>([])
  const [exceptionModalVisible, setExceptionModalVisible] = useState(false)
  const [exceptionForm] = Form.useForm()
  
  // 外出相关
  const [outgoingRecords, setOutgoingRecords] = useState<any[]>([])
  const [outgoingModalVisible, setOutgoingModalVisible] = useState(false)
  const [outgoingForm] = Form.useForm()
  
  // 出差相关
  const [tripRecords, setTripRecords] = useState<any[]>([])
  const [tripModalVisible, setTripModalVisible] = useState(false)
  const [tripForm] = Form.useForm()
  
  // 日报弹窗
  const [dailyReportModalVisible, setDailyReportModalVisible] = useState(false)
  const [dailyReportForm] = Form.useForm()
  const [submitLoading, setSubmitLoading] = useState(false)
  
  // 管理员相关
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([])
  const [adminExceptions, setAdminExceptions] = useState<any[]>([])
  const [allRecords, setAllRecords] = useState<any[]>([])
  const [allLoading, setAllLoading] = useState(false)

  useEffect(() => {
    fetchConfig()
    fetchTodayStatus()
    fetchRecords()
    fetchStats()
    fetchLeaveRecords()
    fetchOvertimeRecords()
    fetchMyExceptions()
    fetchOutgoingRecords()
    fetchTripRecords()
    fetchPendingLeaves()
    if (isAdmin) {
      fetchAllRecords()
      fetchAdminExceptions()
    }
  }, [isAdmin, canApproveLeave])

  useEffect(() => {
    if (activeTab === 'checkin' || activeTab === 'all') {
      fetchRecords()
      if (isAdmin) fetchAllRecords()
    }
  }, [dateRange])

  const fetchConfig = async () => {
    try {
      const res: any = await api.get('/attendance/config')
      if (res.success) setConfig(res.data)
    } catch (error) {}
  }

  const fetchTodayStatus = async () => {
    try {
      const res: any = await api.get('/attendance/today')
      if (res.success) setTodayRecord(res.data)
    } catch (error) {}
  }

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD')
        params.endDate = dateRange[1].format('YYYY-MM-DD')
      }
      const res: any = await api.get('/attendance/records', { params })
      if (res.success) setRecords(res.data || [])
    } catch (error) {
      message.error('获取打卡记录失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res: any = await api.get('/attendance/stats')
      if (res.success) setStats(res.data)
    } catch (error) {}
  }

  const fetchLeaveRecords = async () => {
    try {
      const res: any = await api.get('/attendance/leave')
      if (res.success) setLeaveRecords(res.data || [])
    } catch (error) {}
  }

  const fetchOvertimeRecords = async () => {
    try {
      const res: any = await api.get('/attendance/overtime')
      if (res.success) setOvertimeRecords(res.data || [])
    } catch (error) {}
  }

  const fetchMyExceptions = async () => {
    try {
      const res: any = await api.get('/attendance/exceptions/my')
      if (res.success) setMyExceptions(res.data || [])
    } catch (error) {}
  }

  const fetchOutgoingRecords = async () => {
    try {
      const res: any = await api.get('/hr-requests/outgoing')
      if (res.success) setOutgoingRecords(res.data || [])
    } catch (error) {}
  }

  const fetchTripRecords = async () => {
    try {
      const res: any = await api.get('/hr-requests/business-trip')
      if (res.success) setTripRecords(res.data || [])
    } catch (error) {}
  }

  const fetchPendingLeaves = async () => {
    try {
      const res: any = await api.get('/attendance/admin/leave-pending')
      if (res.success) setPendingLeaves(res.data || [])
    } catch (error) {}
  }

  const fetchAllRecords = async () => {
    setAllLoading(true)
    try {
      const params: any = {}
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD')
        params.endDate = dateRange[1].format('YYYY-MM-DD')
      }
      const res: any = await api.get('/attendance/admin/records', { params })
      if (res.success) setAllRecords(res.data || [])
    } catch (error) {} finally { setAllLoading(false) }
  }

  const fetchAdminExceptions = async () => {
    try {
      const res: any = await api.get('/attendance/exceptions/admin')
      if (res.success) setAdminExceptions(res.data || [])
    } catch (error) {}
  }

  const getLocation = () => {
    setLocationLoading(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
          setLocationLoading(false)
          message.success('定位成功')
        },
        () => {
          setLocationLoading(false)
          message.warning('定位失败，将使用默认位置打卡')
        }
      )
    } else {
      setLocationLoading(false)
      message.warning('浏览器不支持定位')
    }
  }

  const handleCheckIn = async () => {
    if (todayRecord?.check_in_time && !todayRecord?.check_out_time) {
      if (!window.confirm('确定要下班打卡吗？')) return
    }
    try {
      const payload: any = {
        location: currentLocation ? `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : '公司总部',
      }
      if (currentLocation) {
        payload.latitude = currentLocation.lat
        payload.longitude = currentLocation.lng
      }
      const res: any = await api.post('/attendance/check-in', payload)
      if (res.success) {
        message.success(res.message || '打卡成功')
        fetchTodayStatus()
        fetchRecords()
        fetchStats()
        
        if (todayRecord?.check_in_time && res.data?.requireDailyReport) {
          dailyReportForm.setFieldsValue({
            reportDate: dayjs(),
            content: '',
            completedTasks: [''],
            plannedTasks: ['']
          })
          setDailyReportModalVisible(true)
        }
      }
    } catch (error: any) {
      message.error(error?.message || '打卡失败')
    }
  }

  const handleDailyReportSubmit = async (values: any) => {
    setSubmitLoading(true)
    try {
      const payload = {
        reportDate: values.reportDate.format('YYYY-MM-DD'),
        content: values.content,
        completedTasks: (values.completedTasks || []).filter((t: string) => t.trim()),
        plannedTasks: (values.plannedTasks || []).filter((t: string) => t.trim()),
        problems: values.problems
      }
      const res: any = await api.post('/daily-reports', payload)
      if (res.success) {
        message.success('日报创建成功')
        setDailyReportModalVisible(false)
        dailyReportForm.resetFields()
        if (res.data?.id) {
          await api.post(`/daily-reports/${res.data.id}/submit`)
          message.success('日报已提交')
        }
      }
    } catch (error: any) {
      message.error(error?.message || '提交失败')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleLeaveSubmit = async (values: any) => {
    try {
      const res: any = await api.post('/attendance/leave', {
        leaveType: values.leaveType,
        startDate: values.dateRange[0].format('YYYY-MM-DD HH:mm'),
        endDate: values.dateRange[1].format('YYYY-MM-DD HH:mm'),
        reason: values.reason,
      })
      if (res.success) {
        message.success('请假申请已提交')
        setLeaveModalVisible(false)
        leaveForm.resetFields()
        fetchLeaveRecords()
      }
    } catch (error: any) {
      message.error(error?.message || '提交失败')
    }
  }

  const handleLeaveApprove = async (id: string, approved: boolean) => {
    try {
      const res: any = await api.put(`/attendance/admin/leave/${id}/approve`, { approved, notes: '' })
      if (res.success) {
        message.success(res.message || (approved ? '已通过' : '已驳回'))
        fetchPendingLeaves()
        fetchLeaveRecords()
      }
    } catch (error: any) {
      message.error(error?.message || '操作失败')
    }
  }

  const handleOvertimeSubmit = async (values: any) => {
    try {
      const res: any = await api.post('/attendance/overtime', {
        date: values.date.format('YYYY-MM-DD'),
        startTime: values.timeRange[0].format('YYYY-MM-DD HH:mm'),
        endTime: values.timeRange[1].format('YYYY-MM-DD HH:mm'),
        reason: values.reason,
      })
      if (res.success) {
        message.success('加班申请已提交')
        setOvertimeModalVisible(false)
        overtimeForm.resetFields()
        fetchOvertimeRecords()
      }
    } catch (error: any) {
      message.error(error?.message || '提交失败')
    }
  }

  const handleOutgoingSubmit = async (values: any) => {
    try {
      const res: any = await api.post('/hr-requests/outgoing', {
        destination: values.destination,
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        purpose: values.purpose,
      })
      if (res.success) {
        message.success('外出申请已提交')
        setOutgoingModalVisible(false)
        outgoingForm.resetFields()
        fetchOutgoingRecords()
      }
    } catch (error: any) {
      message.error(error?.message || '提交失败')
    }
  }

  const handleTripSubmit = async (values: any) => {
    try {
      const res: any = await api.post('/hr-requests/business-trip', {
        destination: values.destination,
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        transport: values.transport,
        purpose: values.purpose,
      })
      if (res.success) {
        message.success('出差申请已提交')
        setTripModalVisible(false)
        tripForm.resetFields()
        fetchTripRecords()
      }
    } catch (error: any) {
      message.error(error?.message || '提交失败')
    }
  }

  const LEAVE_TYPES = [
    { value: 'annual', label: '年假', color: 'blue' },
    { value: 'sick', label: '病假', color: 'red' },
    { value: 'personal', label: '事假', color: 'orange' },
    { value: 'marriage', label: '婚假', color: 'magenta' },
    { value: 'maternity', label: '产假', color: 'pink' },
    { value: 'paternity', label: '陪产假', color: 'purple' },
    { value: 'bereavement', label: '丧假', color: 'gray' },
    { value: 'time_off', label: '调休假', color: 'cyan' },
    { value: 'other', label: '其他', color: 'default' },
  ]

  const STATUS_MAP: Record<string, { color: string; text: string }> = {
    normal: { color: 'success', text: '正常' },
    late: { color: 'warning', text: '迟到' },
    early_leave: { color: 'warning', text: '早退' },
    absent: { color: 'error', text: '缺勤' },
    leave: { color: 'default', text: '请假' },
  }

  const recordColumns = [
    { title: '日期', dataIndex: 'date', key: 'date', render: (date: string) => dayjs(date).format('YYYY-MM-DD') },
    { title: '上班时间', dataIndex: 'check_in_time', key: 'checkIn', render: (time: string) => time ? dayjs(time).format('HH:mm:ss') : '-' },
    { title: '下班时间', dataIndex: 'check_out_time', key: 'checkOut', render: (time: string) => time ? dayjs(time).format('HH:mm:ss') : '-' },
    { title: '工作时长', dataIndex: 'work_hours', key: 'workHours', render: (h: number) => h > 0 ? `${h}h` : '-' },
    { title: '加班时长', dataIndex: 'overtime_hours', key: 'overtimeHours', render: (h: number) => h > 0 ? `+${h}h` : '-' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => {
      const info = STATUS_MAP[status] || STATUS_MAP.normal
      return <span style={{ color: info.color === 'success' ? '#52c41a' : info.color === 'warning' ? '#faad14' : info.color === 'error' ? '#ff4d4f' : '#666' }}>{info.text}</span>
    }},
  ]

  const leaveColumns = [
    { title: '请假类型', dataIndex: 'leave_type', key: 'leaveType', render: (type: string) => {
      const info = LEAVE_TYPES.find(t => t.value === type)
      return <span>{info?.label || type}</span>
    }},
    { title: '开始时间', dataIndex: 'start_date', key: 'startDate', render: (date: string) => dayjs(date).format('MM-DD HH:mm') },
    { title: '结束时间', dataIndex: 'end_date', key: 'endDate', render: (date: string) => dayjs(date).format('MM-DD HH:mm') },
    { title: '天数', dataIndex: 'days', key: 'days', render: (days: number) => days === 0.5 ? '0.5 天' : days === 1 ? '1 天' : `${days} 天` },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => {
      const textMap: Record<string, string> = { pending: '待审批', approved: '已通过', rejected: '已驳回' }
      return <span>{textMap[status] || status}</span>
    }},
  ]

  const pendingLeaveColumns = [
    { title: '申请人', dataIndex: 'user_name', key: 'userName' },
    { title: '部门', dataIndex: 'department_name', key: 'dept' },
    { title: '请假类型', dataIndex: 'leave_type', key: 'leaveType', render: (type: string) => {
      const info = LEAVE_TYPES.find(t => t.value === type)
      return <span>{info?.label || type}</span>
    }},
    { title: '开始时间', dataIndex: 'start_date', key: 'startDate', render: (date: string) => dayjs(date).format('MM-DD HH:mm') },
    { title: '结束时间', dataIndex: 'end_date', key: 'endDate', render: (date: string) => dayjs(date).format('MM-DD HH:mm') },
    { title: '天数', dataIndex: 'days', key: 'days', render: (days: number) => days === 0.5 ? '0.5 天' : days === 1 ? '1 天' : `${days} 天` },
    { title: '操作', key: 'action', render: (_: any, record: any) => (
      <Space>
        <Button type="primary" size="small" onClick={() => handleLeaveApprove(record.id, true)}>通过</Button>
        <Button danger size="small" onClick={() => handleLeaveApprove(record.id, false)}>驳回</Button>
      </Space>
    )},
  ]

  const overtimeColumns = [
    { title: '日期', dataIndex: 'date', key: 'date', render: (date: string) => dayjs(date).format('YYYY-MM-DD') },
    { title: '开始时间', dataIndex: 'start_time', key: 'startTime', render: (time: string) => dayjs(time).format('HH:mm') },
    { title: '结束时间', dataIndex: 'end_time', key: 'endTime', render: (time: string) => dayjs(time).format('HH:mm') },
    { title: '时长(小时)', dataIndex: 'hours', key: 'hours' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (status: string) => {
      const textMap: Record<string, string> = { pending: '待审批', approved: '已通过', rejected: '已驳回' }
      return <span>{textMap[status] || status}</span>
    }},
  ]

  const exceptionColumns = [
    { title: '异常日期', dataIndex: 'record_date', key: 'recordDate', render: (d: string) => dayjs(d).format('YYYY-MM-DD') },
    { title: '异常类型', dataIndex: 'exception_type', key: 'exceptionType', render: (t: string) => {
      const map: Record<string, string> = { late: '迟到', early_leave: '早退', absent: '缺勤', missing_clock_in: '未打卡上班', missing_clock_out: '未打卡下班', location_abnormal: '位置异常' }
      return <span>{map[t] || t}</span>
    }},
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => {
      const map: Record<string, string> = { pending: '待处理', approved: '已通过', rejected: '已驳回' }
      return <span>{map[s] || s}</span>
    }},
  ]

  const outgoingColumns = [
    { title: '目的地', dataIndex: 'destination', key: 'destination' },
    { title: '开始日期', dataIndex: 'start_date', key: 'startDate', render: (d: string) => d || '-' },
    { title: '结束日期', dataIndex: 'end_date', key: 'endDate', render: (d: string) => d || '-' },
    { title: '外出目的', dataIndex: 'purpose', key: 'purpose', render: (v: string) => v || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => {
      const map: Record<string, string> = { pending: '待审批', approved: '已通过', rejected: '已驳回' }
      return <span>{map[s] || s}</span>
    }},
  ]

  const tripColumns = [
    { title: '目的地', dataIndex: 'destination', key: 'destination' },
    { title: '开始日期', dataIndex: 'start_date', key: 'startDate', render: (d: string) => d || '-' },
    { title: '结束日期', dataIndex: 'end_date', key: 'endDate', render: (d: string) => d || '-' },
    { title: '交通工具', dataIndex: 'transport', key: 'transport', render: (v: string) => v || '-' },
    { title: '出差目的', dataIndex: 'purpose', key: 'purpose', render: (v: string) => v || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => {
      const map: Record<string, string> = { pending: '待审批', approved: '已通过', rejected: '已驳回' }
      return <span>{map[s] || s}</span>
    }},
  ]

  const tabItems: any[] = [
    {
      key: 'checkin',
      label: (<span><ClockCircleOutlined /> 打卡</span>),
      children: (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {todayRecord?.check_in_time ? (
                todayRecord?.check_out_time ? (
                  <Badge status="success" text={<span style={{ fontSize: '24px', color: '#52c41a' }}>已下班</span>} />
                ) : (
                  <Badge status="processing" text={<span style={{ fontSize: '24px', color: '#1890ff' }}>工作中</span>} />
                )
              ) : (
                <Badge status="warning" text={<span style={{ fontSize: '24px', color: '#faad14' }}>待上班</span>} />
              )}
            </div>

            <div style={{ fontSize: '64px', fontWeight: 'bold', marginBottom: '8px' }}>
              {dayjs().format('HH:mm:ss')}
            </div>
            <div style={{ fontSize: '18px', color: '#666', marginBottom: '32px' }}>
              {dayjs().format('YYYY年MM月DD日')}
            </div>

            {/* 考勤配置信息 */}
            {config && (
              <div style={{ marginBottom: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '8px', display: 'inline-block', textAlign: 'left' }}>
                <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                  <strong>工作时间：</strong>{config?.work_start_time?.value} - {config?.work_end_time?.value}
                </div>
                <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                  <strong>午休时间：</strong>{config?.rest_start?.value} - {config?.rest_end?.value}
                </div>
                <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                  <strong>晚饭时间：</strong>{config?.dinner_start?.value} - {config?.dinner_end?.value}
                </div>
                <div style={{ fontSize: '14px' }}>
                  <strong>工作制度：</strong>{config?.work_week_type?.value}（{config?.work_saturday_weeks?.value === 'odd' ? '单周周六上班' : '双周周六上班'}）
                </div>
              </div>
            )}

            <div>
              <Button
                type="primary"
                size="large"
                icon={<EnvironmentOutlined />}
                onClick={getLocation}
                loading={locationLoading}
                style={{ marginBottom: 16, marginRight: 16 }}
              >
                {currentLocation ? `已定位 (${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)})` : '获取定位'}
              </Button>
            </div>

            <div>
              <Button
                type="primary"
                size="large"
                icon={<ClockCircleOutlined />}
                onClick={handleCheckIn}
                disabled={todayRecord?.check_in_time && todayRecord?.check_out_time}
                style={{ width: '200px', height: '50px', fontSize: '18px' }}
              >
                {todayRecord?.check_in_time ? (todayRecord?.check_out_time ? '今日已打卡' : '下班打卡') : '上班打卡'}
              </Button>
            </div>

            <div style={{ marginTop: '24px', color: '#999' }}>
              打卡地点: {currentLocation ? `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : '公司总部'}
            </div>
          </div>

          {stats && (
            <Row gutter={16} style={{ marginTop: '32px' }}>
              <Col span={6}><Card><Statistic title="本月出勤天数" value={stats.checkedDays} suffix={`/ ${stats.totalDays}`} /></Card></Col>
              <Col span={6}><Card><Statistic title="正常天数" value={stats.normalDays} valueStyle={{ color: '#52c41a' }} /></Card></Col>
              <Col span={6}><Card><Statistic title="迟到天数" value={stats.lateDays} valueStyle={{ color: '#faad14' }} /></Card></Col>
              <Col span={6}><Card><Statistic title="请假天数" value={stats.leaveDays} valueStyle={{ color: '#1890ff' }} /></Card></Col>
            </Row>
          )}

          <div style={{ marginTop: '24px' }}>
            <Space style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>打卡记录</h3>
              <RangePicker value={dateRange} onChange={setDateRange} placeholder={['开始日期', '结束日期']} />
              <Button onClick={fetchRecords}>刷新</Button>
            </Space>
            <Table columns={recordColumns} dataSource={records} rowKey="id" loading={loading} scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }} pagination={{
              current: 1,
              pageSize: 10,
              pageSizeOptions: ['10', '20', '50'],
              showSizeChanger: true,
              showTotal: (t: number) => `共 ${t} 条`,
            }} />
          </div>
        </Card>
      )
    },
    {
      key: 'leave',
      label: (<span><CalendarOutlined /> 请假</span>),
      children: (
        <Card>
          <div style={{ marginBottom: '16px' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setLeaveModalVisible(true)}>申请请假</Button>
          </div>
          <Table columns={leaveColumns} dataSource={leaveRecords} rowKey="id" scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }} pagination={{
              current: 1,
              pageSize: 10,
              pageSizeOptions: ['10', '20', '50'],
              showSizeChanger: true,
              showTotal: (t: number) => `共 ${t} 条`,
            }} />
        </Card>
      )
    },
    {
      key: 'overtime',
      label: (<span><ClockCircleOutlined /> 加班</span>),
      children: (
        <Card>
          <div style={{ marginBottom: '16px' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOvertimeModalVisible(true)}>申请加班</Button>
          </div>
          <Table columns={overtimeColumns} dataSource={overtimeRecords} rowKey="id" scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }} pagination={{
              current: 1,
              pageSize: 10,
              pageSizeOptions: ['10', '20', '50'],
              showSizeChanger: true,
              showTotal: (t: number) => `共 ${t} 条`,
            }} />
        </Card>
      )
    },
    {
      key: 'exceptions',
      label: (<span><ExclamationCircleOutlined /> 异常申诉</span>),
      children: (
        <Card>
          <div style={{ marginBottom: '16px' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setExceptionModalVisible(true)}>提交申诉</Button>
          </div>
          <Table columns={exceptionColumns} dataSource={myExceptions} rowKey="id" scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }} pagination={{
              current: 1,
              pageSize: 10,
              pageSizeOptions: ['10', '20', '50'],
              showSizeChanger: true,
              showTotal: (t: number) => `共 ${t} 条`,
            }} />
        </Card>
      )
    },
    {
      key: 'outgoing',
      label: (<span><CarOutlined /> 外出</span>),
      children: (
        <Card>
          <div style={{ marginBottom: '16px' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOutgoingModalVisible(true)}>申请外出</Button>
          </div>
          <Table columns={outgoingColumns} dataSource={outgoingRecords} rowKey="id" scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }} pagination={{
              current: 1,
              pageSize: 10,
              pageSizeOptions: ['10', '20', '50'],
              showSizeChanger: true,
              showTotal: (t: number) => `共 ${t} 条`,
            }} />
        </Card>
      )
    },
    {
      key: 'businessTrip',
      label: (<span><CarOutlined /> 出差</span>),
      children: (
        <Card>
          <div style={{ marginBottom: '16px' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setTripModalVisible(true)}>申请出差</Button>
          </div>
          <Table columns={tripColumns} dataSource={tripRecords} rowKey="id" scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }} pagination={{
              current: 1,
              pageSize: 10,
              pageSizeOptions: ['10', '20', '50'],
              showSizeChanger: true,
              showTotal: (t: number) => `共 ${t} 条`,
            }} />
        </Card>
      )
    },
  ]

  if (canApproveLeave) {
    tabItems.push({
      key: 'admin',
      label: (<span><TeamOutlined />{(pendingLeaves.length > 0 ? ` 待审批(${pendingLeaves.length})` : ' 管理')}</span>),
      children: (
        <>
          <Row gutter={16}>
            <Col span={24}>
              <Card title="待审批请假" extra={<Badge count={pendingLeaves.length}><Button type="link">查看全部</Button></Badge>}>
                {pendingLeaves.length === 0 ? (
                  <Alert message="暂无待审批的请假申请" type="success" showIcon />
                ) : (
                  <Table columns={pendingLeaveColumns} dataSource={pendingLeaves} rowKey="id" pagination={false} size="small" />
                )}
              </Card>
            </Col>
          </Row>
        </>
      )
    })
    tabItems.push({
      key: 'rule-settings',
      label: (<span><SettingOutlined /> 规则设置</span>),
      children: <div style={{ height: '100%', overflow: 'auto' }}><AttendanceRuleSettings /></div>
    })
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <Modal title="申请请假" open={leaveModalVisible} onCancel={() => setLeaveModalVisible(false)} footer={null}>
        <Form form={leaveForm} layout="vertical" onFinish={handleLeaveSubmit}>
          <Form.Item name="leaveType" label="请假类型" rules={[{ required: true }]}>
            <Select placeholder="选择请假类型">
              {LEAVE_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item
            name="dateRange"
            label="请假时间"
            rules={[
              { required: true, message: '请选择请假时间' },
              {
                validator(_, value) {
                  if (!value || !value[0] || !value[1]) {
                    return Promise.resolve()
                  }
                  if (value[1].isBefore(value[0])) {
                    return Promise.reject(new Error('结束时间不能早于开始时间'))
                  }
                  return Promise.resolve()
                }
              }
            ]}
          >
            <RangePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item shouldUpdate={(prev, cur) => prev.dateRange !== cur.dateRange}>
            {({ getFieldValue }) => {
              const range = getFieldValue('dateRange')
              if (!range?.[0] || !range?.[1]) return null
              const diffMs = range[1].diff(range[0])
              const diffHours = diffMs / (1000 * 60 * 60)
              const sameDay = range[0].isSame(range[1], 'day')
              const leaveDays = sameDay ? (diffHours >= 5 ? 1 : 0.5) : Math.round((diffHours / 24) * 2) / 2
              return <div style={{ color: '#1890ff', marginTop: -8, marginBottom: 12 }}>请假时长：{leaveDays === 1 ? '1 天' : `${leaveDays} 天`}</div>
            }}
          </Form.Item>
          <Form.Item name="reason" label="请假事由">
            <TextArea rows={3} placeholder="请输入请假事由" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setLeaveModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="申请加班" open={overtimeModalVisible} onCancel={() => setOvertimeModalVisible(false)} footer={null}>
        <Form form={overtimeForm} layout="vertical" onFinish={handleOvertimeSubmit}>
          <Form.Item name="date" label="加班日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="timeRange" label="加班时间" rules={[{ required: true }]}>
            <RangePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="加班事由">
            <TextArea rows={3} placeholder="请输入加班事由" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setOvertimeModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="提交异常申诉" open={exceptionModalVisible} onCancel={() => setExceptionModalVisible(false)} footer={null}>
        <Form form={exceptionForm} layout="vertical" onFinish={(values) => {
          message.success('申诉已提交')
          setExceptionModalVisible(false)
          exceptionForm.resetFields()
        }}>
          <Form.Item name="recordDate" label="异常日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="exceptionType" label="异常类型" rules={[{ required: true }]}>
            <Select>
              <Option value="late">迟到</Option>
              <Option value="early_leave">早退</Option>
              <Option value="missing_clock_in">未打卡上班</Option>
              <Option value="missing_clock_out">未打卡下班</Option>
              <Option value="location_abnormal">位置异常</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="申诉说明" rules={[{ required: true }]}>
            <TextArea rows={3} placeholder="请说明异常原因" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setExceptionModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="申请外出" open={outgoingModalVisible} onCancel={() => setOutgoingModalVisible(false)} footer={null}>
        <Form form={outgoingForm} layout="vertical" onFinish={handleOutgoingSubmit}>
          <Form.Item name="destination" label="目的地" rules={[{ required: true, message: '请输入目的地' }]}>
            <Input placeholder="请输入外出目的地" />
          </Form.Item>
          <Form.Item name="dateRange" label="外出日期" rules={[{ required: true, message: '请选择外出日期' }]}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="purpose" label="外出目的" rules={[{ required: true, message: '请输入外出目的' }]}>
            <TextArea rows={3} placeholder="请输入外出目的" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setOutgoingModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="申请出差" open={tripModalVisible} onCancel={() => setTripModalVisible(false)} footer={null}>
        <Form form={tripForm} layout="vertical" onFinish={handleTripSubmit}>
          <Form.Item name="destination" label="目的地" rules={[{ required: true, message: '请输入目的地' }]}>
            <Input placeholder="请输入出差目的地" />
          </Form.Item>
          <Form.Item name="dateRange" label="出差日期" rules={[{ required: true, message: '请选择出差日期' }]}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="transport" label="交通工具" initialValue="汽车">
            <Select>
              <Option value="飞机">飞机</Option>
              <Option value="高铁">高铁</Option>
              <Option value="汽车">汽车</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="purpose" label="出差目的" rules={[{ required: true, message: '请输入出差目的' }]}>
            <TextArea rows={3} placeholder="请输入出差目的" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setTripModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="填写今日日报"
        open={dailyReportModalVisible}
        onCancel={() => setDailyReportModalVisible(false)}
        onOk={() => dailyReportForm.submit()}
        confirmLoading={submitLoading}
        width={700}
        maskClosable={false}
        closable={false}
      >
        <Form form={dailyReportForm} layout="vertical" onFinish={handleDailyReportSubmit}>
          <Form.Item name="reportDate" label="日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} disabled />
          </Form.Item>
          <Form.Item name="content" label="工作内容" rules={[{ required: true }]}>
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
                  <Button type="dashed" onClick={() => add()} block>添加已完成任务</Button>
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
                  <Button type="dashed" onClick={() => add()} block>添加计划任务</Button>
                </>
              )}
            </Form.List>
          </Form.Item>
          <Form.Item name="problems" label="遇到的问题">
            <TextArea rows={3} placeholder="描述遇到的问题或需要的支持（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
