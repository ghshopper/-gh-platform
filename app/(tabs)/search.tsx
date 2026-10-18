import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductBrowser } from '@/browse';
import { useLang } from '@/lang';
import { C } from '@/theme';
import { T } from '@/ui';

export default function SearchTab() {
  const insets = useSafeAreaInsets();
  const { tr } = useLang();
  return (
    <View style={{ flex: 1, backgroundColor: C.white, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        <T size={26} w="medium">{tr('البحث', 'Search')}</T>
      </View>
      <ProductBrowser initial={{}} />
    </View>
  );
}
