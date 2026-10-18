import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppData } from '@/appdata';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C, F, S } from '@/theme';
import { Empty, T } from '@/ui';

/** Designers A–Z, the way luxury apps list them. */
export default function BrandsTab() {
  const insets = useSafeAreaInsets();
  const { tr, isAr } = useLang();
  const app = useAppData();
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = app.brands
      .filter((b) => !needle || `${b.name_en ?? ''} ${b.name_ar ?? ''}`.toLowerCase().includes(needle))
      .sort((a, b) => (a.name_en ?? a.name_ar ?? '').localeCompare(b.name_en ?? b.name_ar ?? ''));
    const groups = new Map<string, typeof list>();
    for (const b of list) {
      const letter = (b.name_en ?? b.name_ar ?? '#').trim().charAt(0).toUpperCase() || '#';
      groups.set(letter, [...(groups.get(letter) ?? []), b]);
    }
    return [...groups.entries()].map(([title, data]) => ({ title, data }));
  }, [app.brands, q]);

  return (
    <View style={{ flex: 1, backgroundColor: C.white, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: S.gutter, paddingTop: 10, gap: 12 }}>
        <T size={26} w="medium">{tr('البراندات', 'Brands')}</T>
        <View style={{ height: 46, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
          <Icon name="search" size={18} />
          <TextInput value={q} onChangeText={setQ} placeholder={tr('ابحث عن براند', 'Search brands')} placeholderTextColor={C.faint}
            style={{ flex: 1, fontFamily: F.regular, fontSize: 14, color: C.ink }} />
        </View>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(b) => String(b.id)}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await app.reload().catch(() => undefined); setRefreshing(false); }} />}
        renderSectionHeader={({ section }) => (
          <View style={{ backgroundColor: C.white, paddingHorizontal: S.gutter, paddingTop: 18, paddingBottom: 6 }}>
            <T latin w="medium" size={13} spacing={2}>{section.title}</T>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/brand/[id]', params: { id: String(item.id) } })} accessibilityRole="button"
            style={({ pressed }) => ({ marginHorizontal: S.gutter, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: C.line, opacity: pressed ? 0.6 : 1 })}>
            <View style={{ flex: 1 }}>
              <T latin w="medium" size={13} spacing={1.8}>{(item.name_en ?? '').toUpperCase()}</T>
              {item.name_ar ? <T size={12} color={C.muted}>{item.name_ar}</T> : null}
            </View>
            <Icon name="forward" size={16} color={C.faint} flip={isAr} />
          </Pressable>
        )}
        ListEmptyComponent={<Empty icon="brands" title={tr('لا توجد ماركات', 'No brands')} />}
      />
    </View>
  );
}
