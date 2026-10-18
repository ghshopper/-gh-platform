import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { Alert, Dimensions, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, imageUrl, listOf } from '@/api';
import { useAppData } from '@/appdata';
import { useAuth } from '@/auth';
import { num } from '@/format';
import { useLoad } from '@/hooks';
import { Icon, type IconName } from '@/icons';
import { useLang } from '@/lang';
import { ProductCard } from '@/product-card';
import { C, S } from '@/theme';
import type { Category, HeroSlide, Product, SectionSetting } from '@/types';
import { Btn, IconBtn, Kicker, Photo, SectionTitle, T } from '@/ui';

const W = Dimensions.get('window').width;

function active(s?: SectionSetting): boolean {
  return !s || (s.is_active !== 0 && s.is_active !== false);
}

function openSlide(slide: HeroSlide, tr: (a: string, e: string) => string) {
  const type = slide.link_type ?? 'none';
  const value = slide.link_value ?? '';
  if (!value || type === 'none') return;
  if (type === 'category') router.push({ pathname: '/products', params: { category_id: value } });
  else if (type === 'brand') router.push({ pathname: '/brand/[id]', params: { id: value } });
  else if (type === 'product') router.push({ pathname: '/product/[id]', params: { id: value } });
  else if (type === 'url') WebBrowser.openBrowserAsync(value).catch(() => Alert.alert(tr('تعذّر فتح الرابط', 'Could not open the link')));
}

