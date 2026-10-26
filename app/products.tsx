import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useAppData } from '@/appdata';
import { ProductBrowser } from '@/browse';
import { useLang } from '@/lang';
import { C } from '@/theme';
import { Header } from '@/ui';

export default function Products() {
  const params = useLocalSearchParams<{ category_id?: string; brand_id?: string; search?: string; title?: string; instant?: string }>();
  const { tr, pick } = useLang();
  const { categories } = useAppData();
  const cat = categories.flatMap((c) => [c, ...(c.children ?? [])]).find((c) => String(c.id) === params.category_id);
  const title = params.title || (cat ? pick(cat, 'name') : '') || tr('المنتجات', 'Products');
  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={title} />
      <ProductBrowser initial={{ category_id: params.category_id, brand_id: params.brand_id, search: params.search, instant: params.instant }} showSearch={false} />
    </View>
  );
}
