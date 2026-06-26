import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Workflows from './pages/Workflows'
import Users from './pages/Users'
import TimeTracking from './pages/TimeTracking'
import Attendance from './pages/Attendance'
import SurveyGantt from './pages/SurveyGantt'
import AddressBook from './pages/AddressBook'
import Alerts from './pages/Alerts'
import Contracts from './pages/Contracts'
import Finance from './pages/Finance'
import AdminSettings from './pages/AdminSettings'
import SubTaskDetail from './pages/SubTaskDetail'

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<any>(null)
  
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      console.error('Global error:', event.error)
      setError(event.error)
    }
    window.addEventListener('error', handler)
    return () => window.removeEventListener('error', handler)
  }, [])
  
  if (error) {
    return (
      <div style={{ padding: 20, color: 'red' }}>
        <h2>页面渲染出错</h2>
        <pre style={{ background: '#f0f0f0', padding: 10 }}>{error?.message || String(error)}</pre>
      </div>
    )
  }
  return <>{children}</>
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="workflows" element={<Workflows />} />
          <Route path="time-tracking" element={<TimeTracking />} />
          <Route path="users" element={<Users />} />
          <Route path="survey-gantt" element={<SurveyGantt />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="finance" element={<Finance />} />
          <Route path="admin-settings" element={<AdminSettings />} />
          <Route path="address-book" element={<AddressBook />} />
          <Route path="tasks/:taskId" element={<SubTaskDetail />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}

export default App
