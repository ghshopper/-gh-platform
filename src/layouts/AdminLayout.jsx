import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import ghLogo from '../assets/gh-logo.png'
import { canOpen } from '../lib/access'
import api from '../services/api'
import GlobalSearch from '../components/GlobalSearch'
import toast from 'react-hot-toast'
import {
  RiHome5Line,
  RiFileList3Line,
  RiGroupLine,
  RiShoppingBag3Line,
  RiBillLine,
  RiTruckLine, RiQuestionLine,
  RiBankCardLine,
  RiStarSmileLine,
  RiBarChartBoxLine,
  RiUserSettingsLine,
  RiSettings4Line,
  RiSearch2Line,
  RiNotification3Fill,
  RiMenuFoldFill,
  RiMenuUnfoldFill,
  RiCalendarEventFill,
  RiArrowDownSLine,
  RiArrowLeftSLine,
  RiCheckDoubleLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiTimeLine,
  RiCloseLine,
  RiSearchFill,
  RiSmartphoneLine,
  RiLogoutBoxRLine,
  RiEdit2Line,
  RiCoupon3Line,
  RiGiftLine,
  RiWhatsappLine,
  RiPercentLine,
  RiHistoryLine,
  RiGlobalLine,
} from 'react-icons/ri'

// Sidebar, grouped the way the work flows: sell → products → customers → store.
const navSections = [
  { items: [{ label: 'الرئيسية', icon: RiHome5Line, path: '/admin/dashboard' }] },
  { title: 'البيع', items: [
    { label: 'الطلبات', icon: RiShoppingBag3Line, path: '/admin/app-orders' },
    { label: 'طلبات القطع', icon: RiSearchFill, path: '/admin/product-requests' },
    { label: 'السلات المتروكة', icon: RiShoppingBag3Line, path: '/admin/abandoned-carts' },
    { label: 'الفواتير', icon: RiBillLine, path: '/admin/invoices' },
    { label: 'المدفوعات', icon: RiBankCardLine, path: '/admin/payments' },
  ] },
  { title: 'المنتجات', items: [
    { label: 'المنتجات', icon: RiShoppingBag3Line, path: '/admin/products' },
    { label: 'منتجات للإضافة', icon: RiSearchFill, path: '/admin/import-items' },
    { label: 'التصنيفات', icon: RiBillLine, path: '/admin/categories' },
    { label: 'البراندات', icon: RiStarSmileLine, path: '/admin/brands' },
    { label: 'الخصائص', icon: RiSettings4Line, path: '/admin/attributes' },
    { label: 'التقييمات', icon: RiStarSmileLine, path: '/admin/reviews' },
  ] },
  { title: 'العملاء', items: [
    { label: 'العملاء', icon: RiGroupLine, path: '/admin/customers' },
    { label: 'نظام الولاء', icon: RiStarSmileLine, path: '/admin/loyalty' },
    { label: 'كوبونات الخصم', icon: RiCoupon3Line, path: '/admin/coupons' },
    { label: 'بطاقات الهدايا', icon: RiGiftLine, path: '/admin/gift-cards' },
    { label: 'العروض التلقائية', icon: RiPercentLine, path: '/admin/offers' },
    { label: 'إرسال إشعارات', icon: RiNotification3Fill, path: '/admin/notify-users' },
  ] },
  { title: 'المتجر', items: [
    { label: 'واجهة التطبيق', icon: RiSmartphoneLine, path: '/admin/customize-app' },
    { label: 'الأسئلة الشائعة', icon: RiQuestionLine, path: '/admin/faqs' },
    { label: 'الشحن', icon: RiTruckLine, path: '/admin/shipping' },
    { label: 'شحن الخليج', icon: RiGlobalLine, path: '/admin/gcc-shipping' },
    { label: 'التقارير', icon: RiBarChartBoxLine, path: '/admin/reports' },
    { label: 'واتساب', icon: RiWhatsappLine, path: '/admin/whatsapp' },
    { label: 'المستخدمون', icon: RiUserSettingsLine, path: '/admin/users' },
    { label: 'سجل النشاط', icon: RiHistoryLine, path: '/admin/activity' },
    { label: 'الإعدادات', icon: RiSettings4Line, path: '/admin/settings' },
  ] },
]
// Kept for the header search and older code paths.
const navItems = navSections.flatMap((s) => s.items)

