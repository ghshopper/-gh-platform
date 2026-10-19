import { TextInput, View } from 'react-native';
import { useLang } from './lang';
import { C, F } from './theme';
import type { ProductAttribute } from './types';
import { T } from './ui';

/** "Engraving" option: the customer types the text (optional unless required). */
export function EngraveInput({ attr, label, value, onChange }: { attr: ProductAttribute; label: string; value: string; onChange: (v: string) => void }) {
  const { tr } = useLang();
  const max = attr.max_length || 12;
  return (
    <View style={{ gap: 10 }}>
      <T size={13} color={C.sub}>{label} · {attr.required ? tr('مطلوب', 'required') : tr('اختياري', 'optional')}</T>
      <TextInput
        value={value}
        onChangeText={onChange}
        maxLength={max}
        placeholder={tr(`اكتب النص (حتى ${max} حرف)`, `Your text (up to ${max} characters)`)}
        placeholderTextColor={C.faint}
        style={{ height: 46, borderWidth: 1, borderColor: C.lineStrong, paddingHorizontal: 14, fontFamily: F.regular, fontSize: 15, letterSpacing: 2, color: C.ink }}
      />
    </View>
  );
}
