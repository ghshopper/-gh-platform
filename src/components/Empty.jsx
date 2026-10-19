import { RiInboxLine } from 'react-icons/ri'

/** One empty state for every list: an icon, what's missing, and what to do next. */
export default function Empty({ icon: Icon = RiInboxLine, title = 'ما فيه شي هنا للحين', hint, action, onAction, compact }) {
  return (
    <div className={`gh-empty ${compact ? 'compact' : ''}`}>
      <div className="gh-empty-ic"><Icon size={compact ? 20 : 26} /></div>
      <div className="gh-empty-title">{title}</div>
      {hint && <div className="gh-empty-hint">{hint}</div>}
      {action && <button className="btn btn-sm btn-primary" onClick={onAction}>{action}</button>}
    </div>
  )
}

/** The same, as a table row. */
export function EmptyRow({ cols = 6, ...p }) {
  return <tr className="gh-empty-row"><td colSpan={cols}><Empty compact {...p} /></td></tr>
}
