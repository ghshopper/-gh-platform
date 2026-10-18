import { Image } from 'expo-image';
import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { imageUrl } from './api';
import { omr } from './format';
import { Icon, type IconName } from './icons';
import { useLang } from './lang';
import { C, F, S } from './theme';

type Weight = 'light' | 'regular' | 'medium' | 'semibold';

interface TProps {
  children?: ReactNode;
  size?: number;
  w?: Weight;
  color?: string;
  /** Latin face (brand names, prices). */
  latin?: boolean;
  serif?: boolean;
  center?: boolean;
  /** Force left-to-right (numbers, emails). */
  ltr?: boolean;
  spacing?: number;
  lines?: number;
  lh?: number;
  style?: StyleProp<TextStyle>;
  onPress?: () => void;
}

/**
 * All text in the app. Alignment is left natural so it follows the layout
 * direction (right in Arabic, left in English) on both platforms; `ltr`
 * pieces (numbers, emails) are isolated so their own order is kept.
 */
export function T({ children, size = 14, w = 'regular', color = C.ink, latin, serif, center, ltr, spacing, lines, lh, style, onPress }: TProps) {
  const { isAr } = useLang();
  const fontFamily = serif
    ? F.serifItalic
    : latin
      ? w === 'medium' || w === 'semibold' ? F.latinMedium : F.latin
      : F[w];
  const align: TextStyle['textAlign'] | undefined = center ? 'center' : undefined;
  const body = ltr && isAr && (typeof children === 'string' || typeof children === 'number') ? `\u2066${children}\u2069` : children;
  return (
    <Text
      onPress={onPress}
      numberOfLines={lines}
      style={[
        {
          fontFamily,
          fontSize: size,
          color,
          textAlign: align,
          writingDirection: isAr ? 'rtl' : 'ltr',
          letterSpacing: spacing,
          lineHeight: lh ?? Math.round(size * (latin ? 1.35 : 1.6)),
        },
        style,
      ]}
    >
      {body}
    </Text>
  );
}

/** Brand name in tracked capitals. */
export function BrandText({ children, size = 11.5, style }: { children: string; size?: number; style?: StyleProp<TextStyle> }) {
  return (
    <T latin w="medium" size={size} spacing={1.6} lines={1} style={style}>
      {children.toUpperCase()}
    </T>
  );
}

export function Price({ value, was, size = 13 }: { value: number; was?: number | null; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <T latin size={size}>{omr(value)}</T>
      {was ? (
        <T latin size={size - 1.5} color={C.faint} style={{ textDecorationLine: 'line-through' }}>
          {omr(was)}
        </T>
      ) : null}
    </View>
  );
}

interface BtnProps {
  label: string;
  onPress?: () => void;
  kind?: 'solid' | 'outline' | 'link';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  height?: number;
}

export function Btn({ label, onPress, kind = 'solid', icon, loading, disabled, style, height = 52 }: BtnProps) {
  const solid = kind === 'solid';
  const off = disabled || loading;
  if (kind === 'link') {
    return (
      <Pressable onPress={onPress} disabled={off} hitSlop={10} accessibilityRole="button" style={style}>
        <T size={13} style={{ textDecorationLine: 'underline' }}>{label}</T>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal: 20,
          backgroundColor: solid ? C.ink : C.white,
          borderWidth: solid ? 0 : 1,
          borderColor: C.ink,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: off ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={solid ? C.white : C.ink} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={solid ? C.white : C.ink} stroke={1.6} /> : null}
          <T size={15} color={solid ? C.white : C.ink} center>{label}</T>
        </>
      )}
    </Pressable>
  );
}

export function IconBtn({ name, onPress, label, size = 22, color = C.ink, badge, flip, style }: {
  name: IconName; onPress?: () => void; label: string; size?: number; color?: string; badge?: number; flip?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Icon name={name} size={size} color={color} flip={flip} />
      {badge ? (
        <View style={{ position: 'absolute', top: 6, left: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
          <Text style={{ color: C.white, fontFamily: F.latin, fontSize: 9.5 }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Top bar for pushed screens: back · title · optional action. */
export function Header({ title, latinTitle, right, onBack, close }: { title?: string; latinTitle?: string; right?: ReactNode; onBack?: () => void; close?: boolean }) {
  const insets = useSafeAreaInsets();
  const { isAr, tr } = useLang();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.line }}>
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }}>
        <View style={{ width: 52 }}>
          <IconBtn name={close ? 'close' : 'back'} flip={!close && isAr} label={close ? tr('إغلاق', 'Close') : tr('رجوع', 'Back')} onPress={back} />
        </View>
        <View style={{ flex: 1 }}>
          {latinTitle ? (
            <T latin w="medium" size={13} spacing={2.5} center lines={1}>{latinTitle}</T>
          ) : (
            <T size={16} w="medium" center lines={1}>{title}</T>
          )}
        </View>
        <View style={{ width: 52, alignItems: 'flex-end' }}>{right}</View>
      </View>
    </View>
  );
}

export function SectionTitle({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: S.gutter, marginBottom: 14 }, style]}>
      <T size={17} w="medium">{title}</T>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <T size={12.5} color={C.sub} style={{ textDecorationLine: 'underline' }}>{action}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Small tracked Latin label above a heading ("NEW IN · وصل حديثاً"). */
export function Kicker({ children, color = C.muted, center }: { children: string; color?: string; center?: boolean }) {
  return <T latin size={11} spacing={3} color={color} center={center}>{children}</T>;
}

export function Loader({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ padding: 40, alignItems: 'center', justifyContent: 'center' }, style]}>
      <ActivityIndicator color={C.ink} />
    </View>
  );
}

