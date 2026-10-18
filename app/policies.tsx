import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useAppData } from '@/appdata';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import { Empty, Header, T } from '@/ui';

function strip(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

export default function Policies() {
  const { tr, pick } = useLang();
  const { policies } = useAppData();
  const [open, setOpen] = useState<number | null>(policies[0]?.id ?? null);
  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('الشروط والسياسات', 'Terms & policies')} />
      <ScrollView contentContainerStyle={{ padding: S.gutter, paddingBottom: 40 }}>
        {policies.length === 0 ? <Empty icon="info" title={tr('لا توجد سياسات منشورة', 'No policies published')} /> : null}
        {policies.map((p) => (
          <View key={p.id} style={{ borderBottomWidth: 1, borderBottomColor: C.line }}>
            <Pressable onPress={() => setOpen(open === p.id ? null : p.id)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56 }} accessibilityRole="button" accessibilityState={{ expanded: open === p.id }}>
              <T size={15} style={{ flex: 1 }}>{pick(p, 'title') || p.type}</T>
              <Icon name={open === p.id ? 'minus' : 'plus'} size={16} color={C.gold} />
            </Pressable>
            {open === p.id ? <T size={13.5} color={C.sub} style={{ paddingBottom: 18 }}>{strip(pick(p, 'content'))}</T> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
