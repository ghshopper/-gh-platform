import { useState, useRef, useEffect, useCallback } from 'react'
import {
  RiSmartphoneLine,
  RiImageLine,
  RiPaletteLine,
  RiUploadCloud2Line,
  RiCheckLine,
  RiLoader4Line,
  RiDeleteBin2Line,
  RiPlayCircleLine,
  RiColorFilterLine,
  RiSave3Line,
  RiEyeLine,
  RiHome4Line,
  RiAddCircleLine,
  RiEditLine,
  RiDragMove2Line,
  RiLinkM,
  RiArrowUpLine,
  RiArrowDownLine,
  RiCloseLine,
  RiImageAddLine,
  RiMenuLine,
  RiVipDiamondLine,
  RiPriceTag3Line,
  RiUserLine,
  RiSearch2Line,
  RiShoppingBag3Line,
  RiNotificationBadgeLine,
  RiMoneyDollarCircleLine,
  RiCoupon2Line,
  RiShoppingCart2Line,
  RiLayoutBottomLine,
  RiFileList3Line,
} from 'react-icons/ri'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL

const TABS = [
  { id: 'splash',   label: 'شاشة البداية والشعار', icon: RiSmartphoneLine },
  { id: 'homescreen', label: 'الشاشة الرئيسية', icon: RiHome4Line },
  { id: 'colors',   label: 'ألوان التطبيق', icon: RiPaletteLine },
  { id: 'bottomnav', label: 'القائمة السفلية', icon: RiMenuLine },
  { id: 'brandsscreen', label: 'شاشة البراندات', icon: RiVipDiamondLine },
  { id: 'profile', label: 'إعدادات الحساب', icon: RiUserLine },
  { id: 'product_requests', label: 'شاشة طلب منتج', icon: RiSearch2Line },
  { id: 'cart', label: 'تخصيص السلة', icon: RiShoppingBag3Line },
  { id: 'footer', label: 'الفوتر المخصص', icon: RiLayoutBottomLine },
  { id: 'policies', label: 'السياسات والشروط', icon: RiFileList3Line },
]

const DEFAULT_COLORS = {
  primary:    '#4A0E1B',
  secondary:  '#B5915F',
  background: '#FAF8F5',
  accent:     '#D4AF37',
}

const COLOR_LABELS = {
  primary:    'اللون الرئيسي',
  secondary:  'اللون الثانوي (الذهبي)',
  background: 'لون الخلفية',
  accent:     'لون التمييز',
}

const DEFAULT_BADGES = {
  crown: {
    bg_color_1: '#4A0E1B',
    bg_color_2: '#28040C',
    text_color: '#FFF7EB',
    border_color: '#E8CA9B',
    text_ar: 'توصيل خلال ساعتين',
    text_en: 'Delivery in 2h',
  },
  truck: {
    bg_color_1: '#DDB894',
    bg_color_2: '#C29A72',
    text_color: '#380712',
    border_color: '#ffffff',
    text_ar: 'توصيل خلال 3 أيام',
    text_en: 'Delivery in 3 Days',
  },
  plane: {
    bg_color_1: '#FFFFFF',
    bg_color_2: '#F0E9DF',
    text_color: '#4A0E1B',
    border_color: '#D6B08C',
    text_ar: 'توصيل خلال 5-7 أيام',
    text_en: 'Delivery in 5-7 Days',
  },
  preorder: {
    bg_color_1: '#1C1C1C',
    bg_color_2: '#0B0B0B',
    text_color: '#FFDF9E',
    border_color: '#E8CA9B',
    text_ar: 'طلب مسبق',
    text_en: 'Pre-order',
  },
  discount: {
    bg_color_1: '#E8F5E9',
    bg_color_2: '#C8E6C9',
    text_color: '#2E7D32',
    border_color: '#2E7D32',
    text_ar: 'خصم',
    text_en: 'Discount',
  }
}

const DEFAULT_PROFILE_SETTINGS = {
  guest_card_title_ar: 'عضوية GH SHOPPER',
  guest_card_title_en: 'GH SHOPPER Membership',
  guest_card_subtitle_ar: 'سجل الدخول الآن لتستمتع بمزايا العضوية الفاخرة، جمع النقاط، وتتبع طلباتك بكل سهولة.',
  guest_card_subtitle_en: 'Log in now to enjoy luxury membership benefits, earn points, and track orders easily.',
  guest_login_btn_ar: 'تسجيل الدخول',
  guest_login_btn_en: 'Login',
  guest_register_btn_ar: 'إنشاء حساب',
  guest_register_btn_en: 'Register',
  guest_card_bg_top: '#4B1828',
  guest_card_bg_bottom: '#2A0812',
  guest_card_text_color: '#FFFFFF',
  
  section_account_title_ar: 'إعدادات الحساب',
  section_account_title_en: 'Account Settings',
  my_orders_title_ar: 'طلباتي',
  my_orders_title_en: 'My Orders',
  my_orders_subtitle_ar: 'الطلبات المحفوظة في هذا الجهاز',
  my_orders_subtitle_en: 'Orders saved on this device',
  request_product_title_ar: 'طلب منتج غير متوفر',
  request_product_title_en: 'Request Unavailable Product',
  request_product_subtitle_ar: 'أخبرنا بالمنتج الذي تريده وسنجده لك',
  request_product_subtitle_en: 'Tell us what you need and we will find it',
  track_order_title_ar: 'تتبع طلب يدوي',
  track_order_title_en: 'Manual Order Tracking',
  track_order_subtitle_ar: 'أدخل رقم الطلب لتتبعه',
  track_order_subtitle_en: 'Enter order number to track',
  
  section_general_title_ar: 'عام',
  section_general_title_en: 'General',
  language_title_ar: 'اللغة',
  language_title_en: 'Language',
  language_subtitle_ar: 'اختر لغتك المفضلة',
  language_subtitle_en: 'Choose your preferred language',
  currency_title_ar: 'العملة',
  currency_title_en: 'Currency',
  currency_subtitle_ar: 'اختر العملة المفضلة للتسوق',
  currency_subtitle_en: 'Choose preferred shopping currency',
  notifications_title_ar: 'الإشعارات',
  notifications_title_en: 'Notifications',
  notifications_subtitle_ar: 'تنبيهات مخصصة',
  notifications_subtitle_en: 'Custom alerts',
  help_center_title_ar: 'مركز المساعدة',
  help_center_title_en: 'Help Center',
  help_center_subtitle_ar: 'الدعم والإجابات',
  help_center_subtitle_en: 'Support & Answers',
  privacy_policy_title_ar: 'سياسة الخصوصية',
  privacy_policy_title_en: 'Privacy Policy',
  privacy_policy_subtitle_ar: 'شروطنا وبنودنا',
  privacy_policy_subtitle_en: 'Terms & Conditions',
  logout_btn_en: 'Logout',
}

const DEFAULT_LOGIN_BANNER = {
  bg_color: '#4A0E1B',
  title_ar: 'مرحباً بعودتك',
  title_en: 'Welcome Back',
  subtitle_ar: 'سجل دخولك لمتابعة التسوق',
  subtitle_en: 'Login to continue shopping',
  button_color: '#B5915F',
}

const DEFAULT_REGISTER_BANNER = {
  bg_color: '#4A0E1B',
  title_ar: 'انضم إلينا',
  title_en: 'Join Us',
  subtitle_ar: 'أنشئ حساباً جديداً لتجربة تسوق مميزة',
  subtitle_en: 'Create a new account for a premium experience',
  button_color: '#B5915F',
}

