import { useState, useEffect } from 'react'
import {
  RiUserSettingsLine,
  RiUserAddLine,
  RiSearch2Line,
  RiFilter3Line,
  RiShieldUserLine,
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiEditLine,
  RiDeleteBinLine,
  RiLockPasswordLine,
  RiMailLine,
  RiPhoneLine,
  RiKey2Line,
  RiCheckDoubleLine,
  RiEyeLine,
  RiRefreshLine,
  RiUserStarLine,
  RiTeamLine,
  RiCopperCoinLine,
  RiShieldCheckLine,
  RiCloseLine
} from 'react-icons/ri'
import toast from 'react-hot-toast'

const ROLE_COLORS = {
  super_admin:      { bg: 'var(--color-primary-light)', text: '#fff', border: 'var(--color-primary)', label: 'المدير العام (Super Admin)' },
  admin:            { bg: '#6A1B9A', text: '#fff', border: '#4A148C', label: 'مدير نظام (Admin)' },
  manager:          { bg: '#1565C0', text: '#fff', border: '#0D47A1', label: 'مدير متجر (Store Manager)' },
  sales_manager:    { bg: '#2E7D32', text: '#fff', border: '#1B5E20', label: 'مدير مبيعات (Sales)' },
  shipping_manager: { bg: '#E65100', text: '#fff', border: '#BF360C', label: 'مسؤول الشحن (Shipping)' },
  accountant:       { bg: '#00838F', text: '#fff', border: '#006064', label: 'محاسب مالي (Accountant)' },
  support:          { bg: '#455A64', text: '#fff', border: '#263238', label: 'خدمة العملاء (Support)' },
  product_editor:   { bg: '#8C6A2E', text: '#fff', border: '#6B4F1E', label: 'مسؤول المنتجات (Products)' },
  customer:         { bg: '#9E9E9E', text: '#fff', border: '#616161', label: 'عميل (Customer)' },
}

