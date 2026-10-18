import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { C } from './theme';

export type IconName =
  | 'search' | 'bell' | 'bag' | 'heart' | 'heartFill' | 'user' | 'home' | 'brands' | 'camera'
  | 'forward' | 'back' | 'close' | 'trash' | 'plus' | 'minus' | 'share' | 'whatsapp' | 'phone'
  | 'check' | 'pin' | 'receipt' | 'doc' | 'globe' | 'logout' | 'gift' | 'star' | 'starFill' | 'filter'
  | 'sort' | 'shield' | 'truck' | 'lock' | 'edit' | 'box' | 'crown' | 'chat' | 'info' | 'down' | 'locate'
  | 'bagAdd' | 'moon' | 'tag' | 'instagram' | 'grid' | 'card';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  stroke?: number;
  /** Mirror for right-to-left (arrows). */
  flip?: boolean;
}

/** Thin line icons drawn to match the design (1.3–1.6 stroke, no fills). */
export function Icon({ name, size = 22, color = C.ink, stroke = 1.4, flip }: Props) {
  const p = { stroke: color, strokeWidth: stroke, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const t = flip ? [{ scaleX: -1 }] : undefined;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={t ? { transform: t } : undefined}>
      {name === 'bagAdd' && (<><Path d="M5 8h14l-1 13H6L5 8z" {...p} /><Path d="M9 8V6a3 3 0 0 1 6 0v2" {...p} /><Path d="M12 11.5v6M9 14.5h6" {...p} /></>)}
      {name === 'moon' && <Path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" {...p} />}
      {name === 'tag' && (<><Path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5z" {...p} /><Circle cx={8} cy={8.5} r={1.4} {...p} /></>)}
      {name === 'instagram' && (<><Rect x={4} y={4} width={16} height={16} rx={4.5} {...p} /><Circle cx={12} cy={12} r={3.6} {...p} /><Circle cx={16.8} cy={7.2} r={0.6} {...p} fill={color} /></>)}
      {name === 'grid' && (<><Rect x={4} y={4} width={6.5} height={6.5} {...p} /><Rect x={13.5} y={4} width={6.5} height={6.5} {...p} /><Rect x={4} y={13.5} width={6.5} height={6.5} {...p} /><Rect x={13.5} y={13.5} width={6.5} height={6.5} {...p} /></>)}
      {name === 'card' && (<><Rect x={3} y={6} width={18} height={12} {...p} /><Path d="M3 10h18M7 15h4" {...p} /></>)}
      {name === 'search' && (<><Circle cx={11} cy={11} r={7} {...p} /><Path d="M20 20l-3.5-3.5" {...p} /></>)}
      {name === 'bell' && (<><Path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" {...p} /><Path d="M10 20a2 2 0 0 0 4 0" {...p} /></>)}
      {name === 'bag' && (<><Path d="M5 8h14l-1 13H6L5 8z" {...p} /><Path d="M9 8V6a3 3 0 0 1 6 0v2" {...p} /></>)}
      {name === 'heart' && <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...p} />}
      {name === 'heartFill' && <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...p} fill={color} />}
      {name === 'user' && (<><Circle cx={12} cy={8} r={4} {...p} /><Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...p} /></>)}
      {name === 'home' && <Path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" {...p} />}
      {name === 'brands' && (<><Rect x={5} y={5} width={14} height={14} {...p} /><Path d="M9 9h6M9 12h6M9 15h4" {...p} /></>)}
      {name === 'camera' && (<><Path d="M4 8h3l2-3h6l2 3h3v11H4z" {...p} /><Circle cx={12} cy={13} r={3.5} {...p} /></>)}
      {name === 'forward' && <Path d="M9 6l6 6-6 6" {...p} />}
      {name === 'back' && <Path d="M15 6l-6 6 6 6" {...p} />}
      {name === 'down' && <Path d="M6 9l6 6 6-6" {...p} />}
      {name === 'close' && <Path d="M6 6l12 12M18 6L6 18" {...p} />}
      {name === 'trash' && <Path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13" {...p} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...p} />}
      {name === 'minus' && <Path d="M5 12h14" {...p} />}
      {name === 'share' && <Path d="M12 3v12M8 7l4-4 4 4M5 13v6h14v-6" {...p} />}
      {name === 'whatsapp' && <Path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" {...p} />}
      {name === 'phone' && <Path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" {...p} />}
      {name === 'check' && <Path d="M5 12l4 4 10-10" {...p} />}
      {name === 'pin' && (<><Path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" {...p} /><Circle cx={12} cy={10} r={2.5} {...p} /></>)}
      {name === 'locate' && (<><Circle cx={12} cy={12} r={7} {...p} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3" {...p} /></>)}
      {name === 'receipt' && (<><Path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" {...p} /><Path d="M9 8h6M9 12h6" {...p} /></>)}
      {name === 'doc' && (<><Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" {...p} /><Path d="M14 2v6h6M8 13h8M8 17h5" {...p} /></>)}
      {name === 'globe' && (<><Circle cx={12} cy={12} r={9} {...p} /><Path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" {...p} /></>)}
      {name === 'logout' && (<><Path d="M15 4h4v16h-4" {...p} /><Path d="M10 8l-4 4 4 4M6 12h10" {...p} /></>)}
      {name === 'gift' && (<><Rect x={4} y={9} width={16} height={11} {...p} /><Path d="M3 9h18M12 9v11M12 9c-2-4-6-4-6-1.5S10 9 12 9c2 0 6 0 6-1.5S14 5 12 9" {...p} /></>)}
      {name === 'star' && <Path d="M12 4l2.5 5 5.5.8-4 3.9.9 5.5L12 16.6 7.1 19.2l.9-5.5-4-3.9 5.5-.8z" {...p} />}
      {name === 'starFill' && <Path d="M12 4l2.5 5 5.5.8-4 3.9.9 5.5L12 16.6 7.1 19.2l.9-5.5-4-3.9 5.5-.8z" {...p} fill={color} />}
      {name === 'filter' && <Path d="M4 6h16M7 12h10M10 18h4" {...p} />}
      {name === 'sort' && <Path d="M8 4v16M8 20l-3-3M8 20l3-3M16 20V4M16 4l-3 3M16 4l3 3" {...p} />}
      {name === 'shield' && (<><Path d="M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6z" {...p} /><Path d="M9 12l2 2 4-4" {...p} /></>)}
      {name === 'truck' && (<><Path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" {...p} /><Circle cx={7} cy={17.5} r={1.5} {...p} /><Circle cx={17} cy={17.5} r={1.5} {...p} /></>)}
      {name === 'lock' && (<><Rect x={5} y={11} width={14} height={9} {...p} /><Path d="M8 11V8a4 4 0 0 1 8 0v3" {...p} /></>)}
      {name === 'edit' && <Path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" {...p} />}
      {name === 'box' && (<><Path d="M3 7l9-4 9 4v10l-9 4-9-4z" {...p} /><Path d="M3 7l9 4 9-4M12 11v10" {...p} /></>)}
      {name === 'crown' && <Path d="M4 18h16M4 18l-1-10 5 4 4-6 4 6 5-4-1 10" {...p} />}
      {name === 'chat' && <Path d="M4 5h16v11H9l-5 4z" {...p} />}
      {name === 'info' && (<><Circle cx={12} cy={12} r={9} {...p} /><Path d="M12 11v6M12 7.5v.5" {...p} /></>)}
    </Svg>
  );
}
