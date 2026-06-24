// @ts-nocheck
import { useState, useEffect } from 'react'
import {
  Card, Tabs, Table, Button, Modal, Form, Input, Select, Switch,
  message, Space, Popconfirm, Tag, InputNumber, TimePicker, Calendar, Badge,
  DatePicker
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined,
  UserOutlined, ClockCircleOutlined, FileTextOutlined,
  TeamOutlined, SettingOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../lib/api'
import { useAuthStore, PERMISSION_DEFINITIONS, PERMISSION_CATEGORIES, DEFAULT_ROLE_PERMISSIONS, type PermissionKey } from '../stores/auth'

const { Option } = Select
const { TextArea } = Input

interface User {
  id: string
  name: string
  username: string
  email?: string
  phone?: string
  role: string
  isAdmin: boolean
  isActive: boolean
  departmentName?: string
}

interface WorkflowDef {
  id: string
  name: string
  type: string
  description?: string
  isActive: number
  flowConfig?: any
  formSchema?: any
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('users')

  // ==================== 用户权限管理 ====================
  const [users, setUsers] = useState<User[]>([])
  const [userLoading, setUserLoading] = useState(false)
  const [userModalVisible, setUserModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm] = Form.useForm()
  const [userPagination, setUserPagination] = useState({ current: 1, pageSize: 10 })

  const fetchUsers = async (page = 1, pageSize = 10) => {
    setUserLoading(true)
    try {
      const res: any = await api.get('/users', { params: { page, pageSize } })
      if (res.success) {
        setUsers(res.data)
        setUserPagination({ current: page, pageSize })
      }
    } catch (error) {
      message.error('获取用户列表失败')
    } finally {
      setUserLoading(false)
    }
  }

  const handleUserTableChange = (paginationConfig: any) => {
    fetchUsers(paginationConfig.current, paginationConfig.pageSize)
  }

  const handleSaveUser = async (values: any) => {
    try {
      if (editingUser) {
        const payload = {
          ...values,
          permissions: JSON.stringify(userPermissions)
        }
        const res: any = await api.put(`/users/${editingUser.id}`, payload)
        if (res.success) {
          message.success('用户更新成功')
          setUserModalVisible(false)
          setUserPermissions([])
          fetchUsers(userPagination.current, userPagination.pageSize)
        }
      }
    } catch (error: any) {
      message.error(error?.message || '操作失败')
    }
  }

  const handleDeleteUser = async (id: string) => {
    try {
      const res: any = await api.delete(`/users/${id}`)
      if (res.success) {
        message.success('用户删除成功')
        fetchUsers(userPagination.current, userPagination.pageSize)
      }
    } catch (error: any) {
      message.error(error?.message || '删除失败')
    }
  }

  // 当前编辑用户的权限
  const [userPermissions, setUserPermissions] = useState<PermissionKey[]>([])

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    
    // 解析用户权限
    let perms: PermissionKey[] = []
    if (user.permissions) {
      try {
        perms = typeof user.permissions === 'string' 
          ? JSON.parse(user.permissions) 
          : user.permissions
      } catch (e) {
        perms = []
      }
    }
    // 如果没有自定义权限，使用角色默认权限
    if (perms.length === 0) {
      perms = DEFAULT_ROLE_PERMISSIONS[user.role || 'member'] || []
    }
    setUserPermissions(perms)
    
    userForm.setFieldsValue({
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isAdmin: user.isAdmin,
      isActive: user.isActive,
      departmentName: user.departmentName
    })
    setUserModalVisible(true)
  }

  const handlePermissionChange = (permission: PermissionKey, checked: boolean) => {
    if (checked) {
      setUserPermissions([...userPermissions, permission])
    } else {
      setUserPermissions(userPermissions.filter(p => p !== permission))
    }
  }

  const handleRoleChange = (role: string) => {
    // 当角色改变时，自动应用该角色的默认权限
    const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || []
    setUserPermissions(defaultPerms)
  }

  // ==================== 审批流程管理 ====================
  const [workflows, setWorkflows] = useState<WorkflowDef[]>([])
  const [wfLoading, setWfLoading] = useState(false)
  const [wfModalVisible, setWfModalVisible] = useState(false)
  const [wfForm] = Form.useForm()
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDef | null>(null)
  const [wfPagination, setWfPagination] = useState({ current: 1, pageSize: 10 })

  const fetchWorkflows = async (page = 1, pageSize = 10) => {
    setWfLoading(true)
    try {
      const res: any = await api.get('/workflows/definitions', { params: { page, pageSize } })
      if (res.success) {
        setWorkflows(res.data)
        setWfPagination({ current: page, pageSize })
      }
    } catch (error) {
      message.error('获取审批流程失败')
    } finally {
      setWfLoading(false)
    }
  }

  const handleWfTableChange = (paginationConfig: any) => {
    fetchWorkflows(paginationConfig.current, paginationConfig.pageSize)
  }

  const handleSaveWorkflow = async (values: any) => {
    try {
      const payload = {
        name: values.name,
        type: values.type,
        description: values.description || '',
        isActive: values.isActive !== false,
        formSchema: { fields: [{ name: 'content', label: '申请内容', type: 'textarea' }] },
        flowConfig: {
          steps: (values.steps || []).map((s: any) => ({ name: s.stepName, approver: s.approver })),
          cc: values.cc || []
        }
      }
      if (editingWorkflow) {
        const res: any = await api.put(`/workflows/definitions/${editingWorkflow.id}`, payload)
        if (res.success) {
          message.success('审批流程更新成功')
          setWfModalVisible(false)
          wfForm.resetFields()
          setEditingWorkflow(null)
          fetchWorkflows(wfPagination.current, wfPagination.pageSize)
        }
      } else {
        const res: any = await api.post('/workflows/definitions', payload)
        if (res.success) {
          message.success('审批流程创建成功')
          setWfModalVisible(false)
          wfForm.resetFields()
          setEditingWorkflow(null)
          fetchWorkflows()
        }
      }
    } catch (error: any) {
      message.error(error?.message || '保存失败')
    }
  }

  const handleEditWorkflow = (wf: WorkflowDef) => {
    setEditingWorkflow(wf)
    const flowConfig = typeof wf.flowConfig === 'string' ? JSON.parse(wf.flowConfig) : (wf.flowConfig || {})
    const steps = flowConfig.steps || []
    const cc = flowConfig.cc || []
    wfForm.setFieldsValue({
      name: wf.name,
      type: wf.type,
      description: wf.description,
      isActive: wf.isActive === 1,
      steps: steps.map((s: any) => ({ stepName: s.name, approver: s.approver })),
      cc
    })
    setWfModalVisible(true)
  }

  const handleDeleteWorkflow = async (id: string) => {
    try {
      const res: any = await api.delete(`/workflows/definitions/${id}`)
      if (res.success) {
        message.success('删除成功')
        fetchWorkflows(wfPagination.current, wfPagination.pageSize)
      }
    } catch (error: any) {
      message.error(error?.message || '删除失败')
    }
  }

  // ==================== 单双休打卡规则配置 ====================
  const [attendanceConfig, setAttendanceConfig] = useState<any>(null)
  const [configForm] = Form.useForm()
  const [calendarData, setCalendarData] = useState<any>({})
  const [holidays, setHolidays] = useState<any[]>([])
  const [makeupDays, setMakeupDays] = useState<any[]>([])
  const [referenceDate, setReferenceDate] = useState(dayjs())
  const [referenceWeekType, setReferenceWeekType] = useState('single')
  const [workTimeForm] = Form.useForm()

  const fetchAttendanceConfig = async () => {
    try {
      const res: any = await api.get('/attendance/config')
      if (res.success) {
        setAttendanceConfig(res.data)
        configForm.setFieldsValue({
          workStartTime: res.data?.workStartTime ? dayjs(res.data.workStartTime, 'HH:mm') : dayjs('08:30', 'HH:mm'),
          workEndTime: res.data?.workEndTime ? dayjs(res.data.workEndTime, 'HH:mm') : dayjs('17:30', 'HH:mm'),
          lunchStart: res.data?.lunchStart ? dayjs(res.data.lunchStart, 'HH:mm') : dayjs('12:00', 'HH:mm'),
          lunchEnd: res.data?.lunchEnd ? dayjs(res.data.lunchEnd, 'HH:mm') : dayjs('13:30', 'HH:mm'),
          lateThreshold: res.data?.lateThreshold || 15,
          earlyThreshold: res.data?.earlyThreshold || 15,
        })
        if (res.data?.referenceDate) {
          setReferenceDate(dayjs(res.data.referenceDate))
        }
        if (res.data?.referenceWeekType) {
          setReferenceWeekType(res.data.referenceWeekType)
        }
      }
    } catch (error) {
      console.error('获取打卡配置失败', error)
    }
  }

  const fetchCalendarData = async (year?: number, month?: number) => {
    try {
      const res: any = await api.get('/attendance/calendar', {
        params: { year, month }
      })
      if (res.success) {
        setCalendarData(res.data)
        setHolidays(res.data.holidays || [])
        setMakeupDays(res.data.makeupDays || [])
      }
    } catch (error) {
      console.error('获取日历数据失败', error)
    }
  }

  const handleSaveWorkTime = async (values: any) => {
    try {
      const payload = {
        workStartTime: values.workStartTime?.format('HH:mm'),
        workEndTime: values.workEndTime?.format('HH:mm'),
        lunchStart: values.lunchStart?.format('HH:mm'),
        lunchEnd: values.lunchEnd?.format('HH:mm'),
        lateThreshold: values.lateThreshold,
        earlyThreshold: values.earlyThreshold,
      }
      const res: any = await api.put('/attendance/config', payload)
      if (res.success) {
        message.success('工作时间保存成功')
        fetchAttendanceConfig()
      }
    } catch (error: any) {
      message.error(error?.message || '保存失败')
    }
  }

  const handleSaveCalendarRules = async () => {
    try {
      const payload = {
        referenceDate: referenceDate.format('YYYY-MM-DD'),
        referenceWeekType,
        holidays: holidays.map((h: any) => typeof h === 'string' ? h : h.date),
        makeupDays: makeupDays.map((m: any) => typeof m === 'string' ? m : m.date),
      }
      const res: any = await api.put('/attendance/calendar-rules', payload)
      if (res.success) {
        message.success('日历规则保存成功')
        fetchCalendarData()
      }
    } catch (error: any) {
      message.error(error?.message || '保存失败')
    }
  }

  const handleAddHoliday = (date: string, name: string) => {
    setHolidays([...holidays, { date, name }])
  }

  const handleRemoveHoliday = (date: string) => {
    setHolidays(holidays.filter((h: any) => (h.date || h) !== date))
  }

  const handleAddMakeupDay = (date: string) => {
    setMakeupDays([...makeupDays, date])
  }

  const handleRemoveMakeupDay = (date: string) => {
    setMakeupDays(makeupDays.filter((d: any) => d !== date))
  }

  const getDayType = (date: dayjs.Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD')
    
    // 检查法定节假日
    const holiday = holidays.find((h: any) => (h.date || h) === dateStr)
    if (holiday) return { type: 'holiday', text: '法定节假日', color: 'red' }
    
    // 检查补班日
    if (makeupDays.some((d: any) => d === dateStr)) return { type: 'makeup', text: '补班', color: 'orange' }
    
    // 计算单双休
    const dayOfWeek = date.day()
    if (dayOfWeek === 0) return { type: 'weekend', text: '周日休息', color: 'green' }
    if (dayOfWeek === 6) {
      // 周六：根据单双周判断
      const refWeek = referenceDate.week()
      const currentWeek = date.week()
      const weekDiff = Math.abs(currentWeek - refWeek)
      const isSingleWeek = weekDiff % 2 === 0
      const shouldWork = referenceWeekType === 'single' ? isSingleWeek : !isSingleWeek
      
      if (shouldWork) return { type: 'work', text: '周六上班', color: 'blue' }
      return { type: 'rest', text: '周六休息', color: 'green' }
    }
    
    return { type: 'work', text: '工作日', color: 'default' }
  }

  const dateCellRender = (value: dayjs.Dayjs) => {
    const dayInfo = getDayType(value)
    return (
      <div style={{ textAlign: 'center' }}>
        <Badge
          color={dayInfo.color}
          text={<span style={{ fontSize: 12 }}>{dayInfo.text}</span>
          }
        />
      </div>
    )
  }

  // ==================== 初始化加载 ====================
  useEffect(() => {
    fetchUsers(userPagination.current, userPagination.pageSize)
    fetchWorkflows(wfPagination.current, wfPagination.pageSize)
    fetchAttendanceConfig()
    fetchCalendarData()
  }, [])

  // ==================== 表格列定义 ====================
  const userColumns = [
    { title: '姓名', dataIndex: 'name', key: 'name', render: (text: string) => <Space><UserOutlined />{text}</Space> },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '邮箱', dataIndex: 'email', key: 'email', render: (v: string) => v || '-' },
    { title: '部门', dataIndex: 'departmentName', key: 'departmentName', render: (v: string) => v || '-' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const roleMap: Record<string, { text: string; color: string }> = {
          admin: { text: '管理员', color: 'red' },
          manager: { text: '经理', color: 'blue' },
          member: { text: '普通成员', color: 'default' }
        }
        return <Tag color={roleMap[role]?.color}>{roleMap[role]?.text || role}</Tag>
      }
    },
    {
      title: '管理员',
      dataIndex: 'isAdmin',
      key: 'isAdmin',
      render: (v: boolean) => v ? <Tag color="red">是</Tag> : <Tag>否</Tag>
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (v: boolean) => v ? <Tag color="green">正常</Tag> : <Tag color="red">禁用</Tag>
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: User) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditUser(record)}>权限</Button>
          <Popconfirm title="确定删除此用户？" onConfirm={() => handleDeleteUser(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  const workflowColumns = [
    { title: '流程名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '描述', dataIndex: 'description', key: 'description', render: (v: string) => v || '-' },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (v: number) => v === 1 ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: WorkflowDef) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditWorkflow(record)}>编辑</Button>
          <Popconfirm title="确定删除此流程？" onConfirm={() => handleDeleteWorkflow(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>
        <SettingOutlined /> 管理员权限设置
      </h2>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'users',
            label: (
              <span>
                <TeamOutlined /> 用户权限管理
              </span>
            ),
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#666' }}>管理用户角色、权限和状态</span>
                </div>
                <Table
                  columns={userColumns}
                  dataSource={users}
                  rowKey="id"
                  loading={userLoading}
                  scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
                  pagination={{
                    current: userPagination.current,
                    pageSize: userPagination.pageSize,
                    pageSizeOptions: ['10', '20', '50'],
                    showSizeChanger: true,
                    showTotal: (t: number) => `共 ${t} 条`,
                    onChange: handleUserTableChange,
                  }}
                />
              </div>
            )
          },
          {
            key: 'workflows',
            label: (
              <span>
                <FileTextOutlined /> 审批流程设置
              </span>
            ),
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#666' }}>配置审批流程定义</span>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingWorkflow(null); wfForm.resetFields(); setWfModalVisible(true); }}>
                    新增流程
                  </Button>
                </div>
                <Table
                  columns={workflowColumns}
                  dataSource={workflows}
                  rowKey="id"
                  loading={wfLoading}
                  scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
                  pagination={{
                    current: wfPagination.current,
                    pageSize: wfPagination.pageSize,
                    pageSizeOptions: ['10', '20', '50'],
                    showSizeChanger: true,
                    showTotal: (t: number) => `共 ${t} 条`,
                    onChange: handleWfTableChange,
                  }}
                />
              </div>
            )
          },
          {
            key: 'attendance',
            label: (
              <span>
                <ClockCircleOutlined /> 打卡规则设置
              </span>
            ),
            children: (
              <div>
                <Tabs
                  items={[
                    {
                      key: 'worktime',
                      label: '工作时间',
                      children: (
                        <Card title="工作时间配置">
                          <Form form={configForm} layout="vertical" onFinish={handleSaveWorkTime}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                              <Form.Item name="workStartTime" label="上班时间" rules={[{ required: true }]}>
                                <TimePicker format="HH:mm" style={{ width: '100%' }} />
                              </Form.Item>
                              <Form.Item name="workEndTime" label="下班时间" rules={[{ required: true }]}>
                                <TimePicker format="HH:mm" style={{ width: '100%' }} />
                              </Form.Item>
                              <Form.Item name="lunchStart" label="午休开始">
                                <TimePicker format="HH:mm" style={{ width: '100%' }} />
                              </Form.Item>
                              <Form.Item name="lunchEnd" label="午休结束">
                                <TimePicker format="HH:mm" style={{ width: '100%' }} />
                              </Form.Item>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                              <Form.Item name="lateThreshold" label="迟到阈值（分钟）">
                                <InputNumber min={0} max={120} style={{ width: '100%' }} />
                              </Form.Item>
                              <Form.Item name="earlyThreshold" label="早退阈值（分钟）">
                                <InputNumber min={0} max={120} style={{ width: '100%' }} />
                              </Form.Item>
                            </div>

                            <Form.Item>
                              <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                                保存工作时间
                              </Button>
                            </Form.Item>
                          </Form>
                        </Card>
                      )
                    },
                    {
                      key: 'calendar',
                      label: '日历规则（单双休）',
                      children: (
                        <div>
                          <Card title="单双休基准设置" style={{ marginBottom: 24 }}>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                              <div>
                                <span style={{ marginRight: 8 }}>选择基准日期：</span>
                                <DatePicker
                                  value={referenceDate}
                                  onChange={(date) => date && setReferenceDate(date)}
                                />
                              </div>
                              <div>
                                <span style={{ marginRight: 8 }}>该周为：</span>
                                <Select
                                  value={referenceWeekType}
                                  onChange={setReferenceWeekType}
                                  style={{ width: 120 }}
                                >
                                  <Option value="single">单休周</Option>
                                  <Option value="double">双休周</Option>
                                </Select>
                              </div>
                              <Button type="primary" onClick={handleSaveCalendarRules} icon={<SaveOutlined />}>
                                保存日历规则
                              </Button>
                            </div>
                            <div style={{ background: '#f6ffed', padding: 12, borderRadius: 4, marginBottom: 16 }}>
                              <p style={{ margin: 0 }}><strong>规则说明：</strong></p>
                              <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                                <li>选择任意一个日期作为基准，标记该周为单休或双休</li>
                                <li>系统会自动推算其他周的单双休（单双周交替）</li>
                                <li>法定节假日（红色）优先级最高，不上班</li>
                                <li>补班日（橙色）其次，必须上班</li>
                                <li>单双休规则（蓝/绿色）优先级最低</li>
                              </ul>
                            </div>
                          </Card>

                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                            <Card title="工作日历">
                              <Calendar
                                dateCellRender={dateCellRender}
                                onPanelChange={(value) => {
                                  fetchCalendarData(value.year(), value.month() + 1)
                                }}
                              />
                            </Card>

                            <div>
                              <Card title="法定节假日" style={{ marginBottom: 16 }}>
                                <div style={{ marginBottom: 8 }}>
                                  <Space>
                                    <DatePicker placeholder="选择日期" />
                                    <Input placeholder="节日名称" style={{ width: 100 }} />
                                    <Button size="small" type="primary">添加</Button>
                                  </Space>
                                </div>
                                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                                  {holidays.map((h: any, idx: number) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                      <span><Tag color="red">{h.date || h}</Tag> {h.name || '节假日'}</span>
                                      <Button type="link" size="small" danger onClick={() => handleRemoveHoliday(h.date || h)}>删除</Button>
                                    </div>
                                  ))}
                                </div>
                              </Card>

                              <Card title="补班日">
                                <div style={{ marginBottom: 8 }}>
                                  <Space>
                                    <DatePicker placeholder="选择补班日期" />
                                    <Button size="small" type="primary">添加</Button>
                                  </Space>
                                </div>
                                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                                  {makeupDays.map((d: any, idx: number) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                                      <Tag color="orange">{d}</Tag>
                                      <Button type="link" size="small" danger onClick={() => handleRemoveMakeupDay(d)}>删除</Button>
                                    </div>
                                  ))}
                                </div>
                              </Card>
                            </div>
                          </div>
                        </div>
                      )
                    }
                  ]}
                />
              </div>
            )
          }
        ]}
      />

      {/* 用户权限编辑弹窗 */}
      <Modal
        title="编辑用户权限"
        open={userModalVisible}
        onCancel={() => { setUserModalVisible(false); setUserPermissions([]); }}
        onOk={() => userForm.submit()}
        width={800}
      >
        <Form form={userForm} layout="vertical" onFinish={handleSaveUser}>
          <Form.Item name="name" label="姓名">
            <Input disabled />
          </Form.Item>

          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select onChange={handleRoleChange}>
              <Option value="admin">管理员</Option>
              <Option value="manager">经理</Option>
              <Option value="member">普通成员</Option>
            </Select>
          </Form.Item>

          <Form.Item name="isAdmin" label="管理员权限" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>

          <Form.Item name="isActive" label="账户状态" valuePropName="checked">
            <Switch checkedChildren="正常" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item name="departmentName" label="部门">
            <Select allowClear>
              {['技术部', '市场部', '财务部', '行政部', '生产部', '测绘部', '质控部'].map(d => (
                <Option key={d} value={d}>{d}</Option>
              ))}
            </Select>
          </Form.Item>

          <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            <h4 style={{ marginBottom: 16 }}>权限配置</h4>
            <p style={{ color: '#666', marginBottom: 16, fontSize: 12 }}>
              提示：修改角色会自动重置为该角色的默认权限。管理员拥有所有权限，无需配置。
            </p>
            
            {PERMISSION_CATEGORIES.map(category => {
              const categoryPerms = Object.entries(PERMISSION_DEFINITIONS)
                .filter(([_, def]) => def.category === category.key)
                .map(([key, def]) => ({ key: key as PermissionKey, ...def }))
              
              if (categoryPerms.length === 0) return null
              
              return (
                <div key={category.key} style={{ marginBottom: 16 }}>
                  <h5 style={{ marginBottom: 8, color: '#1890ff' }}>{category.label}</h5>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {categoryPerms.map(perm => (
                      <label key={perm.key} style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        padding: '4px 8px', 
                        border: '1px solid #d9d9d9', 
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: userPermissions.includes(perm.key) ? '#e6f7ff' : '#fff',
                        borderColor: userPermissions.includes(perm.key) ? '#1890ff' : '#d9d9d9'
                      }}>
                        <input
                          type="checkbox"
                          checked={userPermissions.includes(perm.key)}
                          onChange={(e) => handlePermissionChange(perm.key, e.target.checked)}
                          style={{ marginRight: 4 }}
                        />
                        <span style={{ fontSize: 12 }}>{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Form>
      </Modal>

      {/* 审批流程创建/编辑弹窗 */}
      <Modal
        title={editingWorkflow ? '编辑审批流程' : '新增审批流程'}
        open={wfModalVisible}
        onCancel={() => { setWfModalVisible(false); setEditingWorkflow(null); }}
        onOk={() => wfForm.submit()}
        width={600}
      >
        <Form form={wfForm} layout="vertical" onFinish={handleSaveWorkflow} initialValues={{ isActive: true }}>
            <Form.Item name="name" label="流程名称" rules={[{ required: true }]}>
              <Input placeholder="例如：请假申请" />
            </Form.Item>

            <Form.Item name="type" label="流程类型" rules={[{ required: true }]}>
              <Select placeholder="选择流程类型">
                <Option value="leave">请假</Option>
                <Option value="overtime">加班</Option>
                <Option value="expense">报销</Option>
                <Option value="purchase">采购</Option>
                <Option value="other">其他</Option>
              </Select>
            </Form.Item>

            <Form.Item name="description" label="描述">
              <Input.TextArea rows={2} placeholder="流程说明" />
            </Form.Item>

            <Form.Item name="isActive" label="启用状态" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>

            <div style={{ fontWeight: 500, marginBottom: 8 }}>审批步骤</div>
            <Form.List name="steps">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...rest }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item {...rest} name={[name, 'stepName']} rules={[{ required: true, message: '请输入步骤名称' }]}>
                        <Input placeholder="步骤名称（如：部门主管审批）" style={{ width: 200 }} />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'approver']} rules={[{ required: true, message: '请选择审批人' }]}>
                        <Select placeholder="选择审批人" style={{ width: 200 }} showSearch filterOption={(input, option) => (option?.label as string || '').includes(input)}>
                          {users.map((u: any) => (
                            <Select.Option key={u.id} value={`user:${u.id}`}>{u.name}</Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                      {fields.length > 1 && <Button type="text" danger onClick={() => remove(name)}>删除</Button>}
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>添加审批步骤</Button>
                </>
              )}
            </Form.List>

            <div style={{ fontWeight: 500, marginTop: 16, marginBottom: 8 }}>抄送人</div>
            <Form.Item name="cc">
              <Select mode="multiple" placeholder="选择抄送人（可多选）" allowClear showSearch filterOption={(input, option) => (option?.label as string || '').includes(input)}>
                {users.map((u: any) => (
                  <Select.Option key={u.id} value={`user:${u.id}`}>{u.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
      </Modal>
    </div>
  )
}