export default function Users() {
  const [users, setUsers] = useState([])
  const [summary, setSummary] = useState({ total: 0, admins: 0, staff: 0, active: 0 })
  const [roles, setRoles] = useState([])
  const [areaList, setAreaList] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [search, setSearch] = useState('')
  const [selectedRole, setSelectedRole] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showRolesModal, setShowRolesModal] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'manager',
    status: 'active',
    password: '',
  })
  const [saving, setSaving] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (selectedRole !== 'all') params.append('role', selectedRole)
      if (selectedStatus !== 'all') params.append('status', selectedStatus)

      const token = localStorage.getItem('token')
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/users?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        }
      })
      const json = await res.json()
      if (json.success) {
        setUsers(json.data || [])
        if (json.summary) setSummary(json.summary)
      }
    } catch (err) {
      toast.error('تعذر جلب قائمة المستخدمين')
    } finally {
      setLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/roles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        }
      })
      const json = await res.json()
      if (json.success) {
        setRoles(json.data || [])
        setAreaList(json.areas || [])
      }
    } catch (err) {}
  }

  useEffect(() => {
    fetchUsers()
    fetchRoles()
  }, [selectedRole, selectedStatus])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchUsers()
  }

  const handleToggleStatus = async (user) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/${user.id}/toggle-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        }
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message || 'تم تحديث حالة الحساب بنجاح')
        fetchUsers()
      } else {
        toast.error(json.message || 'فشلت العملية')
      }
    } catch (err) {
      toast.error('حدث خطأ أثناء تغيير الحالة')
    }
  }

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`هل أنت متأكد من حذف المستخدم "${user.name}"؟`)) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        }
      })
      const json = await res.json()
      if (json.success) {
        toast.success('تم حذف المستخدم بنجاح')
        fetchUsers()
      } else {
        toast.error(json.message || 'تعذر حذف المستخدم')
      }
    } catch (err) {
      toast.error('حدث خطأ أثناء محاولة الحذف')
    }
  }

  const openAddModal = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'manager',
      status: 'active',
      password: '',
    })
    setShowAddModal(true)
  }

  const openEditModal = (user) => {
    setCurrentUser(user)
    setFormData({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'manager',
      status: user.status || 'active',
      password: '',
    })
    setShowEditModal(true)
  }

  const handleSaveUser = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const isEdit = !!currentUser
      const url = isEdit
        ? `${import.meta.env.VITE_API_URL}/admin/users/${currentUser.id}`
        : `${import.meta.env.VITE_API_URL}/admin/users`
      
      const method = isEdit ? 'PUT' : 'POST'
      const payload = { ...formData }
      if (isEdit && !payload.password) delete payload.password

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (json.success) {
        toast.success(isEdit ? 'تم تحديث بيانات المستخدم' : 'تم إضافة المستخدم بنجاح')
        setShowAddModal(false)
        setShowEditModal(false)
        setCurrentUser(null)
        fetchUsers()
      } else {
        toast.error(json.message || 'يرجى مراجعة البيانات المدخلة')
      }
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ المستخدم')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page" dir="rtl">
      {/* Luxury Hero Header */}
      <div className="dashboard-header gh-hero flex justify-between items-center mb-8" style={{ background: 'linear-gradient(90deg, #4A0D17, #5C131F)', padding: '24px', borderRadius: 'var(--radius-lg)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, #B5915F, #8B6B3D)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RiUserSettingsLine size={32} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0' }}>إدارة المستخدمين والصلاحيات</h1>
            <p style={{ opacity: 0.8, margin: 0, fontSize: '14px' }}>تحكم بكافة حسابات المشرفين، المدراء، الموظفين، وأذونات الوصول بأمان تام.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setShowRolesModal(true)} className="btn btn-outline" style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff' }}>
            <RiShieldCheckLine size={18} />
            دليل الصلاحيات والأدوار
          </button>
          <button onClick={openAddModal} className="btn btn-gold">
            <RiUserAddLine size={18} />
            إضافة مستخدم جديد
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="stats-grid-scrollable" style={{ marginBottom: '24px' }}>
        <div className="stat-card-new">
          <div className="stat-content-right">
            <div className="stat-label-new">إجمالي الحسابات</div>
            <div className="stat-value-row">
              <span className="stat-number-new font-mono">{summary.total}</span>
            </div>
          </div>
          <div className="stat-icon-left icon-primary"><RiTeamLine size={20} className="inner-icon" /></div>
        </div>
        <div className="stat-card-new">
          <div className="stat-content-right">
            <div className="stat-label-new">المدراء والمشرفون</div>
            <div className="stat-value-row">
              <span className="stat-number-new font-mono">{summary.admins}</span>
            </div>
          </div>
          <div className="stat-icon-left icon-purple"><RiShieldUserLine size={20} className="inner-icon" /></div>
        </div>
        <div className="stat-card-new">
          <div className="stat-content-right">
            <div className="stat-label-new">طاقم العمل والعمليات</div>
            <div className="stat-value-row">
              <span className="stat-number-new font-mono">{summary.staff}</span>
            </div>
          </div>
          <div className="stat-icon-left icon-orange"><RiUserStarLine size={20} className="inner-icon" /></div>
        </div>
        <div className="stat-card-new">
          <div className="stat-content-right">
            <div className="stat-label-new">الحسابات النشطة</div>
            <div className="stat-value-row">
              <span className="stat-number-new font-mono">{summary.active}</span>
            </div>
          </div>
          <div className="stat-icon-left icon-green"><RiCheckboxCircleFill size={20} className="inner-icon" /></div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flex: 1, minWidth: '300px' }}>
            <div className="search-bar" style={{ width: '100%' }}>
              <RiSearch2Line className="search-icon" />
              <input
                type="text"
                placeholder="بحث بالاسم، البريد أو الهاتف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </form>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-body)', padding: '6px 12px', borderRadius: '50px' }}>
              <RiFilter3Line color="var(--text-secondary)" />
              <select className="input" style={{ border: 'none', background: 'transparent', height: '30px', padding: 0 }} value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                <option value="all">كافة الأدوار</option>
                <option value="super_admin">المدير العام</option>
                <option value="admin">مدير نظام</option>
                <option value="manager">مدير متجر</option>
                <option value="sales_manager">مدير مبيعات</option>
                <option value="shipping_manager">مسؤول الشحن</option>
                <option value="accountant">محاسب مالي</option>
                <option value="support">خدمة العملاء</option>
                <option value="customer">عملاء المتجر</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-body)', padding: '6px 12px', borderRadius: '50px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>الحالة:</span>
              <select className="input" style={{ border: 'none', background: 'transparent', height: '30px', padding: 0 }} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="all">كافة الحالات</option>
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
                <option value="banned">محظور</option>
              </select>
            </div>

            <button onClick={fetchUsers} className="btn btn-ghost" style={{ padding: '8px' }}>
              <RiRefreshLine size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card mb-0">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>الدور والصلاحية</th>
                <th>معلومات التواصل</th>
                <th>الطلبات / العمليات</th>
                <th>الحالة</th>
                <th>تاريخ الانضمام</th>
                <th style={{ textAlign: 'center' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)' }}>جاري التحميل...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)' }}>لا يوجد مستخدمون مطابقون لمعايير البحث</td></tr>
              ) : (
                users.map((user) => {
                  const roleConfig = ROLE_COLORS[user.role] || ROLE_COLORS.customer
                  const isActive = user.status === 'active' || !user.status

                  return (
                    <tr key={user.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{user.name}</p>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="badge" style={{ backgroundColor: roleConfig.bg, color: roleConfig.text, border: `1px solid ${roleConfig.border}` }}>
                          <RiShieldCheckLine size={14} style={{ marginLeft: 4 }} />
                          {roleConfig.label}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <RiMailLine /> {user.email}
                          </div>
                          {user.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <RiPhoneLine /> <span dir="ltr">{user.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ padding: '4px 8px', background: 'var(--bg-body)', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                            {user.orders_count ?? 0} طلب
                          </span>
                          {user.loyalty_points > 0 && (
                            <span style={{ padding: '4px 8px', background: 'var(--color-gold-bg)', color: 'var(--color-gold-dark)', borderRadius: 6, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <RiCopperCoinLine /> {user.loyalty_points.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <button
                          onClick={() => handleToggleStatus(user)}
                          style={{
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12,
                            color: isActive ? 'var(--status-delivered)' : 'var(--status-cancelled)'
                          }}
                        >
                          {isActive ? <RiCheckboxCircleFill size={16} /> : <RiCloseCircleFill size={16} />}
                          {isActive ? 'نشط' : 'معطل'}
                        </button>
                      </td>

                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {user.created_at ? new Date(user.created_at).toLocaleDateString('ar-OM') : '-'}
                      </td>

                      <td>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button onClick={() => openEditModal(user)} className="icon-btn" title="تعديل"><RiEditLine size={18} /></button>
                          <button onClick={() => handleDeleteUser(user)} className="icon-btn" title="حذف" style={{ color: 'var(--status-cancelled)' }}><RiDeleteBinLine size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODALS --- */}
      {/* Roles Info Modal */}
      {showRolesModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2"><RiShieldCheckLine className="text-amber-500" /> دليل الصلاحيات والأدوار</h3>
              <button className="close-btn" onClick={() => setShowRolesModal(false)}><RiCloseLine size={24} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {Object.values(ROLE_COLORS).map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-body)', borderRadius: '12px' }}>
                    <span className="badge" style={{ backgroundColor: r.bg, color: r.text, minWidth: '150px', justifyContent: 'center' }}>{r.label}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>أذونات وصول مخصصة لهذا الدور حسب إعدادات النظام.</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit User Modal */}
      {(showAddModal || showEditModal) && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{showEditModal ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}</h3>
              <button className="close-btn" onClick={() => { setShowAddModal(false); setShowEditModal(false); }}><RiCloseLine size={24} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="label">الاسم الكامل <span style={{ color: 'red' }}>*</span></label>
                  <input type="text" className="input" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="الاسم الكامل" />
                </div>
                <div className="form-group">
                  <label className="label">البريد الإلكتروني <span style={{ color: 'red' }}>*</span></label>
                  <input type="email" className="input" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="name@domain.com" />
                </div>
                <div className="form-group">
                  <label className="label">رقم الهاتف</label>
                  <input type="text" className="input" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="+968..." dir="ltr" />
                </div>
                <div className="form-group">
                  <label className="label">الصلاحية / الدور <span style={{ color: 'red' }}>*</span></label>
                  <select className="input" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
                    <option value="customer">عميل المتجر (بدون لوحة التحكم)</option>
                  </select>
                  {(() => {
                    const r = roles.find(x => x.id === formData.role)
                    if (!r) return null
                    return (
                      <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: '#FAF7F2', border: '1px solid #EFE6D8' }}>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{r.description}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {areaList.map(a => {
                            const on = (r.areas || []).includes(a.key)
                            return <span key={a.key} title={a.description} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: on ? '#1F1915' : '#fff', color: on ? '#fff' : '#B9AEA7', border: '1px solid ' + (on ? '#1F1915' : '#E5DCCF'), textDecoration: on ? 'none' : 'line-through' }}>{a.label}</span>
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
                <div className="form-group">
                  <label className="label">كلمة المرور {showEditModal && <span style={{ fontSize: 11, color: 'var(--text-light)' }}>(اتركه فارغاً لعدم التغيير)</span>}</label>
                  <input type="text" className="input" required={!showEditModal} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder={showEditModal ? '••••••••' : 'كلمة مرور قوية'} />
                </div>
                
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => { setShowAddModal(false); setShowEditModal(false); }} style={{ flex: 1 }}>إلغاء</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                    {saving ? 'جاري الحفظ...' : (showEditModal ? 'حفظ التعديلات' : 'إضافة المستخدم')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
