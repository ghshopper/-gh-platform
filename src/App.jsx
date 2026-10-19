import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import AdminLayout from './layouts/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import Orders from './pages/admin/Orders'
import Products from './pages/admin/Products'
import Reviews from './pages/admin/Reviews'
import Customers from './pages/admin/Customers'
import Categories from './pages/admin/Categories'
import Brands from './pages/admin/Brands'
import Attributes from './pages/admin/Attributes'
import Invoices from './pages/admin/Invoices'
import Shipping from './pages/admin/Shipping'
import Payments from './pages/admin/Payments'
import Loyalty from './pages/admin/Loyalty'
import Reports from './pages/admin/Reports'
import Users from './pages/admin/Users'
import Settings from './pages/admin/Settings'
import NotifyUsers from './pages/admin/NotifyUsers'
import Login from './pages/admin/Login'
import ProductRequests from './pages/admin/ProductRequests'
import AppOrders from './pages/admin/AppOrders'
import Coupons from './pages/admin/Coupons'
import CustomizeApp from './pages/admin/CustomizeApp'
import Profile from './pages/admin/Profile'
import ImportItems from './pages/admin/ImportItems'
import './index.css'

import LandingPage from './pages/website/LandingPage'

// Simple Auth Guard for Admin
const AdminRoute = ({ children }) => {
  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  if (!token || user.role !== 'super_admin') {
    return <Navigate to="/admin/login" replace />
  }
  return children
}

export default function App() {
  const basename = window.location.pathname.startsWith('/public') ? '/public' : '/'
  return (
    <BrowserRouter basename={basename}>
      <Toaster position="top-center" />
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Admin Login */}
        <Route path="/admin/login" element={<Login />} />
        
        {/* Admin Panel */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="orders" element={<Navigate to="/admin/app-orders" replace />} />
          <Route path="store-orders" element={<Orders />} />
          <Route path="app-orders" element={<AppOrders />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="products" element={<Products />} />
          <Route path="import-items" element={<ImportItems />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="customers" element={<Customers />} />
          <Route path="categories" element={<Categories />} />
          <Route path="brands" element={<Brands />} />
          <Route path="attributes" element={<Attributes />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="shipping" element={<Shipping />} />
          <Route path="payments" element={<Payments />} />
          <Route path="loyalty" element={<Loyalty />} />
          <Route path="reports" element={<Reports />} />
          <Route path="users" element={<Users />} />
          <Route path="notify-users" element={<NotifyUsers />} />
          <Route path="settings" element={<Settings />} />
          <Route path="product-requests" element={<ProductRequests />} />
          <Route path="customize-app" element={<CustomizeApp />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
