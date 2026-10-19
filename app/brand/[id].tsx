import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { api, imageUrl } from '@/api';
import { useAppData } from '@/appdata';
import { useAuth } from '@/auth';
import { ProductBrowser } from '@/browse';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { showToast } from '@/product-card';
import { C } from '@/theme';
import { Header, T } from '@/ui';

/** "Follow": new pieces from this brand reach the customer. */
function FollowButton({ brandId }: { brandId: number }) {
  const { tr } = useLang();
  const { loggedIn } = useAuth();
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!loggedIn) return;
    api.get<{ data?: number[] }>('/customer/brand-follows').then((r) => setOn((r?.data ?? []).includes(brandId))).catch(() => undefined);
  }, [loggedIn, brandId]);
  const toggle = async () => {
    if (!loggedIn) return router.push('/login');
    try {
      const r = await api.post<{ following: boolean }>(`/customer/brands/${brandId}/follow`);
      setOn(r.following);
      showToast(r.following ? tr('بنعلمك أول ما توصل قطع جديدة', "We'll tell you when new pieces arrive") : tr('ألغيت المتابعة', 'Unfollowed'));
    } catch {
      showToast(tr('ما قدرنا، جرّب مرة ثانية', 'Something went wrong'));
    }
  };
  return (
    <Pressable onPress={toggle} accessibilityState={{ selected: on }}
      style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 16, borderWidth: 1, borderColor: C.ink, backgroundColor: on ? C.ink : 'transparent', marginTop: 10 }}>
      <Icon name={on ? 'heartFill' : 'heart'} size={15} color={on ? C.white : C.ink} />
      <T size={13} color={on ? C.white : C.ink}>{on ? tr('تتابعه', 'Following') : tr('تابع البراند', 'Follow')}</T>
    </Pressable>
  );
}

export default function BrandScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pick } = useLang();
  const { brands } = useAppData();
  const brand = brands.find((b) => String(b.id) === id);
  const name = (brand?.name_en ?? brand?.name_ar ?? '').toUpperCase();
  const header = (
    <View style={{ marginTop: brand?.banner ? -18 : 0, marginBottom: 6 }}>
      {brand?.banner ? <Image source={{ uri: imageUrl(brand.banner) }} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" /> : null}
      {brand?.banner && brand.name_ar ? <T size={13} color={C.muted} center style={{ marginTop: 10 }}>{pick(brand, 'name')}</T> : null}
      <FollowButton brandId={Number(id)} />
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header latinTitle={name || ' '} />
      <ProductBrowser initial={{ brand_id: id }} showSearch={false} header={header} />
    </View>
  );
}
