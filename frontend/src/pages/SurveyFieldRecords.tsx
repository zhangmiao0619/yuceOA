// @ts-nocheck
import { useState, useEffect } from 'react'
import { Card, Table, Tag, Button, Modal, Form, Input, Select, DatePicker, message, Tabs, Space, Popconfirm, Descriptions, Image, Row, Col, Upload } from 'antd'
import { PlusOutlined, DeleteOutlined, EyeOutlined, EditOutlined, UploadOutlined, CalendarOutlined } from '@ant-design/icons'
import api from '../lib/api'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input
const { RangePicker } = DatePicker

const WEATHER_OPTIONS = ['晴', '多云', '阴', '小雨', '中雨', '大雨', '雪', '雾', '霾', '大风']

export default function SurveyFieldRecords() {
  const [records, setRecords] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [stages, setStages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<any>(null)
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<any>(null)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  const fetchRecords = async (params?: { projectId?: string; startDate?: string; endDate?: string }) => {
    setLoading(true)
    try {
      let url = '/survey/field-records?'
      if (params?.projectId) url += `projectId=${params.projectId}&`
      if (params?.startDate) url += `startDate=${params.startDate}&`
      if (params?.endDate) url += `endDate=${params.endDate}&`
      const res: any = await api.get(url)
      if (res.success) {
        setRecords(res.data)
      }
    } catch (error) {
      message.error('获取外业记录失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const res: any = await api.get('/survey/projects')
      if (res.success) {
        setProjects(res.data)
      }
    } catch (error) {
      console.error('获取项目列表失败', error)
    }
  }

  const fetchStages = async (projectId: string) => {
    try {
      const res: any = await api.get(`/survey/projects/${projectId}`)
      if (res.success && res.data.stages) {
        setStages(res.data.stages)
      }
    } catch (error) {
      console.error('获取工序列表失败', error)
    }
  }

  useEffect(() => {
    fetchRecords()
    fetchProjects()
  }, [])

  const handleProjectChange = (value: string | null) => {
    setSelectedProjectId(value ?? null)
    const params: any = {}
    if (value) params.projectId = value
    if (dateRange && dateRange[0] && dateRange[1]) {
      params.startDate = dateRange[0].format('YYYY-MM-DD')
      params.endDate = dateRange[1].format('YYYY-MM-DD')
    }
    fetchRecords(params)
  }

  const handleDateRangeChange = (dates: any) => {
    setDateRange(dates)
    const params: any = {}
    if (selectedProjectId) params.projectId = selectedProjectId
    if (dates && dates[0] && dates[1]) {
      params.startDate = dates[0].format('YYYY-MM-DD')
      params.endDate = dates[1].format('YYYY-MM-DD')
    }
    fetchRecords(params)
  }

  const handleCreate = async (values: any) => {
    try {
      let photos = []
      if (values.photos && values.photos.length > 0) {
        for (const file of values.photos) {
          const formData = new FormData()
          formData.append('file', file.originFileObj || file)
          const uploadRes: any = await api.upload('/uploads', formData)
          if (uploadRes.success) {
            photos.push(uploadRes.data.path)
          }
        }
      }
      
      const res: any = await api.post('/survey/field-records', {
        ...values,
        surveyProjectId: values.surveyProjectId,
        stageId: values.stageId || null,
        recordDate: values.recordDate?.format('YYYY-MM-DD'),
        photos: photos.length > 0 ? JSON.stringify(photos) : undefined,
      })
      if (res.success) {
        message.success('创建成功')
        setModalVisible(false)
        form.resetFields()
        fetchRecords()
      }
    } catch (error) {
      message.error('创建失败')
    }
  }

  const handleEdit = (record: any) => {
    setEditingRecord(record)
    editForm.setFieldsValue({
      ...record,
      recordDate: record.recordDate ? dayjs(record.recordDate) : null,
      photos: []
    })
    fetchStages(record.surveyProjectId)
    setEditModalVisible(true)
  }

  const handleSaveEdit = async (values: any) => {
    if (!editingRecord) return
    try {
      let photos = editingRecord.photos
      if (values.photos && values.photos.length > 0) {
        const newPhotos = []
        for (const file of values.photos) {
          if (file.url) {
            newPhotos.push(file.url)
          } else {
            const formData = new FormData()
            formData.append('file', file.originFileObj || file)
            const uploadRes: any = await api.upload('/uploads', formData)
            if (uploadRes.success) {
              newPhotos.push(uploadRes.data.path)
            }
          }
        }
        photos = [...(photos || []), ...newPhotos]
      }
      
      const res: any = await api.put(`/survey/field-records/${editingRecord.id}`, {
        ...values,
        recordDate: values.recordDate?.format('YYYY-MM-DD'),
        photos: photos ? JSON.stringify(photos) : undefined,
      })
      if (res.success) {
        message.success('更新成功')
        setEditModalVisible(false)
        editForm.resetFields()
        setEditingRecord(null)
        fetchRecords()
      }
    } catch (error) {
      message.error('更新失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res: any = await api.delete(`/survey/field-records/${id}`)
      if (res.success) {
        message.success('删除成功')
        fetchRecords()
      }
    } catch (error) {
      message.error('删除失败')
    }
  }

  const handleView = (record: any) => {
    setSelectedRecord(record)
    setDetailVisible(true)
  }

  const columns = [
    {
      title: '记录日期',
      dataIndex: 'recordDate',
      key: 'recordDate',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '-',
    },
    {
      title: '所属项目',
      dataIndex: ['surveyProject', 'name'],
      key: 'projectName',
      render: (text: string) => text || '-',
    },
    {
      title: '天气',
      dataIndex: 'weather',
      key: 'weather',
      render: (weather: string) => weather ? <Tag>{weather}</Tag> : '-',
    },
    {
      title: '组长',
      dataIndex: 'teamLeader',
      key: 'teamLeader',
    },
    {
      title: '作业区域',
      dataIndex: 'workArea',
      key: 'workArea',
      ellipsis: true,
    },
    {
      title: '记录人',
      dataIndex: ['recorder', 'name'],
      key: 'recorder',
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleView(record)}>详情</Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除此记录吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Tabs defaultActiveKey="list" items={[
          { key: 'list', label: '外业记录', children: (
            <>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                <Space>
                  <Select
                    placeholder="筛选项目"
                    allowClear
                    style={{ width: 250 }}
                    value={selectedProjectId}
                    onChange={handleProjectChange}
                  >
                    {projects.map((p: any) => (
                      <Option key={p.id} value={p.id}>{p.name}</Option>
                    ))}
                  </Select>
                  <RangePicker 
                    value={dateRange}
                    onChange={handleDateRangeChange}
                    placeholder={['开始日期', '结束日期']}
                  />
                  <Button onClick={() => fetchRecords()}>刷新</Button>
                </Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                  setStages([])
                  setModalVisible(true)
                }}>
                  新增记录
                </Button>
              </div>

              <Table
                columns={columns}
                dataSource={records}
                rowKey="id"
                loading={loading}
                scroll={{ x: 'max-content', y: 'calc(100vh - 400px)' }}
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
        ]} />
      </Card>

      <Modal
        title="新增外业记录"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
        }}
        footer={null}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="surveyProjectId" label="所属项目" rules={[{ required: true, message: '请选择项目' }]}>
            <Select placeholder="选择项目" onChange={(value) => fetchStages(value)}>
              {projects.map((p: any) => (
                <Option key={p.id} value={p.id}>{p.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="stageId" label="工序">
            <Select placeholder="选择工序（可选）">
              {stages.map((s: any) => (
                <Option key={s.id} value={s.id}>{s.stageName}</Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="recordDate" label="记录日期" rules={[{ required: true, message: '请选择日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="weather" label="天气">
                <Select placeholder="选择天气">
                  {WEATHER_OPTIONS.map(w => <Option key={w} value={w}>{w}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="temperature" label="温度">
                <Input placeholder="如：25℃" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="teamLeader" label="组长">
                <Input placeholder="请输入组长姓名" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="workArea" label="作业区域">
            <Input placeholder="请输入作业区域" />
          </Form.Item>

          <Form.Item name="workContent" label="工作内容" rules={[{ required: true, message: '请输入工作内容' }]}>
            <TextArea rows={3} placeholder="请描述工作内容" />
          </Form.Item>

          <Form.Item name="progress" label="进度情况">
            <TextArea rows={2} placeholder="请描述进度情况" />
          </Form.Item>

          <Form.Item name="issues" label="遇到的问题">
            <TextArea rows={2} placeholder="请描述遇到的问题（如有）" />
          </Form.Item>

          <Form.Item name="solutions" label="解决方案">
            <TextArea rows={2} placeholder="请描述解决方案（如有）" />
          </Form.Item>

          <Form.Item name="photos" label="现场照片" valuePropName="fileList" getValueFromEvent={(e) => Array.isArray(e) ? e : e?.fileList}>
            <Upload name="file" listType="picture-card" multiple beforeUpload={() => false}>
              <div><UploadOutlined /><div>上传照片</div></div>
            </Upload>
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑外业记录"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false)
          editForm.resetFields()
          setEditingRecord(null)
        }}
        footer={null}
        width={700}
      >
        <Form form={editForm} layout="vertical" onFinish={handleSaveEdit}>
          <Form.Item name="surveyProjectId" label="所属项目" rules={[{ required: true }]}>
            <Select placeholder="选择项目" onChange={(value) => fetchStages(value)}>
              {projects.map((p: any) => (
                <Option key={p.id} value={p.id}>{p.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="stageId" label="工序">
            <Select placeholder="选择工序">
              {stages.map((s: any) => (
                <Option key={s.id} value={s.id}>{s.stageName}</Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="recordDate" label="记录日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="weather" label="天气">
                <Select placeholder="选择天气">
                  {WEATHER_OPTIONS.map(w => <Option key={w} value={w}>{w}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="temperature" label="温度">
                <Input placeholder="如：25℃" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="teamLeader" label="组长">
                <Input placeholder="请输入组长姓名" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="workArea" label="作业区域">
            <Input placeholder="请输入作业区域" />
          </Form.Item>

          <Form.Item name="workContent" label="工作内容">
            <TextArea rows={3} placeholder="请描述工作内容" />
          </Form.Item>

          <Form.Item name="progress" label="进度情况">
            <TextArea rows={2} placeholder="请描述进度情况" />
          </Form.Item>

          <Form.Item name="issues" label="遇到的问题">
            <TextArea rows={2} placeholder="请描述遇到的问题（如有）" />
          </Form.Item>

          <Form.Item name="solutions" label="解决方案">
            <TextArea rows={2} placeholder="请描述解决方案（如有）" />
          </Form.Item>

          <Form.Item name="photos" label="现场照片" valuePropName="fileList" getValueFromEvent={(e) => Array.isArray(e) ? e : e?.fileList}>
            <Upload name="file" listType="picture-card" multiple beforeUpload={() => false}>
              <div><UploadOutlined /><div>上传照片</div></div>
            </Upload>
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setEditModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="外业记录详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedRecord && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="记录日期">{dayjs(selectedRecord.recordDate).format('YYYY-MM-DD')}</Descriptions.Item>
            <Descriptions.Item label="天气">{selectedRecord.weather || '-'}</Descriptions.Item>
            <Descriptions.Item label="温度">{selectedRecord.temperature || '-'}</Descriptions.Item>
            <Descriptions.Item label="组长">{selectedRecord.teamLeader || '-'}</Descriptions.Item>
            <Descriptions.Item label="所属项目" span={2}>{selectedRecord.surveyProject?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="工序" span={2}>{selectedRecord.stage?.stageName || '-'}</Descriptions.Item>
            <Descriptions.Item label="作业区域" span={2}>{selectedRecord.workArea || '-'}</Descriptions.Item>
            <Descriptions.Item label="工作内容" span={2}>{selectedRecord.workContent || '-'}</Descriptions.Item>
            <Descriptions.Item label="进度情况" span={2}>{selectedRecord.progress || '-'}</Descriptions.Item>
            <Descriptions.Item label="遇到的问题" span={2}>{selectedRecord.issues || '-'}</Descriptions.Item>
            <Descriptions.Item label="解决方案" span={2}>{selectedRecord.solutions || '-'}</Descriptions.Item>
            <Descriptions.Item label="记录人">{selectedRecord.recorder?.name || '-'}</Descriptions.Item>
          </Descriptions>
        )}
        {selectedRecord?.photos && (
          <div style={{ marginTop: 16 }}>
            <h4>现场照片：</h4>
            <Image.PreviewGroup>
              {JSON.parse(selectedRecord.photos).map((url: string, index: number) => (
                <Image key={index} src={url} width={100} style={{ marginRight: 8 }} />
              ))}
            </Image.PreviewGroup>
          </div>
        )}
      </Modal>
    </div>
  )
}
