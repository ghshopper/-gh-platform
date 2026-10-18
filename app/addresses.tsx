import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { api, listOf } from '@/api';
import { useLoad } from '@/hooks';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import type { Address } from '@/types';
import { Btn, Empty, ErrorBox, Header, Loader, T } from '@/ui';

export default function Addresses() {
  const { tr } = useLang();
  const q = useLoad(async () => listOf<Address>(await api.get<unknown>('/customer/addresses')), []);
  useFocusEffect(useCallback(() => { q.reload(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = (a: Address) =>
    Alert.alert(tr('حذف العنوان', 'Delete address'), tr('أكيد تبي تحذف هذا العنوان؟', 'Delete this address?'), [
      { text: tr('إلغاء', 'Cancel'), style: 'cancel' },
      { text: tr('حذف', 'Delete'), style: 'destructive', onPress: async () => {
        try { await api.del(`/customer/addresses/${a.id}`); q.reload(); } catch (e) { Alert.alert(e instanceof Error ? e.message : ''); }
      } },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('عناويني', 'My addresses')} />
      {q.loading ? <Loader /> : q.error ? <ErrorBox message={q.error} onRetry={q.reload} /> : (
        <ScrollView contentContainerStyle={{ padding: S.gutter, gap: 12, paddingBottom: 40 }}>
          {(q.data ?? []).length === 0 ? <Empty icon="pin" title={tr('ما عندك عناوين محفوظة', 'No saved addresses')} /> : null}
          {(q.data ?? []).map((a) => (
            <View key={a.id} style={{ borderWidth: 1, borderColor: a.is_default ? C.ink : C.line, padding: 16, gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T size={15} w="medium">{a.title || tr('عنوان', 'Address')}</T>
                {a.is_default ? <T size={11.5} color={C.gold}>{tr('الافتراضي', 'Default')}</T> : null}
              </View>
              <T size={13}>{a.recipient_name} · <T latin size={13}>{a.phone}</T></T>
              <T size={12.5} color={C.sub}>{[a.governorate, a.city, a.street, a.building, a.details].filter(Boolean).join('، ')}</T>
              <View style={{ flexDirection: 'row', gap: 20, marginTop: 8 }}>
                <Pressable onPress={() => router.push({ pathname: '/address-edit', params: { id: String(a.id) } })} hitSlop={8}><T size={13} style={{ textDecorationLine: 'underline' }}>{tr('تعديل', 'Edit')}</T></Pressable>
                <Pressable onPress={() => remove(a)} hitSlop={8}><T size={13} color={C.red}>{tr('حذف', 'Delete')}</T></Pressable>
              </View>
            </View>
          ))}
          <Btn kind="outline" icon="plus" label={tr('إضافة عنوان جديد', 'Add address')} onPress={() => router.push('/address-edit')} />
        </ScrollView>
      )}
    </View>
  );
}
