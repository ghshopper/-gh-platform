import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { imageUrl } from '@/api';
import { useAppData } from '@/appdata';
import { ProductBrowser } from '@/browse';
import { useLang } from '@/lang';
import { C } from '@/theme';
import { Header, T } from '@/ui';

export default function BrandScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pick } = useLang();
  const { brands } = useAppData();
  const brand = brands.find((b) => String(b.id) === id);
  const name = (brand?.name_en ?? brand?.name_ar ?? '').toUpperCase();
  const header = brand?.banner ? (
    <View style={{ marginTop: -18, marginBottom: 6 }}>
      <Image source={{ uri: imageUrl(brand.banner) }} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" />
      {brand.name_ar ? <T size={13} color={C.muted} center style={{ marginTop: 10 }}>{pick(brand, 'name')}</T> : null}
    </View>
  ) : null;
  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header latinTitle={name || ' '} />
      <ProductBrowser initial={{ brand_id: id }} showSearch={false} header={header} />
    </View>
  );
}
