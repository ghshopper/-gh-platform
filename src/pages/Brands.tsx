import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTitle } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import { useData } from '../lib/store';

export default function Brands() {
  const { tr } = usePrefs();
  useTitle(tr('البراندات', 'Designers'));
  const { brands } = useData();
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const list = brands
      .map((b) => ({ id: b.id, en: (b.name_en || b.name_ar || '').trim(), ar: (b.name_ar || '').trim() }))
      .filter((b) => !q || b.en.toLowerCase().includes(q.toLowerCase()) || b.ar.includes(q))
      .sort((a, b) => a.en.localeCompare(b.en));
    const map = new Map<string, typeof list>();
    for (const b of list) {
      const k = /^[a-z]/i.test(b.en) ? b.en[0].toUpperCase() : '#';
      map.set(k, [...(map.get(k) ?? []), b]);
    }
    return [...map.entries()];
  }, [brands, q]);
  return (
    <div className="container page">
      <header className="page-head center">
        <span className="kicker">DESIGNERS A–Z</span>
        <h1>{tr('البراندات', 'Designers')}</h1>
        <input className="field-line" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('ابحث عن براند', 'Search designers')} />
        <div className="az">{groups.map(([k]) => <a key={k} href={`#az-${k}`}>{k}</a>)}</div>
      </header>
      <div className="az-groups">
        {groups.map(([k, list]) => (
          <section key={k} id={`az-${k}`} className="az-group">
            <h2 className="l">{k}</h2>
            <div>{list.map((b) => <Link key={b.id} to={`/brand/${b.id}`}><b>{b.en.toUpperCase()}</b>{b.ar && b.ar !== b.en ? <span>{b.ar}</span> : null}</Link>)}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
