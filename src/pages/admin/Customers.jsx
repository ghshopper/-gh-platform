import { useState, useEffect } from 'react'
import {
  RiGroupLine,
  RiUserAddLine,
  RiSearch2Line,
  RiFilter3Line,
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiEditLine,
  RiDeleteBinLine,
  RiMailLine,
  RiPhoneLine,
  RiCopperCoinLine,
  RiVipDiamondLine,
  RiUserStarLine,
  RiMedalLine,
  RiEyeLine,
  RiRefreshLine,
  RiFileList3Line,
  RiCalendarLine,
  RiCloseLine,
  RiShoppingBag3Line
} from 'react-icons/ri'
import toast from 'react-hot-toast'
import OmrSymbol from '../../components/OmrSymbol'
import GHPagination from '../../components/GHPagination'
import CustomerProfile from '../../components/CustomerProfile'
import { EmptyRow } from '../../components/Empty'
import { useSearchParams } from 'react-router-dom'

// The three loyalty tiers: Beige (0–20k points), Burgundy (20k–50k), Black (50k+).
const TIER_LOOKS = [
  { bg: '#F3EADB', text: '#6B4E2E', border: '#CDB794', icon: RiCopperCoinLine, swatch: 'linear-gradient(135deg,#ECDFC9,#CDB794)' },
  { bg: 'rgba(92, 10, 22, 0.08)', text: '#5C0A16', border: '#5C0A16', icon: RiUserStarLine, swatch: 'linear-gradient(135deg,#6A0E1A,#2E0306)' },
  { bg: '#111111', text: '#E8D3A6', border: '#111111', icon: RiVipDiamondLine, swatch: 'linear-gradient(135deg,#1C1C1C,#000)' },
]
const tierLabel = (t) => t.name_ar || t.name
function tierStyle(tiers, name) {
  const i = Math.max(0, tiers.findIndex((t) => t.name === name))
  const t = tiers[i]
  return { ...TIER_LOOKS[Math.min(i, TIER_LOOKS.length - 1)], label: t ? tierLabel(t) : (name || '—') }
}

