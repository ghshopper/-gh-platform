import { useEffect, useState } from 'react'
import api from '../services/api'

/**
 * The customer features the owner switches on/off (المميزات).
 * Every staff member may read the public flags (GET /app/features);
 * only full admins change them (GET/PUT /admin/features).
 */
export const FEATURE_NAMES = {
  wishlist_alerts: 'تنبيهات المفضلة',
  quotes: 'عروض أسعار القطع',
  smart_push: 'إشعارات ذكية',
  wallet: 'محفظة GH',
  gifts: 'إرسال هدية',
  vip_progress: 'مستوى VIP',
  purchase_photos: 'صور القطعة من المحل',
  reviews: 'التقييمات',
  chat: 'المحادثة المباشرة',
  weekly_new: 'جديدنا هذا الأسبوع',
}

let cache = null
let inflight = null
const listeners = new Set()
const unwrap = (d) => (d && typeof d === 'object' && d.data && typeof d.data === 'object' && !Array.isArray(d.data) && !('on' in d.data) ? d.data : d)

export function loadFeatures(force = false) {
  if (cache && !force) return Promise.resolve(cache)
  if (inflight && !force) return inflight
  inflight = api.get('/app/features')
    .then((r) => { cache = unwrap(r.data) || {}; listeners.forEach((f) => f(cache)); return cache })
    .catch(() => { cache = cache || {}; return cache })
    .finally(() => { inflight = null })
  return inflight
}

/** After the features page saves: everyone on the page sees the new switches. */
export function setFeatures(next) {
  cache = unwrap(next) || {}
  listeners.forEach((f) => f(cache))
}

/** null while loading, then the features object. */
export function useFeatures() {
  const [f, setF] = useState(cache)
  useEffect(() => {
    listeners.add(setF)
    loadFeatures().then(setF)
    return () => { listeners.delete(setF) }
  }, [])
  return f
}

/** True / false; while loading: undefined. A missing key counts as off. */
export function useFeature(key) {
  const f = useFeatures()
  if (!f) return undefined
  return !!f[key]?.on
}
