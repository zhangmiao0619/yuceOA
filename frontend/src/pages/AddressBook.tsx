// @ts-nocheck
import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, Modal, message, Spin, Tree, Row, Col, Input, Avatar, Popconfirm } from 'antd'
import { SyncOutlined, UserOutlined, TeamOutlined, ReloadOutlined, SearchOutlined, PhoneOutlined, MailOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import api from '../lib/api'
import { hasPermission } from '../stores/auth'

const { Search } = Input

export default function AddressBook() {
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [selectedDept, setSelectedDept] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)

  interface Department {
    id: number
    name: string
    parentid: number
    order: number
  }

  useEffect(() => {
    loadDepartments()
    loadUsers()
  }, [])

  useEffect(() => {
    if (searchText) {
      const filtered = allUsers.filter(u => 
        u.name?.includes(searchText) || 
        u.mobile?.includes(searchText) ||
        u.position?.includes(searchText)
      )
      setUsers(filtered)
    } else if (selectedDept) {
      const filtered = allUsers.filter(u => u.main_department === selectedDept)
      setUsers(filtered)
    } else {
      setUsers(allUsers)
    }
  }, [searchText, selectedDept, allUsers])

  const loadDepartments = async () => {
    try {
      const res = await api.get('/wechat/departments')
      if (res.success) {
        setDepartments(res.data)
      } else {
        // 企业微信接口失败时，从本地用户数据提取部门
        extractDepartmentsFromUsers()
      }
    } catch (err) {
      // 企业微信未配置或接口失败时，从本地用户数据提取部门
      extractDepartmentsFromUsers()
    }
  }

  const extractDepartmentsFromUsers = () => {
    const deptMap = new Map<number, Department>()
    allUsers.forEach((u: any) => {
      if (u.department_name) {
        const deptId = u.main_department || 1
        if (!deptMap.has(deptId)) {
          deptMap.set(deptId, {
            id: deptId,
            name: u.department_name,
            parentid: 0,
            order: 0
          })
        }
      }
    })
    // 如果没有部门，添加一个默认部门
    if (deptMap.size === 0) {
      deptMap.set(1, { id: 1, name: '全部成员', parentid: 0, order: 0 })
    }
    setDepartments(Array.from(deptMap.values()))
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await api.get('/users')
      if (res.success) {
        const userData = res.data.map((u: any) => ({
          userid: u.id,
          name: u.name || u.username,
          mobile: u.phone,
          email: u.email,
          position: u.role === 'admin' ? '管理员' : u.role === 'manager' ? '经理' : '成员',
          main_department: u.departmentId ? parseInt(u.departmentId) : 1,
          department_name: u.departmentName,
          avatar: u.avatar,
          status: u.isActive ? 1 : 0
        }))
        setAllUsers(userData)
        setUsers(userData)
      }
    } catch (err) {
      message.error('加载用户失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await api.post('/wechat/sync-address-book')
      if (res.success) {
        message.success(`同步完成：新增${res.data?.created || 0}人，更新${res.data?.updated || 0}人`)
        loadUsers()
      } else {
        message.error(res.message || '同步失败')
      }
    } catch (err: any) {
      message.error(err.message || '同步失败')
    } finally {
      setSyncing(false)
    }
  }

  const handleDeptSelect = async (deptId: number) => {
    setSelectedDept(deptId)
    setSearchText('')
  }

  const handleEdit = (user: any) => {
    setSelectedUser(user)
    setEditModalVisible(true)
  }

  const handleSaveEdit = async (values: any) => {
    if (!selectedUser) return
    try {
      const res = await api.put(`/users/${selectedUser.userid}`, values)
      if (res.success) {
        message.success('更新成功')
        setEditModalVisible(false)
        setSelectedUser(null)
        loadUsers()
      }
    } catch (err) {
      message.error('更新失败')
    }
  }

  const handleDelete = async (userId: string) => {
    try {
      const res = await api.delete(`/users/${userId}`)
      if (res.success) {
        message.success('删除成功')
        loadUsers()
      }
    } catch (err) {
      message.error('删除失败')
    }
  }

  const handleCall = (phone: string) => {
    if (phone) {
      window.location.href = `tel:${phone}`
    }
  }

  const handleEmail = (email: string) => {
    if (email) {
      window.location.href = `mailto:${email}`
    }
  }

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text: string, record: any) => (
        <Space>
          <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>
            {(text || '?')[0]}
          </Avatar>
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'department',
      width: 120,
      render: (text: string) => text || '-'
    },
    {
      title: '职位',
      dataIndex: 'position',
      key: 'position',
      width: 100,
    },
    {
      title: '手机',
      dataIndex: 'mobile',
      key: 'mobile',
      width: 130,
      render: (mobile: string) => mobile ? (
        <Space>
          <span>{mobile}</span>
          <Button type="link" size="small" icon={<PhoneOutlined />} onClick={() => handleCall(mobile)} />
        </Space>
      ) : '-'
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 180,
      render: (email: string) => email ? (
        <Space>
          <span style={{ fontSize: 12 }}>{email}</span>
          <Button type="link" size="small" icon={<MailOutlined />} onClick={() => handleEmail(email)} />
        </Space>
      ) : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: number) => (
        <Tag color={status === 1 ? 'green' : 'red'}>
          {status === 1 ? '正常' : '禁用'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" onClick={() => {
            setSelectedUser(record)
            setDetailModalVisible(true)
          }}>
            详情
          </Button>
          {hasPermission('canManageAddressBook') && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
        </Space>
      )
    }
  ]

  return (
    <div>
      <h2>通讯录管理</h2>
      
      <Row gutter={16}>
        <Col span={6}>
          <Card 
            title={<><TeamOutlined /> 部门列表</>}
            extra={
              <Button type="text" icon={<ReloadOutlined />} onClick={loadDepartments} />
            }
            style={{ height: '100%' }}
          >
            <div style={{ marginBottom: 16 }}>
              <Search
                placeholder="搜索成员..."
                allowClear
                onSearch={setSearchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <Tree
              showIcon
              defaultExpandAll
              treeData={departments.map(dept => ({
                key: dept.id,
                title: dept.name,
              }))}
              onSelect={(keys) => {
                if (keys[0]) {
                  handleDeptSelect(Number(keys[0]))
                } else {
                  setSelectedDept(null)
                  setUsers(allUsers)
                }
              }}
              selectedKeys={selectedDept ? [selectedDept] : []}
            />
            <div style={{ marginTop: 16 }}>
              <Button 
                type="link" 
                onClick={() => {
                  setSelectedDept(null)
                  setSearchText('')
                  setUsers(allUsers)
                }}
              >
                显示全部成员
              </Button>
            </div>
          </Card>
        </Col>
        
        <Col span={18}>
          <Card
            title={<><UserOutlined /> 成员列表 ({users.length}人)</>}
            extra={
              <Space>
                <Search
                  placeholder="搜索..."
                  allowClear
                  onSearch={setSearchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: 200 }}
                />
                <Button 
                  type="primary" 
                  icon={<SyncOutlined spin={syncing} />}
                  onClick={handleSync}
                  loading={syncing}
                >
                  {syncing ? '同步中...' : '同步通讯录'}
                </Button>
              </Space>
            }
          >
            <Spin spinning={loading}>
              <Table
                columns={columns}
                dataSource={users}
                rowKey="userid"
                size="small"
                scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
                pagination={{
                  current: 1,
                  pageSize: 10,
                  pageSizeOptions: ['10', '20', '50'],
                  showSizeChanger: true,
                  showTotal: (t: number) => `共 ${t} 条`,
                }}
              />
            </Spin>
          </Card>
        </Col>
      </Row>

      <Modal
        title="成员详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false)
          setSelectedUser(null)
        }}
        footer={null}
        width={500}
      >
        {selectedUser && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Avatar size={80} style={{ backgroundColor: '#1890ff', fontSize: 32 }}>
                {(selectedUser.name || '?')[0]}
              </Avatar>
              <h3 style={{ marginTop: 16 }}>{selectedUser.name}</h3>
              <p style={{ color: '#999' }}>{selectedUser.department_name} · {selectedUser.position}</p>
            </div>
            <div style={{ padding: '0 20px' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#999', fontSize: 12 }}>手机</div>
                <div>
                  {selectedUser.mobile || '-'}
                  {selectedUser.mobile && (
                    <Button type="link" icon={<PhoneOutlined />} onClick={() => handleCall(selectedUser.mobile)}>
                      拨打
                    </Button>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#999', fontSize: 12 }}>邮箱</div>
                <div>
                  {selectedUser.email || '-'}
                  {selectedUser.email && (
                    <Button type="link" icon={<MailOutlined />} onClick={() => handleEmail(selectedUser.email)}>
                      发送邮件
                    </Button>
                  )}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#999', fontSize: 12 }}>状态</div>
                <div>
                  <Tag color={selectedUser.status === 1 ? 'green' : 'red'}>
                    {selectedUser.status === 1 ? '正常' : '禁用'}
                  </Tag>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="编辑成员"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false)
          setSelectedUser(null)
        }}
        footer={null}
        width={500}
      >
        {selectedUser && (
          <div style={{ padding: 16 }}>
            <p><strong>姓名：</strong>{selectedUser.name}</p>
            <p><strong>部门：</strong>{selectedUser.department_name || '-'}</p>
            <p><strong>职位：</strong>{selectedUser.position || '-'}</p>
            <p style={{ color: '#999' }}>如需修改信息，请联系管理员更新企业微信通讯录后重新同步。</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
