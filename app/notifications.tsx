import { FlatList, RefreshControl, View } from 'react-native';
import { api, hasToken, listOf } from '@/api';
import { dateText } from '@/format';
import { useLoad } from '@/hooks';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import type { AppNotification } from '@/types';
import { Empty, ErrorBox, Header, Loader, T } from '@/ui';

export default function Notifications() {
  const { tr, pick, isAr } = useLang();
  const q = useLoad(async () => {
    const list = listOf<AppNotification>(await api.get<unknown>('/customer/notifications'));
    if (hasToken()) {
      for (const n of list.filter((x) => !x.read_at).slice(0, 20)) api.put(`/customer/notifications/${n.id}/read`).catch(() => undefined);
    }
    return list;
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('الإشعارات', 'Notifications')} />
      {q.loading ? <Loader /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : (
        <FlatList
          data={q.data ?? []}
          keyExtractor={(n) => String(n.id)}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} />}
          renderItem={({ item }) => (
            <View style={{ marginHorizontal: S.gutter, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.line, gap: 4, flexDirection: 'row' }}>
              {!item.read_at ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.maroon, marginTop: 8, marginEnd: 10 }} /> : null}
              <View style={{ flex: 1, gap: 4 }}>
                <T size={14.5} w="medium">{pick(item, 'title')}</T>
                <T size={13} color={C.sub}>{pick(item, 'body')}</T>
                <T size={11.5} color={C.faint}>{dateText(item.created_at, isAr)}</T>
              </View>
            </View>
          )}
          ListEmptyComponent={<Empty icon="bell" title={tr('لا توجد إشعارات حالياً', 'No notifications yet')} text={tr('بنعلمك هنا بكل تحديثات طلباتك', "We'll let you know about your orders here")} />}
        />
      )}
    </View>
  );
}
