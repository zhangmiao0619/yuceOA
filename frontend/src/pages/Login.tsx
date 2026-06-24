// @ts-nocheck
import { useState, useEffect } from 'react'
import { Button, message, Form, Input } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import api from '../lib/api'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
export default function Login() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const token = searchParams.get('token')
    const userStr = searchParams.get('user')
    if (token && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr))
        setAuth(token, user)
        message.success('登录成功')
        navigate('/')
      } catch (error) {
        message.error('登录解析失败')
      }
    }
  }, [searchParams, setAuth, navigate])
  const handlePasswordLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const res: any = await api.post('/auth/login', {
        username: values.username,
        password: values.password
      })
      if (res.success) {
        setAuth(res.data.token, res.data.user)
        message.success('登录成功')
        navigate('/')
      } else {
        message.error(res.message || '登录失败')
      }
    } catch (error: any) {
      const errorMsg = error?.message || error?.data?.message || '登录失败'
      message.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <div style={{ width: 360, padding: 32, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 24 }}>OA 办公系统</h2>
        <Form name="login" onFinish={handlePasswordLogin} autoComplete="off">
         <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]} >
            <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]} >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading} > 登录 </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}
