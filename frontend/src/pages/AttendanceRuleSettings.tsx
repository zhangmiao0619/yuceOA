import { useState, useEffect } from 'react'
import { Card, DatePicker, Radio, Button, message, Calendar, Badge, Table, Modal, Form, Input, Tag, Row, Col, Alert } from 'antd'
import { SaveOutlined, PlusOutlined, DeleteOutlined, CalendarOutlined } from '@ant-design/icons'
import api from '../lib/api'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'

interface Holiday {
  id: string
  date: string
  name: string
  type: 'holiday' | 'makeup'
  description?: string
}

interface AttendanceRule {
  id: string
  referenceDate: string
  weekType: 'single' | 'double'
  description?: string
}

export default function AttendanceRuleSettings() {
  const [rule, setRule] = useState<AttendanceRule | null>(null)
  const [referenceDate, setReferenceDate] = useState<Dayjs | null>(null)
  const [weekType, setWeekType] = useState<'single' | 'double'>('double')
  const [loading, setLoading] = useState(false)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [holidayModalVisible, setHolidayModalVisible] = useState(false)
  const [holidayForm] = Form.useForm()
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null)
  const [selectedYear, setSelectedYear] = useState(dayjs().year())
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1)
  const [holidayPagination, setHolidayPagination] = useState({ current: 1, pageSize: 10 })

  useEffect(() => {
    fetchRule()
    fetchHolidays()
  }, [selectedYear])

  const fetchRule = async () => {
    try {
      const res: any = await api.get('/attendance/calendar')
      if (res.success && res.data.calendarConfig) {
        const config = res.data.calendarConfig
        setRule(config)
        setReferenceDate(config.reference_date ? dayjs(config.reference_date) : null)
        setWeekType(config.reference_week_type || 'double')
      }
    } catch (error) {
      console.error('获取考勤规则失败', error)
    }
  }

  const fetchHolidays = async (page = 1, pageSize = 10) => {
    try {
      const res: any = await api.get('/attendance/calendar', {
        params: { year: selectedYear, month: selectedMonth, page, pageSize }
      })
      if (res.success) {
        setHolidays(res.data.holidays || [])
        setHolidayPagination({ current: page, pageSize })
      }
    } catch (error) {
      console.error('获取节假日失败', error)
    }
  }

  const handleHolidayTableChange = (paginationConfig: any) => {
    fetchHolidays(paginationConfig.current, paginationConfig.pageSize)
  }

  const handleSaveRule = async () => {
    if (!referenceDate) {
      message.warning('请选择基准日期')
      return
    }
    setLoading(true)
    try {
      const res: any = await api.put('/attendance/calendar-rules', {
        referenceDate: referenceDate.format('YYYY-MM-DD'),
        referenceWeekType: weekType
      })
      if (res.success) {
        message.success('规则保存成功')
        fetchRule()
      }
    } catch (error: any) {
      message.error(error?.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveHoliday = async (values: any) => {
    try {
      const payload = {
        ...values,
        date: values.date.format('YYYY-MM-DD')
      }
      if (editingHoliday) {
        // 更新节假日
        const res: any = await api.put(`/attendance/holidays/${editingHoliday.id}`, payload)
        if (res.success) {
          message.success('节假日更新成功')
        }
      } else {
        // 创建节假日
        const res: any = await api.post('/attendance/holidays', payload)
        if (res.success) {
          message.success('节假日添加成功')
        }
      }
      setHolidayModalVisible(false)
      holidayForm.resetFields()
      setEditingHoliday(null)
      fetchHolidays()
    } catch (error: any) {
      message.error(error?.message || '操作失败')
    }
  }

  const handleDeleteHoliday = async (id: string) => {
    try {
      const res: any = await api.delete(`/attendance/holidays/${id}`)
      if (res.success) {
        message.success('删除成功')
        fetchHolidays()
      }
    } catch (error: any) {
      message.error(error?.message || '删除失败')
    }
  }

  // 计算某天是否工作日
  const isWorkDay = (date: Dayjs): { isWork: boolean; reason: string; type: 'work' | 'rest' | 'holiday' | 'makeup' } => {
    const dateStr = date.format('YYYY-MM-DD')
    const dayOfWeek = date.day()

    // 1. 检查是否是节假日（法定节假日）
    const holiday = holidays.find(h => h.date === dateStr && h.type === 'holiday')
    if (holiday) {
      return { isWork: false, reason: holiday.name, type: 'holiday' }
    }

    // 2. 检查是否是补班日
    const makeup = holidays.find(h => h.date === dateStr && (h.type === 'makeup' || h.type === 'workday'))
    if (makeup) {
      return { isWork: true, reason: makeup.name, type: 'makeup' }
    }

    // 3. 周日休息
    if (dayOfWeek === 0) {
      return { isWork: false, reason: '周日', type: 'rest' }
    }

    // 4. 周一到周五上班
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      return { isWork: true, reason: '工作日', type: 'work' }
    }

    // 5. 周六：根据单双休规则判断
    if (dayOfWeek === 6) {
      const refDate = referenceDate
      if (!refDate) {
        return { isWork: true, reason: '默认上班', type: 'work' }
      }

      const refWeek = getWeekNumber(refDate)
      const currentWeek = getWeekNumber(date)
      const weekDiff = Math.abs(currentWeek - refWeek)
      const isSingleWeek = weekDiff % 2 === 0

      // 如果基准周是单休周，那么与基准周同奇偶的是单休周（上班），否则是双休周（休息）
      const shouldWork = weekType === 'single' ? isSingleWeek : !isSingleWeek

      return {
        isWork: shouldWork,
        reason: shouldWork ? '单休周六' : '双休周六',
        type: shouldWork ? 'work' : 'rest'
      }
    }

    return { isWork: true, reason: '工作日', type: 'work' }
  }

  // 获取周数（ISO 8601）
  const getWeekNumber = (date: Dayjs): number => {
    return date.week()
  }

  // 日历单元格渲染
  const dateCellRender = (value: Dayjs) => {
    const { isWork, reason, type } = isWorkDay(value)
    const colorMap: Record<string, string> = {
      work: '#52c41a',
      rest: '#ff4d4f',
      holiday: '#ff4d4f',
      makeup: '#1890ff'
    }
    const textMap: Record<string, string> = {
      work: '班',
      rest: '休',
      holiday: '假',
      makeup: '班'
    }

    return (
      <div style={{ textAlign: 'center', padding: '2px' }}>
        <Badge
          color={colorMap[type]}
          text={
            <span style={{ fontSize: '12px', color: colorMap[type], fontWeight: type === 'holiday' ? 'bold' : 'normal' }}>
              {textMap[type]}
            </span>
          }
        />
        {type === 'holiday' && (
          <div style={{ fontSize: '10px', color: '#999', marginTop: 2 }}>{reason}</div>
        )}
      </div>
    )
  }

  const holidayColumns = [
    { title: '日期', dataIndex: 'date', key: 'date', render: (d: string) => dayjs(d).format('YYYY-MM-DD') },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (t: string) => (
      t === 'holiday' ? <Tag color="red">节假日</Tag> : <Tag color="blue">补班</Tag>
    )},
    { title: '描述', dataIndex: 'description', key: 'description', render: (v: string) => v || '-' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Holiday) => (
        <Button type="link" danger onClick={() => handleDeleteHoliday(record.id)}>删除</Button>
      )
    }
  ]

  return (
    <div style={{ padding: '10px 0' }}>
      <Row gutter={24}>
        <Col span={12}>
          <Card title="单双休规则设置" extra={<Button type="primary" icon={<SaveOutlined />} onClick={handleSaveRule} loading={loading}>保存规则</Button>}>
            <Alert
              message="规则说明"
              description="选择一个基准日期，并指定该日期所在周是单休还是双休。系统会根据单双周交替规则自动推算所有周六的上班/休息状态。法定节假日和补班日优先级高于单双休规则。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form layout="vertical">
              <Form.Item label="基准日期" required>
                <DatePicker
                  value={referenceDate}
                  onChange={setReferenceDate}
                  style={{ width: '100%' }}
                  placeholder="选择一个周六作为基准日期"
                />
              </Form.Item>
              <Form.Item label="基准周类型" required>
                <Radio.Group value={weekType} onChange={(e) => setWeekType(e.target.value)}>
                  <Radio.Button value="single">单休周（本周六上班）</Radio.Button>
                  <Radio.Button value="double">双休周（本周六休息）</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Form>
            {referenceDate && (
              <div style={{ marginTop: 16, padding: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
                <div><strong>当前设置：</strong></div>
                <div>基准日期：{referenceDate.format('YYYY-MM-DD')}（周{['日', '一', '二', '三', '四', '五', '六'][referenceDate.day()]}）</div>
                <div>基准周：{weekType === 'single' ? '单休周' : '双休周'}</div>
              </div>
            )}
          </Card>

          <Card title="节假日管理" style={{ marginTop: 16 }} extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              setEditingHoliday(null)
              holidayForm.resetFields()
              setHolidayModalVisible(true)
            }}>添加节假日</Button>
          }>
            <Table
              columns={holidayColumns}
              dataSource={holidays}
              rowKey="id"
              size="small"
              scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
              pagination={{
                current: holidayPagination.current,
                pageSize: holidayPagination.pageSize,
                pageSizeOptions: ['10', '20', '50'],
                showSizeChanger: true,
                showTotal: (t: number) => `共 ${t} 条`,
                onChange: handleHolidayTableChange,
              }}
            />
          </Card>
        </Col>

        <Col span={12}>
          <Card title="日历预览">
            <div style={{ padding: '10px 0' }}>
            <Calendar
              key={`${weekType}-${referenceDate?.format('YYYY-MM-DD') || 'none'}`}
              fullscreen={false}
              value={dayjs(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`)}
              onPanelChange={(date) => {
                setSelectedYear(date.year())
                setSelectedMonth(date.month() + 1)
              }}
              dateCellRender={dateCellRender}
              headerRender={({ value, onChange }) => (
                <div style={{ padding: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <Button onClick={() => onChange(value.clone().subtract(1, 'month'))}>上月</Button>
                  <span style={{ fontSize: 16, fontWeight: 'bold' }}>{value.format('YYYY年MM月')}</span>
                  <Button onClick={() => onChange(value.clone().add(1, 'month'))}>下月</Button>
                </div>
              )}
            />
            <div style={{ marginTop: 16, display: 'flex', gap: 16, justifyContent: 'center' }}>
              <Badge color="#52c41a" text="上班" />
              <Badge color="#ff4d4f" text="休息" />
              <Badge color="#ff4d4f" text="法定节假日" />
              <Badge color="#1890ff" text="补班" />
            </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title={editingHoliday ? '编辑节假日' : '添加节假日'}
        open={holidayModalVisible}
        onCancel={() => {
          setHolidayModalVisible(false)
          setEditingHoliday(null)
          holidayForm.resetFields()
        }}
        onOk={() => holidayForm.submit()}
      >
        <Form form={holidayForm} layout="vertical" onFinish={handleSaveHoliday}>
          <Form.Item name="date" label="日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="如：元旦、春节补班" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]} initialValue="holiday">
            <Radio.Group>
              <Radio.Button value="holiday">节假日（放假）</Radio.Button>
                  <Radio.Button value="makeup">补班（上班）</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="可选描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
