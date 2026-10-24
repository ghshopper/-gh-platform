import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { api, hasToken, listOf } from '@/api';
import { dateText } from '@/format';
import { useLoad } from '@/hooks';
import { useAuth } from '@/auth';
import { openFeatureTarget } from '@/feature-links';
import { useFeature } from '@/features';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import type { AppNotification } from '@/types';
import { Empty, ErrorBox, Header, Loader, T } from '@/ui';

/** Where tapping a notification goes (same rules as tapping the push itself). */
function open(n: AppNotification): void {
  const d = n.data ?? {};
  const s = (k: string) => (d[k] !== undefined && d[k] !== null && d[k] !== '' ? String(d[k]) : '');
  if (openFeatureTarget(s('type') || (n.type ?? ''), d)) return;
  if (s('product_id')) router.push({ pathname: '/product/[id]', params: { id: s('product_id') } });
  else if (s('brand_id')) router.push({ pathname: '/brand/[id]', params: { id: s('brand_id') } });
  else if (s('category_id')) router.push({ pathname: '/products', params: { category_id: s('category_id') } });
  else if (s('url')) WebBrowser.openBrowserAsync(s('url')).catch(() => undefined);
  else if (s('order_id') || (n.type ?? '').startsWith('order')) router.push('/orders');
}

export default function Notifications() {
  const { tr, pick, isAr } = useLang();
  const { loggedIn } = useAuth();
  const alerts = useFeature('wishlist_alerts');
  const q = useLoad(async () => {
    const list = listOf<AppNotification>(await api.get<unknown>('/customer/notifications'));
    if (hasToken()) {
      for (const n of list.filter((x) => !x.read_at).slice(0, 20)) api.put(`/customer/notifications/${n.id}/read`).catch(() => undefined);
    }
    return list;
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('الإشعارات', 'Notifications')} right={alerts.on && loggedIn ? (
        <Pressable onPress={() => router.push('/alert-prefs')} hitSlop={8} style={{ paddingHorizontal: 10 }} accessibilityLabel={tr('تنبيهات المفضلة', 'Wishlist alerts')}>
          <Icon name="filter" size={20} />
        </Pressable>
      ) : undefined} />
      {q.loading ? <Loader /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(n) => String(n.id)}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} />}
          renderItem={({ item }) => {
            const img = item.data?.image ? String(item.data.image) : '';
            return (
              <Pressable onPress={() => open(item)} style={({ pressed }) => ({ marginHorizontal: S.gutter, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: 'row', opacity: pressed ? 0.7 : 1 })}>
                {!item.read_at ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.maroon, marginTop: 8, marginEnd: 10 }} /> : null}
                <View style={{ flex: 1, gap: 4 }}>
                  <T size={14.5} w="medium">{pick(item, 'title')}</T>
                  <T size={13} color={C.sub}>{pick(item, 'body')}</T>
                  {img ? <Image source={{ uri: img }} style={{ width: '100%', aspectRatio: 2, marginTop: 8, backgroundColor: C.surface }} contentFit="cover" transition={200} /> : null}
                  <T size={11.5} color={C.faint}>{dateText(item.created_at, isAr)}</T>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Empty icon="bell" title={tr('لا توجد إشعارات حالياً', 'No notifications yet')} text={tr('بنعلمك هنا بكل تحديثات طلباتك', "We'll let you know about your orders here")} />}
        />
      )}
    </View>
  );
}
