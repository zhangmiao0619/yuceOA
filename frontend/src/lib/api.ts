// @ts-nocheck
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const api = axios.create({
  baseURL: '/api'
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    const errorData = error.response?.data
    if (errorData && typeof errorData === 'object' && 'message' in errorData) {
      return Promise.reject(errorData)
    }
    return Promise.reject(error)
  }
)

// 上传文件
api.upload = async (url: string, formData: FormData, options?: { onUploadProgress?: (e: any) => void }) => {
  try {
    const response = await axios.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${useAuthStore.getState().token}`
      },
      onUploadProgress: options?.onUploadProgress
    })
    return response.data
  } catch (error: any) {
    throw error.response?.data || error
  }
}

export default api