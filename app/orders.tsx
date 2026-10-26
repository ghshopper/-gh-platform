import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useAuth } from '@/auth';
import { dateText, omrReal } from '@/format';
import { useLoad } from '@/hooks';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { fetchMyOrders, orderStage } from '@/orders';
import { C, S } from '@/theme';
import type { MyOrder } from '@/types';
import { BrandText, Empty, ErrorBox, Header, Loader, Photo, T } from '@/ui';

const FILTERS: { key: 'all' | 'open' | 'delivered' | 'due'; ar: string; en: string }[] = [
  { key: 'all', ar: 'الكل', en: 'All' },
  { key: 'open', ar: 'قيد التنفيذ', en: 'In progress' },
  { key: 'delivered', ar: 'تم التسليم', en: 'Delivered' },
  { key: 'due', ar: 'عليها مبلغ', en: 'Balance due' },
];

function OrderRow({ o }: { o: MyOrder }) {
  const { tr, isAr } = useLang();
  const st = orderStage(o);
  const first = o.items[0];
  return (
    <Pressable onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id } })} accessibilityRole="button"
      style={({ pressed }) => ({ marginHorizontal: S.gutter, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.line, gap: 10, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <T latin w="medium" size={13} spacing={1.5}>{o.invoice_no}</T>
          <T size={12} color={C.muted}>{dateText(o.created_at, isAr)}</T>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: o.status === 'delivered' ? C.greenSoft : C.surface }}>
          <T size={11.5} color={o.status === 'delivered' ? C.green : C.ink}>{tr(st.ar, st.en)}</T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {o.items.slice(0, 3).map((i, k) => <Photo key={k} path={i.photo_url} label={i.brand ?? ''} style={{ width: 52, height: 64 }} />)}
        </View>
        <View style={{ flex: 1 }}>
          {first?.brand ? <BrandText size={11}>{first.brand}</BrandText> : null}
          <T size={12.5} color={C.sub} lines={1}>{first?.name}{o.items.length > 1 ? tr(` و${o.items.length - 1} غيرها`, ` +${o.items.length - 1} more`) : ''}</T>
          <T latin size={13}>{omrReal(o.total)}</T>
          {o.remaining > 0 ? <T size={12} color={C.red}>{tr(`المتبقي ${omrReal(o.remaining)}`, `Balance ${omrReal(o.remaining)}`)}</T> : null}
        </View>
        <Icon name="forward" size={16} color={C.faint} flip={isAr} />
      </View>
    </Pressable>
  );
}

export default function Orders() {
  const { tr } = useLang();
  const { loggedIn } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const q = useLoad(fetchMyOrders, [loggedIn]);
  const orders = (q.data?.orders ?? []).filter((o) =>
    filter === 'all' ? true : filter === 'open' ? o.status !== 'delivered' : filter === 'delivered' ? o.status === 'delivered' : o.remaining > 0,
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('طلباتي', 'My orders')} right={
        <Pressable onPress={() => router.push('/track')} hitSlop={8} style={{ paddingHorizontal: 10 }} accessibilityLabel={tr('تتبع طلب برقمه', 'Track by number')}>
          <Icon name="search" size={20} />
        </Pressable>
      } />
      {q.loading ? <Loader /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.reload} />}
          ListHeaderComponent={
            <View>
              {!loggedIn ? (
                <Pressable onPress={() => router.push('/login')} style={{ margin: S.gutter, marginBottom: 6, padding: 14, backgroundColor: C.surface2 }}>
                  <T size={13}>{tr('هذي الطلبات المحفوظة في هذا الجهاز. سجّل دخولك عشان تشوف كل طلباتك.', 'These are the orders saved on this phone. Sign in to see all of them.')}</T>
                </Pressable>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: S.gutter, paddingVertical: 12 }}>
                {FILTERS.map((f) => (
                  <Pressable key={f.key} onPress={() => setFilter(f.key)} accessibilityState={{ selected: filter === f.key }}
                    style={{ paddingHorizontal: 12, height: 34, justifyContent: 'center', borderWidth: 1, borderColor: filter === f.key ? C.ink : C.lineStrong, backgroundColor: filter === f.key ? C.ink : C.white }}>
                    <T size={12.5} color={filter === f.key ? C.white : C.ink}>{tr(f.ar, f.en)}</T>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => <OrderRow o={item} />}
          ListEmptyComponent={<Empty icon="doc" title={tr('لا توجد طلبات', 'No orders yet')} text={tr('أول ما تطلب، بيطلع طلبك هنا', 'Your orders will show here')} action={tr('تسوّق الآن', 'Shop now')} onAction={() => router.replace('/')} />}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}