// ─── Reusable Card Component ───
function Card({ title, icon: Icon, children, style }) {
  return (
    <div style={{ background: '#fff', borderRadius: 20, padding: 28, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', ...style }}>
      {title && (
        <h3 style={{ margin: '0 0 20px', fontWeight: 800, fontSize: 16, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon style={{ color: '#B5915F' }} />}
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

// ─── Accordion Section Component ───
function AccordionSection({ title, icon: Icon, isOpen, onToggle, children, style }) {
  return (
    <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden', ...style }}>
      <div 
        onClick={onToggle}
        style={{ padding: '24px 28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isOpen ? '#fefefe' : '#fff', borderBottom: isOpen ? '1px solid #f1f5f9' : 'none' }}
      >
        <h3 style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon style={{ color: '#B5915F' }} />}
          {title}
        </h3>
        <div>
          {isOpen ? <RiArrowUpLine size={20} color="#94a3b8" /> : <RiArrowDownLine size={20} color="#94a3b8" />}
        </div>
      </div>
      {isOpen && (
        <div style={{ padding: 28 }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Primary Button ───
function PrimaryButton({ onClick, disabled, loading, children, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '12px 24px', borderRadius: 12,
        background: 'linear-gradient(135deg, #4B1828, #2A0812)',
        color: '#fff', border: 'none', cursor: disabled ? 'default' : 'pointer',
        fontWeight: 700, fontSize: 14, fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        opacity: disabled ? 0.7 : 1, transition: 'all 0.2s', ...style,
      }}
    >
      {loading ? <RiLoader4Line size={16} style={{ animation: 'spin 1s linear infinite' }} /> : children}
    </button>
  )
}

export default function CustomizeApp() {
  const [activeTab, setActiveTab] = useState('splash')
  const [settings, setSettings] = useState(null)
  const [colors, setColors] = useState(DEFAULT_COLORS)
  const [badges, setBadges] = useState(DEFAULT_BADGES)
  const [profileSettings, setProfileSettings] = useState(DEFAULT_PROFILE_SETTINGS)
  const [productRequestSettings, setProductRequestSettings] = useState({
    title_ar: 'اطلب منتجك',
    title_en: 'Request a Product',
    subtitle_ar: 'لم تجد ما تبحث عنه؟ اطلبه الآن!',
    subtitle_en: 'Did not find what you are looking for? Request it now!',
    enable_phone: true,
    enable_email: false,
    enable_product_link: true,
    enable_product_image: true,
    dynamic_inputs: []
  })
  const [cartSettings, setCartSettings] = useState({
    empty_title_ar: 'السلة فارغة',
    empty_title_en: 'Cart is empty',
    empty_subtitle_ar: 'تصفح المنتجات وأضف ما يعجبك',
    empty_subtitle_en: 'Browse products and add what you like',
  })
  const [loginBanner, setLoginBanner] = useState(DEFAULT_LOGIN_BANNER)
  const [registerBanner, setRegisterBanner] = useState(DEFAULT_REGISTER_BANNER)
  
  // Footer & Policies
  const [footerSettings, setFooterSettings] = useState({})
  const [policies, setPolicies] = useState([])
  
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [duration, setDuration] = useState(3)
  const [mediaType, setMediaType] = useState('image')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [logoUrl, setLogoUrl] = useState(null)
  const fileInputRef = useRef(null)
  const logoInputRef = useRef(null)

  // Hero Slides
  const [heroSlides, setHeroSlides] = useState([])
  const [heroLoading, setHeroLoading] = useState(true)
  const [editingSlide, setEditingSlide] = useState(null)
  const [showSlideModal, setShowSlideModal] = useState(false)
  const [slideForm, setSlideForm] = useState({})
  const [slideImage, setSlideImage] = useState(null)
  const [slideSaving, setSlideSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const slideImageRef = useRef(null)

  // Home Sections
  const [homeSections, setHomeSections] = useState({})
  const [sectionsLoading, setSectionsLoading] = useState(true)
  const [openSection, setOpenSection] = useState('hero')

  const headers = {
    Authorization: 'Bearer ' + localStorage.getItem('token'),
    Accept: 'application/json',
  }

  // ─── Fetch Data ───
  const fetchSettings = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/admin/app-customize/splash`, { headers })
      const json = await res.json()
      if (json.success) {
        const data = json.data
        setSettings(data)
        setDuration(data.duration_seconds || 3)
        setMediaType(data.media_type || 'image')
        setPreviewUrl(data.full_media_url || null)
        setLogoUrl(data.full_logo_url || null)
        if (data.app_colors) {
          setColors({ 
            ...DEFAULT_COLORS, 
            ...data.app_colors,
            logo_width: data.app_colors.logo_width || 120,
            logo_height: data.app_colors.logo_height || 40,
          })
        }
        if (data.badge_settings) {
          setBadges({
            ...DEFAULT_BADGES,
            ...data.badge_settings,
          })
        }
        if (data.profile_settings) {
          setProfileSettings({
            ...DEFAULT_PROFILE_SETTINGS,
            ...data.profile_settings,
          })
        }
        if (data.product_request_settings) {
          setProductRequestSettings(data.product_request_settings)
        }
        if (data.cart_settings) {
          setCartSettings(data.cart_settings)
        }
        if (data.login_banner_settings) {
          setLoginBanner({
            ...DEFAULT_LOGIN_BANNER,
            ...data.login_banner_settings,
          })
        }
        if (data.register_banner_settings) {
          setRegisterBanner({
            ...DEFAULT_REGISTER_BANNER,
            ...data.register_banner_settings,
          })
        }
      }
    } catch (err) {
      toast.error('فشل تحميل الإعدادات')
    } finally {
      setLoading(false)
    }
  }

  const fetchHeroSlides = useCallback(async () => {
    setHeroLoading(true)
    try {
      const res = await fetch(`${API}/admin/home-customize/hero-slides`, { headers })
      const json = await res.json()
      if (json.success) setHeroSlides(json.data || [])
    } catch { toast.error('فشل تحميل شرائح الهيرو') }
    finally { setHeroLoading(false) }
  }, [])

  const fetchDropdowns = useCallback(async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch(`${API}/admin/categories`, { headers }),
        fetch(`${API}/admin/products`, { headers }),
      ])
      const catJson = await catRes.json()
      const prodJson = await prodRes.json()
      setCategories(catJson.data || catJson || [])
      setProducts(prodJson.data || prodJson || [])
    } catch {}
  }, [])

  const fetchHomeSections = useCallback(async () => {
    setSectionsLoading(true)
    try {
      const res = await fetch(`${API}/admin/home-customize/sections`, { headers })
      const json = await res.json()
      if (json.success) {
        setHomeSections(json.data || {})
        if (json.data && json.data.cart_screen && json.data.cart_screen.card_settings) {
          setCartSettings(prev => ({ ...prev, ...json.data.cart_screen.card_settings }))
        }
      }
    } catch { toast.error('فشل تحميل إعدادات الأقسام') }
    finally { setSectionsLoading(false) }
  }, [])

  const fetchFooterAndPolicies = useCallback(async () => {
    try {
      const [footerRes, policiesRes] = await Promise.all([
        fetch(`${API}/admin/app-customize/footer`, { headers }),
        fetch(`${API}/admin/app-customize/policies`, { headers })
      ])
      const footerJson = await footerRes.json()
      const policiesJson = await policiesRes.json()
      setFooterSettings(footerJson || {})
      setPolicies(policiesJson || [])
    } catch { toast.error('فشل تحميل الفوتر والسياسات') }
  }, [])

  useEffect(() => { fetchSettings(); fetchHeroSlides(); fetchDropdowns(); fetchHomeSections(); fetchFooterAndPolicies(); }, [])

  // ─── Splash Handlers ───
  const handleFileUpload = async (file) => {
    if (!file) return
    const mime = file.type
    let type = 'image'
    if (mime.startsWith('video/')) type = 'video'
    else if (mime === 'image/gif') type = 'gif'
    setMediaType(type)
    setPreviewUrl(URL.createObjectURL(file))
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('media', file)
      formData.append('media_type', type)
      const res = await fetch(`${API}/admin/app-customize/splash/upload`, {
        method: 'POST',
        headers: { 
          Authorization: 'Bearer ' + localStorage.getItem('token'),
          Accept: 'application/json'
        },
        body: formData,
      })
      const json = await res.json()
      if (json.success) {
        toast.success('تم رفع الوسائط بنجاح! ✅')
        setPreviewUrl(json.full_media_url)
        fetchSettings()
      } else toast.error(json.message || 'فشل الرفع')
    } catch { toast.error('فشل رفع الملف') }
    finally { setUploading(false) }
  }

  const handleLogoUpload = async (file) => {
    if (!file) return
    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      const res = await fetch(`${API}/admin/app-customize/logo/upload`, {
        method: 'POST',
        headers: { 
          Authorization: 'Bearer ' + localStorage.getItem('token'),
          Accept: 'application/json'
        },
        body: formData,
      })
      const json = await res.json()
      if (json.success) {
        toast.success('تم رفع الشعار بنجاح! ✅')
        setLogoUrl(json.full_logo_url)
      } else toast.error(json.message || 'فشل رفع الشعار')
    } catch { toast.error('فشل رفع الشعار') }
    finally { setUploadingLogo(false) }
  }

  const handleIconUpload = async (file, index, iconField) => {
    if (!file) return;
    
    // We will upload it to the splash upload endpoint temporarily or a specific icon endpoint
    // For now, let's use the splash upload endpoint since it handles media
    const loadingToast = toast.loading('جاري الرفع...');
    try {
      const formData = new FormData();
      // Using splash endpoint as a general media upload for now, or if there's a specific one, use it.
      formData.append('media', file);
      formData.append('media_type', 'image');
      
      const res = await fetch(`${API}/admin/app-customize/splash/upload`, {
        method: 'POST',
        headers: { 
          Authorization: 'Bearer ' + localStorage.getItem('token'),
          Accept: 'application/json'
        },
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم رفع الأيقونة بنجاح! ✅', { id: loadingToast });
        const items = [...(homeSections.bottom_nav?.card_settings?.items || [])]
        items[index] = { ...items[index], [iconField]: json.full_media_url }
        setHomeSections(prev => ({ ...prev, bottom_nav: { ...prev.bottom_nav, card_settings: { ...(prev.bottom_nav?.card_settings || {}), items } } }))
      } else {
        toast.error(json.message || 'فشل الرفع', { id: loadingToast });
      }
    } catch (err) {
      toast.error('حدث خطأ أثناء الرفع', { id: loadingToast });
    }
  }

  const handleDeleteLogo = async () => {
    if (!window.confirm('هل أنت متأكد من حذف الشعار؟ سيعود التطبيق لاسم النص الافتراضي.')) return
    try {
      const res = await fetch(`${API}/admin/app-customize/logo`, {
        method: 'DELETE',
        headers,
      })
      const json = await res.json()
      if (json.success) {
        toast.success('تم حذف الشعار بنجاح! ✅')
        setLogoUrl(null)
      } else toast.error(json.message || 'فشل حذف الشعار')
    } catch { toast.error('فشل الحذف') }
  }

  const saveLogoSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/admin/app-customize/colors`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ colors }),
      })
      const json = await res.json()
      if (json.success) toast.success('تم حفظ إعدادات الشعار بنجاح! ✅')
      else toast.error('فشل الحفظ')
    } catch { toast.error('فشل الحفظ') }
    finally { setSaving(false) }
  }

  const saveSplashSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/admin/app-customize/splash`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration_seconds: duration }),
      })
      const json = await res.json()
      if (json.success) toast.success('تم حفظ الإعدادات بنجاح! ✅')
      else toast.error(json.message || 'فشل الحفظ')
    } catch { toast.error('فشل الحفظ') }
    finally { setSaving(false) }
  }

  const saveColors = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/admin/app-customize/colors`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ colors }),
      })
      const json = await res.json()
      if (json.success) toast.success('تم حفظ الألوان بنجاح! ✅')
      else toast.error('فشل حفظ الألوان')
    } catch { toast.error('فشل الحفظ') }
    finally { setSaving(false) }
  }

  const updateBadge = (type, field, value) => {
    setBadges(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value }
    }))
  }

  const saveBadges = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/admin/app-customize/badges`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ badges }),
      })
      const json = await res.json()
      if (json.success) toast.success('تم حفظ الشارات بنجاح! ✅')
      else toast.error('فشل حفظ الشارات')
    } catch { toast.error('فشل الحفظ') }
    finally { setSaving(false) }
  }

  const saveProfileSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/admin/app-customize/profile`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          profile_settings: profileSettings,
          login_banner_settings: loginBanner,
          register_banner_settings: registerBanner
        }),
      })
      const json = await res.json()
      if (json.success) toast.success('تم حفظ إعدادات الحساب بنجاح! ✅')
      else toast.error('فشل حفظ الإعدادات')
    } catch { toast.error('فشل الحفظ') }
    finally { setSaving(false) }
  }

  const saveProductRequestSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/admin/app-customize/product-requests`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          product_request_settings: productRequestSettings
        }),
      })
      const json = await res.json()
      if (json.success) toast.success('تم حفظ إعدادات شاشة طلب منتج بنجاح! ✅')
      else toast.error('فشل الحفظ')
    } catch { toast.error('فشل الحفظ') }
    finally { setSaving(false) }
  }

  const saveHomeSection = async (key) => {
    try {
      const sectionData = homeSections[key]
      const res = await fetch(`${API}/admin/home-customize/sections/${key}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(sectionData),
      })
      const json = await res.json()
      if (json.success) toast.success('تم حفظ إعدادات القسم بنجاح! ✅')
      else toast.error(json.message || 'فشل حفظ القسم')
    } catch { toast.error('فشل الحفظ') }
  }

  const handleSaveFooter = async () => {
    setSaving(true)
    try {
      const formData = new FormData()
      Object.entries(footerSettings).forEach(([key, val]) => {
        if (val !== null && val !== undefined && key !== 'logo' && key !== 'logo_path') {
          if (key === 'social_links') {
            formData.append(key, JSON.stringify(val))
          } else {
            formData.append(key, val)
          }
        }
      })
      if (footerSettings.logo) {
        formData.append('logo', footerSettings.logo)
      } else if (footerSettings.logo === null) {
        formData.append('logo', '') // Indicate deletion if supported by backend, backend checks for null, but FormData converts to string. Let's handle deletion by passing empty string or just not passing it if no logo change. Wait, backend checks `if ($request->logo === null)`. FormData can't send null. Let's send a special field if deleted.
        // Actually I will just send logo_deleted if I want to delete it. But for now let's just append the File.
      }
      
      const res = await fetch(`${API}/admin/app-customize/footer`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token'), Accept: 'application/json' },
        body: formData,
      })
      const json = await res.json()
      if (res.ok) {
        toast.success('تم حفظ إعدادات الفوتر بنجاح! ✅')
        fetchFooterAndPolicies()
      } else toast.error(json.message || 'فشل حفظ الفوتر')
    } catch { toast.error('فشل الحفظ') }
    finally { setSaving(false) }
  }

  const handleSavePolicy = async (policy) => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/admin/app-customize/policies`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      })
      const json = await res.json()
      if (res.ok) {
        toast.success(`تم حفظ سياسة ${policy.type} بنجاح! ✅`)
        fetchFooterAndPolicies()
      } else toast.error(json.message || 'فشل حفظ السياسة')
    } catch { toast.error('فشل الحفظ') }
    finally { setSaving(false) }
  }

  // ─── Hero Slide Handlers ───
  const openSlideModal = (slide = null) => {
    if (slide) {
      setEditingSlide(slide)
      setSlideForm({
        slide_type: slide.slide_type || 'custom',
        title_ar: slide.title_ar || '',
        title_en: slide.title_en || '',
        subtitle_ar: slide.subtitle_ar || '',
        subtitle_en: slide.subtitle_en || '',
        button_text_ar: slide.button_text_ar || '',
        button_text_en: slide.button_text_en || '',
        bg_color: slide.bg_color || '#3A1A1A',
        link_type: slide.link_type || 'none',
        link_value: slide.link_value || '',
        is_active: slide.is_active ?? true,
      })
    } else {
      setEditingSlide(null)
      setSlideForm({
        slide_type: 'custom',
        title_ar: '', title_en: '',
        subtitle_ar: '', subtitle_en: '',
        button_text_ar: 'تسوق الآن', button_text_en: 'Shop Now',
        bg_color: '#3A1A1A',
        link_type: 'none', link_value: '',
        is_active: true,
      })
    }
    setSlideImage(null)
    setShowSlideModal(true)
  }

  const saveSlide = async () => {
    setSlideSaving(true)
    try {
      const formData = new FormData()
      Object.entries(slideForm).forEach(([key, val]) => {
        if (val !== null && val !== undefined) {
          if (key === 'is_active') {
            formData.append(key, val ? '1' : '0')
          } else {
            formData.append(key, val)
          }
        }
      })
      if (slideImage) formData.append('image', slideImage)

      const url = editingSlide
        ? `${API}/admin/home-customize/hero-slides/${editingSlide.id}`
        : `${API}/admin/home-customize/hero-slides`

      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          Authorization: 'Bearer ' + localStorage.getItem('token'),
          Accept: 'application/json'
        },
        body: formData,
      })
      const json = await res.json()
      if (json.success) {
        toast.success(editingSlide ? 'تم تعديل الشريحة بنجاح! ✅' : 'تم إضافة الشريحة بنجاح! ✅')
        setShowSlideModal(false)
        fetchHeroSlides()
      } else {
        toast.error(json.message || 'فشل الحفظ')
      }
    } catch { toast.error('فشل حفظ الشريحة') }
    finally { setSlideSaving(false) }
  }

  const deleteSlide = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذه الشريحة؟')) return
    try {
      const res = await fetch(`${API}/admin/home-customize/hero-slides/${id}`, {
        method: 'DELETE', headers,
      })
      const json = await res.json()
      if (json.success) {
        toast.success('تم حذف الشريحة بنجاح')
        fetchHeroSlides()
      }
    } catch { toast.error('فشل الحذف') }
  }

  const moveSlide = async (index, direction) => {
    const newSlides = [...heroSlides]
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= newSlides.length) return
    ;[newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]]
    setHeroSlides(newSlides)
    try {
      await fetch(`${API}/admin/home-customize/hero-slides/reorder`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newSlides.map(s => s.id) }),
      })
    } catch {}
  }

  const addDynamicInput = () => {
    setProductRequestSettings(prev => ({
      ...prev,
      dynamic_inputs: [
        ...(prev?.dynamic_inputs || []),
        {
          id: Date.now().toString(),
          label_ar: '',
          label_en: '',
          type: 'text',
          is_required: false
        }
      ]
    }))
  }

  const updateDynamicInput = (index, field, value) => {
    const newInputs = [...(productRequestSettings?.dynamic_inputs || [])]
    newInputs[index][field] = value
    setProductRequestSettings(prev => ({ ...prev, dynamic_inputs: newInputs }))
  }

  const removeDynamicInput = (index) => {
    const newInputs = [...(productRequestSettings?.dynamic_inputs || [])]
    newInputs.splice(index, 1)
    setProductRequestSettings(prev => ({ ...prev, dynamic_inputs: newInputs }))
  }

  // ─── Render ───
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300, color: '#94a3b8' }}>
        <RiLoader4Line size={40} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ direction: 'rtl' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1e293b', margin: 0 }}>
          تخصيص التطبيق
        </h1>
        <p style={{ color: '#64748b', margin: '8px 0 0', fontSize: 14 }}>
          تحكم كامل في مظهر ومحتوى تطبيق GH Shopper
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 14, padding: 4, width: 'fit-content', marginBottom: 32, flexWrap: 'wrap' }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: isActive ? 700 : 600,
                fontFamily: 'inherit',
                background: isActive ? '#fff' : 'transparent',
                color: isActive ? '#4B1828' : '#64748b',
                boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── TAB: SPLASH + LOGO ── */}
      {activeTab === 'splash' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 28, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Logo Upload */}
            <Card title="شعار التطبيق (Logo)" icon={RiImageLine}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                {logoUrl ? (
                  <div style={{
                    width: '100%', maxWidth: 300, minHeight: 120, borderRadius: 16, overflow: 'hidden',
                      border: '2px solid #e2e8f0', background: '#fafafa',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
                    }}>
                      <img src={logoUrl} alt="Logo" style={{ width: colors.logo_width || 120, height: colors.logo_height || 40, objectFit: 'contain' }} />
                  </div>
                ) : (
                  <div style={{
                    width: 100, height: 100, borderRadius: 16,
                    border: '2px dashed #e2e8f0', background: '#fafafa',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8',
                  }}>
                    <RiImageLine size={32} />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 6 }}>
                    {logoUrl ? 'الشعار الحالي' : 'لم يتم رفع شعار بعد'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      style={{
                        padding: '8px 20px', borderRadius: 10, border: '1.5px solid #B5915F',
                        background: 'transparent', color: '#B5915F', cursor: 'pointer',
                        fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      {uploadingLogo ? <RiLoader4Line className="spin" size={16} /> : <RiImageAddLine size={16} />}
                      {uploadingLogo ? 'جاري الرفع...' : 'رفع شعار جديد'}
                    </button>
                    {logoUrl && (
                      <button
                        onClick={handleDeleteLogo}
                        style={{
                          padding: '8px 20px', borderRadius: 10, border: '1.5px solid #ef4444',
                          background: '#fef2f2', color: '#ef4444', cursor: 'pointer',
                          fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <RiDeleteBin2Line size={16} /> حذف
                      </button>
                    )}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 12, marginTop: 12 }}>
                    يدعم: PNG, WebP, GIF, SVG — الحجم الأقصى: 5MB
                  </div>
                  
                  {/* Logo Size Controls */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 12, color: '#475569', marginBottom: 6 }}>عرض الشعار (العرض الأقصى)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="range" min="40" max="300" value={colors.logo_width || 120} onChange={e => setColors(prev => ({ ...prev, logo_width: parseInt(e.target.value) }))} style={{ flex: 1, accentColor: '#B5915F' }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', width: 40 }}>{colors.logo_width || 120}px</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: 12, color: '#475569', marginBottom: 6 }}>ارتفاع الشعار (الارتفاع الأقصى)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="range" min="20" max="150" value={colors.logo_height || 40} onChange={e => setColors(prev => ({ ...prev, logo_height: parseInt(e.target.value) }))} style={{ flex: 1, accentColor: '#B5915F' }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', width: 40 }}>{colors.logo_height || 40}px</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <PrimaryButton onClick={saveLogoSettings} disabled={saving} loading={saving} style={{ width: 'max-content' }}>
                      <RiSave3Line size={16} /> حفظ إعدادات الشعار
                    </PrimaryButton>
                  </div>

                </div>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*,.svg,.webp"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) handleLogoUpload(e.target.files[0]) }}
              />
            </Card>

            {/* Splash Upload */}
            <Card title="رفع وسائط شاشة البداية" icon={RiUploadCloud2Line}>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #e2e8f0', borderRadius: 16, padding: 40,
                  textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
                  background: uploading ? '#f8fafc' : '#fafafa',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#B5915F'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#B5915F' }}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
              >
                {uploading ? (
                  <div>
                    <RiLoader4Line size={40} color="#B5915F" style={{ animation: 'spin 1s linear infinite' }} />
                    <div style={{ marginTop: 12, color: '#64748b', fontWeight: 600 }}>جاري الرفع...</div>
                  </div>
                ) : (
                  <div>
                    <RiUploadCloud2Line size={48} color="#B5915F" />
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', marginTop: 12 }}>اسحب الملف هنا أو انقر للاختيار</div>
                    <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>يدعم: JPG, PNG, WebP, SVG, GIF, MP4, MOV</div>
                    <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>الحجم الأقصى: 50MB</div>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*,video/*,.gif,.svg,.webp" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) handleFileUpload(e.target.files[0]) }} />
            </Card>

            {/* Duration */}
            <Card title="⏱️ مدة عرض شاشة البداية">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <input type="range" min="1" max="10" value={duration} onChange={e => setDuration(parseInt(e.target.value))}
                  style={{ flex: 1, accentColor: '#B5915F' }} />
                <span style={{ fontWeight: 900, fontSize: 24, color: '#4B1828', minWidth: 60, textAlign: 'center' }}>{duration}ث</span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>مدة عرض الشاشة للمستخدم قبل الدخول للتطبيق (من 1 إلى 10 ثواني)</div>
              <PrimaryButton onClick={saveSplashSettings} disabled={saving} loading={saving} style={{ marginTop: 20, width: '100%' }}>
                <RiSave3Line size={16} /> حفظ الإعدادات
              </PrimaryButton>
            </Card>
          </div>

          {/* Phone Preview */}
          <div style={{ position: 'sticky', top: 20 }}>
            <Card title="معاينة الشاشة" icon={RiEyeLine} style={{ textAlign: 'center' }}>
              <div style={{
                width: 220, height: 440, margin: '0 auto',
                border: '8px solid #1e293b', borderRadius: 36,
                overflow: 'hidden', position: 'relative',
                background: colors.background || '#FAF8F5',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2), 0 0 0 2px #374151',
              }}>
                <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 60, height: 8, background: '#1e293b', borderRadius: 10, zIndex: 10 }} />
                {previewUrl ? (
                  mediaType === 'video' ? (
                    <video src={previewUrl} autoPlay muted loop style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={previewUrl} alt="splash preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: colors.primary || '#4B1828' }}>
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 48, fontWeight: 900, color: colors.secondary || '#B5915F', lineHeight: 1 }}>GH</div>
                    <div style={{ color: colors.secondary || '#B5915F', fontSize: 14, letterSpacing: 4, marginTop: 8 }}>SHOPPER</div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 16, fontSize: 12, color: '#94a3b8' }}>معاينة تقريبية لشاشة البداية</div>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB: HOME SCREEN ── */}
      {activeTab === 'homescreen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Hero Slides Section */}
          <AccordionSection 
            title="شرائح الهيرو (Hero Slider)" 
            icon={RiImageLine}
            isOpen={openSection === 'hero'}
            onToggle={() => setOpenSection(openSection === 'hero' ? '' : 'hero')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ color: '#64748b', fontSize: 13 }}>
                {heroSlides.length} شريحة — اسحب لتغيير الترتيب
              </div>
              <button
                onClick={() => openSlideModal()}
                style={{
                  padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #B5915F, #8B6914)',
                  color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <RiAddCircleLine size={16} /> إضافة شريحة جديدة
              </button>
            </div>

            {heroLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                <RiLoader4Line size={32} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : heroSlides.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>
                لا توجد شرائح — اضغط "إضافة شريحة جديدة" للبدء
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {heroSlides.map((slide, index) => (
                  <div key={slide.id} style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: 16,
                    background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0',
                    transition: 'all 0.2s',
                  }}>
                    {/* Image Preview */}
                    <div style={{
                      width: 120, height: 60, borderRadius: 12, overflow: 'hidden',
                      background: slide.bg_color || '#3A1A1A', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {slide.full_image_url ? (
                        <img src={slide.full_image_url} alt="" style={{
                          width: '100%', height: '100%',
                          objectFit: slide.slide_type === 'cover' ? 'cover' : 'contain',
                        }} />
                      ) : (
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textAlign: 'center' }}>
                          {slide.slide_type === 'cover' ? 'بانر كامل' : 'مخصص'}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>
                        {slide.title_ar || (slide.slide_type === 'cover' ? 'بانر كامل (Cover)' : 'شريحة مخصصة')}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          background: slide.slide_type === 'cover' ? '#dbeafe' : '#fef3c7',
                          color: slide.slide_type === 'cover' ? '#1e40af' : '#92400e',
                        }}>
                          {slide.slide_type === 'cover' ? 'بانر كامل' : 'مخصص'}
                        </span>
                        {slide.link_type !== 'none' && (
                          <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#dcfce7', color: '#166534' }}>
                            <RiLinkM size={10} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
                            {slide.link_type === 'category' ? 'فئة' : slide.link_type === 'product' ? 'منتج' : 'رابط'}
                          </span>
                        )}
                        {!slide.is_active && (
                          <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#fee2e2', color: '#991b1b' }}>
                            معطّل
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => moveSlide(index, -1)} disabled={index === 0}
                        style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: index === 0 ? 0.3 : 1 }}>
                        <RiArrowUpLine size={14} color="#64748b" />
                      </button>
                      <button onClick={() => moveSlide(index, 1)} disabled={index === heroSlides.length - 1}
                        style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: index === heroSlides.length - 1 ? 0.3 : 1 }}>
                        <RiArrowDownLine size={14} color="#64748b" />
                      </button>
                      <button onClick={() => openSlideModal(slide)}
                        style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #B5915F', background: '#FFF8F0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RiEditLine size={14} color="#B5915F" />
                      </button>
                      <button onClick={() => deleteSlide(slide.id)}
                        style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RiDeleteBin2Line size={14} color="#ef4444" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AccordionSection>

          {/* Categories Section */}
          <AccordionSection 
            title="قسم الفئات (Categories)" 
            icon={RiColorFilterLine}
            isOpen={openSection === 'categories'}
            onToggle={() => setOpenSection(openSection === 'categories' ? '' : 'categories')}
          >
            {sectionsLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}><RiLoader4Line size={32} className="spin" /></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>عنوان القسم (عربي)</label>
                  <input 
                    type="text" 
                    value={homeSections.categories?.title_ar || ''} 
                    onChange={e => setHomeSections(prev => ({ ...prev, categories: { ...prev.categories, title_ar: e.target.value } }))}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>عنوان القسم (إنجليزي)</label>
                  <input 
                    type="text" 
                    value={homeSections.categories?.title_en || ''} 
                    onChange={e => setHomeSections(prev => ({ ...prev, categories: { ...prev.categories, title_en: e.target.value } }))}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit', textAlign: 'left', direction: 'ltr' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>نص الزر (عربي)</label>
                  <input 
                    type="text" 
                    value={homeSections.categories?.action_text_ar || ''} 
                    onChange={e => setHomeSections(prev => ({ ...prev, categories: { ...prev.categories, action_text_ar: e.target.value } }))}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>نص الزر (إنجليزي)</label>
                  <input 
                    type="text" 
                    value={homeSections.categories?.action_text_en || ''} 
                    onChange={e => setHomeSections(prev => ({ ...prev, categories: { ...prev.categories, action_text_en: e.target.value } }))}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit', textAlign: 'left', direction: 'ltr' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>عدد الفئات المعروضة</label>
                  <input 
                    type="number" 
                    value={homeSections.categories?.items_count || 6} 
                    onChange={e => setHomeSections(prev => ({ ...prev, categories: { ...prev.categories, items_count: e.target.value } }))}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, color: '#1e293b' }}>
                    <input 
                      type="checkbox" 
                      checked={homeSections.categories?.is_active !== 0 && homeSections.categories?.is_active !== false}
                      onChange={e => setHomeSections(prev => ({ ...prev, categories: { ...prev.categories, is_active: e.target.checked } }))}
                      style={{ width: 18, height: 18, accentColor: '#B5915F' }}
                    />
                    تفعيل القسم وعرضه في التطبيق
                  </label>
                </div>
                
                <div style={{ gridColumn: '1 / -1', marginTop: 12 }}>
                  <PrimaryButton onClick={() => saveHomeSection('categories')} style={{ width: 'max-content' }}>
                    <RiSave3Line size={16} /> حفظ قسم الفئات
                  </PrimaryButton>
                </div>
              </div>
            )}
          </AccordionSection>
          {/* Brands Section */}
          <AccordionSection 
            title="قسم العلامات التجارية (Brands)" 
            icon={RiColorFilterLine}
            isOpen={openSection === 'brands'}
            onToggle={() => setOpenSection(openSection === 'brands' ? '' : 'brands')}
          >
            {sectionsLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}><RiLoader4Line size={32} className="spin" /></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>عنوان القسم (عربي)</label>
                  <input 
                    type="text" 
                    value={homeSections.brands?.title_ar || ''} 
                    onChange={e => setHomeSections(prev => ({ ...prev, brands: { ...prev.brands, title_ar: e.target.value } }))}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>عنوان القسم (إنجليزي)</label>
                  <input 
                    type="text" 
                    value={homeSections.brands?.title_en || ''} 
                    onChange={e => setHomeSections(prev => ({ ...prev, brands: { ...prev.brands, title_en: e.target.value } }))}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit', textAlign: 'left', direction: 'ltr' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>نص الزر (عربي)</label>
                  <input 
                    type="text" 
                    value={homeSections.brands?.action_text_ar || ''} 
                    onChange={e => setHomeSections(prev => ({ ...prev, brands: { ...prev.brands, action_text_ar: e.target.value } }))}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>نص الزر (إنجليزي)</label>
                  <input 
                    type="text" 
                    value={homeSections.brands?.action_text_en || ''} 
                    onChange={e => setHomeSections(prev => ({ ...prev, brands: { ...prev.brands, action_text_en: e.target.value } }))}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit', textAlign: 'left', direction: 'ltr' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>عدد الماركات المعروضة</label>
                  <input 
                    type="number" 
                    value={homeSections.brands?.items_count || 4} 
                    onChange={e => setHomeSections(prev => ({ ...prev, brands: { ...prev.brands, items_count: e.target.value } }))}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, color: '#1e293b' }}>
                    <input 
                      type="checkbox" 
                      checked={homeSections.brands?.is_active !== 0 && homeSections.brands?.is_active !== false}
                      onChange={e => setHomeSections(prev => ({ ...prev, brands: { ...prev.brands, is_active: e.target.checked } }))}
                      style={{ width: 18, height: 18, accentColor: '#B5915F' }}
                    />
                    تفعيل القسم وعرضه في التطبيق
                  </label>
                </div>
                
                <div style={{ gridColumn: '1 / -1', marginTop: 12 }}>
                  <PrimaryButton onClick={() => saveHomeSection('brands')} style={{ width: 'max-content' }}>
                    <RiSave3Line size={16} /> حفظ قسم العلامات التجارية
                  </PrimaryButton>
                </div>
              </div>
            )}
          </AccordionSection>

          {/* Featured Products Section */}
          <AccordionSection 
            title="قسم المنتجات المميزة (Featured Products)" 
            icon={RiColorFilterLine}
            isOpen={openSection === 'featured_products'}
            onToggle={() => setOpenSection(openSection === 'featured_products' ? '' : 'featured_products')}
          >
            {sectionsLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}><RiLoader4Line size={32} className="spin" /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>عنوان القسم (عربي)</label>
                    <input 
                      type="text" 
                      value={homeSections.featured_products?.title_ar || ''} 
                      onChange={e => setHomeSections(prev => ({ ...prev, featured_products: { ...prev.featured_products, title_ar: e.target.value } }))}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>عنوان القسم (إنجليزي)</label>
                    <input 
                      type="text" 
                      value={homeSections.featured_products?.title_en || ''} 
                      onChange={e => setHomeSections(prev => ({ ...prev, featured_products: { ...prev.featured_products, title_en: e.target.value } }))}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit', textAlign: 'left', direction: 'ltr' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>نص الزر (عربي)</label>
                    <input 
                      type="text" 
                      value={homeSections.featured_products?.action_text_ar || ''} 
                      onChange={e => setHomeSections(prev => ({ ...prev, featured_products: { ...prev.featured_products, action_text_ar: e.target.value } }))}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>نص الزر (إنجليزي)</label>
                    <input 
                      type="text" 
                      value={homeSections.featured_products?.action_text_en || ''} 
                      onChange={e => setHomeSections(prev => ({ ...prev, featured_products: { ...prev.featured_products, action_text_en: e.target.value } }))}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit', textAlign: 'left', direction: 'ltr' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>عدد المنتجات المعروضة</label>
                    <input 
                      type="number" 
                      value={homeSections.featured_products?.items_count || 8} 
                      onChange={e => setHomeSections(prev => ({ ...prev, featured_products: { ...prev.featured_products, items_count: e.target.value } }))}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, color: '#1e293b' }}>
                      <input 
                        type="checkbox" 
                        checked={homeSections.featured_products?.is_active !== 0 && homeSections.featured_products?.is_active !== false}
                        onChange={e => setHomeSections(prev => ({ ...prev, featured_products: { ...prev.featured_products, is_active: e.target.checked } }))}
                        style={{ width: 18, height: 18, accentColor: '#B5915F' }}
                      />
                      تفعيل القسم وعرضه في التطبيق
                    </label>
                  </div>
                </div>

                {/* Card Settings */}
                <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 14, color: '#1e293b' }}>تحكم بتصميم الكارد (Product Card Settings)</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 12, color: '#475569' }}>حجم خط العنوان (Title Size)</label>
                      <input 
                        type="number" 
                        value={homeSections.featured_products?.card_settings?.titleFontSize || 14} 
                        onChange={e => setHomeSections(prev => ({ 
                          ...prev, 
                          featured_products: { 
                            ...prev.featured_products, 
                            card_settings: { ...(prev.featured_products?.card_settings || {}), titleFontSize: e.target.value } 
                          } 
                        }))}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 12, color: '#475569' }}>حجم خط الوصف القصير (Description Size)</label>
                      <input 
                        type="number" 
                        value={homeSections.featured_products?.card_settings?.descFontSize || 11} 
                        onChange={e => setHomeSections(prev => ({ 
                          ...prev, 
                          featured_products: { 
                            ...prev.featured_products, 
                            card_settings: { ...(prev.featured_products?.card_settings || {}), descFontSize: e.target.value } 
                          } 
                        }))}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 12, color: '#475569' }}>نص الخصم (عربي)</label>
                      <input 
                        type="text" 
                        placeholder="خصم، حسم، تنزيلات..."
                        value={homeSections.featured_products?.card_settings?.discountBadgeTextAr || 'حسم'} 
                        onChange={e => setHomeSections(prev => ({ 
                          ...prev, 
                          featured_products: { 
                            ...prev.featured_products, 
                            card_settings: { ...(prev.featured_products?.card_settings || {}), discountBadgeTextAr: e.target.value } 
                          } 
                        }))}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 12, color: '#475569' }}>نص الخصم (إنجليزي)</label>
                      <input 
                        type="text" 
                        placeholder="Discount, Sale..."
                        value={homeSections.featured_products?.card_settings?.discountBadgeTextEn || 'Discount'} 
                        onChange={e => setHomeSections(prev => ({ 
                          ...prev, 
                          featured_products: { 
                            ...prev.featured_products, 
                            card_settings: { ...(prev.featured_products?.card_settings || {}), discountBadgeTextEn: e.target.value } 
                          } 
                        }))}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', fontFamily: 'inherit', textAlign: 'left', direction: 'ltr' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gridColumn: '1 / -1', marginTop: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, color: '#475569', fontSize: 13 }}>
                        <input 
                          type="checkbox" 
                          checked={homeSections.featured_products?.card_settings?.showAttributes !== false}
                          onChange={e => setHomeSections(prev => ({ 
                            ...prev, 
                            featured_products: { 
                              ...prev.featured_products, 
                              card_settings: { ...(prev.featured_products?.card_settings || {}), showAttributes: e.target.checked } 
                            } 
                          }))}
                          style={{ width: 16, height: 16, accentColor: '#B5915F' }}
                        />
                        إظهار معلومات التقييم (Attributes & Ratings)
                      </label>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 4 }}>
                  <PrimaryButton onClick={() => saveHomeSection('featured_products')} style={{ width: 'max-content' }}>
                    <RiSave3Line size={16} /> حفظ قسم المنتجات المميزة
                  </PrimaryButton>
                </div>
              </div>
            )}
          </AccordionSection>

          {/* Features Banner Section */}
          <AccordionSection 
            title="قسم المميزات (Features Banner)" 
            icon={RiColorFilterLine}
            isOpen={openSection === 'features_banner'}
            onToggle={() => setOpenSection(openSection === 'features_banner' ? '' : 'features_banner')}
          >
            {sectionsLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}><RiLoader4Line size={32} className="spin" /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, color: '#1e293b' }}>
                    <input 
                      type="checkbox" 
                      checked={homeSections.features_banner?.is_active !== 0 && homeSections.features_banner?.is_active !== false}
                      onChange={e => setHomeSections(prev => ({ ...prev, features_banner: { ...prev.features_banner, is_active: e.target.checked } }))}
                      style={{ width: 18, height: 18, accentColor: '#B5915F' }}
                    />
                    تفعيل عرض بانر المميزات في التطبيق
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>لون الخلفية الأول (Gradient 1)</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input 
                        type="color" 
                        value={homeSections.features_banner?.card_settings?.bg_color_1 || '#D6B08C'} 
                        onChange={e => setHomeSections(prev => ({ 
                          ...prev, 
                          features_banner: { 
                            ...prev.features_banner, 
                            card_settings: { ...(prev.features_banner?.card_settings || {}), bg_color_1: e.target.value } 
                          } 
                        }))}
                        style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                      />
                      <input 
                        type="text" 
                        value={homeSections.features_banner?.card_settings?.bg_color_1 || '#D6B08C'} 
                        onChange={e => setHomeSections(prev => ({ 
                          ...prev, 
                          features_banner: { 
                            ...prev.features_banner, 
                            card_settings: { ...(prev.features_banner?.card_settings || {}), bg_color_1: e.target.value } 
                          } 
                        }))}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontFamily: 'monospace', direction: 'ltr' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>لون الخلفية الثاني (Gradient 2)</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input 
                        type="color" 
                        value={homeSections.features_banner?.card_settings?.bg_color_2 || '#EFDDC9'} 
                        onChange={e => setHomeSections(prev => ({ 
                          ...prev, 
                          features_banner: { 
                            ...prev.features_banner, 
                            card_settings: { ...(prev.features_banner?.card_settings || {}), bg_color_2: e.target.value } 
                          } 
                        }))}
                        style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                      />
                      <input 
                        type="text" 
                        value={homeSections.features_banner?.card_settings?.bg_color_2 || '#EFDDC9'} 
                        onChange={e => setHomeSections(prev => ({ 
                          ...prev, 
                          features_banner: { 
                            ...prev.features_banner, 
                            card_settings: { ...(prev.features_banner?.card_settings || {}), bg_color_2: e.target.value } 
                          } 
                        }))}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontFamily: 'monospace', direction: 'ltr' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 14, color: '#1e293b' }}>إدارة المميزات الثلاثة</h4>
                  
                  {[0, 1, 2].map(index => {
                    const featuresList = homeSections.features_banner?.card_settings?.features || [{}, {}, {}];
                    const feature = featuresList[index] || {};
                    const updateFeature = (key, value) => {
                      const newFeatures = [...featuresList];
                      newFeatures[index] = { ...newFeatures[index], [key]: value };
                      setHomeSections(prev => ({
                        ...prev,
                        features_banner: {
                          ...prev.features_banner,
                          card_settings: { ...(prev.features_banner?.card_settings || {}), features: newFeatures }
                        }
                      }));
                    };

                    return (
                      <div key={index} style={{ marginBottom: 20, padding: 16, background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 700, marginBottom: 12, color: '#0f172a' }}>ميزة رقم {index + 1}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>الأيقونة (Material Icon name أو رابط SVG/PNG)</label>
                            <input type="text" value={feature.icon_value || ''} placeholder="مثال: verified_outlined أو https://..." 
                              onChange={e => updateFeature('icon_value', e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>نوع الأيقونة</label>
                            <select value={feature.icon_type || 'material'} onChange={e => updateFeature('icon_type', e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}>
                              <option value="material">Material Icon (مضمن)</option>
                              <option value="image">صورة خارجية (رابط URL)</option>
                              <option value="svg">ملف SVG (رابط URL)</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>العنوان (عربي)</label>
                            <input type="text" value={feature.title_ar || ''} onChange={e => updateFeature('title_ar', e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>العنوان (إنجليزي)</label>
                            <input type="text" value={feature.title_en || ''} onChange={e => updateFeature('title_en', e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, direction: 'ltr' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>الوصف أو النسبة (عربي)</label>
                            <input type="text" value={feature.sub_ar || ''} onChange={e => updateFeature('sub_ar', e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>الوصف أو النسبة (إنجليزي)</label>
                            <input type="text" value={feature.sub_en || ''} onChange={e => updateFeature('sub_en', e.target.value)}
                              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, direction: 'ltr' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 4 }}>
                  <PrimaryButton onClick={() => saveHomeSection('features_banner')} style={{ width: 'max-content' }}>
                    <RiSave3Line size={16} /> حفظ بانر المميزات
                  </PrimaryButton>
                </div>
              </div>
            )}
          </AccordionSection>


          {/* Flash Sales Section */}
          <AccordionSection 
            title="قسم عروض الفلاش الحصرية (Flash Sales)" 
            icon={RiColorFilterLine}
            isOpen={openSection === 'flash_sales'}
            onToggle={() => setOpenSection(openSection === 'flash_sales' ? '' : 'flash_sales')}
          >
            {sectionsLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}><RiLoader4Line size={32} className="spin" /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>عنوان القسم (عربي)</label>
                    <input 
                      type="text" 
                      value={homeSections.flash_sales?.title_ar || ''} 
                      onChange={e => setHomeSections(prev => ({ ...prev, flash_sales: { ...prev.flash_sales, title_ar: e.target.value } }))}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>عنوان القسم (إنجليزي)</label>
                    <input 
                      type="text" 
                      value={homeSections.flash_sales?.title_en || ''} 
                      onChange={e => setHomeSections(prev => ({ ...prev, flash_sales: { ...prev.flash_sales, title_en: e.target.value } }))}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit', textAlign: 'left', direction: 'ltr' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>نص الزر (عربي)</label>
                    <input 
                      type="text" 
                      value={homeSections.flash_sales?.action_text_ar || ''} 
                      onChange={e => setHomeSections(prev => ({ ...prev, flash_sales: { ...prev.flash_sales, action_text_ar: e.target.value } }))}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>نص الزر (إنجليزي)</label>
                    <input 
                      type="text" 
                      value={homeSections.flash_sales?.action_text_en || ''} 
                      onChange={e => setHomeSections(prev => ({ ...prev, flash_sales: { ...prev.flash_sales, action_text_en: e.target.value } }))}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit', textAlign: 'left', direction: 'ltr' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>عدد المنتجات المعروضة</label>
                    <input 
                      type="number" 
                      value={homeSections.flash_sales?.items_count || 8} 
                      onChange={e => setHomeSections(prev => ({ ...prev, flash_sales: { ...prev.flash_sales, items_count: e.target.value } }))}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, color: '#1e293b' }}>
                      <input 
                        type="checkbox" 
                        checked={homeSections.flash_sales?.is_active !== 0 && homeSections.flash_sales?.is_active !== false}
                        onChange={e => setHomeSections(prev => ({ ...prev, flash_sales: { ...prev.flash_sales, is_active: e.target.checked } }))}
                        style={{ width: 18, height: 18, accentColor: '#B5915F' }}
                      />
                      تفعيل القسم وعرضه في التطبيق
                    </label>
                  </div>
                </div>

                {/* Card Settings */}
                <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 14, color: '#1e293b' }}>تحكم بتصميم الكارد (Product Card Settings)</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 12, color: '#475569' }}>حجم خط العنوان (Title Size)</label>
                      <input 
                        type="number" 
                        value={homeSections.flash_sales?.card_settings?.titleFontSize || 14} 
                        onChange={e => setHomeSections(prev => ({ 
                          ...prev, 
                          flash_sales: { 
                            ...prev.flash_sales, 
                            card_settings: { ...(prev.flash_sales?.card_settings || {}), titleFontSize: e.target.value } 
                          } 
                        }))}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 12, color: '#475569' }}>حجم خط الوصف القصير (Description Size)</label>
                      <input 
                        type="number" 
                        value={homeSections.flash_sales?.card_settings?.descFontSize || 11} 
                        onChange={e => setHomeSections(prev => ({ 
                          ...prev, 
                          flash_sales: { 
                            ...prev.flash_sales, 
                            card_settings: { ...(prev.flash_sales?.card_settings || {}), descFontSize: e.target.value } 
                          } 
                        }))}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 12, color: '#475569' }}>نص الخصم (عربي)</label>
                      <input 
                        type="text" 
                        placeholder="خصم، حسم، تنزيلات..."
                        value={homeSections.flash_sales?.card_settings?.discountBadgeTextAr || 'عرض فلاش'} 
                        onChange={e => setHomeSections(prev => ({ 
                          ...prev, 
                          flash_sales: { 
                            ...prev.flash_sales, 
                            card_settings: { ...(prev.flash_sales?.card_settings || {}), discountBadgeTextAr: e.target.value } 
                          } 
                        }))}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 12, color: '#475569' }}>نص الخصم (إنجليزي)</label>
                      <input 
                        type="text" 
                        placeholder="Discount, Sale..."
                        value={homeSections.flash_sales?.card_settings?.discountBadgeTextEn || 'Flash Sale'} 
                        onChange={e => setHomeSections(prev => ({ 
                          ...prev, 
                          flash_sales: { 
                            ...prev.flash_sales, 
                            card_settings: { ...(prev.flash_sales?.card_settings || {}), discountBadgeTextEn: e.target.value } 
                          } 
                        }))}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', fontFamily: 'inherit', textAlign: 'left', direction: 'ltr' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gridColumn: '1 / -1', marginTop: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, color: '#475569', fontSize: 13 }}>
                        <input 
                          type="checkbox" 
                          checked={homeSections.flash_sales?.card_settings?.showAttributes !== false}
                          onChange={e => setHomeSections(prev => ({ 
                            ...prev, 
                            flash_sales: { 
                              ...prev.flash_sales, 
                              card_settings: { ...(prev.flash_sales?.card_settings || {}), showAttributes: e.target.checked } 
                            } 
                          }))}
                          style={{ width: 16, height: 16, accentColor: '#B5915F' }}
                        />
                        إظهار معلومات التقييم (Attributes & Ratings)
                      </label>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 4 }}>
                  <PrimaryButton onClick={() => saveHomeSection('flash_sales')} style={{ width: 'max-content' }}>
                    <RiSave3Line size={16} /> حفظ قسم عروض الفلاش
                  </PrimaryButton>
                </div>
              </div>
            )}
          </AccordionSection>

          {/* Luxury Collections Section */}
          <AccordionSection 
            title="قسم المجموعات الحصرية (Luxury Collections)" 
            icon={RiColorFilterLine}
            isOpen={openSection === 'luxury_collections'}
            onToggle={() => setOpenSection(openSection === 'luxury_collections' ? '' : 'luxury_collections')}
          >
            {sectionsLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}><RiLoader4Line size={32} className="spin" /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>عنوان القسم (عربي)</label>
                    <input type="text" value={homeSections.luxury_collections?.title_ar || ''} onChange={e => setHomeSections(prev => ({ ...prev, luxury_collections: { ...prev.luxury_collections, title_ar: e.target.value } }))} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>عنوان القسم (إنجليزي)</label>
                    <input type="text" value={homeSections.luxury_collections?.title_en || ''} onChange={e => setHomeSections(prev => ({ ...prev, luxury_collections: { ...prev.luxury_collections, title_en: e.target.value } }))} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', direction: 'ltr' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>نص الزر (عربي)</label>
                    <input type="text" value={homeSections.luxury_collections?.action_text_ar || ''} onChange={e => setHomeSections(prev => ({ ...prev, luxury_collections: { ...prev.luxury_collections, action_text_ar: e.target.value } }))} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>نص الزر (إنجليزي)</label>
                    <input type="text" value={homeSections.luxury_collections?.action_text_en || ''} onChange={e => setHomeSections(prev => ({ ...prev, luxury_collections: { ...prev.luxury_collections, action_text_en: e.target.value } }))} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', direction: 'ltr' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>عدد الأقسام المعروضة في الصف (Items count)</label>
                    <input type="number" value={homeSections.luxury_collections?.items_count || 3} onChange={e => setHomeSections(prev => ({ ...prev, luxury_collections: { ...prev.luxury_collections, items_count: e.target.value } }))} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, color: '#1e293b' }}>
                      <input type="checkbox" checked={homeSections.luxury_collections?.is_active !== 0 && homeSections.luxury_collections?.is_active !== false} onChange={e => setHomeSections(prev => ({ ...prev, luxury_collections: { ...prev.luxury_collections, is_active: e.target.checked } }))} style={{ width: 18, height: 18, accentColor: '#B5915F' }} />
                      تفعيل القسم وعرضه
                    </label>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>اختيار الأقسام المخصصة (اترك فارغاً لعرض الأقسام الافتراضية)</label>
                    <select multiple size={4} 
                      value={homeSections.luxury_collections?.card_settings?.categories || []} 
                      onChange={e => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        setHomeSections(prev => ({ ...prev, luxury_collections: { ...prev.luxury_collections, card_settings: { ...(prev.luxury_collections?.card_settings || {}), categories: selected } } }))
                      }} 
                      style={{ width: '100%', padding: '8px', borderRadius: 12, border: '1px solid #e2e8f0', fontFamily: 'inherit' }}
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name_ar || c.name_en || c.name || `فئة #${c.id}`}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>اضغط مطولاً على Ctrl (أو Cmd) لاختيار أكثر من قسم</div>
                  </div>
                </div>
                <div>
                  <PrimaryButton onClick={() => saveHomeSection('luxury_collections')} style={{ width: 'max-content' }}><RiSave3Line size={16} /> حفظ مجموعات حصرية</PrimaryButton>
                </div>
              </div>
            )}
          </AccordionSection>

          {/* Loyalty Program Section */}
          <AccordionSection 
            title="قسم برنامج الولاء (Loyalty Program)" 
            icon={RiColorFilterLine}
            isOpen={openSection === 'loyalty_program'}
            onToggle={() => setOpenSection(openSection === 'loyalty_program' ? '' : 'loyalty_program')}
          >
            {sectionsLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}><RiLoader4Line size={32} className="spin" /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>العنوان الرئيسي (عربي)</label>
                    <input type="text" value={homeSections.loyalty_program?.title_ar || ''} onChange={e => setHomeSections(prev => ({ ...prev, loyalty_program: { ...prev.loyalty_program, title_ar: e.target.value } }))} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>العنوان الرئيسي (إنجليزي)</label>
                    <input type="text" value={homeSections.loyalty_program?.title_en || ''} onChange={e => setHomeSections(prev => ({ ...prev, loyalty_program: { ...prev.loyalty_program, title_en: e.target.value } }))} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', direction: 'ltr' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>العنوان الفرعي (عربي)</label>
                    <input type="text" value={homeSections.loyalty_program?.card_settings?.subtitle_ar || ''} onChange={e => setHomeSections(prev => ({ ...prev, loyalty_program: { ...prev.loyalty_program, card_settings: { ...(prev.loyalty_program?.card_settings || {}), subtitle_ar: e.target.value } } }))} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>العنوان الفرعي (إنجليزي)</label>
                    <input type="text" value={homeSections.loyalty_program?.card_settings?.subtitle_en || ''} onChange={e => setHomeSections(prev => ({ ...prev, loyalty_program: { ...prev.loyalty_program, card_settings: { ...(prev.loyalty_program?.card_settings || {}), subtitle_en: e.target.value } } }))} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', direction: 'ltr' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>نص الزر (عربي)</label>
                    <input type="text" value={homeSections.loyalty_program?.action_text_ar || ''} onChange={e => setHomeSections(prev => ({ ...prev, loyalty_program: { ...prev.loyalty_program, action_text_ar: e.target.value } }))} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: '#334155' }}>نص الزر (إنجليزي)</label>
                    <input type="text" value={homeSections.loyalty_program?.action_text_en || ''} onChange={e => setHomeSections(prev => ({ ...prev, loyalty_program: { ...prev.loyalty_program, action_text_en: e.target.value } }))} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #e2e8f0', direction: 'ltr' }} />
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 14, color: '#1e293b' }}>تحكم الأيقونة (Icon Settings)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>نوع الأيقونة</label>
                      <select value={homeSections.loyalty_program?.card_settings?.icon_type || 'material'} onChange={e => setHomeSections(prev => ({ ...prev, loyalty_program: { ...prev.loyalty_program, card_settings: { ...(prev.loyalty_program?.card_settings || {}), icon_type: e.target.value } } }))} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                        <option value="material">Material Icon (مضمن)</option>
                        <option value="image">صورة خارجية (رابط URL)</option>
                        <option value="svg">ملف SVG (رابط URL)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>الأيقونة (Material Icon name أو رابط SVG/PNG)</label>
                      <input type="text" value={homeSections.loyalty_program?.card_settings?.icon_value || 'workspace_premium'} placeholder="مثال: workspace_premium" onChange={e => setHomeSections(prev => ({ ...prev, loyalty_program: { ...prev.loyalty_program, card_settings: { ...(prev.loyalty_program?.card_settings || {}), icon_value: e.target.value } } }))} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', direction: 'ltr' }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, color: '#1e293b' }}>
                    <input type="checkbox" checked={homeSections.loyalty_program?.is_active !== 0 && homeSections.loyalty_program?.is_active !== false} onChange={e => setHomeSections(prev => ({ ...prev, loyalty_program: { ...prev.loyalty_program, is_active: e.target.checked } }))} style={{ width: 18, height: 18, accentColor: '#B5915F' }} />
                    تفعيل عرض برنامج الولاء
                  </label>
                </div>

                <div>
                  <PrimaryButton onClick={() => saveHomeSection('loyalty_program')} style={{ width: 'max-content' }}><RiSave3Line size={16} /> حفظ برنامج الولاء</PrimaryButton>
                </div>
              </div>
            )}
          </AccordionSection>

        </div>
      )}

      {/* ── TAB: COLORS ── */}
      {activeTab === 'colors' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 28, alignItems: 'start' }}>
          <Card title="لوحة ألوان التطبيق" icon={RiPaletteLine}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {Object.entries(COLOR_LABELS).map(([key, label]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: '#f8fafc', borderRadius: 14 }}>
                  <input type="color" value={colors[key] || '#000000'} onChange={e => setColors(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ width: 52, height: 52, borderRadius: 12, border: '2px solid #e2e8f0', cursor: 'pointer', padding: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{label}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, fontFamily: 'monospace' }}>{colors[key]}</div>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: colors[key], border: '2px solid #e2e8f0' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setColors(DEFAULT_COLORS)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: 'inherit' }}>
                إعادة الضبط الافتراضي
              </button>
              <PrimaryButton onClick={saveColors} disabled={saving} loading={saving} style={{ flex: 2 }}>
                <RiSave3Line size={16} /> حفظ الألوان
              </PrimaryButton>
            </div>
          </Card>

          {/* Live Color Preview */}
          <div style={{ position: 'sticky', top: 20 }}>
            <Card title="معاينة الألوان المباشرة" style={{ textAlign: 'center' }}>
              <div style={{
                width: 220, height: 440, margin: '0 auto',
                border: '8px solid #1e293b', borderRadius: 36,
                overflow: 'hidden', background: colors.background,
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              }}>
                <div style={{ background: colors.primary, padding: '40px 16px 16px', color: '#fff' }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>GH Shopper</div>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ background: colors.secondary, borderRadius: 12, padding: 12, color: '#fff', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
                    منتج مميز — {colors.secondary}
                  </div>
                  <div style={{ background: colors.accent + '30', borderRadius: 10, padding: 10, border: `1px solid ${colors.accent}`, fontSize: 12, color: '#333', marginBottom: 10 }}>
                    خصم خاص 20% ✨
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, height: 60, background: colors.primary + '15', borderRadius: 10, border: `1px solid ${colors.primary}30` }} />
                    <div style={{ flex: 1, height: 60, background: colors.secondary + '15', borderRadius: 10, border: `1px solid ${colors.secondary}30` }} />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB: BADGES ── */}
      {activeTab === 'badges' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 28, alignItems: 'start' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ─── Helper: Reusable Badge Card ─── */}
            {[
              {
                key: 'crown',
                title: '👑 شارة التوصيل السريع (ساعتين)',
                desc: 'تظهر على المنتجات التي تحتوي على badge_code يحتوي على "ساعتين" أو "fast" أو "2h"',
                svgIcon: <svg width="14" height="14" viewBox="0 0 24 24" fill={badges.crown?.text_color || '#FFF7EB'}><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>,
              },
              {
                key: 'truck',
                title: '🚚 شارة التوصيل خلال 3 أيام',
                desc: 'تظهر على المنتجات التي تحتوي على badge_code يحتوي على "3" أو "free" أو "3d"',
                svgIcon: <svg width="14" height="14" viewBox="0 0 24 24" fill={badges.truck?.text_color || '#380712'}><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>,
              },
              {
                key: 'plane',
                title: '✈️ شارة التوصيل 5-7 أيام',
                desc: 'تظهر على المنتجات التي تحتوي على badge_code يحتوي على "5" أو "7" أو "5-7d"',
                svgIcon: <svg width="14" height="14" viewBox="0 0 24 24" fill={badges.plane?.text_color || '#4A0E1B'}><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>,
              },
              {
                key: 'preorder',
                title: '📦 شارة الطلب المسبق',
                desc: 'تظهر على المنتجات التي تحتوي على badge_code يحتوي على "مسبق" أو "pre-order"',
                svgIcon: <svg width="14" height="14" viewBox="0 0 24 24" fill={badges.preorder?.text_color || '#FFDF9E'}><path d="M20 3H4c-1.1 0-2 .9-2 2v2c0 .55.45 1 1 1h1v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8h1c.55 0 1-.45 1-1V5c0-1.1-.9-2-2-2zm-1 17H5V8h14v12zM4 6V5h16v1H4z"/></svg>,
              },
              {
                key: 'discount',
                title: '🏷️ شارة الخصم',
                desc: 'تظهر على المنتجات التي لها سعر مقارنة (compare_price) أعلى من السعر الحالي',
                svgIcon: <svg width="14" height="14" viewBox="0 0 24 24" fill={badges.discount?.text_color || '#2E7D32'}><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>,
              },
            ].map(({ key, title, desc, svgIcon }) => (
              <Card key={key} title={title} icon={RiPriceTag3Line}>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px', background: '#f8fafc', padding: '8px 12px', borderRadius: 8, borderRight: '3px solid #B5915F' }}>{desc}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 8 }}>النص (عربي)</label>
                    <input type="text" value={badges[key]?.text_ar || ''} onChange={e => updateBadge(key, 'text_ar', e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 8 }}>النص (إنجليزي)</label>
                    <input type="text" value={badges[key]?.text_en || ''} onChange={e => updateBadge(key, 'text_en', e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 14, textAlign: 'left', direction: 'ltr' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 8 }}>الخلفية 1 (اللون الأول)</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={badges[key]?.bg_color_1?.startsWith('#') ? badges[key].bg_color_1 : '#ffffff'} onChange={e => updateBadge(key, 'bg_color_1', e.target.value)} style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
                      <input type="text" value={badges[key]?.bg_color_1 || ''} onChange={e => updateBadge(key, 'bg_color_1', e.target.value)} style={{ flex: 1, padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, fontFamily: 'monospace' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 8 }}>الخلفية 2 (اللون الثاني)</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={badges[key]?.bg_color_2?.startsWith('#') ? badges[key].bg_color_2 : '#ffffff'} onChange={e => updateBadge(key, 'bg_color_2', e.target.value)} style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
                      <input type="text" value={badges[key]?.bg_color_2 || ''} onChange={e => updateBadge(key, 'bg_color_2', e.target.value)} style={{ flex: 1, padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, fontFamily: 'monospace' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 8 }}>لون النص والأيقونة</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={badges[key]?.text_color || '#000000'} onChange={e => updateBadge(key, 'text_color', e.target.value)} style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
                      <input type="text" value={badges[key]?.text_color || ''} onChange={e => updateBadge(key, 'text_color', e.target.value)} style={{ flex: 1, padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, fontFamily: 'monospace' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 8 }}>لون الإطار</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={badges[key]?.border_color || '#000000'} onChange={e => updateBadge(key, 'border_color', e.target.value)} style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
                      <input type="text" value={badges[key]?.border_color || ''} onChange={e => updateBadge(key, 'border_color', e.target.value)} style={{ flex: 1, padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 12, fontFamily: 'monospace' }} />
                    </div>
                  </div>
                </div>
                {/* Mini inline preview */}
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>معاينة:</span>
                  <div style={{
                    background: `linear-gradient(135deg, ${badges[key]?.bg_color_1}, ${badges[key]?.bg_color_2})`,
                    color: badges[key]?.text_color,
                    border: `1px solid ${badges[key]?.border_color}`,
                    borderRadius: 20,
                    padding: '5px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  }}>
                    {svgIcon}
                    {badges[key]?.text_ar}
                  </div>
                </div>
              </Card>
            ))}

            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <PrimaryButton onClick={saveBadges} disabled={saving} loading={saving} style={{ flex: 1 }}>
                <RiSave3Line size={16} /> حفظ جميع الشارات الأربع
              </PrimaryButton>
            </div>
          </div>

          {/* Live Preview Panel */}
          <div style={{ position: 'sticky', top: 20 }}>
            <Card title="معاينة حقيقية للشارات" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20, textAlign: 'right' }}>هذه المعاينة تحاكي شكل الشارات في تطبيق Flutter مع تأثير الزجاج الفاخر</p>
              <div style={{ background: 'linear-gradient(135deg, #1a0a0e, #2d1520)', padding: '40px 20px', borderRadius: 20, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
                
                {/* Crown Badge */}
                <div style={{
                  background: `linear-gradient(135deg, ${badges.crown?.bg_color_1}, ${badges.crown?.bg_color_2})`,
                  color: badges.crown?.text_color,
                  border: `1px solid ${badges.crown?.border_color}`,
                  borderRadius: 20, padding: '7px 16px',
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  fontSize: 12, fontWeight: 800,
                  backdropFilter: 'blur(12px)',
                  boxShadow: `0 4px 20px ${badges.crown?.bg_color_1}80, 0 0 8px ${badges.crown?.border_color}40`,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 60%)', borderRadius: 20 }} />
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={badges.crown?.text_color}><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>
                  <span style={{ position: 'relative' }}>{badges.crown?.text_ar}</span>
                </div>

                {/* Truck Badge */}
                <div style={{
                  background: `linear-gradient(135deg, ${badges.truck?.bg_color_1}, ${badges.truck?.bg_color_2})`,
                  color: badges.truck?.text_color,
                  border: `1px solid ${badges.truck?.border_color}`,
                  borderRadius: 20, padding: '7px 16px',
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  fontSize: 12, fontWeight: 800,
                  backdropFilter: 'blur(12px)',
                  boxShadow: `0 4px 16px ${badges.truck?.bg_color_1}60`,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 60%)', borderRadius: 20 }} />
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={badges.truck?.text_color}><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4z"/></svg>
                  <span style={{ position: 'relative' }}>{badges.truck?.text_ar}</span>
                </div>

                {/* Plane Badge */}
                <div style={{
                  background: `linear-gradient(135deg, ${badges.plane?.bg_color_1}, ${badges.plane?.bg_color_2})`,
                  color: badges.plane?.text_color,
                  border: `1px solid ${badges.plane?.border_color}`,
                  borderRadius: 20, padding: '7px 16px',
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  fontSize: 12, fontWeight: 800,
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 60%)', borderRadius: 20 }} />
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={badges.plane?.text_color}><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>
                  <span style={{ position: 'relative' }}>{badges.plane?.text_ar}</span>
                </div>

                {/* Pre-order Badge */}
                <div style={{
                  background: `linear-gradient(135deg, ${badges.preorder?.bg_color_1}, ${badges.preorder?.bg_color_2})`,
                  color: badges.preorder?.text_color,
                  border: `1px solid ${badges.preorder?.border_color}`,
                  borderRadius: 20, padding: '7px 16px',
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  fontSize: 12, fontWeight: 800,
                  backdropFilter: 'blur(12px)',
                  boxShadow: `0 4px 20px rgba(0,0,0,0.3)`,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 60%)', borderRadius: 20 }} />
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={badges.preorder?.text_color}><path d="M20 3H4c-1.1 0-2 .9-2 2v2c0 .55.45 1 1 1h1v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8h1c.55 0 1-.45 1-1V5c0-1.1-.9-2-2-2zm-1 17H5V8h14v12zM4 6V5h16v1H4z"/></svg>
                  <span style={{ position: 'relative' }}>{badges.preorder?.text_ar}</span>
                </div>

                {/* Discount Badge */}
                <div style={{
                  background: `linear-gradient(135deg, ${badges.discount?.bg_color_1}, ${badges.discount?.bg_color_2})`,
                  color: badges.discount?.text_color,
                  border: `1px solid ${badges.discount?.border_color}`,
                  borderRadius: 20, padding: '5px 14px',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11, fontWeight: 800,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill={badges.discount?.text_color}><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>
                  {badges.discount?.text_ar} 20%
                </div>

              </div>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12 }}>تظهر الشارات هكذا تماماً فوق صور المنتجات في التطبيق</p>
            </Card>
          </div>

        </div>
      )}

      {/* ── TAB: BOTTOM NAV ── */}
      {activeTab === 'bottomnav' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* General Settings */}
          <Card title="إعدادات القائمة السفلية العامة" icon={RiMenuLine}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
              {/* Background Color */}
              <div style={{ padding: 16, background: '#f8fafc', borderRadius: 14 }}>
                <label style={{ fontWeight: 700, fontSize: 12, color: '#374151', display: 'block', marginBottom: 8 }}>لون الخلفية</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="color" value={homeSections.bottom_nav?.card_settings?.bg_color || '#F7F5F0'}
                    onChange={e => setHomeSections(prev => ({
                      ...prev, bottom_nav: { ...prev.bottom_nav, card_settings: { ...(prev.bottom_nav?.card_settings || {}), bg_color: e.target.value } }
                    }))}
                    style={{ width: 42, height: 42, borderRadius: 10, border: '2px solid #e2e8f0', cursor: 'pointer', padding: 2 }} />
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8' }}>{homeSections.bottom_nav?.card_settings?.bg_color || '#F7F5F0'}</span>
                </div>
              </div>
              {/* Active Color */}
              <div style={{ padding: 16, background: '#f8fafc', borderRadius: 14 }}>
                <label style={{ fontWeight: 700, fontSize: 12, color: '#374151', display: 'block', marginBottom: 8 }}>لون العنصر النشط</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="color" value={homeSections.bottom_nav?.card_settings?.active_color || '#722F37'}
                    onChange={e => setHomeSections(prev => ({
                      ...prev, bottom_nav: { ...prev.bottom_nav, card_settings: { ...(prev.bottom_nav?.card_settings || {}), active_color: e.target.value } }
                    }))}
                    style={{ width: 42, height: 42, borderRadius: 10, border: '2px solid #e2e8f0', cursor: 'pointer', padding: 2 }} />
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8' }}>{homeSections.bottom_nav?.card_settings?.active_color || '#722F37'}</span>
                </div>
              </div>
              {/* Inactive Color */}
              <div style={{ padding: 16, background: '#f8fafc', borderRadius: 14 }}>
                <label style={{ fontWeight: 700, fontSize: 12, color: '#374151', display: 'block', marginBottom: 8 }}>لون العنصر غير النشط</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="color" value={homeSections.bottom_nav?.card_settings?.inactive_color || '#8C7B70'}
                    onChange={e => setHomeSections(prev => ({
                      ...prev, bottom_nav: { ...prev.bottom_nav, card_settings: { ...(prev.bottom_nav?.card_settings || {}), inactive_color: e.target.value } }
                    }))}
                    style={{ width: 42, height: 42, borderRadius: 10, border: '2px solid #e2e8f0', cursor: 'pointer', padding: 2 }} />
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8' }}>{homeSections.bottom_nav?.card_settings?.inactive_color || '#8C7B70'}</span>
                </div>
              </div>
            </div>

            {/* Icon & Text Size */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div style={{ padding: 16, background: '#f8fafc', borderRadius: 14 }}>
                <label style={{ fontWeight: 700, fontSize: 12, color: '#374151', display: 'block', marginBottom: 8 }}>حجم الأيقونة (px)</label>
                <input type="number" min="16" max="40" value={homeSections.bottom_nav?.card_settings?.icon_size || 26}
                  onChange={e => setHomeSections(prev => ({
                    ...prev, bottom_nav: { ...prev.bottom_nav, card_settings: { ...(prev.bottom_nav?.card_settings || {}), icon_size: parseInt(e.target.value) || 26 } }
                  }))}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div style={{ padding: 16, background: '#f8fafc', borderRadius: 14 }}>
                <label style={{ fontWeight: 700, fontSize: 12, color: '#374151', display: 'block', marginBottom: 8 }}>حجم النص (px)</label>
                <input type="number" min="8" max="18" value={homeSections.bottom_nav?.card_settings?.text_size || 10}
                  onChange={e => setHomeSections(prev => ({
                    ...prev, bottom_nav: { ...prev.bottom_nav, card_settings: { ...(prev.bottom_nav?.card_settings || {}), text_size: parseInt(e.target.value) || 10 } }
                  }))}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>

            <PrimaryButton onClick={() => saveHomeSection('bottom_nav')} disabled={saving} loading={saving} style={{ width: '100%' }}>
              <RiSave3Line size={16} /> حفظ الإعدادات العامة
            </PrimaryButton>
          </Card>

          {/* Menu Items */}
          <Card title="عناصر القائمة (5 عناصر)" icon={RiEditLine}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(homeSections.bottom_nav?.card_settings?.items || [
                { key: 'home', label_ar: 'الرئيسية', label_en: 'Home' },
                { key: 'search', label_ar: 'البحث', label_en: 'Search' },
                { key: 'brands', label_ar: 'البراندات', label_en: 'Brands' },
                { key: 'cart', label_ar: 'السلة', label_en: 'Cart' },
                { key: 'profile', label_ar: 'حسابي', label_en: 'Profile' },
              ]).map((item, idx) => (
                <div key={item.key} style={{ padding: 20, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, #4B1828, #2A0812)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
                      {idx + 1}
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>
                      {item.key === 'home' ? '🏠 الرئيسية' : item.key === 'search' ? '🔍 البحث' : item.key === 'brands' ? '💎 البراندات' : item.key === 'cart' ? '🛒 السلة' : '👤 حسابي'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontWeight: 600, fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>الاسم بالعربية</label>
                      <input value={item.label_ar || ''} placeholder="الاسم عربي"
                        onChange={e => {
                          const items = [...(homeSections.bottom_nav?.card_settings?.items || [])]
                          items[idx] = { ...items[idx], label_ar: e.target.value }
                          setHomeSections(prev => ({
                            ...prev, bottom_nav: { ...prev.bottom_nav, card_settings: { ...(prev.bottom_nav?.card_settings || {}), items } }
                          }))
                        }}
                        style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontWeight: 600, fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>الاسم بالإنجليزية</label>
                      <input value={item.label_en || ''} placeholder="Name in English" dir="ltr"
                        onChange={e => {
                          const items = [...(homeSections.bottom_nav?.card_settings?.items || [])]
                          items[idx] = { ...items[idx], label_en: e.target.value }
                          setHomeSections(prev => ({
                            ...prev, bottom_nav: { ...prev.bottom_nav, card_settings: { ...(prev.bottom_nav?.card_settings || {}), items } }
                          }))
                        }}
                        style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  
                  {/* Icon Settings */}
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontWeight: 600, fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>نوع الأيقونة</label>
                      <select 
                        value={item.icon_type || 'code'}
                        onChange={e => {
                          const items = [...(homeSections.bottom_nav?.card_settings?.items || [])]
                          items[idx] = { ...items[idx], icon_type: e.target.value }
                          setHomeSections(prev => ({
                            ...prev, bottom_nav: { ...prev.bottom_nav, card_settings: { ...(prev.bottom_nav?.card_settings || {}), items } }
                          }))
                        }}
                        style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit' }}>
                        <option value="code">كود (SVG / FontAwesome)</option>
                        <option value="file">رفع صورة (PNG/SVG/Webp)</option>
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontWeight: 600, fontSize: 12, color: '#475569', display: 'block', marginBottom: 8 }}>الأيقونة (غير نشط)</label>
                        {(!item.icon_type || item.icon_type === 'code') ? (
                          <textarea 
                            value={item.inactive_icon || ''} 
                            placeholder="الصق كود SVG هنا"
                            dir="ltr"
                            onChange={e => {
                              const items = [...(homeSections.bottom_nav?.card_settings?.items || [])]
                              items[idx] = { ...items[idx], inactive_icon: e.target.value }
                              setHomeSections(prev => ({
                                ...prev, bottom_nav: { ...prev.bottom_nav, card_settings: { ...(prev.bottom_nav?.card_settings || {}), items } }
                              }))
                            }}
                            style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'monospace', minHeight: 80, resize: 'vertical', background: '#f8fafc' }}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {item.inactive_icon ? (
                              <div style={{ position: 'relative', width: 80, height: 80, borderRadius: 16, border: '1.5px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                <img src={item.inactive_icon} alt="Inactive" style={{ maxWidth: '60%', maxHeight: '60%', objectFit: 'contain' }} />
                                <button onClick={() => {
                                  const items = [...(homeSections.bottom_nav?.card_settings?.items || [])]
                                  items[idx] = { ...items[idx], inactive_icon: null }
                                  setHomeSections(prev => ({ ...prev, bottom_nav: { ...prev.bottom_nav, card_settings: { ...(prev.bottom_nav?.card_settings || {}), items } } }))
                                }} style={{ position: 'absolute', top: -8, right: -8, width: 26, height: 26, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)' }}>
                                  <RiCloseLine size={16} />
                                </button>
                              </div>
                            ) : (
                              <label style={{ cursor: 'pointer', width: 80, height: 80, borderRadius: 16, border: '2px dashed #cbd5e1', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', transition: 'all 0.2s' }}>
                                <RiUploadCloud2Line size={24} />
                                <span style={{ fontSize: 12, marginTop: 6, fontWeight: 600 }}>رفع</span>
                                <input type="file" accept="image/*,.svg" onChange={(e) => handleIconUpload(e.target.files[0], idx, 'inactive_icon')} style={{ display: 'none' }} />
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label style={{ fontWeight: 600, fontSize: 12, color: '#475569', display: 'block', marginBottom: 8 }}>الأيقونة (نشط)</label>
                        {(!item.icon_type || item.icon_type === 'code') ? (
                          <textarea 
                            value={item.active_icon || ''} 
                            placeholder="الصق كود SVG هنا"
                            dir="ltr"
                            onChange={e => {
                              const items = [...(homeSections.bottom_nav?.card_settings?.items || [])]
                              items[idx] = { ...items[idx], active_icon: e.target.value }
                              setHomeSections(prev => ({
                                ...prev, bottom_nav: { ...prev.bottom_nav, card_settings: { ...(prev.bottom_nav?.card_settings || {}), items } }
                              }))
                            }}
                            style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'monospace', minHeight: 80, resize: 'vertical', background: '#f8fafc' }}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {item.active_icon ? (
                              <div style={{ position: 'relative', width: 80, height: 80, borderRadius: 16, border: '1.5px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                <img src={item.active_icon} alt="Active" style={{ maxWidth: '60%', maxHeight: '60%', objectFit: 'contain' }} />
                                <button onClick={() => {
                                  const items = [...(homeSections.bottom_nav?.card_settings?.items || [])]
                                  items[idx] = { ...items[idx], active_icon: null }
                                  setHomeSections(prev => ({ ...prev, bottom_nav: { ...prev.bottom_nav, card_settings: { ...(prev.bottom_nav?.card_settings || {}), items } } }))
                                }} style={{ position: 'absolute', top: -8, right: -8, width: 26, height: 26, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)' }}>
                                  <RiCloseLine size={16} />
                                </button>
                              </div>
                            ) : (
                              <label style={{ cursor: 'pointer', width: 80, height: 80, borderRadius: 16, border: '2px dashed #cbd5e1', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', transition: 'all 0.2s' }}>
                                <RiUploadCloud2Line size={24} />
                                <span style={{ fontSize: 12, marginTop: 6, fontWeight: 600 }}>رفع</span>
                                <input type="file" accept="image/*,.svg" onChange={(e) => handleIconUpload(e.target.files[0], idx, 'active_icon')} style={{ display: 'none' }} />
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20 }}>
              <PrimaryButton onClick={() => saveHomeSection('bottom_nav')} disabled={saving} loading={saving} style={{ width: '100%' }}>
                <RiSave3Line size={16} /> حفظ عناصر القائمة
              </PrimaryButton>
            </div>
          </Card>

          {/* Live Preview */}
          <Card title="معاينة القائمة السفلية" icon={RiEyeLine}>
            <div style={{
              width: '100%', maxWidth: 400, margin: '0 auto', height: 70,
              background: homeSections.bottom_nav?.card_settings?.bg_color || '#F7F5F0',
              borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-around',
              boxShadow: '0 -4px 20px rgba(0,0,0,0.08)', padding: '0 10px',
              border: '2px solid #e2e8f0',
            }}>
              {(homeSections.bottom_nav?.card_settings?.items || [
                { label_ar: 'الرئيسية' }, { label_ar: 'البحث' }, { label_ar: 'البراندات' }, { label_ar: 'السلة' }, { label_ar: 'حسابي' }
              ]).map((item, i) => {
                const isActive = i === 0
                const icons = ['🏠', '🔍', '💎', '🛒', '👤']
                return (
                  <div key={i} style={{ textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{ fontSize: homeSections.bottom_nav?.card_settings?.icon_size || 26, lineHeight: 1 }}>{icons[i]}</div>
                    <div style={{
                      fontSize: homeSections.bottom_nav?.card_settings?.text_size || 10,
                      fontWeight: isActive ? 800 : 600,
                      color: isActive
                        ? (homeSections.bottom_nav?.card_settings?.active_color || '#722F37')
                        : (homeSections.bottom_nav?.card_settings?.inactive_color || '#8C7B70'),
                      marginTop: 4,
                    }}>{item.label_ar || 'عنصر'}</div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB: BRANDS SCREEN ── */}
      {activeTab === 'brandsscreen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card title="إعدادات شاشة البراندات" icon={RiVipDiamondLine}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Screen Title */}
              <div style={{ padding: 20, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 15, color: '#1e293b' }}>📌 عنوان الشاشة</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>العنوان بالعربية</label>
                    <input value={homeSections.brands_screen?.card_settings?.screen_title_ar || ''}
                      onChange={e => setHomeSections(prev => ({
                        ...prev, brands_screen: { ...prev.brands_screen, card_settings: { ...(prev.brands_screen?.card_settings || {}), screen_title_ar: e.target.value } }
                      }))}
                      placeholder="العلامات الحصرية"
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>العنوان بالإنجليزية</label>
                    <input value={homeSections.brands_screen?.card_settings?.screen_title_en || ''} dir="ltr"
                      onChange={e => setHomeSections(prev => ({
                        ...prev, brands_screen: { ...prev.brands_screen, card_settings: { ...(prev.brands_screen?.card_settings || {}), screen_title_en: e.target.value } }
                      }))}
                      placeholder="Exclusive Brands"
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontWeight: 600, fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>العنوان الفرعي (Subtitle)</label>
                  <input value={homeSections.brands_screen?.card_settings?.subtitle_text || ''} dir="ltr"
                    onChange={e => setHomeSections(prev => ({
                      ...prev, brands_screen: { ...prev.brands_screen, card_settings: { ...(prev.brands_screen?.card_settings || {}), subtitle_text: e.target.value } }
                    }))}
                    placeholder="EXCLUSIVE BRANDS"
                    style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              </div>

              {/* Shop Button Text */}
              <div style={{ padding: 20, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 15, color: '#1e293b' }}>🛍️ نص زر التسوق</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>بالعربية</label>
                    <input value={homeSections.brands_screen?.card_settings?.shop_btn_ar || ''}
                      onChange={e => setHomeSections(prev => ({
                        ...prev, brands_screen: { ...prev.brands_screen, card_settings: { ...(prev.brands_screen?.card_settings || {}), shop_btn_ar: e.target.value } }
                      }))}
                      placeholder="تسوق الآن"
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>بالإنجليزية</label>
                    <input value={homeSections.brands_screen?.card_settings?.shop_btn_en || ''} dir="ltr"
                      onChange={e => setHomeSections(prev => ({
                        ...prev, brands_screen: { ...prev.brands_screen, card_settings: { ...(prev.brands_screen?.card_settings || {}), shop_btn_en: e.target.value } }
                      }))}
                      placeholder="Shop Now"
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              {/* Discover Text */}
              <div style={{ padding: 20, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 15, color: '#1e293b' }}>✨ نص اكتشاف المنتجات</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>بالعربية</label>
                    <input value={homeSections.brands_screen?.card_settings?.discover_ar || ''}
                      onChange={e => setHomeSections(prev => ({
                        ...prev, brands_screen: { ...prev.brands_screen, card_settings: { ...(prev.brands_screen?.card_settings || {}), discover_ar: e.target.value } }
                      }))}
                      placeholder="اكتشف منتجات"
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>بالإنجليزية</label>
                    <input value={homeSections.brands_screen?.card_settings?.discover_en || ''} dir="ltr"
                      onChange={e => setHomeSections(prev => ({
                        ...prev, brands_screen: { ...prev.brands_screen, card_settings: { ...(prev.brands_screen?.card_settings || {}), discover_en: e.target.value } }
                      }))}
                      placeholder="Discover products"
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              {/* Empty State Text */}
              <div style={{ padding: 20, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 16px', fontWeight: 800, fontSize: 15, color: '#1e293b' }}>📭 نص الشاشة الفارغة</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>العنوان بالعربية</label>
                    <input value={homeSections.brands_screen?.card_settings?.empty_title_ar || ''}
                      onChange={e => setHomeSections(prev => ({
                        ...prev, brands_screen: { ...prev.brands_screen, card_settings: { ...(prev.brands_screen?.card_settings || {}), empty_title_ar: e.target.value } }
                      }))}
                      placeholder="لا توجد ماركات حالياً"
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>العنوان بالإنجليزية</label>
                    <input value={homeSections.brands_screen?.card_settings?.empty_title_en || ''} dir="ltr"
                      onChange={e => setHomeSections(prev => ({
                        ...prev, brands_screen: { ...prev.brands_screen, card_settings: { ...(prev.brands_screen?.card_settings || {}), empty_title_en: e.target.value } }
                      }))}
                      placeholder="No brands available"
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>الوصف بالعربية</label>
                    <input value={homeSections.brands_screen?.card_settings?.empty_subtitle_ar || ''}
                      onChange={e => setHomeSections(prev => ({
                        ...prev, brands_screen: { ...prev.brands_screen, card_settings: { ...(prev.brands_screen?.card_settings || {}), empty_subtitle_ar: e.target.value } }
                      }))}
                      placeholder="يمكنك إضافة ماركات من لوحة الأدمن"
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>الوصف بالإنجليزية</label>
                    <input value={homeSections.brands_screen?.card_settings?.empty_subtitle_en || ''} dir="ltr"
                      onChange={e => setHomeSections(prev => ({
                        ...prev, brands_screen: { ...prev.brands_screen, card_settings: { ...(prev.brands_screen?.card_settings || {}), empty_subtitle_en: e.target.value } }
                      }))}
                      placeholder="You can add brands from the admin panel"
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <PrimaryButton onClick={() => saveHomeSection('brands_screen')} disabled={saving} loading={saving} style={{ width: '100%' }}>
                <RiSave3Line size={16} /> حفظ إعدادات شاشة البراندات
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )}

      {/* ── MODAL: Add/Edit Slide ── */}
      {showSlideModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }} onClick={() => setShowSlideModal(false)}>
          <div style={{
            background: '#fff', borderRadius: 24, padding: 32, width: '100%', maxWidth: 640,
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontWeight: 800, fontSize: 20, color: '#1e293b' }}>
                {editingSlide ? 'تعديل الشريحة' : 'إضافة شريحة جديدة'}
              </h2>
              <button onClick={() => setShowSlideModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <RiCloseLine size={24} color="#94a3b8" />
              </button>
            </div>

            {/* Slide Type */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'block', marginBottom: 8 }}>نوع الشريحة</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {[{ val: 'custom', label: 'مخصص (عنوان + صورة + زر)', desc: 'تحكم كامل بالمحتوى' },
                  { val: 'cover', label: 'بانر كامل (Cover)', desc: 'صورة واحدة تغطي كل الشريحة' }].map(opt => (
                  <div key={opt.val} onClick={() => setSlideForm(p => ({ ...p, slide_type: opt.val }))}
                    style={{
                      flex: 1, padding: 16, borderRadius: 14, cursor: 'pointer',
                      border: `2px solid ${slideForm.slide_type === opt.val ? '#B5915F' : '#e2e8f0'}`,
                      background: slideForm.slide_type === opt.val ? '#FFF8F0' : '#fafafa',
                      transition: 'all 0.2s',
                    }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: slideForm.slide_type === opt.val ? '#B5915F' : '#374151' }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Image Upload */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'block', marginBottom: 8 }}>
                {slideForm.slide_type === 'cover' ? 'صورة البانر (ستغطي كامل الشريحة)' : 'صورة الشريحة'}
              </label>
              <div onClick={() => slideImageRef.current?.click()} style={{
                border: '2px dashed #e2e8f0', borderRadius: 14, padding: 20, textAlign: 'center',
                cursor: 'pointer', background: '#fafafa', transition: 'all 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#B5915F'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}>
                {slideImage ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                    <img src={URL.createObjectURL(slideImage)} alt="" style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 8 }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{slideImage.name}</span>
                  </div>
                ) : editingSlide?.full_image_url ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                    <img src={editingSlide.full_image_url} alt="" style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 8 }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#94a3b8' }}>انقر لتغيير الصورة</span>
                  </div>
                ) : (
                  <div>
                    <RiImageAddLine size={32} color="#B5915F" />
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#64748b', marginTop: 8 }}>انقر لرفع صورة</div>
                  </div>
                )}
              </div>
              <input ref={slideImageRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) setSlideImage(e.target.files[0]) }} />
            </div>

            {/* Custom Fields (only for 'custom' type) */}
            {slideForm.slide_type === 'custom' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>العنوان (عربي)</label>
                    <textarea value={slideForm.title_ar} onChange={e => setSlideForm(p => ({ ...p, title_ar: e.target.value }))}
                      rows={2} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>العنوان (إنجليزي)</label>
                    <textarea value={slideForm.title_en} onChange={e => setSlideForm(p => ({ ...p, title_en: e.target.value }))}
                      rows={2} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', resize: 'none', direction: 'ltr', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>العنوان الفرعي (عربي)</label>
                    <input value={slideForm.subtitle_ar} onChange={e => setSlideForm(p => ({ ...p, subtitle_ar: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>العنوان الفرعي (إنجليزي)</label>
                    <input value={slideForm.subtitle_en} onChange={e => setSlideForm(p => ({ ...p, subtitle_en: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', direction: 'ltr', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>نص الزر (عربي)</label>
                    <input value={slideForm.button_text_ar} onChange={e => setSlideForm(p => ({ ...p, button_text_ar: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontWeight: 600, fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>نص الزر (إنجليزي)</label>
                    <input value={slideForm.button_text_en} onChange={e => setSlideForm(p => ({ ...p, button_text_en: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', direction: 'ltr', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </>
            )}

            {/* Background Color */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center' }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>لون الخلفية</label>
                <input type="color" value={slideForm.bg_color || '#3A1A1A'} onChange={e => setSlideForm(p => ({ ...p, bg_color: e.target.value }))}
                  style={{ width: 52, height: 42, borderRadius: 10, border: '2px solid #e2e8f0', cursor: 'pointer', padding: 2 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 600, fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>حالة الشريحة</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={slideForm.is_active} onChange={e => setSlideForm(p => ({ ...p, is_active: e.target.checked }))}
                    style={{ accentColor: '#B5915F', width: 18, height: 18 }} />
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>مفعّلة</span>
                </label>
              </div>
            </div>

            {/* Link Type */}
            <div style={{ marginBottom: 20, padding: 16, background: '#f8fafc', borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <label style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'block', marginBottom: 10 }}>
                <RiLinkM style={{ verticalAlign: 'middle', marginLeft: 6, color: '#B5915F' }} />
                الرابط عند الضغط
              </label>
              <select value={slideForm.link_type} onChange={e => setSlideForm(p => ({ ...p, link_type: e.target.value, link_value: '' }))}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box', background: '#fff' }}>
                <option value="none">بدون رابط</option>
                <option value="category">فئة (Category)</option>
                <option value="product">منتج (Product)</option>
                <option value="url">رابط خارجي (URL)</option>
              </select>

              {slideForm.link_type === 'category' && (
                <select value={slideForm.link_value} onChange={e => setSlideForm(p => ({ ...p, link_value: e.target.value }))}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' }}>
                  <option value="">— اختر الفئة —</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name_ar || c.name_en || c.name || `فئة #${c.id}`}</option>
                  ))}
                </select>
              )}

              {slideForm.link_type === 'product' && (
                <select value={slideForm.link_value} onChange={e => setSlideForm(p => ({ ...p, link_value: e.target.value }))}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff' }}>
                  <option value="">— اختر المنتج —</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name_ar || p.name_en || p.name || `منتج #${p.id}`}</option>
                  ))}
                </select>
              )}

              {slideForm.link_type === 'url' && (
                <input value={slideForm.link_value} onChange={e => setSlideForm(p => ({ ...p, link_value: e.target.value }))}
                  placeholder="https://example.com" dir="ltr"
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              )}
            </div>

            {/* Save Button */}
            <PrimaryButton onClick={saveSlide} disabled={slideSaving} loading={slideSaving} style={{ width: '100%' }}>
              <RiSave3Line size={16} /> {editingSlide ? 'حفظ التعديلات' : 'إضافة الشريحة'}
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* ── TAB: PROFILE SCREEN ── */}
      {activeTab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card title="إعدادات شاشة الحساب (Profile)" icon={RiUserLine}>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
              من هنا يمكنك تغيير جميع النصوص الموجودة في شاشة الحساب والتخصيص باللغتين العربية والإنجليزية لتظهر بشكل فوري في تطبيق Flutter.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              
              {/* Screen Title */}
              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, gridColumn: '1 / -1' }}>
                <h4 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: 14, fontWeight: 800 }}>عنوان الشاشة الرئيسي</h4>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>عنوان الشاشة (عربي)</label>
                    <input type="text" value={profileSettings.screen_title_ar || ''} onChange={e => setProfileSettings(p => ({ ...p, screen_title_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} placeholder="مثال: حسابي" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>عنوان الشاشة (إنجليزي)</label>
                    <input type="text" value={profileSettings.screen_title_en || ''} onChange={e => setProfileSettings(p => ({ ...p, screen_title_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} dir="ltr" placeholder="Example: My Profile" />
                  </div>
                </div>
              </div>

              {/* Guest Card */}
              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16 }}>
                <h4 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: 14, fontWeight: 800 }}>بطاقة الزائر (Guest Card)</h4>
                
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>عنوان البطاقة (عربي)</label>
                    <input type="text" value={profileSettings.guest_card_title_ar || ''} onChange={e => setProfileSettings(p => ({ ...p, guest_card_title_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>عنوان البطاقة (إنجليزي)</label>
                    <input type="text" value={profileSettings.guest_card_title_en || ''} onChange={e => setProfileSettings(p => ({ ...p, guest_card_title_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} dir="ltr" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>وصف البطاقة (عربي)</label>
                    <textarea rows="2" value={profileSettings.guest_card_subtitle_ar || ''} onChange={e => setProfileSettings(p => ({ ...p, guest_card_subtitle_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, resize: 'none' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>وصف البطاقة (إنجليزي)</label>
                    <textarea rows="2" value={profileSettings.guest_card_subtitle_en || ''} onChange={e => setProfileSettings(p => ({ ...p, guest_card_subtitle_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, resize: 'none' }} dir="ltr" />
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>زر تسجيل الدخول (عربي)</label>
                    <input type="text" value={profileSettings.guest_login_btn_ar || ''} onChange={e => setProfileSettings(p => ({ ...p, guest_login_btn_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>زر تسجيل الدخول (إنجليزي)</label>
                    <input type="text" value={profileSettings.guest_login_btn_en || ''} onChange={e => setProfileSettings(p => ({ ...p, guest_login_btn_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} dir="ltr" />
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>لون خلفية البطاقة (العلوي)</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={profileSettings.guest_card_bg_top || '#4B1828'} onChange={e => setProfileSettings(p => ({ ...p, guest_card_bg_top: e.target.value }))} style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
                      <input type="text" value={profileSettings.guest_card_bg_top || '#4B1828'} onChange={e => setProfileSettings(p => ({ ...p, guest_card_bg_top: e.target.value }))} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, textTransform: 'uppercase' }} dir="ltr" />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>لون خلفية البطاقة (السفلي)</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={profileSettings.guest_card_bg_bottom || '#8E3A4B'} onChange={e => setProfileSettings(p => ({ ...p, guest_card_bg_bottom: e.target.value }))} style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
                      <input type="text" value={profileSettings.guest_card_bg_bottom || '#8E3A4B'} onChange={e => setProfileSettings(p => ({ ...p, guest_card_bg_bottom: e.target.value }))} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, textTransform: 'uppercase' }} dir="ltr" />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>لون النصوص</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={profileSettings.guest_card_text_color || '#FFFFFF'} onChange={e => setProfileSettings(p => ({ ...p, guest_card_text_color: e.target.value }))} style={{ width: 40, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
                      <input type="text" value={profileSettings.guest_card_text_color || '#FFFFFF'} onChange={e => setProfileSettings(p => ({ ...p, guest_card_text_color: e.target.value }))} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, textTransform: 'uppercase' }} dir="ltr" />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>زر إنشاء حساب (عربي)</label>
                    <input type="text" value={profileSettings.guest_register_btn_ar || ''} onChange={e => setProfileSettings(p => ({ ...p, guest_register_btn_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>زر إنشاء حساب (إنجليزي)</label>
                    <input type="text" value={profileSettings.guest_register_btn_en || ''} onChange={e => setProfileSettings(p => ({ ...p, guest_register_btn_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} dir="ltr" />
                  </div>
                </div>
              </div>

              {/* Account Settings */}
              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16 }}>
                <h4 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: 14, fontWeight: 800 }}>قسم إعدادات الحساب</h4>
                
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>عنوان القسم (عربي)</label>
                    <input type="text" value={profileSettings.section_account_title_ar || ''} onChange={e => setProfileSettings(p => ({ ...p, section_account_title_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>عنوان القسم (إنجليزي)</label>
                    <input type="text" value={profileSettings.section_account_title_en || ''} onChange={e => setProfileSettings(p => ({ ...p, section_account_title_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} dir="ltr" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>طلباتي - العنوان (عربي)</label>
                    <input type="text" value={profileSettings.my_orders_title_ar || ''} onChange={e => setProfileSettings(p => ({ ...p, my_orders_title_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>طلباتي - العنوان (إنجليزي)</label>
                    <input type="text" value={profileSettings.my_orders_title_en || ''} onChange={e => setProfileSettings(p => ({ ...p, my_orders_title_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} dir="ltr" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>طلب منتج غير متوفر (عربي)</label>
                    <input type="text" value={profileSettings.request_product_title_ar || ''} onChange={e => setProfileSettings(p => ({ ...p, request_product_title_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>طلب منتج غير متوفر (إنجليزي)</label>
                    <input type="text" value={profileSettings.request_product_title_en || ''} onChange={e => setProfileSettings(p => ({ ...p, request_product_title_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} dir="ltr" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>تتبع طلب يدوي (عربي)</label>
                    <input type="text" value={profileSettings.track_order_title_ar || ''} onChange={e => setProfileSettings(p => ({ ...p, track_order_title_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>تتبع طلب يدوي (إنجليزي)</label>
                    <input type="text" value={profileSettings.track_order_title_en || ''} onChange={e => setProfileSettings(p => ({ ...p, track_order_title_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} dir="ltr" />
                  </div>
                </div>
              </div>

              {/* General Section */}
              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16 }}>
                <h4 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: 14, fontWeight: 800 }}>القسم العام (General)</h4>
                
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>عنوان القسم (عربي)</label>
                    <input type="text" value={profileSettings.section_general_title_ar || ''} onChange={e => setProfileSettings(p => ({ ...p, section_general_title_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>عنوان القسم (إنجليزي)</label>
                    <input type="text" value={profileSettings.section_general_title_en || ''} onChange={e => setProfileSettings(p => ({ ...p, section_general_title_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} dir="ltr" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>اللغة (عربي)</label>
                    <input type="text" value={profileSettings.language_title_ar || ''} onChange={e => setProfileSettings(p => ({ ...p, language_title_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>اللغة (إنجليزي)</label>
                    <input type="text" value={profileSettings.language_title_en || ''} onChange={e => setProfileSettings(p => ({ ...p, language_title_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} dir="ltr" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>العملة (عربي)</label>
                    <input type="text" value={profileSettings.currency_title_ar || ''} onChange={e => setProfileSettings(p => ({ ...p, currency_title_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>العملة (إنجليزي)</label>
                    <input type="text" value={profileSettings.currency_title_en || ''} onChange={e => setProfileSettings(p => ({ ...p, currency_title_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} dir="ltr" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>الإشعارات (عربي)</label>
                    <input type="text" value={profileSettings.notifications_title_ar || ''} onChange={e => setProfileSettings(p => ({ ...p, notifications_title_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>الإشعارات (إنجليزي)</label>
                    <input type="text" value={profileSettings.notifications_title_en || ''} onChange={e => setProfileSettings(p => ({ ...p, notifications_title_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} dir="ltr" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>تسجيل الخروج (عربي)</label>
                    <input type="text" value={profileSettings.logout_btn_ar || ''} onChange={e => setProfileSettings(p => ({ ...p, logout_btn_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>تسجيل الخروج (إنجليزي)</label>
                    <input type="text" value={profileSettings.logout_btn_en || ''} onChange={e => setProfileSettings(p => ({ ...p, logout_btn_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} dir="ltr" />
                  </div>
                </div>

              </div>

            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
              {/* Login Banner */}
              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16 }}>
                <h4 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: 14, fontWeight: 800 }}>بنر تسجيل الدخول (Login Banner)</h4>
                
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>لون الخلفية</label>
                    <input type="color" value={loginBanner.bg_color || '#4A0E1B'} onChange={e => setLoginBanner(p => ({ ...p, bg_color: e.target.value }))} style={{ width: '100%', height: 40, cursor: 'pointer', border: 'none', padding: 0 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>لون الزر</label>
                    <input type="color" value={loginBanner.button_color || '#B5915F'} onChange={e => setLoginBanner(p => ({ ...p, button_color: e.target.value }))} style={{ width: '100%', height: 40, cursor: 'pointer', border: 'none', padding: 0 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>العنوان (عربي)</label>
                    <input type="text" value={loginBanner.title_ar || ''} onChange={e => setLoginBanner(p => ({ ...p, title_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>العنوان (إنجليزي)</label>
                    <input type="text" value={loginBanner.title_en || ''} onChange={e => setLoginBanner(p => ({ ...p, title_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} dir="ltr" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>الوصف (عربي)</label>
                    <textarea rows="2" value={loginBanner.subtitle_ar || ''} onChange={e => setLoginBanner(p => ({ ...p, subtitle_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, resize: 'none' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>الوصف (إنجليزي)</label>
                    <textarea rows="2" value={loginBanner.subtitle_en || ''} onChange={e => setLoginBanner(p => ({ ...p, subtitle_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, resize: 'none' }} dir="ltr" />
                  </div>
                </div>
              </div>

              {/* Register Banner */}
              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16 }}>
                <h4 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: 14, fontWeight: 800 }}>بنر إنشاء حساب (Register Banner)</h4>
                
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>لون الخلفية</label>
                    <input type="color" value={registerBanner.bg_color || '#4A0E1B'} onChange={e => setRegisterBanner(p => ({ ...p, bg_color: e.target.value }))} style={{ width: '100%', height: 40, cursor: 'pointer', border: 'none', padding: 0 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>لون الزر</label>
                    <input type="color" value={registerBanner.button_color || '#B5915F'} onChange={e => setRegisterBanner(p => ({ ...p, button_color: e.target.value }))} style={{ width: '100%', height: 40, cursor: 'pointer', border: 'none', padding: 0 }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>العنوان (عربي)</label>
                    <input type="text" value={registerBanner.title_ar || ''} onChange={e => setRegisterBanner(p => ({ ...p, title_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>العنوان (إنجليزي)</label>
                    <input type="text" value={registerBanner.title_en || ''} onChange={e => setRegisterBanner(p => ({ ...p, title_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }} dir="ltr" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>الوصف (عربي)</label>
                    <textarea rows="2" value={registerBanner.subtitle_ar || ''} onChange={e => setRegisterBanner(p => ({ ...p, subtitle_ar: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, resize: 'none' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 }}>الوصف (إنجليزي)</label>
                    <textarea rows="2" value={registerBanner.subtitle_en || ''} onChange={e => setRegisterBanner(p => ({ ...p, subtitle_en: e.target.value }))} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, resize: 'none' }} dir="ltr" />
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: 20 }}>
              <PrimaryButton onClick={saveProfileSettings} disabled={saving} loading={saving}>
                <RiSave3Line size={16} /> حفظ إعدادات شاشة الحساب
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )}
      {/* ── TAB: PRODUCT REQUESTS ── */}
      {activeTab === 'product_requests' && (
        <div style={{ display: 'grid', gap: 24, paddingBottom: 40 }}>
          <Card title="تخصيص شاشة طلبات المنتجات" icon={RiSearch2Line}>
            <h4 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: 16, fontWeight: 800 }}>النصوص الأساسية</h4>
            <div style={{ display: 'grid', gap: 16, marginBottom: 32 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#334155' }}>العنوان الرئيسي (عربي)</label>
                  <input type="text" value={productRequestSettings?.title_ar || ''} onChange={e => setProductRequestSettings(p => ({ ...p, title_ar: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#334155' }}>العنوان الرئيسي (إنجليزي)</label>
                  <input type="text" value={productRequestSettings?.title_en || ''} onChange={e => setProductRequestSettings(p => ({ ...p, title_en: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }} dir="ltr" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#334155' }}>النص الفرعي (عربي)</label>
                  <input type="text" value={productRequestSettings?.subtitle_ar || ''} onChange={e => setProductRequestSettings(p => ({ ...p, subtitle_ar: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#334155' }}>النص الفرعي (إنجليزي)</label>
                  <input type="text" value={productRequestSettings?.subtitle_en || ''} onChange={e => setProductRequestSettings(p => ({ ...p, subtitle_en: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }} dir="ltr" />
                </div>
              </div>
            </div>

            <h4 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: 16, fontWeight: 800 }}>الحقول الأساسية (تفعيل/تعطيل)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                <input type="checkbox" checked={productRequestSettings?.enable_phone ?? true} onChange={e => setProductRequestSettings(p => ({ ...p, enable_phone: e.target.checked }))} style={{ accentColor: '#B5915F', width: 16, height: 16 }} />
                طلب رقم الهاتف / واتساب
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                <input type="checkbox" checked={productRequestSettings?.enable_email ?? false} onChange={e => setProductRequestSettings(p => ({ ...p, enable_email: e.target.checked }))} style={{ accentColor: '#B5915F', width: 16, height: 16 }} />
                طلب البريد الإلكتروني
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                <input type="checkbox" checked={productRequestSettings?.enable_product_link ?? true} onChange={e => setProductRequestSettings(p => ({ ...p, enable_product_link: e.target.checked }))} style={{ accentColor: '#B5915F', width: 16, height: 16 }} />
                طلب رابط المنتج
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                <input type="checkbox" checked={productRequestSettings?.enable_product_image ?? true} onChange={e => setProductRequestSettings(p => ({ ...p, enable_product_image: e.target.checked }))} style={{ accentColor: '#B5915F', width: 16, height: 16 }} />
                إتاحة رفع صورة المنتج
              </label>
            </div>

            <h4 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: 16, fontWeight: 800 }}>حقول إضافية مخصصة</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {productRequestSettings?.dynamic_inputs?.map((input, index) => (
                <div key={input.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', padding: '12px 16px', borderRadius: 8 }}>
                  <input type="text" placeholder="اسم الحقل (عربي)" value={input.label_ar} onChange={e => updateDynamicInput(index, 'label_ar', e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }} />
                  <input type="text" placeholder="اسم الحقل (إنجليزي)" value={input.label_en} onChange={e => updateDynamicInput(index, 'label_en', e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }} dir="ltr" />
                  <select value={input.type} onChange={e => updateDynamicInput(index, 'type', e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none' }}>
                    <option value="text">نص قصير</option>
                    <option value="textarea">نص طويل</option>
                    <option value="number">رقم</option>
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12 }}>
                    <input type="checkbox" checked={input.is_required} onChange={e => updateDynamicInput(index, 'is_required', e.target.checked)} style={{ accentColor: '#B5915F' }} />
                    إجباري؟
                  </label>
                  <button onClick={() => removeDynamicInput(index)} style={{ padding: 6, background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                    <RiCloseLine size={18} />
                  </button>
                </div>
              ))}
              <button onClick={addDynamicInput} style={{ alignSelf: 'flex-start', background: 'transparent', color: '#B5915F', border: '1px dashed #B5915F', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}>
                <RiAddCircleLine size={16} /> إضافة حقل
              </button>
            </div>

            <div style={{ marginTop: 32 }}>
              <PrimaryButton onClick={saveProductRequestSettings} disabled={saving} loading={saving}>
                <RiSave3Line size={16} /> حفظ التعديلات
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )}

      {/* ─── TAB: CART SCREEN ─── */}
      {activeTab === 'cart' && (
        <div style={{ display: 'grid', gap: 24, paddingBottom: 40, animation: 'fadeIn 0.3s ease' }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: 18, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <RiShoppingCart2Line color="#B5915F" size={24} /> 
                تخصيص شاشة سلة المشتريات
              </h3>
            </div>

            {/* Banner Section */}
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, marginBottom: 24, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h4 style={{ margin: 0, color: '#0f172a', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RiNotificationBadgeLine color="#B5915F" size={20} />
                  البانر العلوي (معلومات الشحن/الضمان)
                </h4>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, background: '#fff', padding: '6px 12px', borderRadius: 20, border: '1px solid #cbd5e1' }}>
                  <input type="checkbox" checked={cartSettings?.top_banner_active ?? true} onChange={e => setCartSettings(p => ({ ...p, top_banner_active: e.target.checked }))} style={{ accentColor: '#B5915F', width: 16, height: 16 }} />
                  تفعيل العرض
                </label>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>النص (عربي)</label>
                  <input type="text" placeholder="مثال: جميع منتجاتنا أصلية 100%" value={cartSettings?.top_banner_ar || ''} onChange={e => setCartSettings(p => ({ ...p, top_banner_ar: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>النص (إنجليزي)</label>
                  <input type="text" placeholder="e.g. 100% Original Products" value={cartSettings?.top_banner_en || ''} onChange={e => setCartSettings(p => ({ ...p, top_banner_en: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} dir="ltr" />
                </div>
              </div>
            </div>

            {/* Installment Section */}
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, marginBottom: 24, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h4 style={{ margin: 0, color: '#0f172a', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RiMoneyDollarCircleLine color="#B5915F" size={20} />
                  قسم التقسيط (تابي / تمارا)
                </h4>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, background: '#fff', padding: '6px 12px', borderRadius: 20, border: '1px solid #cbd5e1' }}>
                  <input type="checkbox" checked={cartSettings?.installment_active ?? true} onChange={e => setCartSettings(p => ({ ...p, installment_active: e.target.checked }))} style={{ accentColor: '#B5915F', width: 16, height: 16 }} />
                  تفعيل تابي وتمارا
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>عنوان القسم (عربي)</label>
                  <input type="text" value={cartSettings?.installment_title_ar || ''} onChange={e => setCartSettings(p => ({ ...p, installment_title_ar: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>عنوان القسم (إنجليزي)</label>
                  <input type="text" value={cartSettings?.installment_title_en || ''} onChange={e => setCartSettings(p => ({ ...p, installment_title_en: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} dir="ltr" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>نص الترويج العلوي (عربي)</label>
                  <input type="text" value={cartSettings?.installment_banner_ar || ''} onChange={e => setCartSettings(p => ({ ...p, installment_banner_ar: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>نص الترويج العلوي (إنجليزي)</label>
                  <input type="text" value={cartSettings?.installment_banner_en || ''} onChange={e => setCartSettings(p => ({ ...p, installment_banner_en: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} dir="ltr" />
                </div>
              </div>
            </div>

            {/* Coupon Section */}
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, marginBottom: 24, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h4 style={{ margin: 0, color: '#0f172a', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RiCoupon2Line color="#B5915F" size={20} />
                  قسم كوبون الخصم
                </h4>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, background: '#fff', padding: '6px 12px', borderRadius: 20, border: '1px solid #cbd5e1' }}>
                  <input type="checkbox" checked={cartSettings?.coupon_active ?? true} onChange={e => setCartSettings(p => ({ ...p, coupon_active: e.target.checked }))} style={{ accentColor: '#B5915F', width: 16, height: 16 }} />
                  تفعيل فورم الكوبون
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>عنوان الكوبون (عربي)</label>
                  <input type="text" value={cartSettings?.coupon_title_ar || ''} onChange={e => setCartSettings(p => ({ ...p, coupon_title_ar: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>عنوان الكوبون (إنجليزي)</label>
                  <input type="text" value={cartSettings?.coupon_title_en || ''} onChange={e => setCartSettings(p => ({ ...p, coupon_title_en: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} dir="ltr" />
                </div>
              </div>
            </div>

            {/* Empty Cart Section */}
            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, marginBottom: 24, border: '1px solid #e2e8f0' }}>
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: 0, color: '#0f172a', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RiShoppingCart2Line color="#B5915F" size={20} />
                  حالة السلة فارغة
                </h4>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>عنوان فارغ (عربي)</label>
                  <input type="text" value={cartSettings?.empty_title_ar || 'السلة فارغة'} onChange={e => setCartSettings(p => ({ ...p, empty_title_ar: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>عنوان فارغ (إنجليزي)</label>
                  <input type="text" value={cartSettings?.empty_title_en || 'Cart is empty'} onChange={e => setCartSettings(p => ({ ...p, empty_title_en: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} dir="ltr" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>وصف فارغ (عربي)</label>
                  <input type="text" value={cartSettings?.empty_subtitle_ar || 'تصفح المنتجات وأضف ما يعجبك'} onChange={e => setCartSettings(p => ({ ...p, empty_subtitle_ar: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>وصف فارغ (إنجليزي)</label>
                  <input type="text" value={cartSettings?.empty_subtitle_en || 'Browse products and add what you like'} onChange={e => setCartSettings(p => ({ ...p, empty_subtitle_en: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} dir="ltr" />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
              <PrimaryButton onClick={async () => {
                setSaving(true)
                try {
                  const res = await fetch(`${API}/admin/home-customize/sections/cart_screen`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ card_settings: cartSettings, is_active: true })
                  })
                  if (res.ok) toast.success('تم حفظ إعدادات السلة بنجاح')
                  else toast.error('فشل حفظ إعدادات السلة')
                } catch { toast.error('خطأ في الاتصال') }
                finally { setSaving(false) }
              }} disabled={saving} loading={saving} style={{ padding: '14px 32px', fontSize: 15, borderRadius: 8 }}>
                <RiSave3Line size={18} /> حفظ إعدادات السلة
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB: FOOTER ── */}
      {activeTab === 'footer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card title="إعدادات الفوتر (Footer)" icon={RiLayoutBottomLine}>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
              تحكم كامل في نصوص وروابط الفوتر السفلي للموقع والتطبيق (Flutter Web).
            </p>

            {/* Logo */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontWeight: 700, fontSize: 13, color: '#374151', display: 'block', marginBottom: 8 }}>شعار الفوتر</label>
              <div onClick={() => fileInputRef.current?.click()} style={{
                border: '2px dashed #e2e8f0', borderRadius: 14, padding: 20, textAlign: 'center',
                cursor: 'pointer', background: '#fafafa', transition: 'all 0.2s', width: 'fit-content'
              }}>
                {footerSettings.logo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src={URL.createObjectURL(footerSettings.logo)} alt="" style={{ height: 40 }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>صورة جديدة محددة</span>
                  </div>
                ) : footerSettings.logo_path ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src={`${API.replace('/api', '/storage')}/${footerSettings.logo_path}`} alt="" style={{ height: 40 }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#94a3b8' }}>تغيير الشعار</span>
                  </div>
                ) : (
                  <div>
                    <RiImageAddLine size={24} color="#B5915F" />
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#64748b', marginTop: 4 }}>انقر لرفع شعار</div>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) setFooterSettings(p => ({ ...p, logo: e.target.files[0] })) }} />
            </div>

            {/* Content fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>نبذة (عربي)</label>
                <textarea rows="3" value={footerSettings?.description_ar || ''} onChange={e => setFooterSettings(p => ({ ...p, description_ar: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>نبذة (إنجليزي)</label>
                <textarea rows="3" value={footerSettings?.description_en || ''} onChange={e => setFooterSettings(p => ({ ...p, description_en: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} dir="ltr" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>العنوان (عربي)</label>
                <input type="text" value={footerSettings?.address_ar || ''} onChange={e => setFooterSettings(p => ({ ...p, address_ar: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>العنوان (إنجليزي)</label>
                <input type="text" value={footerSettings?.address_en || ''} onChange={e => setFooterSettings(p => ({ ...p, address_en: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} dir="ltr" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>البريد الإلكتروني</label>
                <input type="text" value={footerSettings?.email || ''} onChange={e => setFooterSettings(p => ({ ...p, email: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} dir="ltr" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>رقم الهاتف</label>
                <input type="text" value={footerSettings?.phone || ''} onChange={e => setFooterSettings(p => ({ ...p, phone: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} dir="ltr" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 10px' }}>
              <h4 style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#1e293b' }}>روابط التواصل الاجتماعي</h4>
              <button 
                onClick={() => {
                  const links = Array.isArray(footerSettings?.social_links) ? [...footerSettings.social_links] : [];
                  links.push({ platform: 'Facebook', url: '' });
                  setFooterSettings(p => ({ ...p, social_links: links }));
                }}
                style={{
                  background: 'transparent', color: '#B5915F', border: '1px dashed #B5915F', 
                  padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                <RiAddCircleLine size={16} /> إضافة رابط جديد
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {Array.isArray(footerSettings?.social_links) && footerSettings.social_links.map((link, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <select 
                    value={link.platform} 
                    onChange={e => {
                      const links = [...footerSettings.social_links];
                      links[idx].platform = e.target.value;
                      setFooterSettings(p => ({ ...p, social_links: links }));
                    }}
                    style={{ padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                  >
                    <option value="Facebook">فيسبوك (Facebook)</option>
                    <option value="Twitter">تويتر (X / Twitter)</option>
                    <option value="Instagram">انستغرام (Instagram)</option>
                    <option value="Snapchat">سناب شات (Snapchat)</option>
                    <option value="TikTok">تيك توك (TikTok)</option>
                    <option value="YouTube">يوتيوب (YouTube)</option>
                    <option value="WhatsApp">واتساب (WhatsApp)</option>
                    <option value="LinkedIn">لينكدإن (LinkedIn)</option>
                    <option value="Other">رابط آخر (Custom)</option>
                  </select>
                  
                  <input 
                    type="text" 
                    placeholder="رابط الحساب (URL)" 
                    value={link.url} 
                    onChange={e => {
                      const links = [...footerSettings.social_links];
                      links[idx].url = e.target.value;
                      setFooterSettings(p => ({ ...p, social_links: links }));
                    }} 
                    style={{ flex: 1, padding: '10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }} 
                    dir="ltr" 
                  />
                  
                  <button 
                    onClick={() => {
                      const links = footerSettings.social_links.filter((_, i) => i !== idx);
                      setFooterSettings(p => ({ ...p, social_links: links }));
                    }} 
                    style={{ padding: 8, background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                  >
                    <RiCloseLine size={18} />
                  </button>
                </div>
              ))}
              {(!footerSettings?.social_links || footerSettings.social_links.length === 0) && (
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: 20 }}>
                  لا توجد روابط تواصل اجتماعي مضافة حالياً.
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>حقوق النشر (عربي)</label>
                <input type="text" value={footerSettings?.copyright_text_ar || ''} onChange={e => setFooterSettings(p => ({ ...p, copyright_text_ar: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 700, color: '#475569' }}>حقوق النشر (إنجليزي)</label>
                <input type="text" value={footerSettings?.copyright_text_en || ''} onChange={e => setFooterSettings(p => ({ ...p, copyright_text_en: e.target.value }))} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} dir="ltr" />
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <PrimaryButton onClick={handleSaveFooter} disabled={saving} loading={saving} style={{ width: '100%', padding: '14px', fontSize: 15 }}>
                <RiSave3Line size={18} /> حفظ إعدادات الفوتر
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB: POLICIES ── */}
      {activeTab === 'policies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card title="السياسات والشروط (Policies & Terms)" icon={RiFileList3Line}>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
              أدخل محتوى صفحات السياسات (عن الشركة، الشروط، الخصوصية، الاسترجاع). ستظهر في الفوتر وفي التطبيق.
            </p>
            
            {['about', 'terms', 'privacy', 'return'].map(type => {
              const policy = policies.find(p => p.type === type) || { type, title_ar: '', title_en: '', content_ar: '', content_en: '' };
              const typeLabels = {
                about: 'من نحن (About Us)',
                terms: 'الشروط والأحكام (Terms & Conditions)',
                privacy: 'سياسة الخصوصية (Privacy Policy)',
                return: 'سياسة الاسترجاع (Return Policy)'
              };

              return (
                <div key={type} style={{ background: '#f8fafc', padding: 20, borderRadius: 16, marginBottom: 20, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 16px', color: '#1e293b', fontSize: 15, fontWeight: 800 }}>{typeLabels[type]}</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: '#475569' }}>عنوان الصفحة (عربي)</label>
                      <input type="text" value={policy.title_ar} onChange={e => {
                        const newPol = [...policies];
                        const idx = newPol.findIndex(p => p.type === type);
                        if(idx >= 0) newPol[idx].title_ar = e.target.value;
                        else newPol.push({...policy, title_ar: e.target.value});
                        setPolicies(newPol);
                      }} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: '#475569' }}>عنوان الصفحة (إنجليزي)</label>
                      <input type="text" value={policy.title_en} onChange={e => {
                        const newPol = [...policies];
                        const idx = newPol.findIndex(p => p.type === type);
                        if(idx >= 0) newPol[idx].title_en = e.target.value;
                        else newPol.push({...policy, title_en: e.target.value});
                        setPolicies(newPol);
                      }} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} dir="ltr" />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: '#475569' }}>المحتوى (عربي)</label>
                      <textarea rows="6" value={policy.content_ar} onChange={e => {
                        const newPol = [...policies];
                        const idx = newPol.findIndex(p => p.type === type);
                        if(idx >= 0) newPol[idx].content_ar = e.target.value;
                        else newPol.push({...policy, content_ar: e.target.value});
                        setPolicies(newPol);
                      }} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, color: '#475569' }}>المحتوى (إنجليزي)</label>
                      <textarea rows="6" value={policy.content_en} onChange={e => {
                        const newPol = [...policies];
                        const idx = newPol.findIndex(p => p.type === type);
                        if(idx >= 0) newPol[idx].content_en = e.target.value;
                        else newPol.push({...policy, content_en: e.target.value});
                        setPolicies(newPol);
                      }} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }} dir="ltr" />
                    </div>
                  </div>

                  <PrimaryButton onClick={() => handleSavePolicy(policies.find(p => p.type === type) || policy)} disabled={saving} loading={saving} style={{ width: 'fit-content', padding: '10px 20px', fontSize: 13 }}>
                    <RiSave3Line size={16} /> حفظ {typeLabels[type]}
                  </PrimaryButton>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
