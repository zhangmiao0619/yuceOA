// @ts-nocheck
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, Table, Button, Modal, Form, Input, Select, Switch, Space, message, Popconfirm, Tag, Tabs, Descriptions, Timeline, Drawer, Row, Col, DatePicker, Alert, Upload, Breadcrumb } from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, EyeOutlined, HistoryOutlined,
  TeamOutlined, ContainerOutlined, BellOutlined, FileTextOutlined, ClockCircleOutlined,
  FieldTimeOutlined, FormOutlined, UploadOutlined, SyncOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuthStore, hasPermission } from '../stores/auth'
import Assets from './Assets'
import Alerts from './Alerts'
import Attendance from './Attendance'
import TimeTracking from './TimeTracking'
import DailyReport from './DailyReport'
import Contracts from './Contracts'
import Outsourcing from './Outsourcing'


interface User {
  id: string
  name: string
  employeeNo?: string
  departmentName?: string
  personnelCategory?: string
  position?: string
  entryDate?: string
  phone?: string
  employmentStatus?: string
  [key: string]: any
}

export default function Users() {
  const navigate = useNavigate()
  const currentUser = useAuthStore.getState().user
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [modalVisible, setModalVisible] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [profileModalVisible, setProfileModalVisible] = useState(false)
  const [resignModalVisible, setResignModalVisible] = useState(false)
  const [resigningUser, setResigningUser] = useState<User | null>(null)
  const [resignForm] = Form.useForm()
  const [form] = Form.useForm()
  const [profileForm] = Form.useForm()
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)
  const adminViews = ['employees', 'assets', 'alerts', 'contracts', 'timeTracking', 'outsourcing']
  const [searchParams] = useSearchParams()
  const [currentView, setCurrentView] = useState<string>(() => {
    return searchParams.get('view') || 'dashboard'
  })

  // 非管理员访问管理模块时跳回首页
  useEffect(() => {
    if (!currentUser?.isAdmin && adminViews.includes(currentView)) {
      setCurrentView('dashboard')
    }
  }, [currentView, currentUser])

  // 辅助函数：带认证的请求
  const authFetch = async (url: string, options: any = {}) => {
    const token = useAuthStore.getState().token
    const headers = {
      ...(options.headers || {}),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
    return fetch(url, {
      ...options,
      credentials: 'include',
      headers
    })
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await authFetch(`/api/users?page=${pagination.current}&pageSize=${pagination.pageSize}`)
      const data = await res.json()
      if (data.success) {
        // 后端返回格式: data: [...], total: 52, page: 1
        setUsers(data.data || [])
        setPagination(prev => ({ ...prev, total: data.total || 0 }))
      }
    } catch (error) {
      message.error('获取用户失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [pagination.current, pagination.pageSize])

  // 初始加载
  useEffect(() => {
    fetchUsers()
  }, [])

  const handleDelete = async (id: string, needResign: boolean = false) => {
    if (needResign) {
      // 需要办理离职，显示离职弹窗
      const user = users.find(u => u.id === id)
      if (user) {
        setResigningUser(user)
        resignForm.resetFields()
        setResignModalVisible(true)
      }
      return
    }
    
    try {
      const res = await authFetch(`/api/users/${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        message.success('删除成功')
        fetchUsers()
      } else {
        message.error(data.message || '删除失败')
      }
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleResign = async (values: any) => {
    if (!resigningUser) return
    try {
      const res = await authFetch(`/api/users/${resigningUser.id}/resign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resignationDate: values.resignationDate?.format('YYYY-MM-DD'),
          reason: values.reason
        })
      })
      const data = await res.json()
      if (data.success) {
        message.success('离职办理成功')
        setResignModalVisible(false)
        setResigningUser(null)
        resignForm.resetFields()
        fetchUsers()
      } else {
        message.error(data.message || '办理离职失败')
      }
    } catch (error) {
      message.error('办理离职失败')
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      message.warning('请选择文件')
      return
    }
    setImportLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const res = await authFetch('/api/users/import', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        setImportResult(data.data)
        message.success(`导入完成，成功 ${data.data.success} 条，失败 ${data.data.fail} 条`)
        fetchUsers()
      } else {
        message.error(data.message || '导入失败')
      }
    } catch (error) {
      message.error('导入请求失败')
    } finally {
      setImportLoading(false)
    }
  }

  const downloadTemplate = () => {
    const headers = 'username,name,password,email,phone,department_name,role,employee_no,gender,entry_date,position,job_level,salary_base\n'
    const example = 'zhangsan,张三,123456,zhangsan@example.com,13800138000,技术部,member,E001,男,2024-01-01,工程师,P3,8000\n'
    const blob = new Blob([headers + example], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = '员工导入模板.csv'
    link.click()
  }

  const handleWechatSync = async () => {
    setSyncing(true)
    try {
      const res = await authFetch('/api/wechat/sync-address-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (data.success) {
        message.success(`同步完成：新增${data.data?.created || 0}人，更新${data.data?.updated || 0}人`)
        fetchUsers()
      } else {
        message.error(data.message || '同步失败')
      }
    } catch (err) {
      message.error('同步失败，请检查企业微信配置')
    } finally {
      setSyncing(false)
    }
  }

  const handleSubmit = async (values: any) => {
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'
      
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      })
      const data = await res.json()
      
      if (data.success) {
        message.success(editingUser ? '更新成功' : '添加成功')
        setModalVisible(false)
        fetchUsers()
      } else {
        message.error(data.message || '操作失败')
      }
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleProfileUpdate = async (values: any) => {
    if (!selectedUser) return
    try {
      const payload: any = {}
      const dateFields = [
        'birthDate', 'entryDate', 'probationEndDate', 'formalDate',
        'contractStartDate', 'contractEndDate', 'graduationDate',
        'titleDeclarationDate', 'certIssueDate', 'ssStartDate',
        'idCardExpiry', 'latestContractStart', 'latestContractEnd',
        'resignationDate'
      ]
      Object.keys(values).forEach(key => {
        if (values[key] !== undefined) {
          if (dateFields.includes(key) && values[key]) {
            payload[key] = dayjs(values[key]).format('YYYY-MM-DD')
          } else {
            payload[key] = values[key]
          }
        }
      })
      
      const res = await authFetch(`/api/users/${selectedUser.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (data.success) {
        message.success('档案更新成功')
        setProfileModalVisible(false)
        fetchUserProfile(selectedUser)
        fetchUsers()
      }
    } catch (error) {
      message.error('更新失败')
    }
  }

  const fetchUserProfile = async (user: User) => {
    try {
      const res = await authFetch(`/api/users/${user.id}/profile`, {})
      const data = await res.json()
      if (data.success) {
        setSelectedUser(data.data)
        setDetailDrawerVisible(true)
      }
    } catch (error) {
      message.error('获取档案失败')
    }
  }

  // 上传入职材料
  const uploadDocument = async (file: File, docType: string, userId: string) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const res = await authFetch('/api/uploads', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      
      if (data.success) {
        // 更新用户档案的 documents 字段
        const currentDocs = selectedUser?.documents || []
        const updatedDocs = [
          ...currentDocs.filter((d: any) => d.type !== docType),
          {
            type: docType,
            name: file.name,
            url: data.data.url,
            fileName: data.data.fileName,
            uploadedAt: new Date().toISOString()
          }
        ]
        
        const updateRes = await authFetch(`/api/users/${userId}/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documents: updatedDocs })
        })
        const updateData = await updateRes.json()
        
        if (updateData.success) {
          message.success('文件上传成功')
          // 刷新用户数据
          if (selectedUser) {
            fetchUserProfile(selectedUser)
          }
          fetchUsers()
          return data.data
        }
      }
      throw new Error(data.message || '上传失败')
    } catch (error: any) {
      message.error(error?.message || '上传失败')
      throw error
    }
  }

  const employmentStatusMap: Record<string, { text: string; color: string }> = {
    active: { text: '在职', color: 'green' },
    probation: { text: '试用期', color: 'blue' },
    resigned: { text: '已离职', color: 'red' },
    transferred: { text: '已调岗', color: 'orange' },
    suspended: { text: '停薪留职', color: 'default' }
  }

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name', render: (text: string, record: User) => (
      <Space><UserOutlined />{text}{record.isAdmin && <Tag color="red">管理员</Tag>}</Space>
    )},
    { title: '工号', dataIndex: 'employeeNo', key: 'employeeNo', render: (text: string) => text || '-' },
    { title: '部门', dataIndex: 'departmentName', key: 'departmentName', render: (text: string) => text || '-' },
    { title: '人员分类', dataIndex: 'personnelCategory', key: 'personnelCategory', render: (text: string) => text || '-' },
    { title: '岗位', dataIndex: 'position', key: 'position', render: (text: string) => text || '-' },
    { title: '入职时间', dataIndex: 'entryDate', key: 'entryDate', render: (text: string) => text ? dayjs(text).format('YYYY-MM-DD') : '-' },
    { title: '电话', dataIndex: 'phone', key: 'phone', render: (text: string) => text || '-' },
    { title: '状态', dataIndex: 'employmentStatus', key: 'employmentStatus', render: (status: string) => {
      const info = employmentStatusMap[status || 'active'] || { text: status || '在职', color: 'default' }
      return <Tag color={info.color}>{info.text}</Tag>
    }},
    { title: '操作', key: 'action', width: 280, render: (_: any, record: User) => (
      <Space size="small">
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => fetchUserProfile(record)}>档案</Button>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={async () => {
          // Fetch latest profile data
          const res = await authFetch(`/api/users/${record.id}/profile`)
          const data = await res.json()
          if (data.success) {
            setSelectedUser(data.data)
            profileForm.setFieldsValue({
              ...data.data,
              birthDate: data.data.birthDate ? dayjs(data.data.birthDate) : null,
              entryDate: data.data.entryDate ? dayjs(data.data.entryDate) : null,
              probationEndDate: data.data.probationEndDate ? dayjs(data.data.probationEndDate) : null,
              formalDate: data.data.formalDate ? dayjs(data.data.formalDate) : null,
              contractStartDate: data.data.contractStartDate ? dayjs(data.data.contractStartDate) : null,
              contractEndDate: data.data.contractEndDate ? dayjs(data.data.contractEndDate) : null,
              graduationDate: data.data.graduationDate ? dayjs(data.data.graduationDate) : null,
              titleDeclarationDate: data.data.titleDeclarationDate ? dayjs(data.data.titleDeclarationDate) : null,
              certIssueDate: data.data.certIssueDate ? dayjs(data.data.certIssueDate) : null,
              ssStartDate: data.data.ssStartDate ? dayjs(data.data.ssStartDate) : null,
              idCardExpiry: data.data.idCardExpiry ? dayjs(data.data.idCardExpiry) : null,
              latestContractStart: data.data.latestContractStart ? dayjs(data.data.latestContractStart) : null,
              latestContractEnd: data.data.latestContractEnd ? dayjs(data.data.latestContractEnd) : null,
            })
            setProfileModalVisible(true)
          }
        }}>编辑</Button>
        <Popconfirm
          title="确定删除此员工？"
          description={
            <div>
              <p>请选择操作类型：</p>
              <Button type="primary" danger size="small" style={{ marginRight: 8 }} onClick={(e) => {
                e.stopPropagation()
                handleDelete(record.id, true)
              }}>办理离职</Button>
              <Button size="small" onClick={(e) => {
                e.stopPropagation()
                handleDelete(record.id, false)
              }}>直接删除</Button>
            </div>
          }
          onConfirm={() => {}}
          onCancel={() => {}}
          okText=""
          cancelText=""
          showCancel={false}
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      </Space>
    )}
  ]

  // ... 其他代码保持不变

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {currentView === 'dashboard' && (
        <div>
          <h2 style={{ marginBottom: 16, textAlign: 'center', fontWeight: 600 }}>人事管理中心</h2>
          <Row gutter={[16, 16]} justify="center">
            {(() => {
              const allModules = [
                { key: 'employees', title: '员工管理', icon: <TeamOutlined />, color: '#1890ff', description: '员工信息、档案、入转调离' },
                { key: 'assets', title: '资产管理', icon: <ContainerOutlined />, color: '#52c41a', description: '固定资产、无形资产' },
                { key: 'alerts', title: '智能预警', icon: <BellOutlined />, color: '#fa8c16', description: '合同到期、试用期预警' },
                { key: 'contracts', title: '项目合同', icon: <FileTextOutlined />, color: '#eb2f96', description: '合同管理、到期提醒' },
                { key: 'attendance', title: '打卡管理', icon: <ClockCircleOutlined />, color: '#722ed1', description: '考勤打卡、请假审批' },
                { key: 'timeTracking', title: '工时管理', icon: <FieldTimeOutlined />, color: '#13c2c2', description: '工时记录、统计分析' },
                { key: 'dailyReport', title: '日报管理', icon: <FormOutlined />, color: '#2f54eb', description: '工作日报、审阅批注' },
                { key: 'outsourcing', title: '委外管理', icon: <FileTextOutlined />, color: '#fa541c', description: '委外信息管理' },
              ]
              const visibleModules = currentUser?.isAdmin
                ? allModules
                : allModules.filter(m => m.key === 'attendance' || m.key === 'dailyReport')
              return visibleModules.map(module => (
                <Col xs={12} sm={8} md={6} key={module.key}>
                  <Card hoverable onClick={() => setCurrentView(module.key)} style={{ textAlign: 'center', cursor: 'pointer', borderRadius: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', height: 130 }} bodyStyle={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', padding: 12, width: '100%' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: `${module.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, fontSize: 18, color: module.color }}>{module.icon}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{module.title}</div>
                    <div style={{ fontSize: 12, color: '#999', lineHeight: 1.4 }}>{module.description}</div>
                  </Card>
                </Col>
              ))
            })()}
          </Row>
        </div>
      )}
      
      {currentView === 'employees' && (
        <div>
          <Breadcrumb style={{ marginBottom: 24 }} items={[
            { title: <span onClick={() => setCurrentView('dashboard')} style={{ cursor: 'pointer' }}>人事管理中心</span> },
            { title: '员工管理' }
          ]} />
          
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Button onClick={() => { setImportModalVisible(true); setImportFile(null); setImportResult(null); }}>导入员工</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingUser(null); form.resetFields(); setModalVisible(true); }}>添加员工</Button>
              <Button icon={<SyncOutlined spin={syncing} />} loading={syncing} onClick={handleWechatSync}>同步企业微信</Button>
            </Space>
          </div>
          
          <Card>
            <Table 
              columns={columns} 
              dataSource={users} 
              rowKey="id" 
              loading={loading} 
              scroll={{ x: 1200, y: 'calc(100vh - 400px)' }}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                pageSizeOptions: ['10', '20', '50'],
                showSizeChanger: true,
                showTotal: (t: number) => `共 ${t} 条`,
                onChange: (page, pageSize) => {
                  setPagination({ current: page, pageSize, total: pagination.total })
                }
              }} 
            />
          </Card>
          
          <Modal title={editingUser ? '编辑成员' : '添加成员'} open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={500}>
            <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ role: 'member', isAdmin: false, isActive: true }}>
              <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }]}><Input placeholder="请输入姓名" /></Form.Item>
              {!editingUser && (
                <>
                  <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}><Input placeholder="请输入用户名" /></Form.Item>
                  <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}><Input.Password placeholder="请输入密码" /></Form.Item>
                </>
              )}
              <Form.Item label="邮箱" name="email"><Input placeholder="请输入邮箱" /></Form.Item>
              <Form.Item label="手机" name="phone"><Input placeholder="请输入手机号" /></Form.Item>
              <Form.Item label="部门" name="departmentName">
                <Select placeholder="选择部门">
                  {['技术部', '市场部', '财务部', '行政部', '生产部', '测绘部', '质控部'].map(d => <Select.Option key={d} value={d}>{d}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item label="角色" name="role">
                <Select><Select.Option value="admin">管理员</Select.Option><Select.Option value="manager">经理</Select.Option><Select.Option value="member">普通成员</Select.Option></Select>
              </Form.Item>
              <Form.Item label="管理员权限" name="isAdmin" valuePropName="checked"><Switch /></Form.Item>
              <Form.Item label="账户状态" name="isActive" valuePropName="checked"><Switch checkedChildren="正常" unCheckedChildren="禁用" /></Form.Item>
              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space><Button onClick={() => setModalVisible(false)}>取消</Button><Button type="primary" htmlType="submit">{editingUser ? '保存' : '添加'}</Button></Space>
              </Form.Item>
            </Form>
          </Modal>
          
          <Drawer title={selectedUser ? `${selectedUser.name} 的电子档案` : '员工档案'} width={900} open={detailDrawerVisible} onClose={() => { setDetailDrawerVisible(false); setSelectedUser(null); }}
            extra={
              <Space>
                <Button type="primary" onClick={() => {
                  profileForm.setFieldsValue({
                    ...selectedUser,
                    birthDate: selectedUser?.birthDate ? dayjs(selectedUser.birthDate) : null,
                    entryDate: selectedUser?.entryDate ? dayjs(selectedUser.entryDate) : null,
                    probationEndDate: selectedUser?.probationEndDate ? dayjs(selectedUser.probationEndDate) : null,
                    formalDate: selectedUser?.formalDate ? dayjs(selectedUser.formalDate) : null,
                    contractStartDate: selectedUser?.contractStartDate ? dayjs(selectedUser.contractStartDate) : null,
                    contractEndDate: selectedUser?.contractEndDate ? dayjs(selectedUser.contractEndDate) : null,
                    graduationDate: selectedUser?.graduationDate ? dayjs(selectedUser.graduationDate) : null,
                    titleDeclarationDate: selectedUser?.titleDeclarationDate ? dayjs(selectedUser.titleDeclarationDate) : null,
                    certIssueDate: selectedUser?.certIssueDate ? dayjs(selectedUser.certIssueDate) : null,
                    ssStartDate: selectedUser?.ssStartDate ? dayjs(selectedUser.ssStartDate) : null,
                    idCardExpiry: selectedUser?.idCardExpiry ? dayjs(selectedUser.idCardExpiry) : null,
                    latestContractStart: selectedUser?.latestContractStart ? dayjs(selectedUser.latestContractStart) : null,
                    latestContractEnd: selectedUser?.latestContractEnd ? dayjs(selectedUser.latestContractEnd) : null,
                  })
                  setProfileModalVisible(true)
                }}>编辑档案</Button>
              </Space>
            }
          >
            {selectedUser && (
              <>
                {/* 员工卡片 */}
                <Card style={{ marginBottom: 16, background: '#f0f5ff', border: '1px solid #d6e4ff' }}>
                  <Row gutter={24} align="middle">
                    <Col>
                      <div style={{
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: '#1890ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 32,
                        fontWeight: 'bold'
                      }}>
                        {selectedUser.name ? selectedUser.name.charAt(0) : '?'}
                      </div>
                    </Col>
                    <Col flex="auto">
                      <Row gutter={[32, 16]}>
                        <Col span={8}>
                          <div style={{ color: '#666', fontSize: 12 }}>姓名</div>
                          <div style={{ fontSize: 16, fontWeight: 'bold' }}>{selectedUser.name || '-'}</div>
                        </Col>
                        <Col span={8}>
                          <div style={{ color: '#666', fontSize: 12 }}>工号</div>
                          <div style={{ fontSize: 16, fontWeight: 'bold' }}>{selectedUser.employeeNo || '-'}</div>
                        </Col>
                        <Col span={8}>
                          <div style={{ color: '#666', fontSize: 12 }}>部门</div>
                          <div style={{ fontSize: 16, fontWeight: 'bold' }}>{selectedUser.departmentName || '-'}</div>
                        </Col>
                        <Col span={8}>
                          <div style={{ color: '#666', fontSize: 12 }}>职位</div>
                          <div style={{ fontSize: 14 }}>{selectedUser.position || '-'}</div>
                        </Col>
                        <Col span={8}>
                          <div style={{ color: '#666', fontSize: 12 }}>手机号</div>
                          <div style={{ fontSize: 14 }}>{selectedUser.phone || '-'}</div>
                        </Col>
                        <Col span={8}>
                          <div style={{ color: '#666', fontSize: 12 }}>入职时间</div>
                          <div style={{ fontSize: 14 }}>{selectedUser.entryDate || '-'}</div>
                        </Col>
                        <Col span={8}>
                          <div style={{ color: '#666', fontSize: 12 }}>性别</div>
                          <div style={{ fontSize: 14 }}>{selectedUser.gender || '-'}</div>
                        </Col>
                        <Col span={8}>
                          <div style={{ color: '#666', fontSize: 12 }}>身份证号</div>
                          <div style={{ fontSize: 14 }}>{selectedUser.idCard || '-'}</div>
                        </Col>
                        <Col span={8}>
                          <div style={{ color: '#666', fontSize: 12 }}>门禁指纹编号</div>
                          <div style={{ fontSize: 14, color: '#1890ff', fontWeight: 'bold' }}>{selectedUser.fingerprintId || '-'}</div>
                        </Col>
                      </Row>
                    </Col>
                  </Row>
                </Card>

              <Tabs defaultActiveKey="basic" items={[
                { key: 'basic', label: '基本信息', children: (
                  <Descriptions bordered column={3} size="small">
                    <Descriptions.Item label="姓名">{selectedUser.name}</Descriptions.Item>
                    <Descriptions.Item label="工号">{selectedUser.employeeNo || '-'}</Descriptions.Item>
                    <Descriptions.Item label="部门">{selectedUser.departmentName || '-'}</Descriptions.Item>
                    <Descriptions.Item label="人员分类">{selectedUser.personnelCategory || '-'}</Descriptions.Item>
                    <Descriptions.Item label="岗位">{selectedUser.position || '-'}</Descriptions.Item>
                    <Descriptions.Item label="入职时间">{selectedUser.entryDate || '-'}</Descriptions.Item>
                    <Descriptions.Item label="性别">{selectedUser.gender || '-'}</Descriptions.Item>
                    <Descriptions.Item label="出生日期">{selectedUser.birthDate || '-'}</Descriptions.Item>
                    <Descriptions.Item label="年龄">{selectedUser.age || '-'}</Descriptions.Item>
                    <Descriptions.Item label="身份证号码">{selectedUser.idCard || '-'}</Descriptions.Item>
                    <Descriptions.Item label="电话">{selectedUser.phone || '-'}</Descriptions.Item>
                    <Descriptions.Item label="门禁指纹编号">{selectedUser.fingerprintId || '-'}</Descriptions.Item>
                    <Descriptions.Item label="籍贯">{selectedUser.nativePlace || '-'}</Descriptions.Item>
                    <Descriptions.Item label="家庭住址">{selectedUser.homeAddress || '-'}</Descriptions.Item>
                    <Descriptions.Item label="民族">{selectedUser.ethnicity || '-'}</Descriptions.Item>
                    <Descriptions.Item label="邮箱">{selectedUser.email || '-'}</Descriptions.Item>
                    <Descriptions.Item label="身份证有效期">{selectedUser.idCardExpiry || '-'}</Descriptions.Item>
                  </Descriptions>
                ) },
                { key: 'education', label: '学历与证书', children: (
                  <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="学历">{selectedUser.education || '-'}</Descriptions.Item>
                    <Descriptions.Item label="专业">{selectedUser.major || '-'}</Descriptions.Item>
                    <Descriptions.Item label="毕业院校">{selectedUser.graduationSchool || '-'}</Descriptions.Item>
                    <Descriptions.Item label="毕业时间">{selectedUser.graduationDate || '-'}</Descriptions.Item>
                    <Descriptions.Item label="证书名称">{selectedUser.certName || '-'}</Descriptions.Item>
                    <Descriptions.Item label="证书编号">{selectedUser.certNo || '-'}</Descriptions.Item>
                    <Descriptions.Item label="颁发日期">{selectedUser.certIssueDate || '-'}</Descriptions.Item>
                    <Descriptions.Item label="职称">{selectedUser.professionalTitle || '-'}</Descriptions.Item>
                  </Descriptions>
                ) },
                { key: 'work', label: '工作信息', children: (
                  <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="转正日期">{selectedUser.formalDate || '-'}</Descriptions.Item>
                    <Descriptions.Item label="试用期工资">{selectedUser.probationSalary || '-'}</Descriptions.Item>
                    <Descriptions.Item label="转正工资">{selectedUser.formalSalary || '-'}</Descriptions.Item>
                    <Descriptions.Item label="工龄补贴">{selectedUser.seniorityAllowance || '-'}</Descriptions.Item>
                    <Descriptions.Item label="基本工资">{selectedUser.salaryBase || '-'}</Descriptions.Item>
                    <Descriptions.Item label="工龄">{selectedUser.workYears || '-'}</Descriptions.Item>
                    <Descriptions.Item label="合同起始时间">{selectedUser.contractStartDate || '-'}</Descriptions.Item>
                    <Descriptions.Item label="合同终止时间">{selectedUser.contractEndDate || '-'}</Descriptions.Item>
                    <Descriptions.Item label="最新合同起始">{selectedUser.latestContractStart || '-'}</Descriptions.Item>
                    <Descriptions.Item label="最新合同终止">{selectedUser.latestContractEnd || '-'}</Descriptions.Item>
                    <Descriptions.Item label="合同编号">{selectedUser.contractNo || '-'}</Descriptions.Item>
                    <Descriptions.Item label="合同期限">{selectedUser.contractTerm || '-'}</Descriptions.Item>
                    <Descriptions.Item label="签合同次数">{selectedUser.contractCount || '-'}</Descriptions.Item>
                    <Descriptions.Item label="社保缴纳时间">{selectedUser.ssStartDate || '-'}</Descriptions.Item>
                  </Descriptions>
                ) },
                { key: 'bank', label: '银行与社保', children: (
                  <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="银行卡号">{selectedUser.bankAccount || '-'}</Descriptions.Item>
                    <Descriptions.Item label="开户行">{selectedUser.bankName || '-'}</Descriptions.Item>
                    <Descriptions.Item label="银行支行">{selectedUser.bankBranch || '-'}</Descriptions.Item>
                    <Descriptions.Item label="行号">{selectedUser.bankCode || '-'}</Descriptions.Item>
                    <Descriptions.Item label="社保号">{selectedUser.socialSecurityNo || '-'}</Descriptions.Item>
                    <Descriptions.Item label="公积金号">{selectedUser.providentFundNo || '-'}</Descriptions.Item>
                  </Descriptions>
                ) },
                { key: 'emergency', label: '紧急联系人', children: (
                  <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="紧急联系人">{selectedUser.emergencyContact || '-'}</Descriptions.Item>
                    <Descriptions.Item label="关系">{selectedUser.emergencyRelation || '-'}</Descriptions.Item>
                    <Descriptions.Item label="联系方式">{selectedUser.emergencyPhone || '-'}</Descriptions.Item>
                  </Descriptions>
                ) },
                { key: 'documents', label: '入职材料', children: (
                  <div style={{ padding: '16px' }}>
                    {[
                      { type: 'id_card', label: '身份证复印件' },
                      { type: 'graduation_cert', label: '毕业证书复印件' },
                      { type: 'degree_cert', label: '学位证书复印件' },
                      { type: 'medical_exam', label: '入职体检扫描件' },
                      { type: 'resignation_cert', label: '离职证明扫描件' },
                      { type: 'student_status', label: '学籍在线证明图片' }
                    ].map(doc => {
                      const uploadedDoc = selectedUser.documents?.find((d: any) => d.type === doc.type)
                      return (
                        <div key={doc.type} style={{ marginBottom: '24px', padding: '16px', border: '1px solid #f0f0f0', borderRadius: '8px' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>{doc.label}</div>
                          {uploadedDoc ? (
                            <div>
                              <div style={{ marginBottom: '8px' }}>
                                <a href={uploadedDoc.url} target="_blank" rel="noopener noreferrer">
                                  {uploadedDoc.name}
                                </a>
                              </div>
                              <div style={{ fontSize: '12px', color: '#999' }}>
                                上传时间: {dayjs(uploadedDoc.uploadedAt).format('YYYY-MM-DD HH:mm')}
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: '#999' }}>未上传</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) },
                { key: 'records', label: '人事变动', children: (
                  <Timeline
                    items={selectedUser.workRecords?.map((r: any) => ({
                      color: r.record_type === 'resignation' ? 'red' : r.record_type === 'entry' ? 'green' : 'blue',
                      children: (
                        <div>
                          <div><strong>{r.record_type === 'entry' ? '入职' : r.record_type === 'transfer' ? '转岗' : r.record_type === 'promotion' ? '晋升' : r.record_type === 'resignation' ? '离职' : r.record_type}</strong> · {dayjs(r.effective_date).format('YYYY-MM-DD')}</div>
                          {r.old_value && <div style={{ fontSize: 12, color: '#666' }}>原: {r.old_value}</div>}
                          {r.new_value && <div style={{ fontSize: 12, color: '#666' }}>新: {r.new_value}</div>}
                          {r.reason && <div style={{ fontSize: 12, color: '#999' }}>原因: {r.reason}</div>}
                        </div>
                      )
                    })) || [{ children: '暂无记录' }]}
                  />
                ) },
              ]} />
            </>
          )}
          </Drawer>
          
          <Modal title="编辑员工档案" open={profileModalVisible} onCancel={() => setProfileModalVisible(false)} onOk={() => profileForm.submit()} width={900}>
            <Form form={profileForm} layout="vertical" onFinish={handleProfileUpdate}>
              <Tabs defaultActiveKey="basic" items={[
                { key: 'basic', label: '基本信息', children: (
                  <>
                    <Row gutter={16}>
                      <Col span={8}><Form.Item name="name" label="姓名"><Input /></Form.Item></Col>
                      <Col span={8}><Form.Item name="employeeNo" label="工号"><Input /></Form.Item></Col>
                      <Col span={8}><Form.Item name="departmentName" label="部门"><Input /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={8}><Form.Item name="personnelCategory" label="人员分类"><Select><Select.Option value="正式员工">正式员工</Select.Option><Select.Option value="试用期">试用期</Select.Option><Select.Option value="实习生">实习生</Select.Option><Select.Option value="外包">外包</Select.Option></Select></Form.Item></Col>
                      <Col span={8}><Form.Item name="position" label="岗位"><Input /></Form.Item></Col>
                      <Col span={8}><Form.Item name="jobLevel" label="职级"><Input /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={8}><Form.Item name="entryDate" label="入职日期"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="idCard" label="身份证号"><Input onChange={(e) => {
                        const idCard = e.target.value
                        if (idCard.length === 18) {
                          const gender = parseInt(idCard[16]) % 2 === 1 ? '男' : '女'
                          const birthYear = idCard.slice(6, 10)
                          const birthMonth = idCard.slice(10, 12)
                          const birthDay = idCard.slice(12, 14)
                          profileForm.setFieldsValue({
                            gender,
                            birthDate: dayjs(`${birthYear}-${birthMonth}-${birthDay}`)
                          })
                        }
                      }} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="phone" label="电话"><Input /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={8}><Form.Item name="gender" label="性别"><Select><Select.Option value="男">男</Select.Option><Select.Option value="女">女</Select.Option></Select></Form.Item></Col>
                      <Col span={8}><Form.Item name="birthDate" label="出生日期"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="idCardExpiry" label="身份证有效期"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}><Form.Item name="address" label="现住址"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="homeAddress" label="家庭住址"><Input /></Form.Item></Col>
                    </Row>
                  </>
                ) },
                { key: 'edu', label: '学历与证书', children: (
                  <>
                    <Row gutter={16}>
                      <Col span={8}><Form.Item name="education" label="学历"><Select><Select.Option value="高中">高中</Select.Option><Select.Option value="大专">大专</Select.Option><Select.Option value="本科">本科</Select.Option><Select.Option value="硕士">硕士</Select.Option><Select.Option value="博士">博士</Select.Option></Select></Form.Item></Col>
                      <Col span={8}><Form.Item name="major" label="专业"><Input /></Form.Item></Col>
                      <Col span={8}><Form.Item name="graduationSchool" label="毕业院校"><Input /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={8}><Form.Item name="graduationDate" label="毕业时间"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="certName" label="证书名称"><Input /></Form.Item></Col>
                      <Col span={8}><Form.Item name="certNo" label="证书编号"><Input /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={8}><Form.Item name="certIssueDate" label="颁发日期"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="professionalTitle" label="职称"><Input /></Form.Item></Col>
                    </Row>
                  </>
                ) },
                { key: 'work', label: '工作信息', children: (
                  <>
                    <Row gutter={16}>
                      <Col span={8}><Form.Item name="formalDate" label="转正日期"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="probationEndDate" label="试用期结束"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="probationSalary" label="试用期工资"><Input type="number" min={0} /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={8}><Form.Item name="formalSalary" label="转正工资"><Input type="number" min={0} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="seniorityAllowance" label="工龄补贴"><Input type="number" min={0} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="salaryBase" label="基本工资"><Input type="number" min={0} /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={8}><Form.Item name="contractStartDate" label="合同起始"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="contractEndDate" label="合同终止"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="contractNo" label="合同编号"><Input /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={8}><Form.Item name="latestContractStart" label="最新合同起始"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="latestContractEnd" label="最新合同终止"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="contractTerm" label="合同期限"><Input placeholder="如：3年" /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={8}><Form.Item name="contractCount" label="签合同次数"><Input type="number" min={0} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="ssStartDate" label="社保缴纳时间"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                    </Row>
                  </>
                ) },
                { key: 'bank', label: '银行信息', children: (
                  <>
                    <Row gutter={16}>
                      <Col span={12}><Form.Item name="bankAccount" label="银行卡号"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="bankName" label="开户行"><Input /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}><Form.Item name="bankBranch" label="银行支行"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="bankCode" label="行号"><Input /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}><Form.Item name="socialSecurityNo" label="社保号"><Input /></Form.Item></Col>
                      <Col span={12}><Form.Item name="providentFundNo" label="公积金号"><Input /></Form.Item></Col>
                    </Row>
                  </>
                ) },
                { key: 'emergency', label: '紧急联系人', children: (
                  <Row gutter={16}>
                    <Col span={8}><Form.Item name="emergencyContact" label="紧急联系人"><Input /></Form.Item></Col>
                    <Col span={8}><Form.Item name="emergencyRelation" label="关系"><Input /></Form.Item></Col>
                    <Col span={8}><Form.Item name="emergencyPhone" label="联系方式"><Input /></Form.Item></Col>
                  </Row>
                ) },
                { key: 'documents', label: '入职材料', children: (
                  <div style={{ padding: '16px' }}>
                    <p style={{ marginBottom: '16px', color: '#666' }}>请上传员工的入职材料（支持图片、PDF等格式）</p>
                    {[
                      { type: 'id_card', label: '身份证复印件', accept: '.jpg,.jpeg,.png,.pdf' },
                      { type: 'graduation_cert', label: '毕业证书复印件', accept: '.jpg,.jpeg,.png,.pdf' },
                      { type: 'degree_cert', label: '学位证书复印件', accept: '.jpg,.jpeg,.png,.pdf' },
                      { type: 'medical_exam', label: '入职体检扫描件', accept: '.jpg,.jpeg,.png,.pdf' },
                      { type: 'resignation_cert', label: '离职证明扫描件', accept: '.jpg,.jpeg,.png,.pdf' },
                      { type: 'student_status', label: '学籍在线证明图片', accept: '.jpg,.jpeg,.png,.pdf' }
                    ].map(doc => {
                      const uploadedDoc = selectedUser?.documents?.find((d: any) => d.type === doc.type)
                      return (
                        <div key={doc.type} style={{ marginBottom: '24px', padding: '16px', border: '1px solid #f0f0f0', borderRadius: '8px' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '12px' }}>{doc.label}</div>
                          {uploadedDoc ? (
                            <div style={{ marginBottom: '12px' }}>
                              <div>已上传: <a href={uploadedDoc.url} target="_blank" rel="noopener noreferrer">{uploadedDoc.name}</a></div>
                              <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                                上传时间: {dayjs(uploadedDoc.uploadedAt).format('YYYY-MM-DD HH:mm')}
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: '#999', marginBottom: '12px' }}>未上传</div>
                          )}
                          <Upload
                            beforeUpload={(file) => {
                              uploadDocument(file, doc.type, selectedUser?.id)
                              return false
                            }}
                            accept={doc.accept}
                            maxCount={1}
                            showUploadList={false}
                          >
                            <Button icon={<UploadOutlined />}>{uploadedDoc ? '重新上传' : '点击上传'}</Button>
                          </Upload>
                        </div>
                      )
                    })}
                  </div>
                ) },
                { key: 'remarks', label: '备注', children: (
                  <Form.Item name="remarks" label="备注"><Input.TextArea rows={4} /></Form.Item>
                ) },
              ]} />
            </Form>
          </Modal>
          
          <Modal title="办理离职" open={resignModalVisible} onCancel={() => { setResignModalVisible(false); setResigningUser(null); }} onOk={() => resignForm.submit()}>
            <Form form={resignForm} layout="vertical" onFinish={handleResign}>
              <p>正在为 <strong>{resigningUser?.name}</strong> 办理离职手续</p>
              <Form.Item name="resignationDate" label="离职日期" rules={[{ required: true, message: '请选择离职日期' }]} initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="reason" label="离职原因">
                <Input.TextArea rows={3} placeholder="请输入离职原因" />
              </Form.Item>
            </Form>
          </Modal>
          
          <Modal title="导入员工" open={importModalVisible} onCancel={() => { setImportModalVisible(false); setImportFile(null); setImportResult(null); }} onOk={handleImport} confirmLoading={importLoading}>
            <div style={{ marginBottom: 16 }}><Button type="link" onClick={downloadTemplate}>下载导入模板</Button></div>
            <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
            <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>支持 CSV、Excel 格式</div>
            {importResult && (
              <div style={{ marginTop: 16, padding: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
                <div><strong>导入结果</strong></div>
                <div>总记录数: {importResult.total}，成功: {importResult.success}，失败: {importResult.fail}</div>
              </div>
            )}
          </Modal>
        </div>
      )}
      
      {currentView === 'assets' && (
        <div>
          <Breadcrumb style={{ marginBottom: 24 }} items={[
            { title: <span onClick={() => setCurrentView('dashboard')} style={{ cursor: 'pointer' }}>人事管理中心</span> },
            { title: '资产管理' }
          ]} />
          <Assets />
        </div>
      )}
      
      {currentView === 'alerts' && (
        <div>
          <Breadcrumb style={{ marginBottom: 24 }} items={[
            { title: <span onClick={() => setCurrentView('dashboard')} style={{ cursor: 'pointer' }}>人事管理中心</span> },
            { title: '智能预警' }
          ]} />
          <Alerts />
        </div>
      )}
      
      {currentView === 'contracts' && (
        <div>
          <Breadcrumb style={{ marginBottom: 24 }} items={[
            { title: <span onClick={() => setCurrentView('dashboard')} style={{ cursor: 'pointer' }}>人事管理中心</span> },
            { title: '项目合同管理' }
          ]} />
          <Contracts />
        </div>
      )}
      
      {currentView === 'attendance' && (
        <div>
          <Breadcrumb style={{ marginBottom: 24 }} items={[
            { title: <span onClick={() => setCurrentView('dashboard')} style={{ cursor: 'pointer' }}>人事管理中心</span> },
            { title: '打卡管理' }
          ]} />
          <Attendance />
        </div>
      )}
      
      {currentView === 'timeTracking' && (
        <div>
          <Breadcrumb style={{ marginBottom: 24 }} items={[
            { title: <span onClick={() => setCurrentView('dashboard')} style={{ cursor: 'pointer' }}>人事管理中心</span> },
            { title: '工时管理' }
          ]} />
          <TimeTracking />
        </div>
      )}
      
      {currentView === 'dailyReport' && (
        <div>
          <Breadcrumb style={{ marginBottom: 24 }} items={[
            { title: <span onClick={() => setCurrentView('dashboard')} style={{ cursor: 'pointer' }}>人事管理中心</span> },
            { title: '日报管理' }
          ]} />
          <DailyReport />
        </div>
      )}
      
      {currentView === 'outsourcing' && (
        <div>
          <Breadcrumb style={{ marginBottom: 24 }} items={[
            { title: <span onClick={() => setCurrentView('dashboard')} style={{ cursor: 'pointer' }}>人事管理中心</span> },
            { title: '委外信息管理' }
          ]} />
          <Outsourcing />
        </div>
      )}
      
    </div>
  )
}
