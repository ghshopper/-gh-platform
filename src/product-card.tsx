import { router } from 'expo-router';
import { Alert, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { inStock, productImages, productPrice, productWasPrice } from './format';
import { Icon } from './icons';
import { useLang } from './lang';
import { C } from './theme';
import type { Product } from './types';
import { BrandText, Photo, Price, T } from './ui';
import { useWishlist } from './wishlist';

export function brandOf(p: Product): string {
  return (p.brand_name_en || p.brand_name || '').trim();
}

export function askToSignIn(tr: (a: string, e: string) => string) {
  Alert.alert(tr('سجّل دخولك', 'Sign in'), tr('سجّل دخولك عشان تحفظ القطع في المفضلة', 'Sign in to save pieces to your wishlist'), [
    { text: tr('لاحقاً', 'Later'), style: 'cancel' },
    { text: tr('تسجيل الدخول', 'Sign in'), onPress: () => router.push('/login') },
  ]);
}

export function ProductCard({ product, width, style }: { product: Product; width?: number; style?: StyleProp<ViewStyle> }) {
  const { pick, tr } = useLang();
  const wish = useWishlist();
  const saved = wish.has(product.id);
  const img = productImages(product)[0];
  const brand = brandOf(product);
  const out = !inStock(product);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/product/[id]', params: { id: String(product.id) } })}
      accessibilityRole="button"
      accessibilityLabel={`${brand} ${pick(product, 'name')}`}
      style={[{ width, gap: 2 }, style]}
    >
      <View style={{ aspectRatio: 3 / 4, marginBottom: 10 }}>
        <Photo path={img} label={brand} style={{ flex: 1 }} />
        {out ? (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.88)', paddingVertical: 5 }}>
            <T size={11} center color={C.sub}>{tr('نفدت الكمية', 'Sold out')}</T>
          </View>
        ) : null}
        <Pressable
          onPress={async () => {
            if (!(await wish.toggle(product))) askToSignIn(tr);
          }}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={saved ? tr('إزالة من المفضلة', 'Remove from wishlist') : tr('أضف إلى المفضلة', 'Add to wishlist')}
          style={{ position: 'absolute', top: 0, left: 0, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name={saved ? 'heartFill' : 'heart'} size={17} color={saved ? C.maroon : C.ink} stroke={1.3} />
        </Pressable>
      </View>
      {brand ? <BrandText>{brand}</BrandText> : null}
      <T size={12.5} color={C.sub} w="light" lines={2}>{pick(product, 'name')}</T>
      <Price value={productPrice(product)} was={productWasPrice(product)} size={12.5} />
    </Pressable>
  );
}
