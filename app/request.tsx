import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import { Btn, Field, Header, Kicker, T } from '@/ui';

const CATEGORIES = [
  { ar: 'حقيبة', en: 'Bag' },
  { ar: 'ساعة', en: 'Watch' },
  { ar: 'عطر', en: 'Perfume' },
  { ar: 'أحذية', en: 'Shoes' },
  { ar: 'مجوهرات', en: 'Jewellery' },
  { ar: 'أخرى', en: 'Other' },
];

export default function RequestPiece() {
  const { tr, isAr } = useLang();
  const { user } = useAuth();
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [link, setLink] = useState('');
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].ar);
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (user) {
      setName((v) => v || user.name);
      setPhone((v) => v || user.phone || '');
    }
  }, [user]);

  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert(tr('اسمح بالوصول من الإعدادات', 'Allow access in Settings'));
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!r.canceled && r.assets[0]) setPhoto(r.assets[0]);
  };

  const choosePhoto = () => {
    const options = [tr('الكاميرا', 'Camera'), tr('من الصور', 'Photo library'), tr('إلغاء', 'Cancel')];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, (i) => {
        if (i === 0) pick(true);
        if (i === 1) pick(false);
      });
    } else {
      Alert.alert(tr('صورة القطعة', 'Photo'), undefined, [
        { text: options[0], onPress: () => pick(true) },
        { text: options[1], onPress: () => pick(false) },
        { text: options[2], style: 'cancel' },
      ]);
    }
  };

  const send = async () => {
    if (!photo && !link.trim() && !productName.trim()) return Alert.alert(tr('أضف صورة أو رابط أو اسم القطعة', 'Add a photo, link or the piece name'));
    if (!name.trim() || phone.replace(/\D/g, '').length < 8) return Alert.alert(tr('اكتب اسمك ورقم الواتساب', 'Enter your name and WhatsApp number'));
    setBusy(true);
    const product = productName.trim() || [brand.trim(), tr('قطعة من الصورة', 'piece from photo')].filter(Boolean).join(' — ');
    try {
      const form = new FormData();
      form.append('customer_name', name.trim());
      form.append('customer_phone', phone.trim());
      if (user?.email) form.append('customer_email', user.email);
      form.append('product_name_ar', product);
      form.append('brand', brand.trim());
      form.append('category', category);
      form.append('description', notes.trim());
      form.append('product_url', link.trim());
      if (size.trim()) form.append('attributes[size]', size.trim());
      if (color.trim()) form.append('attributes[color]', color.trim());
      if (photo) {
        const ext = (photo.fileName?.split('.').pop() || 'jpg').toLowerCase();
        form.append('image', { uri: photo.uri, name: `piece.${ext === 'heic' ? 'jpg' : ext}`, type: photo.mimeType || 'image/jpeg' } as unknown as Blob);
      }
      await api.upload('/customer/product-requests', form);
      setDone(true);
    } catch (e) {
      Alert.alert(tr('ما قدرنا نرسل الطلب', 'Could not send'), e instanceof Error ? e.message : '');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: C.white }}>
        <Header close title="" />
        <View style={{ padding: 30, alignItems: 'center', gap: 12, marginTop: 40 }}>
          <Icon name="check" size={40} stroke={1.4} />
          <T size={22} w="medium" center>{tr('وصلنا طلبك', 'Request received')}</T>
          <T size={14} color={C.sub} center>{tr('بنتواصل معك على الواتساب بالسعر أول ما نلقى القطعة.', "We'll WhatsApp you with the price once we find it.")}</T>
          <Btn label={tr('العودة للرئيسية', 'Back to home')} onPress={() => router.replace('/')} style={{ alignSelf: 'stretch', marginTop: 20 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header close title="" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: S.gutter + 2, gap: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 4 }}>
            <Kicker color={C.gold}>PERSONAL SHOPPING</Kicker>
            <T size={28} w="medium">{tr('اطلب أي قطعة', 'Request any piece')}</T>
            <T size={13.5} color={C.sub} w="light">{tr('من أي بوتيك في أوروبا. نشتريها لك ونرد عليك بالسعر على واتساب.', 'From any boutique in Europe. We buy it and WhatsApp you the price.')}</T>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={choosePhoto} accessibilityRole="button"
              style={{ width: 150, height: 170, borderWidth: 1, borderStyle: 'dashed', borderColor: C.lineStrong, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Icon name="camera" size={28} stroke={1.3} />
              <T size={13} center>{tr('صوّر أو اختر صورة', 'Take or choose a photo')}</T>
            </Pressable>
            {photo ? (
              <View style={{ flex: 1, height: 170 }}>
                <Image source={{ uri: photo.uri }} style={{ flex: 1 }} contentFit="cover" />
                <Pressable onPress={() => setPhoto(null)} accessibilityLabel={tr('حذف الصورة', 'Remove photo')}
                  style={{ position: 'absolute', top: 6, left: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={12} stroke={2} />
                </Pressable>
              </View>
            ) : null}
          </View>

          <Field label={tr('رابط القطعة (اختياري)', 'Link (optional)')} value={link} onChangeText={setLink} placeholder="https://" autoCapitalize="none" keyboardType="url" ltr />
          <Field label={tr('اسم القطعة', 'Piece name')} value={productName} onChangeText={setProductName} placeholder={tr('مثلاً: حقيبة ليدي ديور ميني', 'e.g. Lady Dior mini bag')} />
          <View style={{ flexDirection: 'row', gap: 14 }}>
            <Field style={{ flex: 1 }} label={tr('البراند', 'Brand')} value={brand} onChangeText={setBrand} placeholder={tr('مثلاً Dior', 'e.g. Dior')} />
            <Field style={{ flex: 1 }} label={tr('المقاس', 'Size')} value={size} onChangeText={setSize} placeholder={tr('اختياري', 'Optional')} />
          </View>
          <Field label={tr('اللون', 'Colour')} value={color} onChangeText={setColor} placeholder={tr('اختياري', 'Optional')} />
          <View style={{ gap: 8 }}>
            <T size={12.5} color={C.sub}>{tr('النوع', 'Type')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIES.map((c) => (
                <Pressable key={c.ar} onPress={() => setCategory(c.ar)} style={{ paddingHorizontal: 14, height: 36, justifyContent: 'center', borderWidth: 1, borderColor: category === c.ar ? C.ink : C.lineStrong, backgroundColor: category === c.ar ? C.ink : C.white }}>
                  <T size={13} color={category === c.ar ? C.white : C.ink}>{isAr ? c.ar : c.en}</T>
                </Pressable>
              ))}
            </View>
          </View>
          <Field label={tr('ملاحظات', 'Notes')} value={notes} onChangeText={setNotes} multiline placeholder={tr('أي تفاصيل تساعدنا نلقاها', 'Anything that helps us find it')} />
          <Field label={tr('اسمك', 'Your name')} value={name} onChangeText={setName} />
          <Field label={tr('رقم الواتساب', 'WhatsApp number')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" ltr />
          <Btn label={tr('أرسل الطلب', 'Send request')} loading={busy} onPress={send} style={{ marginTop: 6 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
