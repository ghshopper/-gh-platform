import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import TwoFactor from '../../components/TwoFactor';

export default function Profile() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = { name, email };
      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const res = await api.put('/auth/profile', payload);
      
      if (res.data && res.data.success) {
        toast.success('تم تحديث البيانات بنجاح');
        // Update user in local storage
        if (res.data.user) {
          localStorage.setItem('user', JSON.stringify(res.data.user));
          setUser(res.data.user);
        } else {
          // Fallback if user object is not returned
          const updatedUser = { ...user, name, email };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setUser(updatedUser);
        }
        setCurrentPassword('');
        setNewPassword('');
        
        // Reload page to reflect name change in sidebar
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.message || 'حدث خطأ أثناء التحديث';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '32px', minHeight: '100%', backgroundColor: 'var(--bg-body)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111', margin: 0, fontFamily: 'var(--font-primary)' }}>تعديل بيانات الحساب</h1>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0', maxWidth: '800px', margin: '0 auto' }}>
        <form onSubmit={handleSubmit}>
          
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#4B5563', marginBottom: '10px' }}>الاسم الكامل</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', fontSize: '15px', color: '#111', outline: 'none', transition: 'all 0.2s' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--color-gold)'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(181,145,95,0.1)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.backgroundColor = '#F9FAFB'; e.target.style.boxShadow = 'none'; }}
              placeholder="الاسم"
            />
          </div>

          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#4B5563', marginBottom: '10px' }}>البريد الإلكتروني</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', fontSize: '15px', color: '#111', outline: 'none', transition: 'all 0.2s', textAlign: 'left', direction: 'ltr' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--color-gold)'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(181,145,95,0.1)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.backgroundColor = '#F9FAFB'; e.target.style.boxShadow = 'none'; }}
              placeholder="admin@example.com"
            />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #E5E7EB', margin: '40px 0' }} />
          
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111', marginBottom: '24px' }}>تغيير كلمة المرور <span style={{ fontSize: '13px', fontWeight: 'normal', color: '#9CA3AF' }}>(اختياري)</span></h3>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#4B5563', marginBottom: '10px' }}>كلمة المرور الحالية</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', fontSize: '15px', color: '#111', outline: 'none', transition: 'all 0.2s' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--color-gold)'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(181,145,95,0.1)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.backgroundColor = '#F9FAFB'; e.target.style.boxShadow = 'none'; }}
              placeholder="أدخل كلمة المرور الحالية (مطلوبة عند تغيير كلمة المرور)"
            />
          </div>

          <div style={{ marginBottom: '40px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#4B5563', marginBottom: '10px' }}>كلمة المرور الجديدة</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ width: '100%', padding: '14px 16px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', fontSize: '15px', color: '#111', outline: 'none', transition: 'all 0.2s' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--color-gold)'; e.target.style.backgroundColor = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(181,145,95,0.1)'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.backgroundColor = '#F9FAFB'; e.target.style.boxShadow = 'none'; }}
              placeholder="أدخل كلمة المرور الجديدة"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={loading}
              style={{ 
                backgroundColor: 'var(--color-gold)', 
                color: '#fff', 
                border: 'none', 
                padding: '14px 32px', 
                borderRadius: '10px', 
                fontSize: '15px', 
                fontWeight: '600', 
                cursor: loading ? 'not-allowed' : 'pointer', 
                transition: 'all 0.2s',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 12px rgba(181,145,95,0.2)'
              }}
              onMouseOver={(e) => !loading && (e.target.style.backgroundColor = 'var(--color-gold-dark)')}
              onMouseOut={(e) => !loading && (e.target.style.backgroundColor = 'var(--color-gold)')}
            >
              {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
          </div>
        </form>
      </div>
      <TwoFactor />
    </div>
  );
}
