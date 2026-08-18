import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { ChatProvider } from './context/ChatContext'
import { KycProvider } from './context/KycContext'
import { UserProvider } from './context/UserContext'
import LandingPage from './pages/LandingPage'
import ChatPage from './pages/ChatPage'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminKyc from './pages/AdminKyc'
import AdminNotifications from './pages/AdminNotifications'
import AdminCreateEmail from './pages/AdminCreateEmail'
import AdminUsers from './pages/AdminUsers'
import VerifyPage from './pages/VerifyPage'
import './App.css'
import './admin.css'
import './landing.css'
import './admin-dash.css'
import './verify.css'

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ChatProvider>
          <KycProvider>
            <UserProvider>
              <BrowserRouter>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/verify/:token" element={<VerifyPage />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<Navigate to="/admin/tickets" replace />} />
                <Route path="/admin/tickets" element={<AdminDashboard />} />
                <Route path="/admin/kyc" element={<AdminKyc />} />
                <Route path="/admin/notifications" element={<AdminNotifications />} />
                <Route path="/admin/notifications/create" element={<AdminCreateEmail />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </BrowserRouter>
            </UserProvider>
          </KycProvider>
        </ChatProvider>
      </NotificationProvider>
    </AuthProvider>
  )
}
