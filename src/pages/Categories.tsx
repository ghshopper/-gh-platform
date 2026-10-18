import { Link } from 'react-router-dom';
import { useTitle } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import { useData } from '../lib/store';
import { CategoryArt } from '../components/CategoryArt';

export default function Categories() {
  const { tr, pick } = usePrefs();
  useTitle(tr('الأقسام', 'Categories'));
  const { categories } = useData();
  return (
    <div className="container page">
      <header className="page-head center"><span className="kicker">CATEGORIES</span><h1>{tr('الأقسام', 'Categories')}</h1></header>
      <div className="cats-page">
        {categories.map((c, i) => (
          <section key={c.id} className="cat-block">
            <Link to={`/shop?category=${c.id}`}><CategoryArt c={c} index={i} /></Link>
            {c.children?.length ? (
              <div className="cat-children">
                {c.children.map((ch) => <Link key={ch.id} to={`/shop?category=${ch.id}`} className="chip">{pick(ch, 'name')}</Link>)}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