function Hero({ slides }: { slides: HeroSlide[] }) {
  const { pick, tr } = useLang();
  const [index, setIndex] = useState(0);
  const list: (HeroSlide | null)[] = slides.length ? slides : [null];
  return (
    <View style={{ marginTop: 18 }}>
      <FlatList
        data={list}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s, i) => String(s?.id ?? i)}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / W))}
        renderItem={({ item }) => {
          const title = item ? pick(item, 'title') : '';
          const sub = item ? pick(item, 'subtitle') : '';
          const button = item ? pick(item, 'button_text') : '';
          return (
            <Pressable onPress={() => item && openSlide(item, tr)} style={{ width: W }} accessibilityRole="button">
              <Image
                source={item?.full_image_url ? { uri: imageUrl(item.full_image_url) } : require('../../assets/hero.jpg')}
                style={{ width: W, height: 440 }}
                contentFit="cover"
                contentPosition={{ top: '30%' }}
                transition={250}
              />
              <View style={{ paddingHorizontal: 24, paddingTop: 16, alignItems: 'center', gap: 6 }}>
                {title ? (
                  <T size={20} w="medium" center>{title}</T>
                ) : (
                  <T serif size={28} center lh={34}>The World of Luxury</T>
                )}
                <T size={14} color={C.sub} w="light" center>{sub || tr('عالم من الفخامة في مكان واحد', 'A world of luxury in one place')}</T>
                <T size={13} center style={{ textDecorationLine: 'underline', marginTop: 4 }}>{button || tr('تسوّق الآن', 'Shop now')}</T>
              </View>
            </Pressable>
          );
        }}
      />
      {list.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 }}>
          {list.map((_, i) => (
            <View key={i} style={{ width: 18, height: 2, backgroundColor: i === index ? C.ink : C.lineStrong }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Feature({ icon, title, sub, middle }: { icon: IconName; title: string; sub: string; middle?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6, borderLeftWidth: middle ? 1 : 0, borderRightWidth: middle ? 1 : 0, borderColor: C.line }}>
      <Icon name={icon} size={24} stroke={1.2} />
      <T size={12.5} w="medium" center>{title}</T>
      <T size={11} color={C.muted} center>{sub}</T>
    </View>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { isAr, tr, pick } = useLang();
  const { user, loggedIn } = useAuth();
  const app = useAppData();
  const sections = app.home?.sections ?? {};

  const featured = useLoad(async () => listOf<Product>(await api.get<unknown>('/customer/products/featured')), []);
  const latest = useLoad(async () => listOf<Product>(await api.get<unknown>('/customer/products', { per_page: 40 })), []);

  const featuredCount = num(sections.featured_products?.items_count, 8) || 8;
  const brandCount = num(sections.brands?.items_count, 6) || 6;
  const flashCount = num(sections.flash_sales?.items_count, 8) || 8;
  const flash = useMemo(
    () => (latest.data ?? []).filter((p) => num(p.compare_price) > num(p.price)).slice(0, flashCount),
    [latest.data, flashCount],
  );
  const collections = useMemo(() => {
    const s = sections.luxury_collections;
    const n = num(s?.items_count, 3) || 3;
    const ids = (s?.card_settings?.categories as unknown[] | undefined)?.map(String) ?? [];
    const list = ids.length ? app.categories.filter((c) => ids.includes(String(c.id))) : app.categories;
    return list.slice(0, n);
  }, [sections.luxury_collections, app.categories]);

  const features = (sections.features_banner?.card_settings?.features as { title_ar?: string; title_en?: string; sub_ar?: string; sub_en?: string }[] | undefined) ?? [
    { title_ar: 'منتجات أصلية', title_en: '100% Original', sub_ar: '١٠٠٪', sub_en: '100%' },
    { title_ar: 'شحن سريع', title_en: 'Fast Shipping', sub_ar: 'دول الخليج', sub_en: 'GCC Countries' },
    { title_ar: 'دفع آمن', title_en: 'Secure Payment', sub_ar: 'تسوّق بثقة', sub_en: 'Shop with confidence' },
  ];
  const featureIcons: IconName[] = ['shield', 'truck', 'lock'];
  const loyalty = sections.loyalty_program;
  const loyaltySub = (loyalty?.card_settings as { subtitle_ar?: string; subtitle_en?: string } | undefined) ?? undefined;

  const cardW = (W - S.gutter * 2 - 12) / 2;
  const products = (featured.data ?? []).slice(0, featuredCount);
  const sectionTitle = (s: SectionSetting | undefined, ar: string, en: string) => (s ? pick(s, 'title') : '') || tr(ar, en);
  const sectionAction = (s: SectionSetting | undefined) => (s ? pick(s, 'action_text') : '') || tr('عرض الكل', 'View all');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={featured.refreshing}
            onRefresh={() => {
              featured.reload();
              latest.reload();
              app.reload();
            }}
          />
        }
      >
        {/* Top bar */}
        <View style={{ paddingTop: insets.top, paddingHorizontal: 12, height: insets.top + 60, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 96 }} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Image
              source={app.home?.logo_url ? { uri: imageUrl(app.home.logo_url) } : require('../../assets/logo.png')}
              style={{ width: 52, height: 52 }}
              contentFit="contain"
              accessibilityLabel="GH Shopper"
            />
          </View>
          <View style={{ width: 96, alignItems: 'flex-end' }}>
            <IconBtn name="bell" label={tr('الإشعارات', 'Notifications')} onPress={() => router.push('/notifications')} />
          </View>
        </View>

        {/* Welcome */}
        {loggedIn ? (
          <View style={{ paddingHorizontal: S.gutter, paddingTop: 10 }}>
            <T size={22} w="medium">{tr(`مرحباً ${user?.name?.split(' ')[0] ?? ''}`, `Welcome ${user?.name?.split(' ')[0] ?? ''}`)}</T>
            <T size={13.5} color={C.muted} w="light">{tr('اختر الأفضل. نحن نهتم بالباقي', 'Choose the best. We take care of the rest.')}</T>
          </View>
        ) : null}

        {/* Search */}
        <Pressable
          onPress={() => router.navigate('/search')}
          accessibilityRole="search"
          style={{ marginHorizontal: S.gutter, marginTop: 16, height: 48, borderWidth: 1, borderColor: C.lineStrong, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}
        >
          <Icon name="search" size={18} />
          <T size={14} color={C.faint}>{tr('ابحث عن منتج، ماركة، أو فئة', 'Search products, brands or categories')}</T>
        </Pressable>

        <Hero slides={app.home?.hero_slides ?? []} />

        {/* Categories */}
        {active(sections.categories) && app.categories.length ? (
          <View style={{ marginTop: 40 }}>
            <SectionTitle
              title={sectionTitle(sections.categories, 'تسوّق حسب الفئة', 'Shop by category')}
              action={sectionAction(sections.categories)}
              onAction={() => router.push('/categories')}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.gutter, gap: 10 }}>
              {app.categories.slice(0, num(sections.categories?.items_count, 12) || 12).map((c: Category) => (
                <Pressable key={c.id} onPress={() => router.push({ pathname: '/products', params: { category_id: String(c.id), title: pick(c, 'name') } })} style={{ width: 112, gap: 8 }} accessibilityRole="button">
                  <Photo path={c.image || c.icon} label={c.name_en ?? ''} style={{ height: 146 }} />
                  <T size={13.5}>{pick(c, 'name')}</T>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Brands */}
        {active(sections.brands) && app.brands.length ? (
          <View style={{ marginTop: 40 }}>
            <SectionTitle title={sectionTitle(sections.brands, 'تسوّق حسب العلامة التجارية', 'Shop by brand')} action={sectionAction(sections.brands)} onAction={() => router.push('/brands')} />
            <View style={{ marginHorizontal: S.gutter, flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderLeftWidth: 1, borderColor: C.line }}>
              {app.brands.slice(0, brandCount).map((b) => (
                <Pressable key={b.id} onPress={() => router.push({ pathname: '/brand/[id]', params: { id: String(b.id) } })} accessibilityRole="button"
                  style={{ width: '33.333%', height: 76, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                  {b.logo ? (
                    <Image source={{ uri: imageUrl(b.logo) }} style={{ width: '80%', height: 40 }} contentFit="contain" accessibilityLabel={b.name_en ?? ''} />
                  ) : (
                    <T latin w="medium" size={11.5} spacing={1.8} center lines={2}>{(b.name_en ?? b.name_ar ?? '').toUpperCase()}</T>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Featured products */}
        {active(sections.featured_products) && products.length ? (
          <View style={{ marginTop: 40 }}>
            <SectionTitle title={sectionTitle(sections.featured_products, 'منتجات مميزة', 'Featured products')} action={sectionAction(sections.featured_products)} onAction={() => router.push('/products')} />
            <View style={{ paddingHorizontal: S.gutter, flexDirection: 'row', flexWrap: 'wrap', gap: 12, rowGap: 24 }}>
              {products.map((p) => <ProductCard key={p.id} product={p} width={cardW} />)}
            </View>
          </View>
        ) : null}

        {/* Features */}
        {active(sections.features_banner) ? (
          <View style={{ marginHorizontal: S.gutter, marginTop: 40, paddingVertical: 22, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line, flexDirection: 'row' }}>
            {features.slice(0, 3).map((f, i) => (
              <Feature key={i} icon={featureIcons[i] ?? 'shield'} title={(isAr ? f.title_ar : f.title_en) ?? ''} sub={(isAr ? f.sub_ar : f.sub_en) ?? ''} middle={i === 1} />
            ))}
          </View>
        ) : null}

        {/* Flash sale (only when switched on in the dashboard) */}
        {sections.flash_sales && active(sections.flash_sales) && flash.length ? (
          <View style={{ marginTop: 40 }}>
            <SectionTitle title={sectionTitle(sections.flash_sales, 'عروض حصرية', 'Exclusive offers')} action={sectionAction(sections.flash_sales)} onAction={() => router.push('/products')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.gutter, gap: 10 }}>
              {flash.map((p) => <ProductCard key={p.id} product={p} width={150} />)}
            </ScrollView>
          </View>
        ) : null}

        {/* Luxury collections (only when switched on) */}
        {sections.luxury_collections && active(sections.luxury_collections) && collections.length ? (
          <View style={{ marginTop: 40 }}>
            <SectionTitle title={sectionTitle(sections.luxury_collections, 'مجموعات حصرية', 'Luxury collections')} action={sectionAction(sections.luxury_collections)} onAction={() => router.push('/categories')} />
            <View style={{ paddingHorizontal: S.gutter, gap: 12 }}>
              {collections.map((c) => (
                <Pressable key={c.id} onPress={() => router.push({ pathname: '/products', params: { category_id: String(c.id), title: pick(c, 'name') } })} accessibilityRole="button">
                  <Photo path={c.image} label={c.name_en ?? ''} style={{ height: 180 }} />
                  <T size={15} w="medium" style={{ marginTop: 8 }}>{pick(c, 'name')}</T>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Personal shopping: ask for any piece */}
        <Pressable onPress={() => router.push('/request')} style={{ marginHorizontal: S.gutter, marginTop: 40, backgroundColor: C.cream }} accessibilityRole="button">
          <Image source={require('../../assets/bags.jpg')} style={{ width: '100%', aspectRatio: 712 / 510 }} contentFit="cover" />
          <View style={{ padding: 22, paddingTop: 6, alignItems: 'center', gap: 6 }}>
            <Kicker color={C.gold} center>PERSONAL SHOPPING</Kicker>
            <T size={19} w="medium" center>{tr('ما لقيت القطعة؟ نجيبها لك', "Can't find it? We'll get it")}</T>
            <T size={13} color={C.sub} w="light" center>{tr('صوّر القطعة أو الصق رابطها، ونشتريها لك من البوتيك', 'Snap it or paste the link, and we buy it from the boutique')}</T>
            <Btn label={tr('اطلب قطعة', 'Request a piece')} onPress={() => router.push('/request')} height={44} style={{ marginTop: 10 }} />
          </View>
        </Pressable>

        {/* Loyalty */}
        {active(loyalty) ? (
          <View style={{ marginHorizontal: S.gutter, marginTop: 28, padding: 24, backgroundColor: C.cream, alignItems: 'center', gap: 6 }}>
            <Kicker color={C.gold} center>GH LOYALTY</Kicker>
            <T size={18} w="medium" center>{(loyalty ? pick(loyalty, 'title') : '') || tr('برنامج الولاء', 'Loyalty program')}</T>
            <T size={13} color={C.sub} w="light" center>
              {(isAr ? loyaltySub?.subtitle_ar : loyaltySub?.subtitle_en) || tr('احصل على نقاط حصرية مع كل طلب', 'Earn exclusive points with every order')}
            </T>
            <Btn
              kind="outline"
              height={42}
              style={{ marginTop: 10 }}
              label={loggedIn ? tr('نقاطي', 'My points') : (loyalty ? pick(loyalty, 'action_text') : '') || tr('انضم الآن', 'Join now')}
              onPress={() => router.push(loggedIn ? '/loyalty' : '/register')}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