export default function Customers() {
  const [tiers, setTiers] = useState([])
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/admin/loyalty-tiers`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, Accept: 'application/json' } })
      .then((r) => r.json())
      .then((j) => setTiers((j.data || j || []).slice().sort((a, b) => a.min_points - b.min_points)))
      .catch(() => {})
  }, [])
  const firstTier = tiers[0]?.name || ''
  const [customers, setCustomers] = useState([])
  const [summary, setSummary] = useState({ total: 0, active: 0, tiers: [] })
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  
  // Filters
  const [search, setSearch] = useState('')
  const [selectedTier, setSelectedTier] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [currentCustomer, setCurrentCustomer] = useState(null)
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    loyalty_tier: '',
    loyalty_points: 0,
    status: 'active',
    password: '',
  })
  const [saving, setSaving] = useState(false)

  const fetchCustomers = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', page)
      if (search) params.append('search', search)
      if (selectedTier !== 'all') params.append('tier', selectedTier)
      if (selectedStatus !== 'all') params.append('status', selectedStatus)

      const token = localStorage.getItem('token')
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/customers?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        }
      })
      const json = await res.json()
      if (json.data) {
        setCustomers(json.data || [])
        if (json.summary) setSummary(json.summary)
        if (json.meta) {
          setCurrentPage(json.meta.current_page || 1)
          setLastPage(json.meta.last_page || 1)
          setTotalItems(json.meta.total || 0)
        } else {
          setTotalItems((json.data || []).length)
        }
      }
    } catch (err) {
      toast.error('تعذر جلب بيانات العملاء')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers(1)
  }, [selectedTier, selectedStatus])

  // ?open=<id> (from the search or an order) opens that customer's card
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    const id = params.get('open')
    if (!id) return
    setCurrentCustomer({ id })
    setShowDetailsModal(true)
    params.delete('open'); setParams(params, { replace: true })
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchCustomers(1)
  }

  const openAddModal = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      loyalty_tier: '',
      loyalty_points: 0,
      status: 'active',
      password: '',
    })
    setShowAddModal(true)
  }

  const openEditModal = (customer) => {
    setCurrentCustomer(customer)
    setFormData({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      loyalty_tier: customer.loyalty_tier || firstTier,
      loyalty_points: customer.loyalty_points || 0,
      status: customer.status || 'active',
      password: '',
    })
    setShowEditModal(true)
  }

  const handleSaveCustomer = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const isEdit = !!currentCustomer
      const url = isEdit
        ? `${import.meta.env.VITE_API_URL}/admin/customers/${currentCustomer.id}`
        : `${import.meta.env.VITE_API_URL}/admin/customers`
      
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
        toast.success(isEdit ? 'تم تحديث بيانات العميل' : 'تمت إضافة العميل بنجاح')
        setShowAddModal(false)
        setShowEditModal(false)
        setCurrentCustomer(null)
        fetchCustomers(currentPage)
      } else {
        toast.error(json.message || 'يرجى مراجعة البيانات المدخلة')
      }
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ العميل')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCustomer = async (customer) => {
    if (!window.confirm(`هل أنت متأكد من حذف العميل "${customer.name}" وجميع بياناته؟`)) return
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/customers/${customer.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        }
      })
      const json = await res.json()
      if (json.success) {
        toast.success('تم حذف العميل بنجاح')
        fetchCustomers(currentPage)
      } else {
        toast.error(json.message || 'تعذر حذف العميل')
      }
    } catch (err) {
      toast.error('حدث خطأ أثناء محاولة الحذف')
    }
  }

  const viewCustomerDetails = (customer) => {
    setCurrentCustomer(customer)
    setShowDetailsModal(true)
  }

  const handleToggleStatus = async (customer) => {
    // Add quick status toggle if API supports it or handle via PUT request
    try {
      const token = localStorage.getItem('token')
      const newStatus = customer.status === 'active' ? 'inactive' : 'active'
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/customers/${customer.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ ...customer, status: newStatus })
      })
      const json = await res.json()
      if (json.success) {
        toast.success('تم تغيير حالة الحساب')
        fetchCustomers()
      }
    } catch (err) {}
  }

  return (
    <div className="page" dir="rtl">
      {/* Luxury Hero Header */}
      <div className="dashboard-header gh-hero flex justify-between items-center mb-8" style={{ background: 'linear-gradient(90deg, #1A1A2E, #2B2B4A)', padding: '24px', borderRadius: 'var(--radius-lg)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, #B5915F, #8B6B3D)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RiGroupLine size={32} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0' }}>إدارة العملاء <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 'normal' }}>Customer Directory</span></h1>
            <p style={{ opacity: 0.8, margin: 0, fontSize: '14px' }}>متابعة سجلات العملاء، مستويات الولاء، سجل الطلبات، وحجم المشتريات بدقة وسهولة.</p>
          </div>
        </div>
        <div>
          <button onClick={openAddModal} className="btn btn-gold">
            <RiUserAddLine size={18} />
            إضافة عميل جديد
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="stats-grid-scrollable" style={{ marginBottom: '24px' }}>
        <div className="stat-card-new">
          <div className="stat-content-right">
            <div className="stat-label-new">إجمالي العملاء</div>
            <div className="stat-value-row">
              <span className="stat-number-new font-mono">{summary.total}</span>
            </div>
          </div>
          <div className="stat-icon-left icon-primary"><RiGroupLine size={20} className="inner-icon" /></div>
        </div>
        {(summary.tiers?.length ? summary.tiers : tiers.map((t) => ({ ...t, count: 0 }))).map((t, i) => {
          const look = TIER_LOOKS[Math.min(i, TIER_LOOKS.length - 1)]
          const Icon = look.icon
          return (
            <div key={t.name} className="stat-card-new" style={{ cursor: 'pointer' }} onClick={() => setSelectedTier(t.name)}>
              <div className="stat-content-right">
                <div className="stat-label-new">مستوى {tierLabel(t)} <span style={{ color: '#9CA3AF', fontSize: 11 }}>· {Number(t.min_points).toLocaleString('en-US')}+ نقطة</span></div>
                <div className="stat-value-row">
                  <span className="stat-number-new font-mono">{t.count ?? 0}</span>
                </div>
              </div>
              <div className="stat-icon-left" style={{ background: look.swatch, color: i === 0 ? '#6B4E2E' : '#E8D3A6' }}><Icon size={20} className="inner-icon" /></div>
            </div>
          )
        })}
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
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>المستوى:</span>
              <select className="input" style={{ border: 'none', background: 'transparent', height: '30px', padding: 0 }} value={selectedTier} onChange={(e) => setSelectedTier(e.target.value)}>
                <option value="all">كل المستويات</option>
                {tiers.map((t) => <option key={t.id} value={t.name}>{tierLabel(t)}</option>)}
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

            <button onClick={fetchCustomers} className="btn btn-ghost" style={{ padding: '8px' }}>
              <RiRefreshLine size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card mb-0">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>العميل</th>
                <th>رقم الهاتف</th>
                <th style={{ textAlign: 'center' }}>عدد الطلبات</th>
                <th>إجمالي المشتريات</th>
                <th>نقاط الولاء</th>
                <th>المستوى</th>
                <th>الحالة</th>
                <th style={{ textAlign: 'center' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)' }}>جاري التحميل...</td></tr>
              ) : customers.length === 0 ? (
                <EmptyRow cols={8} icon={RiGroupLine} title={search || selectedTier !== 'all' || selectedStatus !== 'all' ? 'ما فيه عملاء بهذا البحث' : 'ما فيه عملاء للحين'} hint={search ? 'جرّب الاسم أو آخر 4 أرقام من الهاتف' : 'العملاء يظهرون هنا أول ما يسجلون من التطبيق أو الموقع'} />
              ) : (
                customers.map((customer) => {
                  const tier = tierStyle(tiers, customer.loyalty_tier)
                  const TierIcon = tier.icon
                  const isActive = customer.status === 'active' || !customer.status

                  return (
                    <tr key={customer.id} onClick={() => viewCustomerDetails(customer)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'var(--bg-body)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {customer.name ? customer.name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div>
                            <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{customer.name}</p>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{customer.email}</p>
                          </div>
                        </div>
                      </td>

                      <td style={{ fontSize: 13, color: 'var(--text-secondary)' }} dir="ltr">
                        {customer.phone || '-'}
                      </td>

                      <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 16 }}>
                        {customer.orders_count || 0}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 800, color: 'var(--text-primary)' }}>
                          <span className="font-mono">{parseFloat(customer.total_spent || 0).toFixed(3)}</span>
                          <OmrSymbol size={11} primaryColor="var(--text-primary)" secondaryColor="var(--color-gold)" />
                        </div>
                      </td>

                      <td>
                        <span className="badge" style={{ background: 'var(--bg-body)', color: 'var(--text-secondary)' }}>
                          <RiCopperCoinLine /> {customer.loyalty_points || 0} نقطة
                        </span>
                      </td>

                      <td>
                        <span className="badge" style={{ backgroundColor: tier.bg, color: tier.text, border: `1px solid ${tier.border}40` }}>
                          <TierIcon size={14} />
                          {tier.label}
                        </span>
                      </td>

                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleStatus(customer)}
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

                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <button onClick={() => viewCustomerDetails(customer)} className="icon-btn" title="عرض السجل"><RiEyeLine size={18} /></button>
                          <button onClick={() => openEditModal(customer)} className="icon-btn" title="تعديل"><RiEditLine size={18} /></button>
                          <button onClick={() => handleDeleteCustomer(customer)} className="icon-btn" title="حذف" style={{ color: 'var(--status-cancelled)' }}><RiDeleteBinLine size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          
          {/* Footer Pagination */}
          {!loading && customers.length > 0 && (
            <div style={{
              padding:'14px 20px',
              borderTop:`1px solid rgba(74,13,23,0.06)`,
              background:'#FAFAFA',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '16px' }}>
                <span style={{ fontSize:13, color:'#9CA3AF' }}>عرض {customers.length} عميل في هذه الصفحة</span>
                <span style={{ fontSize:13, color: 'var(--color-primary)', fontWeight:600 }}>إجمالي العملاء: {totalItems}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <GHPagination 
                  currentPage={currentPage} 
                  lastPage={lastPage} 
                  total={totalItems} 
                  onPageChange={(p) => fetchCustomers(p)} 
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}
      {/* Customer card: spend, orders, tier, notes and tags */}
      {showDetailsModal && currentCustomer && (
        <CustomerProfile id={currentCustomer.id} onClose={() => setShowDetailsModal(false)} />
      )}

      {/* Add / Edit Customer Modal */}
      {(showAddModal || showEditModal) && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{showEditModal ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</h3>
              <button className="close-btn" onClick={() => { setShowAddModal(false); setShowEditModal(false); }}><RiCloseLine size={24} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSaveCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="label">اسم العميل <span style={{ color: 'red' }}>*</span></label>
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
                
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="label">مستوى الولاء</label>
                    <select className="input" value={formData.loyalty_tier} onChange={(e) => setFormData({...formData, loyalty_tier: e.target.value})}>
                      {tiers.map((t) => <option key={t.id} value={t.name}>{tierLabel(t)} · {t.min_points}+</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="label">النقاط الحالية</label>
                    <input type="number" min="0" className="input" value={formData.loyalty_points} onChange={(e) => setFormData({...formData, loyalty_points: parseInt(e.target.value) || 0})} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">كلمة المرور {showEditModal && <span style={{ fontSize: 11, color: 'var(--text-light)' }}>(اتركه فارغاً لعدم التغيير)</span>}</label>
                  <input type="text" className="input" required={!showEditModal} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder={showEditModal ? '••••••••' : 'كلمة مرور قوية'} />
                </div>
                
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => { setShowAddModal(false); setShowEditModal(false); }} style={{ flex: 1 }}>إلغاء</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                    {saving ? 'جاري الحفظ...' : (showEditModal ? 'حفظ التعديلات' : 'إضافة العميل')}
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
