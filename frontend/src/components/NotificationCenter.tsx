import { useState } from 'react'
import { Badge, Dropdown, List, Button, Empty, Tabs, Tag } from 'antd'
import { BellOutlined, CheckOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

interface Notification {
  id: string
  type: 'task' | 'workflow' | 'system' | 'reminder'
  title: string
  content: string
  link?: string
  isRead: boolean
  createdAt: string
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  // 获取通知列表
  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications')
      return res.data?.data || []
    },
    refetchInterval: 30000 // 每30秒刷新
  })

  // 获取未读数量
  const { data: unreadCount } = useQuery<number>({
    queryKey: ['unreadCount'],
    queryFn: async () => {
      const res = await api.get('/notifications/unread-count')
      return res.data?.data || 0
    },
    refetchInterval: 30000
  })

  // 标记已读
  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/notifications/${id}/read`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
    }
  })

  // 标记全部已读
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      await api.put('/notifications/read-all')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
    }
  })

  const unreadNotifications = notifications?.filter(n => !n.isRead) || []
  const readNotifications = notifications?.filter(n => n.isRead) || []

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      task: 'blue',
      workflow: 'orange',
      system: 'default',
      reminder: 'red'
    }
    return colors[type] || 'default'
  }

  const getTypeText = (type: string) => {
    const texts: Record<string, string> = {
      task: '任务',
      workflow: '审批',
      system: '系统',
      reminder: '提醒'
    }
    return texts[type] || type
  }

  const NotificationList = ({ data, showRead = false }: { data: Notification[], showRead?: boolean }) => (
    <List
      size="small"
      dataSource={data}
      renderItem={(item) => (
        <List.Item
          className={`notification-item ${!item.isRead ? 'unread' : ''}`}
          style={{ 
            backgroundColor: !item.isRead ? '#f0f7ff' : 'transparent',
            padding: '12px 16px',
            cursor: 'pointer'
          }}
          actions={
            !item.isRead
              ? [
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      markAsRead.mutate(item.id)
                    }}
                  >
                    标为已读
                  </Button>
                ]
              : undefined
          }
        >
          <List.Item.Meta
            avatar={<Tag color={getTypeColor(item.type)}>{getTypeText(item.type)}</Tag>}
            title={
              <Link 
                to={item.link || '#'} 
                style={{ color: 'inherit' }}
                onClick={() => {
                  if (!item.isRead) markAsRead.mutate(item.id)
                  setOpen(false)
                }}
              >
                {item.title}
              </Link>
            }
            description={
              <div>
                <div style={{ marginBottom: 4 }}>{item.content}</div>
                <span style={{ color: '#999', fontSize: 12 }}>
                  {dayjs(item.createdAt).fromNow()}
                </span>
              </div>
            }
          />
        </List.Item>
      )}
      locale={{
        emptyText: <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      }}
    />
  )

  const items = [
    {
      key: 'unread',
      label: (
        <span>
          未读消息
          {unreadNotifications.length > 0 && (
            <Badge count={unreadNotifications.length} style={{ marginLeft: 8 }} />
          )}
        </span>
      ),
      children: <NotificationList data={unreadNotifications} />
    },
    {
      key: 'all',
      label: '全部消息',
      children: <NotificationList data={notifications || []} showRead />
    }
  ]

  const dropdownContent = (
    <div style={{ width: 400, maxHeight: 500, overflow: 'auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #f0f0f0'
      }}>
        <span style={{ fontWeight: 'bold' }}>通知中心</span>
        {unreadNotifications.length > 0 && (
          <Button 
            type="link" 
            size="small"
            onClick={() => markAllAsRead.mutate()}
          >
            全部已读
          </Button>
        )}
      </div>
      <Tabs items={items} style={{ margin: 0 }} />
    </div>
  )

  return (
    <Dropdown
      popupRender={() => dropdownContent}
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      arrow
    >
      <Badge count={unreadCount || 0} size="small" offset={[-2, 2]}>
        <Button 
          type="text" 
          icon={<BellOutlined style={{ fontSize: 18 }} />}
          style={{ color: unreadCount ? '#1890ff' : undefined }}
        />
      </Badge>
    </Dropdown>
  )
}
