import React, { useState, useEffect } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { adminApi } from '../../services/adminApi'
import {
  RiGlobalLine,
  RiBankCardLine,
  RiTruckLine,
  RiTranslate2,
  RiCheckLine,
  RiAddLine,
  RiDeleteBinLine,
  RiCloseCircleLine,
  RiEditBoxLine,
} from 'react-icons/ri'
import './Settings.css'

const API = import.meta.env.VITE_API_URL

export default function Settings() {
  const [activeTab, setActiveTab] = useState('payment')
  const [languages, setLanguages] = useState([])
  const [gateways, setGateways] = useState([])
  const [shippingCountries, setShippingCountries] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Settings State
  const [generalSettings, setGeneralSettings] = useState({
    app_name: 'GH Shopper',
    admin_dashboard_name: 'GH Admin Panel',
    service_fee: '0.000',
    tax_percentage: '0',
    support_email: '',
    support_phone: '',
    currency_symbol: 'OMR',
    gemini_api_key: ''
  })
  
  const [smtpSettings, setSmtpSettings] = useState({
    smtp_host: '',
    smtp_port: '587',
    smtp_user: '',
    smtp_password: '',
    smtp_encryption: 'tls',
    smtp_from_address: '',
    smtp_from_name: 'GH Shopper',
  })
  const [pushPhone, setPushPhone] = useState('')
  const [pushResult, setPushResult] = useState(null)
  const [pushBusy, setPushBusy] = useState(false)
  const runPushTest = async () => {
    setPushBusy(true)
    setPushResult(null)
    try {
      const r = await adminApi.testPush(pushPhone.trim())
      setPushResult(r.data || r)
    } catch (e) {
      setPushResult({ sent: false, error: e?.response?.data?.message || 'تعذّر الفحص' })
    } finally {
      setPushBusy(false)
    }
  }
  const loadKeyFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const j = JSON.parse(String(reader.result))
        if (!j.private_key || !j.client_email) throw new Error()
        setFirebaseSettings((s) => ({ ...s, fcm_server_key: JSON.stringify(j) }))
        toast.success('تم تحميل الملف (' + (j.project_id || '') + ') — اضغط حفظ المفتاح')
      } catch {
        toast.error('هذا مب ملف حساب خدمة من Firebase')
      }
    }
    reader.readAsText(file)
  }
  const [firebaseSettings, setFirebaseSettings] = useState({
    fcm_server_key: '',
  })
  const [testEmail, setTestEmail] = useState('')
  
  // Payment Gateway Edit State
  const [isEditGatewayModalOpen, setIsEditGatewayModalOpen] = useState(false)
  const [editingGateway, setEditingGateway] = useState(null)

  const [newLang, setNewLang] = useState({
    code: '',
    name: '',
    is_rtl: false,
    is_active: true,
  })

  const [newCountry, setNewCountry] = useState({
    name: '',
    code: '',
    currency_code: '',
    currency_symbol: '',
    shipping_cost: '',
    estimated_delivery_time: '',
    is_active: true
  })

  // Shipping Country Edit State
  const [isEditCountryModalOpen, setIsEditCountryModalOpen] = useState(false)
  const [editingCountry, setEditingCountry] = useState(null)
  const [badges, setBadges] = useState(null)

  useEffect(() => {
    fetchLanguages()
    fetchGateways()
    fetchShippingCountries()
    fetchBadges()
    fetchSystemSettings('general')
    fetchSystemSettings('smtp')
    fetchSystemSettings('firebase')
  }, [])

  const fetchSystemSettings = async (group) => {
    try {
      const res = await adminApi.getSettings(group)
      const data = res.data?.data || res.data || {}
      
      if (group === 'general') {
        setGeneralSettings(prev => ({ ...prev, ...data }))
      } else if (group === 'smtp') {
        setSmtpSettings(prev => ({ ...prev, ...data }))
      } else if (group === 'firebase') {
        setFirebaseSettings(prev => ({ ...prev, ...data }))
      }
    } catch (err) {
      console.error('Failed to load settings', err)
    }
  }

  const handleSaveSettings = async (group, data) => {
    try {
      await adminApi.updateSettings(group, data)
      toast.success('تم حفظ الإعدادات بنجاح')
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ الإعدادات')
    }
  }

  const handleTestEmail = async (e) => {
    e.preventDefault()
    if (!testEmail) return toast.error('أدخل بريداً إلكترونياً أولاً')
    try {
      await adminApi.testEmail(testEmail)
      toast.success('تم إرسال رسالة الاختبار بنجاح، تحقق من بريدك')
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل في إرسال البريد')
    }
  }

  
  const fetchBadges = async () => {
    try {
      const res = await fetch(`${API}/admin/app-customize/splash`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      })
      const json = await res.json()
      setBadges(json.data?.badge_settings || {})
    } catch (err) {
      console.error('Failed to load badges', err)
    }
  }

  const fetchGateways = async () => {
    try {
      const res = await adminApi.getPaymentGateways()
      setGateways(res.data.data || res.data)
    } catch (err) {
      toast.error('Failed to load payment gateways')
    }
  }

  const fetchShippingCountries = async () => {
    try {
      const res = await adminApi.getShippingCountries()
      setShippingCountries(res.data?.data || res.data || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load shipping countries')
    }
  }

  const handleAddCountry = async (e) => {
    e.preventDefault()
    try {
      await adminApi.createShippingCountry(newCountry)
      toast.success('تم إضافة الدولة بنجاح')
      setNewCountry({ name: '', code: '', currency_code: '', currency_symbol: '', shipping_cost: '', estimated_delivery_time: '', is_active: true })
      fetchShippingCountries()
    fetchBadges()
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في إضافة الدولة')
    }
  }

  const handleDeleteCountry = async (id) => {
    if(!window.confirm('هل أنت متأكد من حذف هذه الدولة؟')) return
    try {
      await adminApi.deleteShippingCountry(id)
      toast.success('تم الحذف بنجاح')
      fetchShippingCountries()
    fetchBadges()
    } catch (err) {
      toast.error('خطأ في الحذف')
    }
  }

  const handleEditCountrySubmit = async (e) => {
    e.preventDefault()
    if (!editingCountry) return
    try {
      await adminApi.updateShippingCountry(editingCountry.id, editingCountry)
      toast.success('تم تحديث الدولة بنجاح')
      setIsEditCountryModalOpen(false)
      fetchShippingCountries()
    fetchBadges()
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في التحديث')
    }
  }

  const handleEditGatewaySubmit = async (e) => {
    e.preventDefault()
    try {
      await adminApi.updatePaymentGateway(editingGateway.id, {
        extra_fee: editingGateway.extra_fee,
        credentials: editingGateway.credentials,
      })
      toast.success('تم الحفظ بنجاح')
      setIsEditGatewayModalOpen(false)
      fetchGateways()
    } catch (err) {
      toast.error('حدث خطأ أثناء الحفظ')
    }
  }

  const fetchLanguages = async () => {
    try {
      const res = await api.get('/admin/languages')
      setLanguages(Array.isArray(res.data) ? res.data : (res.data.data || []))
      setIsLoading(false)
    } catch (err) {
      toast.error('Failed to load languages')
      setIsLoading(false)
    }
  }

  const toggleGatewayStatus = async (id, currentStatus) => {
    try {
      await adminApi.updatePaymentGateway(id, { is_active: !currentStatus });
      toast.success('تم تحديث حالة البوابة بنجاح');
      fetchGateways();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء تحديث الحالة');
    }
  };

  const toggleCountryStatus = async (id, currentStatus) => {
    try {
      await adminApi.updateShippingCountry(id, { is_active: !currentStatus });
      toast.success('تم تحديث حالة الدولة بنجاح');
      fetchShippingCountries();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء تحديث الحالة');
    }
  };

  const handleAddLanguage = async (e) => {
    e.preventDefault()
    try {
      await api.post('/admin/languages', newLang)
      toast.success('Language added successfully')
      fetchLanguages()
      setNewLang({ code: '', name: '', is_rtl: false, is_active: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error adding language')
    }
  }

  const toggleLanguageStatus = async (id, currentStatus) => {
    try {
      await api.put(`/admin/languages/${id}`, { is_active: !currentStatus })
      toast.success('Status updated')
      fetchLanguages()
    } catch (err) {
      toast.error('Failed to update status')
    }
  }

  const toggleLanguageDirection = async (id, currentRtl) => {
    try {
      await api.put(`/admin/languages/${id}`, { is_rtl: !currentRtl })
      toast.success('Direction updated')
      fetchLanguages()
    } catch (err) {
      toast.error('Failed to update direction')
    }
  }

  const deleteLanguage = async (id) => {
    if (!window.confirm('Are you sure?')) return
    try {
      await api.delete(`/admin/languages/${id}`)
      toast.success('Language deleted')
      fetchLanguages()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete language')
    }
  }

  const getFlagEmoji = (countryCode) => {
    if (!countryCode) return '🌐';
    try {
      const code = countryCode === 'en' ? 'US' : countryCode === 'ar' ? 'SA' : String(countryCode);
      const codePoints = code
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    } catch (e) {
      return '🌐';
    }
  };

  const tabs = [
    { id: 'general', label: 'إعدادات عامة', icon: <RiGlobalLine size={20} /> },
    { id: 'payment', label: 'بوابات الدفع', icon: <RiBankCardLine size={20} /> },
    { id: 'shipping', label: 'رسوم الشحن', icon: <RiTruckLine size={20} /> },
    { id: 'languages', label: 'اللغات', icon: <RiTranslate2 size={20} /> },
    { id: 'smtp', label: 'إعدادات البريد SMTP', icon: <RiGlobalLine size={20} /> },
    { id: 'firebase', label: 'تنبيهات Firebase', icon: <RiGlobalLine size={20} /> },
  ]

  return (
    <div className="settings-wrapper page-container" style={{ padding: '32px' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 className="page-title">الإعدادات</h1>
          <p className="page-subtitle">إدارة إعدادات المتجر العامة واللغات وتخصيص النظام</p>
        </div>
      </div>

      <div className="settings-layout-wrapper" style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* Settings Sidebar Tabs (Glassmorphic) */}
        <div className="settings-glass-card settings-sidebar" style={{ width: '280px', padding: '16px', position: 'sticky', top: '24px' }}>
          <h3 style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '16px', padding: '0 12px' }}>القائمة الرئيسية</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`settings-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Settings Content Area */}
        <div className="settings-glass-card settings-content-area" style={{ flex: 1, padding: '32px', minHeight: '600px', width: '100%' }}>
          
          {activeTab === 'general' && (
            <div>
              <div className="settings-action-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>الإعدادات العامة</h3>
                  <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>قم بإدارة إعدادات التطبيق الأساسية مثل الأسماء والرسوم وتفاصيل التواصل.</p>
                </div>
                <button 
                  onClick={() => handleSaveSettings('general', generalSettings)}
                  style={{ background: 'var(--color-primary)', color: '#fff', padding: '10px 24px', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(181, 142, 107, 0.3)' }}
                >
                  <RiCheckLine size={20} /> حفظ الإعدادات
                </button>
              </div>

              <div className="grid-2">
                {/* الهوية الأساسية */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #F3F4F6', boxShadow: '0 2px 16px rgba(0,0,0,0.03)' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#374151', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '4px', height: '16px', background: 'var(--color-gold)', borderRadius: '4px' }}></span>
                    الهوية الأساسية
                  </h4>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#6B7280', marginBottom: '8px' }}>اسم التطبيق (App Name)</label>
                    <input 
                      type="text" 
                      value={generalSettings.app_name}
                      onChange={e => setGeneralSettings(prev => ({ ...prev, app_name: e.target.value }))}
                      style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', outline: 'none' }}
                      placeholder="GH Shopper"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#6B7280', marginBottom: '8px' }}>اسم لوحة التحكم (Admin Dashboard Name)</label>
                    <input 
                      type="text" 
                      value={generalSettings.admin_dashboard_name}
                      onChange={e => setGeneralSettings(prev => ({ ...prev, admin_dashboard_name: e.target.value }))}
                      style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', outline: 'none' }}
                      placeholder="GH Admin Panel"
                    />
                  </div>
                </div>

                {/* الرسوم والضرائب */}
                <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #F3F4F6', boxShadow: '0 2px 16px rgba(0,0,0,0.03)' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#374151', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '4px', height: '16px', background: 'var(--color-primary)', borderRadius: '4px' }}></span>
                    الرسوم والضرائب
                  </h4>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#6B7280', marginBottom: '8px' }}>رسوم الخدمة (Service Fee) بالريال العماني</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontWeight: 600 }}>OMR</span>
                      <input 
                        type="number" 
                        step="0.001"
                        value={generalSettings.service_fee}
                        onChange={e => setGeneralSettings(prev => ({ ...prev, service_fee: e.target.value }))}
                        style={{ width: '100%', padding: '12px 16px 12px 60px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', outline: 'none', direction: 'ltr' }}
                        placeholder="0.000"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#6B7280', marginBottom: '8px' }}>نسبة الضريبة (Tax Percentage) %</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontWeight: 600 }}>%</span>
                      <input 
                        type="number" 
                        step="0.1"
                        value={generalSettings.tax_percentage}
                        onChange={e => setGeneralSettings(prev => ({ ...prev, tax_percentage: e.target.value }))}
                        style={{ width: '100%', padding: '12px 16px 12px 40px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', outline: 'none', direction: 'ltr' }}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* معلومات التواصل */}
                <div style={{ gridColumn: '1 / -1', background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #F3F4F6', boxShadow: '0 2px 16px rgba(0,0,0,0.03)' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#374151', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '4px', height: '16px', background: '#3B82F6', borderRadius: '4px' }}></span>
                    معلومات الدعم الفني
                  </h4>
                  
                  <div className="grid-2">
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#6B7280', marginBottom: '8px' }}>البريد الإلكتروني للدعم (Support Email)</label>
                      <input 
                        type="email" 
                        value={generalSettings.support_email}
                        onChange={e => setGeneralSettings(prev => ({ ...prev, support_email: e.target.value }))}
                        style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', outline: 'none', direction: 'ltr' }}
                        placeholder="support@ghshopper.com"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#6B7280', marginBottom: '8px' }}>رقم الهاتف (Support Phone)</label>
                      <input 
                        type="text" 
                        value={generalSettings.support_phone}
                        onChange={e => setGeneralSettings(prev => ({ ...prev, support_phone: e.target.value }))}
                        style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', outline: 'none', direction: 'ltr' }}
                        placeholder="+968 1234 5678"
                      />
                    </div>
                  </div>
                </div>

                {/* إعدادات الذكاء الاصطناعي */}
                <div style={{ gridColumn: '1 / -1', background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #F3F4F6', boxShadow: '0 2px 16px rgba(0,0,0,0.03)' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#374151', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '4px', height: '16px', background: '#8B5CF6', borderRadius: '4px' }}></span>
                    إعدادات الذكاء الاصطناعي (AI Settings)
                  </h4>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#6B7280', marginBottom: '8px' }}>مفتاح Gemini API Key</label>
                    <input 
                      type="password" 
                      value={generalSettings.gemini_api_key}
                      onChange={e => setGeneralSettings(prev => ({ ...prev, gemini_api_key: e.target.value }))}
                      style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', outline: 'none', direction: 'ltr' }}
                      placeholder="AIzaSy..."
                    />
                    <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '8px' }}>مطلوب لتفعيل ميزة استيراد المنتجات بالذكاء الاصطناعي من الروابط.</p>
                  </div>
                </div>

              </div>
            </div>
          )}
          
          {activeTab === 'payment' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '22px', color: 'var(--color-primary-dark)' }}>بوابات الدفع</h3>
                  <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>التحكم في بوابات الدفع المتاحة في التطبيق (تفعيل وإلغاء تفعيل).</p>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>البوابة</th>
                      <th>الكود</th>
                      <th>الوصف</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gateways.map(gw => (
                      <tr key={gw.id}>
                        <td style={{ fontWeight: 600 }}>{gw.name}</td>
                        <td style={{ fontFamily: 'Outfit' }}>{gw.code}</td>
                        <td>{gw.subtitle}</td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleGatewayStatus(gw.id, gw.is_active)}
                              className={`badge ${gw.is_active ? 'badge-delivered' : 'badge-cancelled'}`}
                              style={{ cursor: 'pointer', border: 'none', background: gw.is_active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: gw.is_active ? '#22C55E' : '#EF4444' }}
                            >
                              {gw.is_active ? 'مفعل' : 'معطل'}
                            </button>
                            <button
                              onClick={() => {
                                setEditingGateway({ ...gw, credentials: gw.credentials || {} })
                                setIsEditGatewayModalOpen(true)
                              }}
                              className="btn btn-ghost btn-sm"
                              title="تعديل الإعدادات"
                            >
                              <RiCheckLine size={18} /> تعديل
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {activeTab === 'shipping' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '22px', color: 'var(--color-primary-dark)' }}>دول التوصيل والشحن</h3>
                  <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>إدارة أسعار الشحن، والدول المتاحة، والعملات المعتمدة.</p>
                </div>
              </div>

              {/* Add Country Form */}
              <div className="add-lang-container" style={{ marginBottom: '32px' }}>
                <h4 style={{ margin: '0 0 20px', color: 'var(--color-gold-dark)', fontSize: '16px' }}>إضافة دولة جديدة</h4>
                <form onSubmit={handleAddCountry} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                  <div className="settings-input-group" style={{ flex: '1 1 150px' }}>
                    <label className="settings-label">اسم الدولة (العربية)</label>
                    <input type="text" className="settings-input" placeholder="مثال: الكويت" value={newCountry.name} onChange={(e) => setNewCountry({...newCountry, name: e.target.value})} required />
                  </div>
                  <div className="settings-input-group" style={{ flex: '1 1 80px' }}>
                    <label className="settings-label">الكود</label>
                    <input type="text" className="settings-input" placeholder="KW" value={newCountry.code} onChange={(e) => setNewCountry({...newCountry, code: e.target.value.toUpperCase()})} required maxLength={2} />
                  </div>
                  <div className="settings-input-group" style={{ flex: '1 1 100px' }}>
                    <label className="settings-label">كود العملة</label>
                    <input type="text" className="settings-input" placeholder="KWD" value={newCountry.currency_code} onChange={(e) => setNewCountry({...newCountry, currency_code: e.target.value.toUpperCase()})} required maxLength={3} />
                  </div>
                  <div className="settings-input-group" style={{ flex: '1 1 100px' }}>
                    <label className="settings-label">رمز العملة</label>
                    <input type="text" className="settings-input" placeholder="د.ك" value={newCountry.currency_symbol} onChange={(e) => setNewCountry({...newCountry, currency_symbol: e.target.value})} required />
                  </div>
                  <div className="settings-input-group" style={{ flex: '1 1 120px' }}>
                    <label className="settings-label">تكلفة الشحن</label>
                    <input type="number" step="0.001" className="settings-input" placeholder="0.000" value={newCountry.shipping_cost} onChange={(e) => setNewCountry({...newCountry, shipping_cost: e.target.value})} />
                  </div>
                  <div className="settings-input-group" style={{ flex: '1 1 150px' }}>
                    <label className="settings-label">مدة التوصيل</label>
                    <select className="settings-input" value={newCountry.estimated_delivery_time} onChange={(e) => setNewCountry({...newCountry, estimated_delivery_time: e.target.value})}>
                      <option value="">بدون شارة (تلقائي)</option>
                      {badges && Object.entries(badges)
                        .filter(([key]) => key !== 'discount' && key !== 'preorder')
                        .map(([key, badge]) => (
                        <option key={key} value={key}>{badge.text_ar || key}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="settings-gold-btn" style={{ flex: 'none', height: '42px', padding: '0 20px' }}>
                    <RiAddLine size={20} /> إضافة
                  </button>
                </form>
              </div>

              {/* Countries Table */}
              <div className="settings-table-wrapper">
                <table className="settings-table">
                  <thead>
                    <tr>
                      <th>الدولة</th>
                      <th>الكود</th>
                      <th>العملة</th>
                      <th>تكلفة الشحن</th>
                      <th>المدة المتوقعة</th>
                      <th>الحالة</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(shippingCountries) ? shippingCountries : []).map(country => (
                      <tr key={country.id}>
                        <td><span style={{ fontWeight: 600 }}>{country.name}</span></td>
                        <td><span style={{ background: '#F3F4F6', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{country.code}</span></td>
                        <td>{country.currency_code} ({country.currency_symbol})</td>
                        <td>{country.shipping_cost} {country.currency_symbol}</td>
                        <td>{country.estimated_delivery_time || '-'}</td>
                        <td>
                          <button
                            onClick={() => toggleCountryStatus(country.id, country.is_active)}
                            className={`badge ${country.is_active ? 'badge-delivered' : 'badge-cancelled'}`}
                            style={{ cursor: 'pointer', border: 'none', background: country.is_active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: country.is_active ? '#22C55E' : '#EF4444' }}
                          >
                            {country.is_active ? 'مفعل' : 'معطل'}
                          </button>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setEditingCountry(country)
                                setIsEditCountryModalOpen(true)
                              }} 
                              className="action-icon" 
                              style={{ color: 'var(--color-primary)' }}
                            >
                              <RiEditBoxLine />
                            </button>
                            <button onClick={() => handleDeleteCountry(country.id)} className="action-icon" style={{ color: 'var(--color-danger)' }}>
                              <RiDeleteBinLine />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'languages' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '22px', color: 'var(--color-primary-dark)' }}>إدارة اللغات</h3>
                  <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>التحكم في اللغات المتاحة في التطبيق واتجاه النصوص بكل سهولة.</p>
                </div>
              </div>

              {/* Add Language Form (Premium Design) */}
              <div className="add-lang-container" style={{ marginBottom: '32px' }}>
                <h4 style={{ margin: '0 0 20px', color: 'var(--color-gold-dark)', fontSize: '16px' }}>إضافة لغة جديدة</h4>
                <form onSubmit={handleAddLanguage} className="grid-4">
                  <div className="settings-input-group">
                    <label className="settings-label">رمز اللغة</label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      placeholder="ar, en, fr..."
                      value={newLang.code}
                      onChange={(e) => setNewLang({...newLang, code: e.target.value})}
                      required
                    />
                  </div>
                  <div className="settings-input-group">
                    <label className="settings-label">اسم اللغة</label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      placeholder="العربية، English..."
                      value={newLang.name}
                      onChange={(e) => setNewLang({...newLang, name: e.target.value})}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', height: '52px', padding: '0 8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      <input 
                        type="checkbox" 
                        checked={newLang.is_rtl}
                        onChange={(e) => setNewLang({...newLang, is_rtl: e.target.checked})}
                        style={{ width: '20px', height: '20px', accentColor: 'var(--color-gold)' }}
                      />
                      <span>يدعم RTL</span>
                    </label>
                  </div>
                  <button type="submit" className="settings-gold-btn">
                    <RiAddLine size={20} /> إضافة اللغة
                  </button>
                </form>
              </div>

              {/* Languages Table */}
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-gold)' }}>جاري التحميل...</div>
              ) : (
                <div className="settings-table-wrapper">
                  <table className="settings-table">
                    <thead>
                      <tr>
                        <th>اللغة</th>
                        <th>الرمز</th>
                        <th>الاتجاه</th>
                        <th>الحالة</th>
                        <th style={{ textAlign: 'left' }}>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(languages) ? languages : []).map(lang => (
                        <tr key={lang.id || lang.code}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <span style={{ fontSize: '1.8em', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>{getFlagEmoji(lang.code)}</span>
                              <span style={{ fontWeight: 700, fontSize: '15px' }}>{lang.name}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ 
                              background: '#F3F4F6', padding: '4px 10px', borderRadius: '6px', 
                              fontWeight: 700, fontSize: '12px', color: '#4B5563', textTransform: 'uppercase' 
                            }}>
                              {lang.code}
                            </span>
                          </td>
                          <td>
                            <button 
                              onClick={() => toggleLanguageDirection(lang.id, lang.is_rtl)}
                              className={`status-pill ${lang.is_rtl ? 'rtl' : 'ltr'}`}
                              style={{ border: 'none', cursor: 'pointer' }}
                            >
                              {lang.is_rtl ? 'RTL' : 'LTR'}
                            </button>
                          </td>
                          <td>
                            <button 
                              onClick={() => toggleLanguageStatus(lang.id, lang.is_active)}
                              className={`status-pill ${lang.is_active ? 'active' : 'inactive'}`}
                              style={{ border: 'none', cursor: 'pointer' }}
                            >
                              {lang.is_active ? 'نشط' : 'معطل'}
                            </button>
                          </td>
                          <td style={{ textAlign: 'left' }}>
                            <button 
                              onClick={() => deleteLanguage(lang.id)}
                              className="action-icon" 
                              title="حذف"
                              disabled={lang.is_default}
                              style={{ opacity: lang.is_default ? 0.3 : 1, cursor: lang.is_default ? 'not-allowed' : 'pointer' }}
                            >
                              <RiDeleteBinLine size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {activeTab === 'smtp' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '22px', color: 'var(--color-primary-dark)' }}>إعدادات البريد (SMTP)</h3>
                  <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>تكوين خادم البريد لإرسال الفواتير والإشعارات.</p>
                </div>
              </div>

              <div className="settings-glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                <div className="grid-2">
                  <div className="settings-input-group">
                    <label>خادم الـ SMTP (Host)</label>
                    <input type="text" className="settings-input" value={smtpSettings.smtp_host || ''} onChange={e => setSmtpSettings({...smtpSettings, smtp_host: e.target.value})} placeholder="smtp.gmail.com" />
                  </div>
                  <div className="settings-input-group">
                    <label>المنفذ (Port)</label>
                    <input type="text" className="settings-input" value={smtpSettings.smtp_port || ''} onChange={e => setSmtpSettings({...smtpSettings, smtp_port: e.target.value})} placeholder="587" />
                  </div>
                  <div className="settings-input-group">
                    <label>اسم المستخدم (Username)</label>
                    <input type="text" className="settings-input" value={smtpSettings.smtp_user || ''} onChange={e => setSmtpSettings({...smtpSettings, smtp_user: e.target.value})} placeholder="example@gmail.com" />
                  </div>
                  <div className="settings-input-group">
                    <label>كلمة المرور (Password)</label>
                    <input type="password" className="settings-input" value={smtpSettings.smtp_password || ''} onChange={e => setSmtpSettings({...smtpSettings, smtp_password: e.target.value})} placeholder="••••••••" />
                  </div>
                  <div className="settings-input-group">
                    <label>التشفير (Encryption)</label>
                    <select className="settings-input" value={smtpSettings.smtp_encryption || 'tls'} onChange={e => setSmtpSettings({...smtpSettings, smtp_encryption: e.target.value})}>
                      <option value="tls">TLS</option>
                      <option value="ssl">SSL</option>
                    </select>
                  </div>
                  <div className="settings-input-group">
                    <label>اسم المرسل (From Name)</label>
                    <input type="text" className="settings-input" value={smtpSettings.smtp_from_name || ''} onChange={e => setSmtpSettings({...smtpSettings, smtp_from_name: e.target.value})} placeholder="GH Shopper" />
                  </div>
                </div>
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => handleSaveSettings('smtp', smtpSettings)} className="btn btn-primary">
                    <RiCheckLine size={18} /> حفظ إعدادات الـ SMTP
                  </button>
                </div>
              </div>

              <div className="settings-glass-card" style={{ padding: '24px' }}>
                <h4 style={{ margin: '0 0 16px', color: 'var(--color-primary-dark)' }}>تجربة إرسال بريد (Test Email)</h4>
                <form onSubmit={handleTestEmail} className="flex-mobile-col" style={{ display: 'flex', gap: '16px' }}>
                  <input type="email" className="settings-input" style={{ flex: 1 }} placeholder="أدخل البريد الإلكتروني للتجربة" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
                  <button type="submit" className="btn btn-primary" style={{ background: 'var(--color-gold)' }}>
                    إرسال تجريبي
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'firebase' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '22px', color: 'var(--color-primary-dark)' }}>تنبيهات فايربيس (Firebase FCM)</h3>
                  <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>إعدادات الإشعارات التي تظهر للعملاء في التطبيق.</p>
                </div>
              </div>

              <div className="settings-glass-card" style={{ padding: '24px' }}>
                <div className="settings-input-group" style={{ marginBottom: '20px' }}>
                  <label>ملف حساب الخدمة (Service account JSON)</label>
                  <input type="file" accept=".json,application/json" onChange={e => loadKeyFile(e.target.files?.[0])} className="settings-input" style={{ padding: '10px' }} />
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.8 }}>
                    من Firebase Console ← إعدادات المشروع ← حسابات الخدمة (Service accounts) ← «إنشاء مفتاح خاص جديد»، ثم اختر الملف هنا واضغط حفظ.
                    المفتاح القديم (AAAA…) ما عاد يشتغل من 2024.
                  </p>
                  <p style={{ fontSize: '12.5px', marginTop: '6px' }}>
                    {(() => {
                      const v = (firebaseSettings.fcm_server_key || '').trim()
                      if (!v) return <span style={{ color: '#b3261e' }}>● ما في مفتاح محفوظ</span>
                      if (!v.startsWith('{')) return <span style={{ color: '#b3261e' }}>● المحفوظ مفتاح قديم (Server Key) — لازم ملف JSON</span>
                      try { const j = JSON.parse(v); return <span style={{ color: '#1f7a4d' }}>● ملف حساب خدمة للمشروع: {j.project_id}</span> } catch { return <span style={{ color: '#b3261e' }}>● النص المحفوظ غير صالح</span> }
                    })()}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => handleSaveSettings('firebase', firebaseSettings)} className="btn btn-primary">
                    <RiCheckLine size={18} /> حفظ المفتاح
                  </button>
                </div>
              </div>

              <div className="settings-glass-card" style={{ padding: '24px', marginTop: '16px' }}>
                <h4 style={{ margin: '0 0 6px' }}>فحص الإشعارات</h4>
                <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)', fontSize: '13px' }}>يرسل إشعار تجريبي ويقولك بالضبط وين المشكلة إذا ما وصل. اكتب رقم عميل (أو رقمك) أو اتركه فاضي لآخر جهاز مسجل.</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input className="settings-input" style={{ flex: '1 1 200px', direction: 'ltr', textAlign: 'right' }} placeholder="9xxxxxxx" value={pushPhone} onChange={e => setPushPhone(e.target.value)} />
                  <button className="btn btn-primary" disabled={pushBusy} onClick={runPushTest}>{pushBusy ? '...' : 'إرسال إشعار تجريبي'}</button>
                </div>
                {pushResult && (
                  <div style={{ marginTop: '16px', padding: '14px 16px', borderRadius: '10px', background: pushResult.sent ? '#E8F5EE' : '#FDECEC', color: pushResult.sent ? '#1f7a4d' : '#8c1d18', lineHeight: 1.9, fontSize: '13.5px' }}>
                    <b>{pushResult.sent ? '✓ انرسل الإشعار — تأكد إنه وصل الجهاز' : '✗ ما انرسل'}</b>
                    {pushResult.error ? <div>{pushResult.error}</div> : null}
                    <div style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>
                      {pushResult.phones_registered != null ? <>أجهزة مسجلة للإشعارات: {pushResult.phones_registered}</> : null}
                      {pushResult.target ? <> · العميل: {pushResult.target.name} ({pushResult.target.phone || '—'})</> : null}
                      {pushResult.project_id ? <> · مشروع المفتاح: {pushResult.project_id}</> : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {isEditGatewayModalOpen && editingGateway && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px', width: '100%', padding: '32px', borderRadius: '16px', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderBottom: '1px solid #F1F5F9', paddingBottom: '20px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', color: 'var(--color-primary-dark)', fontSize: '22px' }}>إعدادات: {editingGateway.name}</h2>
                <span style={{ fontSize: '13px', color: '#64748B' }}>قم بضبط خصائص البوابة ورسوم الشحن</span>
              </div>
              <button onClick={() => setIsEditGatewayModalOpen(false)} className="btn btn-ghost" style={{ background: '#F8FAFC', borderRadius: '50%', padding: '8px' }}>
                <RiCloseCircleLine size={24} color="#64748B" />
              </button>
            </div>
            <form onSubmit={handleEditGatewaySubmit}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="settings-label">رسوم إضافية (OMR)</label>
                <input 
                  type="number" 
                  step="0.001"
                  className="settings-input" 
                  style={{ width: '100%' }}
                  value={editingGateway.extra_fee || 0}
                  onChange={e => setEditingGateway({...editingGateway, extra_fee: e.target.value})}
                />
              </div>

              {editingGateway.code === 'amwalpay' && (
                <>
                  <div className="toggle-wrapper">
                    <div>
                      <div className="toggle-label">وضع البيئة (Environment)</div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                        {editingGateway.credentials?.is_live ? 'مفعل على الوضع الحقيقي (Live)' : 'مفعل على وضع التجربة (Test)'}
                      </div>
                    </div>
                    <div 
                      className={`toggle-switch ${editingGateway.credentials?.is_live ? 'active' : ''}`}
                      onClick={() => setEditingGateway({
                        ...editingGateway,
                        credentials: { ...editingGateway.credentials, is_live: !editingGateway.credentials?.is_live }
                      })}
                    >
                      <div className="toggle-slider"></div>
                    </div>
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="settings-label">Merchant ID</label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      style={{ width: '100%' }}
                      value={editingGateway.credentials?.merchant_id || ''}
                      onChange={e => setEditingGateway({
                        ...editingGateway, 
                        credentials: { ...editingGateway.credentials, merchant_id: e.target.value }
                      })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="settings-label">Terminal ID</label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      style={{ width: '100%' }}
                      value={editingGateway.credentials?.terminal_id || ''}
                      onChange={e => setEditingGateway({
                        ...editingGateway, 
                        credentials: { ...editingGateway.credentials, terminal_id: e.target.value }
                      })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '24px' }}>
                    <label className="settings-label">Secure Key</label>
                    <input 
                      type="password" 
                      className="settings-input" 
                      style={{ width: '100%' }}
                      value={editingGateway.credentials?.secret_key || ''}
                      onChange={e => setEditingGateway({
                        ...editingGateway, 
                        credentials: { ...editingGateway.credentials, secret_key: e.target.value }
                      })}
                    />
                  </div>
                </>
              )}

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="settings-label">الدول المسموحة (متعدد) - اترك فارغاً للسماح للكل</label>
                <select 
                  multiple 
                  className="settings-input" 
                  style={{ width: '100%', height: '120px' }}
                  value={editingGateway.allowed_countries || []}
                  onChange={e => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setEditingGateway({...editingGateway, allowed_countries: selected});
                  }}
                >
                  <option value="OM">سلطنة عمان (OM)</option>
                  <option value="AE">الإمارات العربية المتحدة (AE)</option>
                  <option value="SA">المملكة العربية السعودية (SA)</option>
                  <option value="QA">قطر (QA)</option>
                  <option value="BH">البحرين (BH)</option>
                  <option value="KW">الكويت (KW)</option>
                </select>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>اضغط على زر Ctrl (أو Cmd) لاختيار أكثر من دولة.</p>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #F1F5F9' }}>
                <button type="button" className="btn btn-outline" style={{ borderRadius: '12px', padding: '12px 24px' }} onClick={() => setIsEditGatewayModalOpen(false)}>إلغاء</button>
                <button type="submit" className="btn btn-primary" style={{ borderRadius: '12px', padding: '12px 24px', background: 'var(--color-primary)', border: 'none', color: 'white', fontWeight: 'bold' }}>حفظ الإعدادات</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isEditCountryModalOpen && editingCountry && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', width: '100%', padding: '32px', borderRadius: '16px', background: 'white', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderBottom: '1px solid #F1F5F9', paddingBottom: '20px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', color: 'var(--color-primary-dark)', fontSize: '22px' }}>تعديل الدولة: {editingCountry.name}</h2>
                <span style={{ fontSize: '13px', color: '#64748B' }}>قم بضبط رسوم الشحن وإضافة مناطق محددة</span>
              </div>
              <button onClick={() => setIsEditCountryModalOpen(false)} className="btn btn-ghost" style={{ background: '#F8FAFC', borderRadius: '50%', padding: '8px' }}>
                <RiCloseCircleLine size={24} color="#64748B" />
              </button>
            </div>
            <form onSubmit={handleEditCountrySubmit}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="settings-label">اسم الدولة</label>
                <input type="text" className="settings-input" style={{ width: '100%' }} value={editingCountry.name || ''} onChange={e => setEditingCountry({...editingCountry, name: e.target.value})} required />
              </div>
              <div className="form-group" className="flex-mobile-col" style={{ marginBottom: '16px', display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="settings-label">الكود (مثال: OM)</label>
                  <input type="text" className="settings-input" style={{ width: '100%' }} value={editingCountry.code || ''} onChange={e => setEditingCountry({...editingCountry, code: e.target.value})} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="settings-label">رمز العملة (مثال: OMR)</label>
                  <input type="text" className="settings-input" style={{ width: '100%' }} value={editingCountry.currency_code || ''} onChange={e => setEditingCountry({...editingCountry, currency_code: e.target.value})} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="settings-label">الرمز (مثال: ر.ع)</label>
                  <input type="text" className="settings-input" style={{ width: '100%' }} value={editingCountry.currency_symbol || ''} onChange={e => setEditingCountry({...editingCountry, currency_symbol: e.target.value})} required />
                </div>
              </div>
              <div className="form-group" className="flex-mobile-col" style={{ marginBottom: '16px', display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="settings-label">تكلفة الشحن الافتراضية</label>
                  <input type="number" step="0.001" className="settings-input" style={{ width: '100%' }} value={editingCountry.shipping_cost || 0} onChange={e => setEditingCountry({...editingCountry, shipping_cost: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="settings-label">مدة التوصيل المتوقعة</label>
                  <select className="settings-input" style={{ width: '100%' }} value={editingCountry.estimated_delivery_time || ''} onChange={e => setEditingCountry({...editingCountry, estimated_delivery_time: e.target.value})}>
                    <option value="">بدون شارة (تلقائي)</option>
                    {badges && Object.entries(badges)
                      .filter(([key]) => key !== 'discount' && key !== 'preorder')
                      .map(([key, badge]) => (
                      <option key={key} value={key}>{badge.text_ar || key}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Regions Section */}
              <div style={{ marginTop: '24px', padding: '16px', background: '#F8FAFC', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, color: 'var(--color-primary-dark)' }}>مناطق الشحن</h4>
                  <button type="button" className="btn btn-primary" style={{ background: 'var(--color-gold)', padding: '6px 12px', fontSize: '13px' }} onClick={() => {
                    const currentRegions = editingCountry.regions || [];
                    setEditingCountry({...editingCountry, regions: [...currentRegions, { name_ar: '', name_en: '', shipping_cost: 0, estimated_delivery_time: '' }]});
                  }}>
                    <RiAddLine /> إضافة منطقة
                  </button>
                </div>
                
                {(editingCountry.regions || []).map((region, index) => (
                  <div key={index} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start', background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input type="text" className="settings-input" placeholder="اسم المنطقة بالعربية (مثال: مسقط)" value={region.name_ar} onChange={(e) => {
                        const newRegions = [...editingCountry.regions];
                        newRegions[index].name_ar = e.target.value;
                        setEditingCountry({...editingCountry, regions: newRegions});
                      }} required />
                      <input type="text" className="settings-input" placeholder="اسم المنطقة بالإنجليزية (مثال: Muscat)" value={region.name_en} onChange={(e) => {
                        const newRegions = [...editingCountry.regions];
                        newRegions[index].name_en = e.target.value;
                        setEditingCountry({...editingCountry, regions: newRegions});
                      }} required />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <input type="number" step="0.001" className="settings-input" placeholder="تكلفة الشحن" value={region.shipping_cost} onChange={(e) => {
                        const newRegions = [...editingCountry.regions];
                        newRegions[index].shipping_cost = e.target.value;
                        setEditingCountry({...editingCountry, regions: newRegions});
                      }} required />
                      <select className="settings-input" value={region.estimated_delivery_time || ''} onChange={(e) => {
                        const newRegions = [...editingCountry.regions];
                        newRegions[index].estimated_delivery_time = e.target.value;
                        setEditingCountry({...editingCountry, regions: newRegions});
                      }}>
                        <option value="">بدون شارة (تلقائي)</option>
                        {badges && Object.entries(badges)
                          .filter(([key]) => key !== 'discount' && key !== 'preorder')
                          .map(([key, badge]) => (
                          <option key={key} value={key}>{badge.text_ar || key}</option>
                        ))}
                      </select>
                    </div>
                    <button type="button" className="action-icon" style={{ color: 'var(--color-danger)', marginTop: '8px' }} onClick={() => {
                      const newRegions = editingCountry.regions.filter((_, i) => i !== index);
                      setEditingCountry({...editingCountry, regions: newRegions});
                    }}>
                      <RiDeleteBinLine size={20} />
                    </button>
                  </div>
                ))}
                {(!editingCountry.regions || editingCountry.regions.length === 0) && (
                  <p style={{ margin: 0, color: '#64748B', fontSize: '13px', textAlign: 'center', padding: '16px' }}>لا توجد مناطق. سيتم استخدام رسوم الشحن الافتراضية للدولة.</p>
                )}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #F1F5F9' }}>
                <button type="button" className="btn btn-outline" style={{ borderRadius: '12px', padding: '12px 24px' }} onClick={() => setIsEditCountryModalOpen(false)}>إلغاء</button>
                <button type="submit" className="btn btn-primary" style={{ borderRadius: '12px', padding: '12px 24px', background: 'var(--color-primary)', border: 'none', color: 'white', fontWeight: 'bold' }}>حفظ التعديلات</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
