export type IconName =
  | 'search' | 'bag' | 'bagAdd' | 'heart' | 'heartFill' | 'user' | 'close' | 'menu' | 'plus' | 'minus' | 'trash'
  | 'forward' | 'back' | 'down' | 'check' | 'filter' | 'globe' | 'moon' | 'sun' | 'whatsapp' | 'instagram' | 'tag'
  | 'truck' | 'shield' | 'lock' | 'gift' | 'camera' | 'crown' | 'pin' | 'doc' | 'box' | 'star' | 'info';

export function Icon({ name, size = 20, stroke = 1.4, className, fill }: { name: IconName; size?: number; stroke?: number; className?: string; fill?: string }) {
  const p = { stroke: 'currentColor', strokeWidth: stroke, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      {name === 'search' && (<><circle cx={11} cy={11} r={7} {...p} /><path d="M20 20l-3.5-3.5" {...p} /></>)}
      {name === 'bag' && (<><path d="M5 8h14l-1 13H6L5 8z" {...p} /><path d="M9 8V6a3 3 0 0 1 6 0v2" {...p} /></>)}
      {name === 'bagAdd' && (<><path d="M5 8h14l-1 13H6L5 8z" {...p} /><path d="M9 8V6a3 3 0 0 1 6 0v2" {...p} /><path d="M12 11.5v6M9 14.5h6" {...p} /></>)}
      {name === 'heart' && <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...p} />}
      {name === 'heartFill' && <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...p} fill={fill ?? 'currentColor'} />}
      {name === 'user' && (<><circle cx={12} cy={8} r={4} {...p} /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...p} /></>)}
      {name === 'close' && <path d="M6 6l12 12M18 6L6 18" {...p} />}
      {name === 'menu' && <path d="M4 7h16M4 12h16M4 17h16" {...p} />}
      {name === 'plus' && <path d="M12 5v14M5 12h14" {...p} />}
      {name === 'minus' && <path d="M5 12h14" {...p} />}
      {name === 'trash' && <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" {...p} />}
      {name === 'forward' && <path d="M9 6l6 6-6 6" {...p} />}
      {name === 'back' && <path d="M15 6l-6 6 6 6" {...p} />}
      {name === 'down' && <path d="M6 9l6 6 6-6" {...p} />}
      {name === 'check' && <path d="M5 12.5l4.5 4.5L19 7" {...p} />}
      {name === 'filter' && <path d="M4 6h16M7 12h10M10 18h4" {...p} />}
      {name === 'globe' && (<><circle cx={12} cy={12} r={9} {...p} /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" {...p} /></>)}
      {name === 'moon' && <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" {...p} />}
      {name === 'sun' && (<><circle cx={12} cy={12} r={4} {...p} /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" {...p} /></>)}
      {name === 'whatsapp' && (<><path d="M4 20l1.3-4A8 8 0 1 1 8 19z" {...p} /><path d="M9 9.5c.5 2.5 2.5 4.5 5 5l1.2-1.2 1.8.8-.4 1.6c-3.8.2-8-4-7.8-7.8l1.6-.4.8 1.8z" {...p} /></>)}
      {name === 'instagram' && (<><rect x={4} y={4} width={16} height={16} rx={4.5} {...p} /><circle cx={12} cy={12} r={3.6} {...p} /><circle cx={16.8} cy={7.2} r={0.6} {...p} /></>)}
      {name === 'tag' && (<><path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5z" {...p} /><circle cx={8} cy={8.5} r={1.4} {...p} /></>)}
      {name === 'truck' && (<><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" {...p} /><circle cx={7} cy={17.5} r={1.6} {...p} /><circle cx={17} cy={17.5} r={1.6} {...p} /></>)}
      {name === 'shield' && (<><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" {...p} /><path d="M9 12l2 2 4-4" {...p} /></>)}
      {name === 'lock' && (<><rect x={5} y={10} width={14} height={10} {...p} /><path d="M8 10V7a4 4 0 0 1 8 0v3" {...p} /></>)}
      {name === 'gift' && (<><rect x={4} y={9} width={16} height={11} {...p} /><path d="M3 6h18v3H3zM12 6v14M12 6c-2-4-6-3-5 0M12 6c2-4 6-3 5 0" {...p} /></>)}
      {name === 'camera' && (<><path d="M4 8h3l2-3h6l2 3h3v11H4z" {...p} /><circle cx={12} cy={13} r={3.5} {...p} /></>)}
      {name === 'crown' && <path d="M4 18h16M5 15l-1-8 5 4 3-6 3 6 5-4-1 8z" {...p} />}
      {name === 'pin' && (<><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" {...p} /><circle cx={12} cy={9} r={2.5} {...p} /></>)}
      {name === 'doc' && <path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7" {...p} />}
      {name === 'box' && <path d="M4 8l8-4 8 4v9l-8 4-8-4zM4 8l8 4 8-4M12 12v9" {...p} />}
      {name === 'star' && <path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z" {...p} />}
      {name === 'info' && (<><circle cx={12} cy={12} r={9} {...p} /><path d="M12 11v5M12 8v.5" {...p} /></>)}
    </svg>
  );
}
