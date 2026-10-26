import { router } from 'expo-router';
import { FlatList, RefreshControl, useWindowDimensions, View } from 'react-native';
import { useAuth } from '@/auth';
import { useLang } from '@/lang';
import { ProductCard } from '@/product-card';
import { C, S, gridCardW, gridCols } from '@/theme';
import { Empty, Header } from '@/ui';
import { useWishlist } from '@/wishlist';


export default function Wishlist() {
  const { width: W } = useWindowDimensions();
  const { tr } = useLang();
  const { loggedIn } = useAuth();
  const wish = useWishlist();
  const cardW = gridCardW(W, S.gutter);
  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('المفضلة', 'Wishlist')} />
      {!loggedIn ? (
        <Empty icon="heart" title={tr('سجّل دخولك', 'Sign in')} text={tr('عشان تحفظ القطع اللي تعجبك', 'to save the pieces you love')} action={tr('تسجيل الدخول', 'Sign in')} onAction={() => router.push('/login')} />
      ) : (
        <FlatList
          key={`cols-${gridCols(W)}`}
          data={wish.products}
          keyExtractor={(p) => String(p.id)}
          numColumns={gridCols(W)}
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
