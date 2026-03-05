import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import GuestOnlyRoute from './components/GuestOnlyRoute'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import Home from './pages/Home'
import Product from './pages/Product'
import Pricing from './pages/Pricing'
import About from './pages/About'
import Contact from './pages/Contact'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import DashboardLayout from './components/layout/DashboardLayout'
import Dashboard from './pages/dashboard/Dashboard'
import Gallery from './pages/dashboard/Gallery'
import Points from './pages/dashboard/Points'
import DetailSet from './pages/DetailSet'
import StyleClone from './pages/StyleClone'
import ApparelSet from './pages/ApparelSet'
import ImageRetouch from './pages/ImageRetouch'

function MarketingLayout({ children }) {
  return (
    <>
      <Header />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <Routes>
      {/* 未登录只能看主页和登录/注册/找回密码；已登录访问这些页会重定向到工作台 */}
      <Route path="/" element={<MarketingLayout><Home /></MarketingLayout>} />
      <Route path="/login" element={<GuestOnlyRoute><MarketingLayout><Login /></MarketingLayout></GuestOnlyRoute>} />
      <Route path="/register" element={<GuestOnlyRoute><MarketingLayout><Register /></MarketingLayout></GuestOnlyRoute>} />
      <Route path="/forgot-password" element={<GuestOnlyRoute><MarketingLayout><ForgotPassword /></MarketingLayout></GuestOnlyRoute>} />
      {/* 定价、关于、联系未登录也可查看 */}
      <Route path="/pricing" element={<MarketingLayout><Pricing /></MarketingLayout>} />
      <Route path="/about" element={<MarketingLayout><About /></MarketingLayout>} />
      <Route path="/contact" element={<MarketingLayout><Contact /></MarketingLayout>} />
      {/* 以下需登录后访问，未登录会跳转到 /login */}
      <Route path="/product" element={<ProtectedRoute><MarketingLayout><Product /></MarketingLayout></ProtectedRoute>} />
      <Route path="/detail-set" element={<ProtectedRoute><MarketingLayout><DetailSet /></MarketingLayout></ProtectedRoute>} />
      <Route path="/style-clone" element={<ProtectedRoute><MarketingLayout><StyleClone /></MarketingLayout></ProtectedRoute>} />
      <Route path="/apparel-set" element={<ProtectedRoute><MarketingLayout><ApparelSet /></MarketingLayout></ProtectedRoute>} />
      <Route path="/image-retouch" element={<ProtectedRoute><MarketingLayout><ImageRetouch /></MarketingLayout></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard/gallery" replace />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="points" element={<Points />} />
        <Route path="settings" element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