export default function AdminLayout() {
  // On a phone the menu starts closed and closes after choosing a page.
  const isPhone = () => typeof window !== 'undefined' && window.innerWidth < 769
  const [isCollapsed, setIsCollapsed] = useState(isPhone)
  const [openGroups, setOpenGroups] = useState({})
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [notifFilter, setNotifFilter] = useState('all') // 'all' | 'unread'
  const [lang, setLang] = useState(localStorage.getItem('adminLang') || 'ar')
  const notifDropdownRef = useRef(null)
  const [searchOpen, setSearchOpen] = useState(false)
  // ⌘K / Ctrl+K opens the search from anywhere ("/" too, when not typing)
  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(e.target?.tagName || '') || e.target?.isContentEditable
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(true) }
      else if (e.key === '/' && !typing) { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const prevCountRef = useRef(null)
  
  const location = useLocation()
  useEffect(() => { if (isPhone()) setIsCollapsed(true) }, [location.pathname])
  const navigate = useNavigate()

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const adminName = user.name || 'المدير العام';
  const adminRole = user.access?.label || (user.role === 'super_admin' ? 'المدير العام' : 'أدمن');
  // Keep the role and areas fresh (an admin may have changed them).
  useEffect(() => {
    api.get('/admin/access').then((r) => {
      if (!r?.data?.role) return
      localStorage.setItem('user', JSON.stringify({ ...user, role: r.data.role, access: r.data }))
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const allowedHere = canOpen(window.location.pathname, user)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/admin/login')
  }

  useEffect(() => {
    // Auto-open group if active
    navItems.forEach(item => {
      if (item.subItems && item.subItems.some(sub => location.pathname.includes(sub.path))) {
        setOpenGroups(prev => ({ ...prev, [item.label]: true }))
      }
    })
  }, [location])

  useEffect(() => {
    document.body.dir = lang === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem('adminLang', lang)
  }, [lang])


  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setIsNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchNotifications = async (silent = true) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/notifications`, {
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('token'),
          'Accept': 'application/json',
        }
      })
      const json = await res.json()
      if (json.data) {
        const items = json.data
        const unread = json.unread_count ?? items.filter(n => !n.read_at).length
        
        // Notify on new unread notifications
        if (prevCountRef.current !== null && unread > prevCountRef.current && !silent) {
          const newest = items[0]
          if (newest && !newest.read_at) {
            toast.custom((t) => (
              <div
                className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 p-4 border border-amber-200`}
                style={{ direction: 'rtl' }}
              >
                <div className="flex-1 w-0">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5 text-amber-600">
                      <RiNotification3Fill size={24} />
                    </div>
                    <div className="mr-3 flex-1">
                      <p className="text-sm font-bold text-gray-900">{newest.title_ar || newest.title_en}</p>
                      <p className="mt-1 text-xs text-gray-600">{newest.body_ar || newest.body_en}</p>
                    </div>
                  </div>
                </div>
                <div className="flex border-r border-gray-200 mr-2 pr-2">
                  <button
                    onClick={() => {
                      toast.dismiss(t.id)
                      if (newest.action_url) navigate(newest.action_url)
                    }}
                    className="w-full border border-transparent rounded-none rounded-r-lg p-2 flex items-center justify-center text-xs font-bold text-amber-800 hover:text-amber-900 focus:outline-none"
                  >
                    عرض
                  </button>
                </div>
              </div>
            ), { duration: 5000 })
          }
        }
        
        prevCountRef.current = unread
        setNotifications(items)
        setUnreadCount(unread)
      }
    } catch (err) {}
  }

  useEffect(() => {
    fetchNotifications(true)
    const interval = setInterval(() => fetchNotifications(false), 15000) // Poll every 15s
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Fetch dashboard name for document title
    fetch(`${import.meta.env.VITE_API_URL}/admin/settings?group=general`, {
      headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token'),
        'Accept': 'application/json',
      }
    })
      .then(res => res.json())
      .then(json => {
        if (json.data && json.data.admin_dashboard_name) {
          document.title = json.data.admin_dashboard_name;
        } else {
          document.title = 'GH Shopper Admin';
        }
      })
      .catch(() => { document.title = 'GH Shopper Admin'; });
  }, [])

  const markAsRead = async (id, actionUrl) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/admin/notifications/${id}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('token'),
          'Accept': 'application/json',
        }
      })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
      
      if (actionUrl) {
        setIsNotifOpen(false)
        navigate(actionUrl)
      }
    } catch (err) {}
  }

  const markAllAsRead = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/admin/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('token'),
          'Accept': 'application/json',
        }
      })
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
      setUnreadCount(0)
      toast.success('تم تحديد جميع الإشعارات كمقروءة')
    } catch (err) {}
  }

  const toggleGroup = (label) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const formatRelativeTime = (dateStr) => {
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffSecs = Math.floor((now - date) / 1000)
      
      if (diffSecs < 60) return 'الآن'
      if (diffSecs < 3600) return `منذ ${Math.floor(diffSecs / 60)} دقيقة`
      if (diffSecs < 86400) return `منذ ${Math.floor(diffSecs / 3600)} ساعة`
      if (diffSecs < 604800) return `منذ ${Math.floor(diffSecs / 86400)} يوم`
      return date.toLocaleDateString('ar-EG')
    } catch (e) {
      return dateStr
    }
  }

  const getNotifIconConfig = (type) => {
    switch (type) {
      case 'new_order':
        return {
          icon: RiShoppingBag3Line,
          bg: '#FDF6E2',
          color: '#B5915F',
          border: '#E8D5B5',
          label: 'طلب جديد'
        }
      case 'order_status_updated':
        return {
          icon: RiTruckLine,
          bg: '#EBF4FF',
          color: '#2563EB',
          border: '#BFDBFE',
          label: 'حالة طلب'
        }
      case 'payment_received':
        return {
          icon: RiBankCardLine,
          bg: '#ECFDF5',
          color: '#059669',
          border: '#A7F3D0',
          label: 'دفعة مالية'
        }
      case 'new_product_request':
        return {
          icon: RiSearchFill,
          bg: '#FFF7ED',
          color: '#EA580C',
          border: '#FED7AA',
          label: 'طلب منتج'
        }
      default:
        return {
          icon: RiNotification3Fill,
          bg: '#FAF5FF',
          color: '#4B1828',
          border: '#E9D5FF',
          label: 'تنبيه'
        }
    }
  }

  const filteredNotifications = notifications.filter(n => {
    if (notifFilter === 'unread') return !n.read_at
    return true
  })

  const today = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="app-layout" style={{ display: 'flex', height: '100dvh', width: '100%', direction: 'rtl' }}>
      
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} pages={navItems.filter((it) => canOpen(it.path, user))} />

      {/* Mobile Sidebar Overlay */}
      <div 
        className={`sidebar-overlay ${!isCollapsed ? 'active' : ''}`} 
        onClick={() => setIsCollapsed(true)} 
      />

      {/* Sidebar - Appears on Right in RTL (DOM Order 1) */}
      <aside className={`sidebar-dark ${isCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo">
          <img src={ghLogo} alt="GH Shopper" className={isCollapsed ? 'small' : ''} />
        </div>

        <nav className="sidebar-nav">
          {navSections.map((s0) => ({ ...s0, items: s0.items.filter((it) => canOpen(it.path, user)) })).filter((s0) => s0.items.length).map((sec, i) => (
            <div key={sec.title || i} className="nav-section">
              {sec.title && !isCollapsed ? <div className="nav-section-title">{sec.title}</div> : null}
              {sec.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `nav-item-dark ${isActive ? 'active' : ''}`}
                    title={isCollapsed ? item.label : ''}
                  >
                    <Icon className="nav-icon" size={18} />
                    {!isCollapsed && <span className="nav-label">{item.label}</span>}
                  </NavLink>
                )
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-user" style={{ justifyContent: isCollapsed ? 'center' : 'flex-start', padding: isCollapsed ? '24px 0' : '24px', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="avatar">
            <span className="avatar-initial">{(adminName || 'A').trim().charAt(0).toUpperCase()}</span>
          </div>
          {!isCollapsed && (
            <div className="user-info" style={{ flex: 1, marginRight: '12px', minWidth: '120px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                <div className="name" style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', margin: 0, padding: 0, lineHeight: 1 }}>{adminName}</div>
                <button onClick={() => navigate('/admin/profile')} title="تعديل الحساب" style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center', margin: 0 }} className="hover:text-primaryGold transition-colors">
                  <RiSettings4Line size={17} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="role" style={{ fontSize: '12px', color: '#9CA3AF', margin: 0, padding: 0, lineHeight: 1 }}>{adminRole}</div>
                <button onClick={handleLogout} title="تسجيل الخروج" style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center', margin: 0 }} className="hover:text-red-500 transition-colors">
                  <RiLogoutBoxRLine size={17} />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content (Appears on Left in RTL) */}
      <div className="main-content">
        {/* Top Navbar */}
        <header className="top-navbar-elegant">
          <div style={{ maxWidth: '1600px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Right side of header (Menu toggle and Search) */}
            <div className="flex items-center gap-4">
              <button className="icon-btn" title="القائمة" onClick={() => setIsCollapsed(!isCollapsed)}>
                {isCollapsed ? (
                  <RiMenuUnfoldFill size={28} style={{ transform: 'scaleX(-1)' }} />
                ) : (
                  <RiMenuFoldFill size={28} style={{ transform: 'scaleX(-1)' }} />
                )}
              </button>
              <button type="button" className="gs-trigger" onClick={() => setSearchOpen(true)}>
                <RiSearch2Line size={19} />
                <span className="gs-trigger-text">بحث عن طلب، عميل، منتج…</span>
                <kbd className="hide-on-mobile">⌘K</kbd>
              </button>
            </div>

            {/* Left side of header (Language, Notifications and Date) */}
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-4">
                <button 
                  className="font-bold text-gray-500 hover:text-gray-900 transition-colors" 
                  style={{ fontSize: '14px', width: 44, textAlign: 'center' }}
                  onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                >
                  {lang === 'ar' ? 'EN' : 'AR'}
                </button>

                {/* Notifications Bell Button & Dropdown */}
                <div className="relative" ref={notifDropdownRef}>
                  <button 
                    className={`icon-btn relative transition-transform ${isNotifOpen ? 'bg-amber-50 shadow-sm scale-105' : ''}`}
                    onClick={() => setIsNotifOpen(!isNotifOpen)}
                    title="مركز التنبيهات"
                    style={{ position: 'relative' }}
                  >
                    <RiNotification3Fill size={24} style={{ color: unreadCount > 0 ? '#B5915F' : '#64748b' }} />
                    {unreadCount > 0 && (
                      <span 
                        style={{
                          position: 'absolute',
                          top: '-4px',
                          left: '-4px',
                          backgroundColor: '#DC2626',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          minWidth: '18px',
                          height: '18px',
                          borderRadius: '999px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 4px',
                          border: '2px solid #fff',
                          boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)'
                        }}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>
                  
                  {/* Luxury Notification Center Dropdown */}
                  {isNotifOpen && (
                    <div 
                      style={{ 
                        position: 'absolute', 
                        top: '48px', 
                        left: '0', 
                        width: '420px', 
                        backgroundColor: '#fff', 
                        borderRadius: '20px', 
                        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)', 
                        zIndex: 100, 
                        overflow: 'hidden',
                        animation: 'fadeIn 0.2s ease-out'
                      }}
                    >
                      {/* Header */}
                      <div style={{ padding: '18px 20px', background: 'linear-gradient(135deg, #4B1828 0%, #2A0812 100%)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(181, 145, 95, 0.25)', border: '1px solid rgba(181, 145, 95, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B5915F' }}>
                            <RiNotification3Fill size={20} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#fff' }}>مركز الإشعارات والتنبيهات</div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                              {unreadCount > 0 ? `لديك ${unreadCount} إشعار جديد بحاجة لمتابعتك` : 'جميع التنبيهات مقروءة ومحدثة'}
                            </div>
                          </div>
                        </div>

                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            style={{
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#B5915F',
                              backgroundColor: 'rgba(181, 145, 95, 0.15)',
                              border: '1px solid rgba(181, 145, 95, 0.3)',
                              padding: '5px 10px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.2s'
                            }}
                            title="تحديد الكل كمقروء"
                          >
                            <RiCheckDoubleLine size={14} />
                            <span>قراءة الكل</span>
                          </button>
                        )}
                      </div>

                      {/* Filters / Tabs */}
                      <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc', padding: '8px 16px', gap: '8px' }}>
                        <button
                          onClick={() => setNotifFilter('all')}
                          style={{
                            fontSize: '12px',
                            fontWeight: notifFilter === 'all' ? 'bold' : 'normal',
                            color: notifFilter === 'all' ? '#4B1828' : '#64748b',
                            backgroundColor: notifFilter === 'all' ? '#fff' : 'transparent',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            border: notifFilter === 'all' ? '1px solid #e2e8f0' : 'none',
                            boxShadow: notifFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                            cursor: 'pointer'
                          }}
                        >
                          الكل ({notifications.length})
                        </button>
                        <button
                          onClick={() => setNotifFilter('unread')}
                          style={{
                            fontSize: '12px',
                            fontWeight: notifFilter === 'unread' ? 'bold' : 'normal',
                            color: notifFilter === 'unread' ? '#B5915F' : '#64748b',
                            backgroundColor: notifFilter === 'unread' ? '#fff' : 'transparent',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            border: notifFilter === 'unread' ? '1px solid #e2e8f0' : 'none',
                            boxShadow: notifFilter === 'unread' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                            cursor: 'pointer'
                          }}
                        >
                          غير مقروء ({unreadCount})
                        </button>
                      </div>

                      {/* Notification Items List */}
                      <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                        {filteredNotifications.length === 0 ? (
                          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#cbd5e1' }}>
                              <RiNotification3Fill size={24} />
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#475569' }}>لا توجد تنبيهات حالياً</div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>سيتم إشعارك فور ورود أي طلب أو تحديث جديد</div>
                          </div>
                        ) : (
                          filteredNotifications.map(n => {
                            const isUnread = !n.read_at
                            const iconCfg = getNotifIconConfig(n.type)
                            const IconComponent = iconCfg.icon

                            return (
                              <div 
                                key={n.id} 
                                onClick={() => markAsRead(n.id, n.action_url)}
                                style={{ 
                                  padding: '14px 18px', 
                                  borderBottom: '1px solid #f1f5f9', 
                                  backgroundColor: isUnread ? '#FEFBF6' : '#fff', 
                                  cursor: 'pointer', 
                                  display: 'flex', 
                                  alignItems: 'flex-start', 
                                  gap: '14px',
                                  transition: 'background-color 0.15s ease',
                                  position: 'relative'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isUnread ? '#FDF6E8' : '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isUnread ? '#FEFBF6' : '#fff'}
                              >
                                {/* Unread indicator bar */}
                                {isUnread && (
                                  <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '4px', backgroundColor: '#B5915F' }} />
                                )}

                                {/* Icon */}
                                <div 
                                  style={{ 
                                    width: '38px', 
                                    height: '38px', 
                                    borderRadius: '12px', 
                                    backgroundColor: iconCfg.bg, 
                                    border: `1px solid ${iconCfg.border}`,
                                    color: iconCfg.color,
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    marginTop: '2px'
                                  }}
                                >
                                  <IconComponent size={20} />
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <div style={{ fontWeight: isUnread ? '700' : '600', color: isUnread ? '#1e293b' : '#475569', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span>{n.title_ar || n.title_en}</span>
                                      {isUnread && (
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#DC2626' }} />
                                      )}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <RiTimeLine size={12} />
                                      <span>{formatRelativeTime(n.created_at)}</span>
                                    </div>
                                  </div>

                                  <div style={{ fontSize: '12px', color: isUnread ? '#334155' : '#64748b', lineHeight: 1.4, marginBottom: '6px' }}>
                                    {n.body_ar || n.body_en}
                                  </div>

                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', color: iconCfg.color, backgroundColor: iconCfg.bg, padding: '2px 8px', borderRadius: '6px', fontWeight: '600' }}>
                                      {iconCfg.label}
                                    </span>
                                    {n.action_url && (
                                      <span style={{ fontSize: '11px', color: '#B5915F', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        <span>عرض التفاصيل</span>
                                        <RiExternalLinkLine size={12} />
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>

                      {/* Footer */}
                      <div style={{ padding: '12px 18px', backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <button
                          onClick={() => {
                            setIsNotifOpen(false)
                            navigate('/admin/app-orders')
                          }}
                          style={{ color: '#4B1828', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          الانتقال إلى سجل الطلبات ←
                        </button>
                        <button
                          onClick={() => fetchNotifications(true)}
                          style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          تحديث التنبيهات ↻
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
              <div className="date-display hide-on-mobile">
                <RiCalendarEventFill size={20} style={{ color: 'var(--color-gold)' }} />
                <span style={{ paddingTop: 2 }}>{today}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-container">
          <div className="page-inner" style={{ maxWidth: '1600px', margin: '0 auto', width: '100%', padding: '32px' }}>
            {allowedHere ? <Outlet /> : (
              <div style={{ textAlign: 'center', padding: '90px 20px', color: 'var(--text-secondary)' }}>
                <h2 style={{ color: 'var(--text-primary)' }}>ما عندك صلاحية على هذا القسم</h2>
                <p>صلاحيتك: {adminRole}. اطلب من المدير يغيّرها إذا تحتاج هذا القسم.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
