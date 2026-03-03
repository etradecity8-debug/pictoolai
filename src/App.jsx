import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
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
import Settings from './pages/dashboard/Settings'
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
      <Route path="/" element={<MarketingLayout><Home /></MarketingLayout>} />
      <Route path="/product" element={<MarketingLayout><Product /></MarketingLayout>} />
      <Route path="/detail-set" element={<MarketingLayout><DetailSet /></MarketingLayout>} />
      <Route path="/style-clone" element={<MarketingLayout><StyleClone /></MarketingLayout>} />
      <Route path="/apparel-set" element={<MarketingLayout><ApparelSet /></MarketingLayout>} />
      <Route path="/image-retouch" element={<MarketingLayout><ImageRetouch /></MarketingLayout>} />
      <Route path="/pricing" element={<MarketingLayout><Pricing /></MarketingLayout>} />
      <Route path="/about" element={<MarketingLayout><About /></MarketingLayout>} />
      <Route path="/contact" element={<MarketingLayout><Contact /></MarketingLayout>} />
      <Route path="/login" element={<MarketingLayout><Login /></MarketingLayout>} />
      <Route path="/register" element={<MarketingLayout><Register /></MarketingLayout>} />
      <Route path="/forgot-password" element={<MarketingLayout><ForgotPassword /></MarketingLayout>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
