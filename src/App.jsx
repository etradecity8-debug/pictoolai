import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import GuestOnlyRoute from './components/GuestOnlyRoute'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'
import Home from './pages/Home'
import Pricing from './pages/Pricing'
import About from './pages/About'
import Contact from './pages/Contact'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import DashboardLayout from './components/layout/DashboardLayout'
import Gallery from './pages/dashboard/Gallery'
import ListingHistory from './pages/dashboard/ListingHistory'
import Points from './pages/dashboard/Points'
import DetailSet from './pages/DetailSet'
import StyleClone from './pages/StyleClone'
import AiDesigner from './pages/AiDesigner'
import AmazonAPlus from './pages/AmazonAPlus'
import AiAssistant from './pages/AiAssistant'
import IpRisk from './pages/IpRisk'
import AiToolbox from './pages/AiToolbox'
import SupplierMatching from './pages/ai-toolbox/SupplierMatching'
import Admin from './pages/Admin'
import { SITE_NAV_HIDDEN } from './lib/siteFeatures'

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
      <Route path="/detail-set" element={<ProtectedRoute><MarketingLayout><DetailSet /></MarketingLayout></ProtectedRoute>} />
      <Route path="/style-clone" element={<Navigate to="/ai-designer/style-clone" replace />} />
      <Route path="/image-edit" element={<Navigate to="/ai-designer/add-remove" replace />} />
      <Route path="/ai-designer" element={<ProtectedRoute><AiDesigner /></ProtectedRoute>} />
      <Route path="/ai-designer/:toolId" element={<ProtectedRoute><AiDesigner /></ProtectedRoute>} />
      <Route
        path="/amazon-aplus"
        element={
          <ProtectedRoute>
            {SITE_NAV_HIDDEN.amazonAplus ? (
              <Navigate to="/" replace />
            ) : (
              <MarketingLayout>
                <AmazonAPlus />
              </MarketingLayout>
            )}
          </ProtectedRoute>
        }
      />
      <Route path="/ai-assistant" element={<ProtectedRoute><MarketingLayout><AiAssistant /></MarketingLayout></ProtectedRoute>} />
      <Route
        path="/ip-risk"
        element={
          <ProtectedRoute>
            {SITE_NAV_HIDDEN.ipRisk ? (
              <Navigate to="/" replace />
            ) : (
              <MarketingLayout>
                <IpRisk />
              </MarketingLayout>
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-toolbox"
        element={
          <ProtectedRoute>
            {SITE_NAV_HIDDEN.aiToolboxSupplier ? (
              <Navigate to="/" replace />
            ) : (
              <MarketingLayout>
                <AiToolbox />
              </MarketingLayout>
            )}
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/ai-toolbox/supplier-matching" replace />} />
        <Route path="supplier-matching" element={<SupplierMatching />} />
      </Route>
      <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard/gallery" replace />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="listings" element={<ListingHistory />} />
        <Route path="points" element={<Points />} />
        <Route path="settings" element={<Navigate to="/dashboard" replace />} />
      </Route>
      {/* 管理后台：仅 admin 角色可访问，非管理员在 Admin.jsx 内部跳回首页 */}
      <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
