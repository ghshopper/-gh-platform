import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useMemo, useState } from 'react';
import { Alert, Dimensions, FlatList, Linking, Modal, Pressable, ScrollView, Share, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, imageUrl, listOf, SITE_BASE } from '@/api';
import { useAuth } from '@/auth';
import { useCart } from '@/cart';
import { useAppData } from '@/appdata';
import { inStock, isOnOrder, num, productAttributes, productImages, productPrice, productWasPrice, waNumber } from '@/format';
import { useLoad } from '@/hooks';
import { knownProduct, rememberProduct } from '@/product-cache';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { askToSignIn, brandOf, ProductCard, showToast } from '@/product-card';
import { C, F, S } from '@/theme';
import type { Product } from '@/types';
import { BrandText, Btn, Divider, ErrorBox, Loader, Photo, Price, T } from '@/ui';
import { useWishlist } from '@/wishlist';

const W = Dimensions.get('window').width;
// Photo height: tall on iPhone, not taller than the screen allows on iPad.
const PH = W >= 700 ? Math.min(W * 0.95, 860) : 520;
const COMPANY_WA = '96877246972';

interface Review { id: number; user_name: string; rating: number; comment?: string | null; date: string }

function RoundBtn({ icon, label, onPress, color = C.ink, fill }: { icon: 'back' | 'share' | 'heart' | 'heartFill'; label: string; onPress: () => void; color?: string; fill?: boolean }) {
  const { isAr } = useLang();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
      <Icon name={fill ? 'heartFill' : icon} size={19} color={color} stroke={1.5} flip={icon === 'back' && isAr} />
    </Pressable>
  );
}

function ProductVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => { p.muted = true; p.loop = true; });
  return <VideoView player={player} style={{ width: W, height: PH }} contentFit="cover" nativeControls />;
}

