import { num } from '../lib/format';
import type { Product } from '../lib/types';

/** The rating from approved reviews (rating_avg/rating_count; older payloads: reviews_avg_rating/reviews_count). */
export function productRating(p: Product): { avg: number; count: number } {
  const avg = num(p.rating_avg ?? p.reviews_avg_rating);
  const count = num(p.rating_count ?? p.reviews_count);
  return { avg, count };
}

/** Five gold stars filled to the average (partial stars by width). */
export function Stars({ value, size = 13, count, label }: { value: number; size?: number; count?: number; label?: string }) {
  const v = Math.max(0, Math.min(5, value));
  return (
    <span className="rstars" style={{ fontSize: size }} aria-label={label ?? `${v.toFixed(1)} / 5`} role="img">
      <span className="rstars-track" aria-hidden>
        ★★★★★
        <span className="rstars-fill" style={{ width: `${(v / 5) * 100}%` }}>★★★★★</span>
      </span>
      {count !== undefined ? <span className="rstars-n num">{v.toFixed(1)}{count ? ` (${count})` : ''}</span> : null}
    </span>
  );
}
