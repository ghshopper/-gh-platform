import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useAppData } from '@/appdata';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import type { Category } from '@/types';
import { Empty, Header, Photo, T } from '@/ui';

export default function Categories() {
  const { tr, pick, isAr } = useLang();
  const { categories } = useAppData();
  const open = (c: Category) => router.push({ pathname: '/products', params: { category_id: String(c.id), title: pick(c, 'name') } });
  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('الأقسام', 'Categories')} />
      <ScrollView contentContainerStyle={{ padding: S.gutter, gap: 18, paddingBottom: 40 }}>
        {categories.length === 0 ? <Empty title={tr('لا توجد أقسام حالياً', 'No categories yet')} /> : null}
        {categories.map((c) => (
          <View key={c.id} style={{ gap: 10 }}>
            <Pressable onPress={() => open(c)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Photo path={c.image || c.icon} label={c.name_en ?? ''} style={{ width: 84, height: 100 }} />
              <T size={17} w="medium" style={{ flex: 1 }}>{pick(c, 'name')}</T>
              <Icon name="forward" size={16} color={C.faint} flip={isAr} />
            </Pressable>
            {(c.children ?? []).length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(c.children ?? []).map((ch) => (
                  <Pressable key={ch.id} onPress={() => open(ch)} style={{ borderWidth: 1, borderColor: C.lineStrong, paddingHorizontal: 14, height: 36, justifyContent: 'center' }}>
                    <T size={13}>{pick(ch, 'name')}</T>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
