/** Categories grouped by section (Beauty / Fashion / Gifts), sub-categories indented. */
export function catTree(categories) {
  const kids = (id) => categories.filter(c => Number(c.parent_id) === Number(id))
  const roots = categories.filter(c => !c.parent_id)
  return roots.map(sec => {
    const children = kids(sec.id)
    if (!children.length) return <option key={sec.id} value={sec.id}>{sec.name_ar}</option>
    return (
      <optgroup key={'g' + sec.id} label={sec.name_ar}>
        {children.flatMap(c => [
          <option key={c.id} value={c.id}>{c.name_ar}</option>,
          ...kids(c.id).map(g => <option key={g.id} value={g.id}>{'\u00a0\u00a0— ' + g.name_ar}</option>),
        ])}
      </optgroup>
    )
  })
}

