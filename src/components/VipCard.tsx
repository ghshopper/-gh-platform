import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { num } from '../lib/format';
import { useLoad } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import { useAuth, useFeature } from '../lib/store';
import type { LoyaltyBalance, TierInfo } from '../lib/types';
import { Icon } from './Icon';

/** The tier look follows the existing member card (beige / burgundy / black). */
export function tierClass(name?: string | null): string {
  const n = name ?? '';
  return /beige|بيج/i.test(n) ? 'tier-beige' : /black|أسود|اسود/i.test(n) ? 'tier-black' : 'tier-burgundy';
}

/** VIP progress (feature vip_progress): current tier, bar to the next, its benefits. */
export function VipCard({ compact, link }: { compact?: boolean; link?: boolean }) {
  const flag = useFeature('vip_progress');
  const { user } = useAuth();
  const { tr, pick, isAr } = usePrefs();
  const data = useLoad(async () => {
    if (!user || !flag) return null;
    const [bal, tiers] = await Promise.all([
      api.get<LoyaltyBalance>('/customer/loyalty/balance'),
      api.get<{ data?: TierInfo[] }>('/customer/loyalty/tiers').then((r) => r?.data ?? []).catch(() => [] as TierInfo[]),
    ]);
    return { bal, tiers };
  }, [user?.id, !!flag]);
  if (!flag || !user || !data.data) return null;
  const { bal, tiers } = data.data;
  const byId = (id?: number | null) => tiers.find((t) => t.id === id) ?? null;
  const tier = bal.tier ?? byId(bal.tier_id);
  const next = bal.next_tier !== undefined ? bal.next_tier : byId(bal.next_tier_id);
  if (!tier && !next) return null;
  const pts = num(bal.tier_points);
  const toNext = Math.max(0, num(bal.to_next, next ? num(next.min_points) - pts : 0));
  const progress = (() => {
    if (typeof bal.progress === 'number') return Math.max(0, Math.min(1, bal.progress));
    if (!next) return 1;
    const from = tier ? num(tier.min_points) : 0;
    const span = num(next.min_points) - from;
    return span > 0 ? Math.max(0, Math.min(1, (pts - from) / span)) : 0;
  })();
  const tierName = tier ? pick(tier, 'name') : tr('عضو', 'Member');
  const nextName = next ? pick(next, 'name') : '';
  const benefits = next ? (isAr ? next.benefits_ar || next.benefits_en : next.benefits_en || next.benefits_ar) ?? '' : (tier ? (isAr ? tier.benefits_ar || tier.benefits_en : tier.benefits_en || tier.benefits_ar) ?? '' : '');
  const list = benefits.split(/\n|•|·|،(?=\s)/).map((x) => x.trim()).filter(Boolean).slice(0, compact ? 2 : 4);

  return (
    <div className={`vip-card ${tierClass(tier?.name ?? tier?.name_ar)}${compact ? ' compact' : ''}`} style={tier?.color ? ({ ['--tier' as string]: tier.color } as React.CSSProperties) : undefined}>
      <div className="vip-top">
        <span className="kicker gold"><Icon name="crown" size={14} /> GH VIP</span>
        <b className="vip-tier">{tierName}</b>
      </div>
      <div className="vip-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="vip-meta">
        {next ? (
          <span>{tr(`باقي لك ${toNext.toLocaleString('en-US')} نقطة لـ ${nextName}`, `${toNext.toLocaleString('en-US')} points to ${nextName}`)}</span>
        ) : (
          <span>{tr('وصلت لأعلى مستوى 🖤', 'You are at the top tier 🖤')}</span>
        )}
        <span className="num">{pts.toLocaleString('en-US')} pts</span>
      </div>
      {list.length ? (
        <div className="vip-benefits">
          <small>{next ? tr(`مزايا ${nextName}`, `${nextName} benefits`) : tr('مزاياك', 'Your benefits')}</small>
          <ul>{list.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
      ) : null}
      {link ? <Link to="/account" className="vip-link">{tr('حسابي', 'My account')} <Icon name={isAr ? 'back' : 'forward'} size={14} /></Link> : null}
    </div>
  );
}