export function Empty({ icon = 'box', title, text, action, onAction }: { icon?: IconName; title: string; text?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ paddingVertical: 70, paddingHorizontal: 36, alignItems: 'center', gap: 10 }}>
      <Icon name={icon} size={34} color={C.faint} stroke={1.2} />
      <T size={17} w="medium" center>{title}</T>
      {text ? <T size={13.5} color={C.muted} center>{text}</T> : null}
      {action ? <Btn label={action} onPress={onAction} kind="outline" height={46} style={{ marginTop: 10, minWidth: 180 }} /> : null}
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { tr } = useLang();
  return <Empty icon="info" title={message} action={onRetry ? tr('إعادة المحاولة', 'Try again') : undefined} onAction={onRetry} />;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: C.line }, style]} />;
}

/** Underlined form field like the design. */
export function Field({ label, error, style, ltr: _ltr, ...rest }: TextInputProps & { label: string; error?: string | null; ltr?: boolean; style?: StyleProp<ViewStyle> }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ gap: 4 }, style]}>
      <T size={12.5} color={C.sub}>{label}</T>
      <TextInput
        placeholderTextColor={C.faint}
        {...rest}
        onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
        style={{
          fontFamily: F.regular,
          fontSize: 15,
          color: C.ink,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: error ? C.red : focus ? C.ink : C.lineStrong,
          minHeight: rest.multiline ? 70 : undefined,
          textAlignVertical: rest.multiline ? 'top' : 'center',
        }}
      />
      {error ? <T size={12} color={C.red}>{error}</T> : null}
    </View>
  );
}

/** Product image or a quiet placeholder with the brand. */
export function Photo({ path, style, label, contain }: { path?: string | null; style?: StyleProp<ViewStyle>; label?: string; contain?: boolean }) {
  const url = imageUrl(path);
  return (
    <View style={[{ backgroundColor: C.surface, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit={contain ? 'contain' : 'cover'} transition={200} cachePolicy="memory-disk" />
      ) : label ? (
        <T latin size={10} spacing={2} color={C.placeholder} center>{label.toUpperCase()}</T>
      ) : null}
    </View>
  );
}

/** Row in a settings-style list. */
export function Row({ icon, title, subtitle, value, onPress, danger, chevron = true }: {
  icon?: IconName; title: string; subtitle?: string; value?: string; onPress?: () => void; danger?: boolean; chevron?: boolean;
}) {
  const { isAr } = useLang();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line, opacity: pressed ? 0.6 : 1 })}>
      {icon ? <Icon name={icon} size={21} color={danger ? C.red : C.ink} stroke={1.3} /> : null}
      <View style={{ flex: 1 }}>
        <T size={15} color={danger ? C.red : C.ink}>{title}</T>
        {subtitle ? <T size={12} color={C.muted}>{subtitle}</T> : null}
      </View>
      {value ? <T size={13} color={C.muted}>{value}</T> : null}
      {onPress && chevron ? <Icon name="forward" size={16} color={C.faint} flip={isAr} /> : null}
    </Pressable>
  );
}

/** Two- or three-way segmented control (flat, like the design). */
export function Segments<K extends string>({ value, options, onChange }: { value: K; options: { key: K; label: string }[]; onChange: (k: K) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.surface, padding: 3 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="radio" accessibilityState={{ checked: on }}
            style={{ flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.bg : 'transparent', shadowColor: C.black, shadowOpacity: on ? 0.08 : 0, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }}>
            <T size={13} color={on ? C.ink : C.sub} center>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Check({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
      <View style={{ width: 22, height: 22, borderWidth: 1, borderColor: on ? C.ink : C.lineStrong, backgroundColor: on ? C.ink : C.white, alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Icon name="check" size={15} color={C.white} stroke={2} /> : null}
      </View>
      <T size={14.5} style={{ flex: 1 }}>{label}</T>
    </Pressable>
  );
}

/** Label and amount on one line (order summaries). */
export function SummaryRow({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <T size={strong ? 15 : 13.5} w={strong ? 'medium' : 'regular'} color={color ?? (strong ? C.ink : C.sub)}>{label}</T>
      <T latin size={strong ? 15 : 13.5} w={strong ? 'medium' : 'regular'} color={color ?? (strong ? C.ink : C.sub)}>{value}</T>
    </View>
  );
}

