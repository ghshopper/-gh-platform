import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { RiMailLine, RiLockPasswordLine, RiAdminFill, RiArrowLeftLine } from 'react-icons/ri'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password, device: 'web-admin' })
      if (res.data.success && res.data.user.role === 'super_admin') {
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('user', JSON.stringify(res.data.user))
        toast.success('تم تسجيل الدخول بنجاح')
        navigate('/admin/dashboard', { replace: true })
      } else {
        toast.error('هذا الحساب لا يملك صلاحيات الإدارة')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'بيانات الدخول غير صحيحة')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      backgroundColor: '#F8F9FA',
      fontFamily: 'Tajawal, sans-serif',
      direction: 'rtl'
    }}>
      {/* Right Side - Login Form (RTL means this is logically on the right visually) */}
      <div style={{
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '40px 10%',
        backgroundColor: '#FFFFFF',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.03)',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ maxWidth: 420, width: '100%', margin: '0 auto' }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ 
              width: 56, height: 56, 
              backgroundColor: '#4A0D17', 
              borderRadius: 16, 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 24,
              boxShadow: '0 8px 24px rgba(74, 13, 23, 0.2)'
            }}>
              <RiAdminFill color="#D4A84B" size={28} />
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 900, color: '#1A1A24', margin: '0 0 12px 0' }}>مرحباً بعودتك</h1>
            <p style={{ fontSize: 16, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>قم بتسجيل الدخول إلى لوحة التحكم الخاصة بمتجر GH Shopper لإدارة المنتجات والطلبات.</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 10 }}>البريد الإلكتروني</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%', padding: '16px 48px 16px 16px',
                    borderRadius: 14, border: '1px solid #E5E7EB',
                    fontSize: 15, outline: 'none', backgroundColor: '#F9FAFB',
                    fontFamily: 'inherit', direction: 'ltr', textAlign: 'right',
                    transition: 'all 0.3s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#4A0D17';
                    e.target.style.backgroundColor = '#FFFFFF';
                    e.target.style.boxShadow = '0 0 0 4px rgba(74, 13, 23, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E5E7EB';
                    e.target.style.backgroundColor = '#F9FAFB';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="admin@ghshopper.com"
                  required
                />
                <RiMailLine style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 18, color: '#9CA3AF' }} size={20} />
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 10 }}>كلمة المرور</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '16px 48px 16px 16px',
                    borderRadius: 14, border: '1px solid #E5E7EB',
                    fontSize: 15, outline: 'none', backgroundColor: '#F9FAFB',
                    fontFamily: 'inherit', direction: 'ltr', textAlign: 'right',
                    transition: 'all 0.3s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#4A0D17';
                    e.target.style.backgroundColor = '#FFFFFF';
                    e.target.style.boxShadow = '0 0 0 4px rgba(74, 13, 23, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#E5E7EB';
                    e.target.style.backgroundColor = '#F9FAFB';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="••••••••"
                  required
                />
                <RiLockPasswordLine style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', right: 18, color: '#9CA3AF' }} size={20} />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{
                width: '100%', 
                backgroundColor: '#4A0D17', 
                color: '#FFFFFF',
                fontWeight: 800, padding: '18px', borderRadius: 14,
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 8, fontSize: 16, letterSpacing: '0.5px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                boxShadow: '0 10px 20px rgba(74, 13, 23, 0.25)',
                transition: 'all 0.3s ease',
                opacity: loading ? 0.7 : 1
              }}
              onMouseOver={(e) => { if(!loading) e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 28px rgba(74, 13, 23, 0.35)'; }}
              onMouseOut={(e) => { if(!loading) e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(74, 13, 23, 0.25)'; }}
            >
              {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
              {!loading && <RiArrowLeftLine size={20} />}
            </button>
          </form>
          
          <div style={{ marginTop: 40, textAlign: 'center', fontSize: 13, color: '#9CA3AF' }}>
            جميع الحقوق محفوظة &copy; {new Date().getFullYear()} GH Shopper
          </div>
        </div>
      </div>

      {/* Left Side - Visual Branding (Hidden on mobile) */}
      <div style={{
        flex: '1.2',
        position: 'relative',
        display: window.innerWidth > 900 ? 'flex' : 'none', // Simple responsive check
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#4A0D17',
        backgroundImage: 'radial-gradient(circle at center, #6B1A2A 0%, #4A0D17 100%)',
        overflow: 'hidden'
      }}>
        {/* Abstract Shapes */}
        <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '50%', height: '50%', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(212, 168, 75, 0.15), transparent)', filter: 'blur(60px)' }}></div>
        <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '60%', height: '60%', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(212, 168, 75, 0.1), transparent)', filter: 'blur(80px)' }}></div>
        
        {/* Glassmorphism Card Info */}
        <div style={{
          position: 'relative', zIndex: 2,
          padding: 48,
          borderRadius: 32,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          maxWidth: 480,
          textAlign: 'center',
          boxShadow: '0 30px 60px rgba(0,0,0,0.3)'
        }}>
          <h2 style={{ fontSize: 42, fontWeight: 900, color: '#FFFFFF', margin: '0 0 16px 0', letterSpacing: '-0.5px' }}>GH Shopper <br/><span style={{ color: '#D4A84B' }}>لوحة الإدارة</span></h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, lineHeight: 1.6, margin: 0 }}>
            قم بإدارة عمليات المتجر، المنتجات، والطلبات بكل سهولة واحترافية من خلال لوحة التحكم الخاصة بنا.
          </p>
        </div>
        
        {/* Floating elements animation could be added here via CSS classes in a real app */}
      </div>
    </div>
  )
}
