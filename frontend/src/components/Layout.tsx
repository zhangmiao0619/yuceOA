import { Layout as AntLayout, Menu, Avatar, Dropdown, Space, Drawer, Button } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  ProjectOutlined,
  FileTextOutlined,
  TeamOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuOutlined,
  HomeOutlined,
  SettingOutlined,
  DollarOutlined,
  BarChartOutlined
} from '@ant-design/icons'
import { useState } from 'react'
import { useAuthStore, hasAnyPermission } from '../stores/auth'
import NotificationCenter from './NotificationCenter'

const { Header, Sider, Content } = AntLayout

const allMenuItems = [
  { key: '/', icon: <HomeOutlined />, label: '工作台', permissions: null },
  { key: '/projects', icon: <ProjectOutlined />, label: '项目管理', permissions: ['project:view', 'project:create'] },
  // { key: '/assets', icon: <ToolOutlined />, label: '资产管理', permissions: ['hr:asset'] },
  // { key: '/tasks', icon: <CheckSquareOutlined />, label: '任务看板', permissions: ['task:view'] },
  { key: '/workflows', icon: <FileTextOutlined />, label: '审批流程', permissions: ['workflow:submit', 'workflow:approve'] },
  // { key: '/reports', icon: <BarChartOutlined />, label: '报表中心', permissions: ['system:report'] },
  { key: '/users', icon: <TeamOutlined />, label: '人事管理', permissions: ['hr:view'] },
  // { key: '/address-book', icon: <TeamOutlined />, label: '通讯录', permissions: ['system:addressBook'] },
  { key: '/admin-settings', icon: <SettingOutlined />, label: '管理员设置', permissions: ['system:settings'] },
  // { key: '/contracts', icon: <FileTextOutlined />, label: '合同管理', permissions: ['hr:contract'] },
  { key: '/finance', icon: <DollarOutlined />, label: '财务管理', permissions: ['finance:view'] },
  // { key: '/survey-deliverables', icon: <FolderOutlined />, label: '测绘成果', permissions: ['project:view'] },
  // { key: '/survey-field-records', icon: <CalendarOutlined />, label: '外业记录', permissions: ['project:view'] },
  { key: '/survey-gantt', icon: <BarChartOutlined />, label: '项目甘特图', permissions: ['project:view'] },
  // { key: '/data-export', icon: <DownloadOutlined />, label: '数据导出', permissions: ['system:dataExport'] },
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)

  // 根据权限过滤菜单
  const menuItems = allMenuItems
    .filter(item => {
      if (!item.permissions) return true
      if (user?.isAdmin) return true
      // 非管理员隐藏管理员设置和财务管理
      if (item.key === '/admin-settings' || item.key === '/finance') return false
      return hasAnyPermission(item.permissions as any)
    })
    .map(({ permissions, ...item }) => item)

  // 检测屏幕大小变化
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      setIsMobile(window.innerWidth <= 768)
    })
  }

  const userMenuItems = [
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: logout }
  ]

  // 移动端菜单内容
  const mobileMenuItems = menuItems.map(item => ({
    ...item,
    onClick: () => {
      navigate(item.key)
      setMobileMenuVisible(false)
    }
  }))

  return (
    <AntLayout style={{ minHeight: '100vh', height: '100vh', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
      {/* 桌面端侧边栏 */}
      {!isMobile && (
        <Sider theme="light" width={200} breakpoint="lg" collapsedWidth={0} style={{ flexShrink: 0 }}>
          <div style={{ 
            height: 64, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 'bold',
            borderBottom: '1px solid #f0f0f0'
          }}>
            OA 办公系统
          </div>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
          />
        </Sider>
      )}
      
      <AntLayout style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <Header style={{ 
          background: '#fff', 
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          gap: 16,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          width: '100%'
        }}>
          {/* 移动端菜单按钮 */}
          {isMobile && (
            <Button 
              type="text" 
              icon={<MenuOutlined />} 
              onClick={() => setMobileMenuVisible(true)}
            />
          )}
          
          {/* 移动端标题 */}
          {isMobile && (
            <div style={{ fontSize: 16, fontWeight: 'bold' }}>
              OA 系统
            </div>
          )}
          
          {/* 桌面端右侧内容 */}
          {!isMobile && <div style={{ flex: 1 }} />}
          
          <NotificationCenter />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} src={user?.avatar} />
              {!isMobile && <span>{user?.name}</span>}
            </Space>
          </Dropdown>
        </Header>
        
        <Content style={{ margin: isMobile ? 8 : 24, padding: isMobile ? 12 : 24, background: '#fff', borderRadius: 8, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <Outlet />
        </Content>
      </AntLayout>

      {/* 移动端抽屉菜单 */}
      <Drawer
        title="OA 办公系统"
        placement="left"
        onClose={() => setMobileMenuVisible(false)}
        open={mobileMenuVisible}
        width={250}
      >
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={mobileMenuItems}
          onClick={({ key }) => {
            navigate(key)
            setMobileMenuVisible(false)
          }}
        />
      </Drawer>
    </AntLayout>
  )
}
