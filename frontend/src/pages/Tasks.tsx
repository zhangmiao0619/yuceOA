// @ts-nocheck
import { useState } from 'react'
import { Card, Tag, Avatar, Badge, Button, Modal, Form, Input, Select, message } from 'antd'
import { PlusOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import api from '../lib/api'

const STATUS_TO_COLUMN: Record<string, string> = {
  unassigned: 'todo',
  assigned: 'todo',
  pending_receive: 'todo',
  received: 'in_progress',
  submitted: 'review',
  completed: 'done',
  rejected: 'todo'
}

const COLUMN_TO_STATUS: Record<string, string[]> = {
  todo: ['unassigned', 'assigned', 'pending_receive', 'rejected'],
  in_progress: ['received'],
  review: ['submitted'],
  done: ['completed']
}

const TASK_STATUS_MAP: Record<string, { color: string; text: string }> = {
  unassigned: { color: 'default', text: '未分配' },
  assigned: { color: 'cyan', text: '已分配' },
  pending_receive: { color: 'processing', text: '待签收' },
  received: { color: 'blue', text: '进行中' },
  submitted: { color: 'warning', text: '待审批' },
  completed: { color: 'success', text: '已完成' },
  rejected: { color: 'error', text: '审批驳回' },
}

interface Task {
  id: string
  title: string
  status: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assignee?: { name: string; avatar?: string }
  projectId: string
  dueDate?: string
}

interface ColumnType {
  id: string
  title: string
  status: string
}

const COLUMNS: ColumnType[] = [
  { id: 'todo', title: '待办', status: 'todo' },
  { id: 'in_progress', title: '进行中', status: 'in_progress' },
  { id: 'review', title: '审核中', status: 'review' },
  { id: 'done', title: '已完成', status: 'done' }
]

const priorityColors: Record<string, string> = {
  low: 'default',
  medium: 'blue',
  high: 'orange',
  urgent: 'red'
}

const priorityLabels: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急'
}

// 可排序的任务卡片
function SortableTask({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id, data: { task } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} />
    </div>
  )
}

// 任务卡片组件
function TaskCard({ task }: { task: Task }) {
  const statusCfg = TASK_STATUS_MAP[task.status] || { color: 'default', text: task.status }
  return (
    <Card
      size="small"
      style={{ marginBottom: 8, cursor: 'grab' }}
      bodyStyle={{ padding: 12 }}
    >
      <div style={{ fontWeight: 500, marginBottom: 8 }}>{task.title}</div>
      
      <div>
        <Tag color={statusCfg.color} style={{ marginBottom: 4 }}>{statusCfg.text}</Tag>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tag color={priorityColors[task.priority]}>
          {priorityLabels[task.priority]}
        </Tag>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {task.dueDate && (
            <span style={{ fontSize: 12, color: '#999' }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {task.dueDate.slice(0, 10)}
            </span>
          )}
          <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>
            {task.assignee?.name?.[0] || '?'}
          </Avatar>
        </div>
      </div>
    </Card>
  )
}

// 看板列组件
function BoardColumn({
  column,
  tasks,
  onAddTask
}: {
  column: ColumnType
  tasks: Task[]
  onAddTask: (status: string) => void
}) {
  const { setNodeRef } = useSortable({
    id: column.id,
    data: { type: 'column', column }
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: 1,
        minWidth: 250,
        background: '#f5f5f5',
        borderRadius: 8,
        padding: 12,
        marginRight: 16
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
      }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          {column.title}
          <Badge count={tasks.length} style={{ marginLeft: 8, backgroundColor: '#999' }} />
        </div>
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => onAddTask(column.status)}
        />
      </div>

      <SortableContext
        items={tasks.map(t => t.id)}
        strategy={verticalListSortingStrategy}
      >
        {tasks.map(task => (
          <SortableTask key={task.id} task={task} />
        ))}
      </SortableContext>
    </div>
  )
}

export default function Tasks() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newTaskStatus, setNewTaskStatus] = useState('todo')
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.get('/tasks')
  })

  // 获取用户列表用于负责人选择
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users')
  })

  const tasks: Task[] = tasksData?.data || []
  const users = usersData?.data || []

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/tasks/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      message.success('任务状态已更新')
    }
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/tasks', data),
    onSuccess: () => {
      message.success('任务创建成功')
      setIsModalOpen(false)
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const taskId = active.id as string
    const overId = over.id as string
    const overData = over.data.current

    // 确定目标列
    let targetColumn: string | null = null

    if (overData?.type === 'column') {
      targetColumn = overData.column.id
    } else if (overData?.task) {
      targetColumn = STATUS_TO_COLUMN[overData.task.status] || null
    } else {
      const matchedCol = COLUMNS.find(col => col.id === overId)
      if (matchedCol) {
        targetColumn = matchedCol.id
      }
    }

    if (targetColumn) {
      const task = tasks.find(t => t.id === taskId)
      if (task) {
        const currentCol = STATUS_TO_COLUMN[task.status]
        if (currentCol !== targetColumn) {
          const targetStatuses = COLUMN_TO_STATUS[targetColumn]
          const newStatus = targetStatuses?.[0] || targetColumn
          if (newStatus !== task.status) {
            updateMutation.mutate({ id: taskId, status: newStatus })
          }
        }
      }
    }
  }

  const handleAddTask = (status: string) => {
    setNewTaskStatus(status)
    setIsModalOpen(true)
  }

  const handleSubmit = (values: any) => {
    createMutation.mutate({
      ...values,
      status: newTaskStatus,
      projectId: '1' // 默认项目
    })
  }

  const activeTask = tasks.find(t => t.id === activeId)

  if (isLoading) {
    return <div>加载中...</div>
  }

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>任务看板</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAddTask('todo')}>
          新建任务
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div style={{ display: 'flex', overflowX: 'auto', paddingBottom: 16 }}>
          {COLUMNS.map(column => (
            <BoardColumn
              key={column.id}
              column={column}
              tasks={tasks.filter(t => STATUS_TO_COLUMN[t.status] === column.status)}
              onAddTask={handleAddTask}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
          {activeTask ? <TaskCard task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      <Modal
        title="新建任务"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="title"
            label="任务标题"
            rules={[{ required: true, message: '请输入任务标题' }]}
          >
            <Input placeholder="请输入任务标题" />
          </Form.Item>

          <Form.Item name="priority" label="优先级" initialValue="medium">
            <Select>
              <Select.Option value="low">低</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="urgent">紧急</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="assigneeId" label="负责人">
            <Select placeholder="选择负责人" allowClear>
              {users.map((user: any) => (
                <Select.Option key={user.id} value={user.id}>
                  {user.name || user.username}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}