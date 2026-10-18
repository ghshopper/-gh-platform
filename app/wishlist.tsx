import { router } from 'expo-router';
import { Dimensions, FlatList, RefreshControl, View } from 'react-native';
import { useAuth } from '@/auth';
import { useLang } from '@/lang';
import { ProductCard } from '@/product-card';
import { C, S } from '@/theme';
import { Empty, Header } from '@/ui';
import { useWishlist } from '@/wishlist';

const W = Dimensions.get('window').width;

export default function Wishlist() {
  const { tr } = useLang();
  const { loggedIn } = useAuth();
  const wish = useWishlist();
  const cardW = (W - S.gutter * 2 - 12) / 2;
  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('المفضلة', 'Wishlist')} />
      {!loggedIn ? (
        <Empty icon="heart" title={tr('سجّل دخولك', 'Sign in')} text={tr('عشان تحفظ القطع اللي تعجبك', 'to save the pieces you love')} action={tr('تسجيل الدخول', 'Sign in')} onAction={() => router.push('/login')} />
      ) : (
        <FlatList
          data={wish.products}
          keyExtractor={(p) => String(p.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: S.gutter }}
          contentContainerStyle={{ gap: 24, paddingVertical: 18 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={wish.reload} />}
          renderItem={({ item }) => <ProductCard product={item} width={cardW} />}
          ListEmptyComponent={<Empty icon="heart" title={tr('المفضلة فارغة', 'Your wishlist is empty')} text={tr('اضغط القلب على أي قطعة تعجبك', 'Tap the heart on anything you love')} />}
        />
      )}
    </View>
  );
}