function Stars({ value, size = 14, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} disabled={!onChange} onPress={() => onChange?.(i)} hitSlop={4} accessibilityLabel={`${i}`}>
          <Icon name={i <= Math.round(value) ? 'starFill' : 'star'} size={size} color={C.ink} stroke={1.2} />
        </Pressable>
      ))}
    </View>
  );
}

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { tr, pick, isAr } = useLang();
  const { loggedIn } = useAuth();
  const cart = useCart();
  const wish = useWishlist();
  const app = useAppData();

  const cached = knownProduct(Number(id));
  const product = useLoad(async () => {
    try {
      const fresh = (await api.get<{ data: Product }>(`/customer/products/${id}`)).data;
      if (fresh) rememberProduct(fresh);
      return fresh ?? cached ?? null;
    } catch (e) {
      if (cached) return cached;
      throw e;
    }
  }, [id]);
  const reviews = useLoad(async () => listOf<Review>(await api.get<unknown>(`/customer/products/${id}/reviews`)), [id]);
  const related = useLoad(async () => {
    const p = product.data ?? cached ?? null;
    if (!p?.category_id) return [] as Product[];
    const rows = listOf<Product>(await api.get<unknown>('/customer/products', { category_id: p.category_id, per_page: 10 }));
    return rows.filter((x) => x.id !== p.id).slice(0, 8);
  }, [product.data?.id]);

  const [slide, setSlide] = useState(0);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string | null>(null);
  const [guide, setGuide] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  const p = product.data ?? cached ?? null;
  const images = useMemo(() => (p ? productImages(p) : []), [p]);
  const attrs = useMemo(() => (p ? productAttributes(p) : []), [p]);
  const selectable = attrs.filter((a) => a.is_selectable !== false);
  const specs = attrs.filter((a) => a.is_selectable === false);

  if (product.loading && !cached) return <View style={{ flex: 1, backgroundColor: C.white, paddingTop: insets.top }}><Loader /></View>;
  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: C.white, paddingTop: insets.top + 40 }}>
        <ErrorBox message={product.error || tr('المنتج غير متوفر حالياً', 'This product is not available')} onRetry={product.reload} />
        <Btn kind="outline" label={tr('رجوع', 'Back')} onPress={() => router.back()} style={{ marginHorizontal: 40 }} />
      </View>
    );
  }

  const brand = brandOf(p);
  const name = pick(p, 'name');
  const price = productPrice(p);
  const was = productWasPrice(p);
  const available = inStock(p);
  const saved = wish.has(p.id);
  const avg = num(p.reviews_avg_rating);
  const count = num(p.reviews_count);
  const description = pick(p, 'description');
  const media: ({ kind: 'img'; path: string } | { kind: 'video'; url: string })[] = images.map((path) => ({ kind: 'img' as const, path }));
  if (p.video_url) media.push({ kind: 'video', url: imageUrl(p.video_url) });

  const addToBag = () => {
    const need = selectable.find((a) => !chosen[pick(a, 'name')]);
    if (need) {
      setMissing(pick(need, 'name'));
      return;
    }
    cart.add({
      productId: p.id,
      name,
      nameEn: p.name_en,
      brand,
      price,
      comparePrice: was,
      image: images[0] ?? '',
      options: Object.entries(chosen).map(([label, value]) => ({ label, value })),
    });
    showToast(tr('تمت الإضافة للسلة', 'Added to your bag'));
  };

  const askOnWhatsApp = () => {
    const msg = tr(`مرحبا، أبي أسأل عن ${brand} ${name}\n${SITE_BASE}/product/${p.id}`, `Hi, I'd like to ask about ${brand} ${name}\n${SITE_BASE}/product/${p.id}`);
    Linking.openURL(`https://wa.me/${waNumber(COMPANY_WA)}?text=${encodeURIComponent(msg)}`).catch(() => undefined);
  };

  const sendReview = async () => {
    setSending(true);
    try {
      const r = await api.post<{ message?: string }>(`/customer/products/${p.id}/reviews`, { rating, comment: comment.trim() || null });
      setWriting(false);
      setComment('');
      Alert.alert(tr('شكراً لك', 'Thank you'), r?.message || tr('بيظهر تقييمك بعد المراجعة', 'Your review will appear after approval'));
    } catch (e) {
      Alert.alert(tr('ما قدرنا نرسل التقييم', 'Could not send your review'), e instanceof Error ? e.message : '');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Gallery */}
        <View>
          <FlatList
            data={media.length ? media : [{ kind: 'img' as const, path: '' }]}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / W))}
            renderItem={({ item }) =>
              item.kind === 'video' ? (
                <ProductVideo url={item.url} />
              ) : (
                <Pressable onPress={() => item.path && setZoom(item.path)} accessibilityRole="imagebutton" accessibilityLabel={name}>
                  <Photo path={item.path} label={brand} style={{ width: W, height: PH }} />
                </Pressable>
              )
            }
          />
          <View style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
            <RoundBtn icon="back" label={tr('رجوع', 'Back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <RoundBtn icon="share" label={tr('مشاركة', 'Share')} onPress={() => Share.share({ message: `${brand} ${name}\n${SITE_BASE}/product/${p.id}` }).catch(() => undefined)} />
              <RoundBtn icon="heart" fill={saved} color={saved ? C.maroon : C.ink} label={tr('المفضلة', 'Wishlist')}
                onPress={async () => { if (!(await wish.toggle(p))) askToSignIn(tr); }} />
            </View>
          </View>
          {media.length > 1 ? (
            <View style={{ position: 'absolute', bottom: 16, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              {media.map((_, i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === slide ? C.ink : C.lineStrong }} />)}
            </View>
          ) : null}
        </View>

        {/* Info */}
        <View style={{ paddingHorizontal: 22, paddingTop: 20, gap: 6 }}>
          {brand ? (
            <Pressable onPress={() => p.brand_id && router.push({ pathname: '/brand/[id]', params: { id: String(p.brand_id) } })}>
              <BrandText size={14}>{brand}</BrandText>
            </Pressable>
          ) : null}
          <T size={17} color={C.ink}>{name}</T>
          <Price value={price} was={was} size={17} />
          {count > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Stars value={avg} size={13} />
              <T latin size={12} color={C.muted}>({count})</T>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <View style={{ backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: !available ? C.red : isOnOrder(p) ? C.amber : C.green }} />
              <T size={12}>{!available ? tr('نفدت الكمية', 'Sold out') : isOnOrder(p) ? tr('بالطلب · نجيبها لك بعد الطلب', 'On order · we source it for you') : tr('تسليم فوري', 'Ready to deliver')}</T>
            </View>
            <View style={{ backgroundColor: C.surface, paddingHorizontal: 10, paddingVertical: 6 }}>
              <T size={12}>{tr('منتج أصلي ١٠٠٪', '100% authentic')}</T>
            </View>
          </View>
        </View>

        {/* Options (size, colour …) */}
        {selectable.map((a) => {
          const label = pick(a, 'name');
          return (
            <View key={label} style={{ paddingHorizontal: 22, marginTop: 18, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T size={13} color={C.sub}>{label}{chosen[label] ? `: ${chosen[label]}` : ''}</T>
                {p.size_guide_image && a.type === 'size' ? (
                  <Pressable onPress={() => setGuide(true)} hitSlop={8}>
                    <T size={12.5} style={{ textDecorationLine: 'underline' }}>{tr('دليل المقاسات', 'Size guide')}</T>
                  </Pressable>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(a.values ?? []).map((v) => {
                  const val = pick(v, 'value');
                  const on = chosen[label] === val;
                  return v.color_code ? (
                    <Pressable key={v.id} onPress={() => { setChosen({ ...chosen, [label]: val }); setMissing(null); }} accessibilityLabel={val} accessibilityState={{ selected: on }}
                      style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: on ? C.ink : C.lineStrong, padding: 3 }}>
                      <View style={{ flex: 1, borderRadius: 14, backgroundColor: v.color_code }} />
                    </Pressable>
                  ) : (
                    <Pressable key={v.id} onPress={() => { setChosen({ ...chosen, [label]: val }); setMissing(null); }} accessibilityState={{ selected: on }}
                      style={{ minWidth: 48, height: 40, paddingHorizontal: 12, borderWidth: 1, borderColor: on ? C.ink : C.lineStrong, backgroundColor: on ? C.ink : C.white, alignItems: 'center', justifyContent: 'center' }}>
                      <T size={13} color={on ? C.white : C.ink} center>{val}</T>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
        {missing ? <T size={12.5} color={C.red} style={{ paddingHorizontal: 22, marginTop: 8 }}>{tr(`اختر ${missing} أول`, `Choose ${missing} first`)}</T> : null}
        {!selectable.length && p.size_guide_image ? (
          <Pressable onPress={() => setGuide(true)} style={{ paddingHorizontal: 22, marginTop: 14 }}>
            <T size={12.5} style={{ textDecorationLine: 'underline' }}>{tr('دليل المقاسات', 'Size guide')}</T>
          </Pressable>
        ) : null}

        {/* Delivery */}
        <View style={{ marginHorizontal: 22, marginTop: 22, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, paddingVertical: 14, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="truck" size={20} stroke={1.3} />
            <T size={13.5} style={{ flex: 1 }}>{tr('التوصيل', 'Delivery')}</T>
          </View>
          <T size={12.5} color={C.sub}>
            {tr(
              `مسقط وبركاء: مندوبنا لباب البيت ${app.delivery.home_fee} ر.ع. · باقي السلطنة: جيناكم للبيت ${app.delivery.home_fee} ر.ع. · أو استلام من مكتب جيناكم ${app.delivery.branch_fee} ر.ع.`,
              `Muscat & Barka: our driver to your door OMR ${app.delivery.home_fee} · Rest of Oman: Genacom to your door OMR ${app.delivery.home_fee} · or pick up at a Genacom office OMR ${app.delivery.branch_fee}`,
            )}
          </T>
        </View>

        {/* Description & specs */}
        <View style={{ paddingHorizontal: 22, marginTop: 22, gap: 10 }}>
          <T size={15} w="medium">{tr('وصف المنتج', 'Description')}</T>
          <T size={14} color={C.sub} w="light">{description || tr('لا يوجد وصف لهذا المنتج.', 'No description for this product.')}</T>
          {specs.length ? (
            <View style={{ marginTop: 8 }}>
              <T size={15} w="medium" style={{ marginBottom: 6 }}>{tr('المواصفات', 'Specifications')}</T>
              {specs.map((a) => (
                <View key={pick(a, 'name')} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <T size={13} color={C.sub}>{pick(a, 'name')}</T>
                  <T size={13}>{(a.values ?? []).map((v) => pick(v, 'value')).join('، ')}</T>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Reviews */}
        <View style={{ paddingHorizontal: 22, marginTop: 28, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T size={15} w="medium">{tr('التقييمات', 'Reviews')}</T>
            <Pressable onPress={() => (loggedIn ? setWriting(true) : router.push('/login'))} hitSlop={8}>
              <T size={12.5} style={{ textDecorationLine: 'underline' }}>{tr('أضف تقييمك', 'Write a review')}</T>
            </Pressable>
          </View>
          {(reviews.data ?? []).length === 0 ? (
            <T size={13} color={C.muted}>{tr('لا توجد تقييمات حتى الآن.', 'No reviews yet.')}</T>
          ) : (
            (reviews.data ?? []).slice(0, 10).map((r) => (
              <View key={r.id} style={{ gap: 4, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T size={13} w="medium">{r.user_name}</T>
                  <T latin size={11.5} color={C.muted}>{r.date}</T>
                </View>
                <Stars value={r.rating} size={12} />
                {r.comment ? <T size={13} color={C.sub}>{r.comment}</T> : null}
              </View>
            ))
          )}
        </View>

        {/* Related */}
        {(related.data ?? []).length ? (
          <View style={{ marginTop: 32 }}>
            <T size={15} w="medium" style={{ paddingHorizontal: 22, marginBottom: 14 }}>{tr('منتجات ذات صلة', 'You may also like')}</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.gutter, gap: 10 }}>
              {(related.data ?? []).map((r) => <ProductCard key={r.id} product={r} width={150} />)}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky actions */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 14), flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={askOnWhatsApp} accessibilityRole="button" accessibilityLabel={tr('اسأل عن القطعة على واتساب', 'Ask about this piece on WhatsApp')}
          style={{ width: 52, height: 52, borderWidth: 1, borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="whatsapp" size={21} stroke={1.5} />
        </Pressable>
        <Btn style={{ flex: 1 }} label={available ? tr('أضف إلى السلة', 'Add to bag') : tr('نفدت الكمية', 'Sold out')} disabled={!available} onPress={addToBag} />
      </View>

      {/* Size guide */}
      <Modal visible={guide} animationType="fade" transparent onRequestClose={() => setGuide(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center' }} onPress={() => setGuide(false)}>
          {p.size_guide_image ? <Image source={{ uri: imageUrl(p.size_guide_image) }} style={{ width: W, height: W * 1.3 }} contentFit="contain" /> : null}
          <T size={13} color={C.pure} center style={{ marginTop: 16 }}>{tr('اضغط للإغلاق', 'Tap to close')}</T>
        </Pressable>
      </Modal>

      {/* Full-screen photo */}
      <Modal visible={!!zoom} animationType="fade" transparent onRequestClose={() => setZoom(null)}>
        <Pressable style={{ flex: 1, backgroundColor: C.white, justifyContent: 'center' }} onPress={() => setZoom(null)}>
          {zoom ? <Image source={{ uri: imageUrl(zoom) }} style={{ width: W, height: '80%' }} contentFit="contain" /> : null}
          <View style={{ position: 'absolute', top: insets.top + 8, left: 12 }}>
            <Icon name="close" size={22} />
          </View>
        </Pressable>
      </Modal>

      {/* Write a review */}
      <Modal visible={writing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setWriting(false)}>
        <View style={{ flex: 1, backgroundColor: C.white, padding: 22, gap: 18, direction: isAr ? 'rtl' : 'ltr' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T size={17} w="medium">{tr('أضف تقييمك', 'Write a review')}</T>
            <Pressable onPress={() => setWriting(false)} hitSlop={10} accessibilityLabel={tr('إغلاق', 'Close')}><Icon name="close" size={20} /></Pressable>
          </View>
          <Stars value={rating} size={30} onChange={setRating} />
          <TextInput value={comment} onChangeText={setComment} multiline placeholder={tr('اكتب تعليقك هنا...', 'Your comment…')} placeholderTextColor={C.faint}
            style={{ minHeight: 120, borderWidth: 1, borderColor: C.lineStrong, padding: 12, fontFamily: F.regular, fontSize: 14, color: C.ink, textAlignVertical: 'top' }} />
          <Btn label={tr('إرسال', 'Send')} loading={sending} onPress={sendReview} />
          <Divider />
          <T size={12} color={C.muted}>{tr('التقييم متاح للطلبات المستلمة فقط، ويظهر بعد المراجعة.', 'Only delivered orders can be reviewed. Reviews appear after approval.')}</T>
        </View>
      </Modal>
    </View>
  );
}
