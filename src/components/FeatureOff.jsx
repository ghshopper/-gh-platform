import { Link } from 'react-router-dom'
import { RiToggleLine } from 'react-icons/ri'
import { canOpen } from '../lib/access'
import { FEATURE_NAMES } from '../lib/features'

/** Short notice shown instead of a page whose feature is off. */
export default function FeatureOff({ k, title }) {
  const admin = canOpen('/admin/features')
  return (
    <div className="gh-feature-off" dir="rtl" style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '34px 24px' }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-body)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <RiToggleLine size={26} />
      </div>
      <h2 style={{ margin: '0 0 6px', fontSize: 18, color: 'var(--text-primary)' }}>{title || FEATURE_NAMES[k]} غير مفعّلة</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        ميزة «{FEATURE_NAMES[k]}» موقّفة حالياً، فما تظهر للعملاء في الموقع والتطبيق.
        {admin ? ' تقدر تشغّلها من صفحة المميزات.' : ' اطلب من المدير يشغّلها من صفحة المميزات.'}
      </p>
      {admin && <Link className="btn btn-primary" to="/admin/features">فتح المميزات</Link>}
    </div>
  )
}
