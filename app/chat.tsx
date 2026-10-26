import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, AppState, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, imageUrl } from '@/api';
import { useAuth } from '@/auth';
import { onChatPoke } from '@/chat-poke';
import { useFeature } from '@/features';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C, F, S } from '@/theme';
import { Empty, ErrorBox, Header, Loader, T } from '@/ui';

interface Msg {
  id: number;
  from: 'customer' | 'staff';
  body?: string | null;
  image_url?: string | null;
  ps_order?: { id: string | number; invoice_no?: string | null } | null;
  product?: { id: number; name?: string | null; image?: string | null } | null;
  created_at?: string | null;
  staff_name?: string | null;
  /** Sent from this phone, waiting for the server. */
  pending?: boolean;
}

interface ChatResponse {
  thread?: { id: number; unread_customer?: number } | null;
  welcome?: string | null;
  hours?: string | null;
  messages?: Msg[];
}

const POLL = 4000;

function timeOf(iso?: string | null, isAr = true): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleTimeString(isAr ? 'ar-OM-u-nu-latn' : 'en-GB', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Muscat' });
  } catch {
    return '';
  }
}

/**
 * المحادثة المباشرة with the GH team. Opened from Account, an order ("اسأل عن طلبك")
 * or a product ("اسأل عن القطعة"); the order/product rides along with the first message.
 * Polls every 4 s while open, and refreshes at once when a chat push arrives.
 */
export default function Chat() {
  const { width: W } = useWindowDimensions();
  const params = useLocalSearchParams<{ ps_order_id?: string; invoice_no?: string; product_id?: string; product_name?: string; product_image?: string }>();
  const insets = useSafeAreaInsets();
  const { tr, isAr } = useLang();
  const { loggedIn } = useAuth();
  const flag = useFeature('chat');

  const [messages, setMessages] = useState<Msg[]>([]);
  const [welcome, setWelcome] = useState('');
  const [hours, setHours] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  // what the customer is asking about (dropped after it is sent once, or on ✕)
  const [about, setAbout] = useState<{ ps_order_id?: string; invoice_no?: string; product_id?: string; product_name?: string; product_image?: string } | null>(
    params.ps_order_id || params.product_id ? { ...params } : null,
  );
  const lastId = useRef(0);
  const list = useRef<FlatList<Msg>>(null);
  const busy = useRef(false);

  const enabled = flag.on && loggedIn;

  const merge = useCallback((incoming: Msg[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.filter((m) => !m.pending).map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      if (!fresh.length) return prev;
      const kept = prev.filter((m) => !m.pending || !fresh.some((f) => f.from === 'customer' && (f.body ?? '') === (m.body ?? '')));
      return [...kept, ...fresh].sort((a, b) => (a.pending ? 1 : 0) - (b.pending ? 1 : 0) || a.id - b.id);
    });
    lastId.current = Math.max(lastId.current, ...incoming.map((m) => m.id));
    if (incoming.some((m) => m.from === 'staff')) api.post('/customer/chat/read').catch(() => undefined);
  }, []);

  const fetchNew = useCallback(async (first = false) => {
    if (!enabled || busy.current) return;
    busy.current = true;
    try {
      const r = await api.get<ChatResponse>('/customer/chat', first || !lastId.current ? undefined : { after_id: lastId.current });
      if (first) {
        setWelcome(r?.welcome ?? (isAr ? flag.welcome_ar : flag.welcome_en) ?? '');
        setHours(r?.hours ?? (isAr ? flag.hours_ar : flag.hours_en) ?? '');
        api.post('/customer/chat/read').catch(() => undefined);
      }
      merge(r?.messages ?? []);
      setError(null);
    } catch (e) {
      if (first) setError(e instanceof Error ? e.message : tr('حدث خطأ', 'Something went wrong'));
    } finally {
      busy.current = false;
      if (first) setLoading(false);
    }
  }, [enabled, merge, isAr, flag.welcome_ar, flag.welcome_en, flag.hours_ar, flag.hours_en, tr]);

  // first load + 4 s polling while the screen is open and the app is in front
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    fetchNew(true);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') fetchNew();
    }, POLL);
    const offPoke = onChatPoke(() => fetchNew());
    return () => {
      clearInterval(timer);
      offPoke();
    };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length]);

  const send = async (image?: ImagePicker.ImagePickerAsset) => {
    const body = text.trim();
    if ((!body && !image) || sending) return;
    setSending(true);
    const tempId = Date.now();
    const temp: Msg = { id: tempId, from: 'customer', body: body || null, image_url: image?.uri ?? null, pending: true, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, temp]);
    if (!image) setText('');
    try {
      let res: { message?: Msg };
      if (image) {
        const form = new FormData();
        if (body) form.append('body', body);
        if (about?.ps_order_id) form.append('ps_order_id', about.ps_order_id);
        if (about?.product_id) form.append('product_id', about.product_id);
        const ext = (image.fileName?.split('.').pop() || 'jpg').toLowerCase();
        form.append('image', { uri: image.uri, name: `chat.${ext === 'heic' ? 'jpg' : ext}`, type: image.mimeType || 'image/jpeg' } as unknown as Blob);
        res = await api.upload<{ message?: Msg }>('/customer/chat', form);
        setText('');
      } else {
        res = await api.post<{ message?: Msg }>('/customer/chat', {
          body,
          ps_order_id: about?.ps_order_id || undefined,
          product_id: about?.product_id ? Number(about.product_id) : undefined,
        });
      }
      setAbout(null);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (res?.message) merge([res.message]);
      else fetchNew();
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (!image) setText(body);
      Alert.alert(tr('ما انرسلت الرسالة', 'Message not sent'), e instanceof Error ? e.message : '');
    } finally {
      setSending(false);
    }
  };

  const pickImage = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert(tr('اسمح بالوصول من الإعدادات', 'Allow access in Settings'));
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!r.canceled && r.assets[0]) send(r.assets[0]);
  };
  const choosePhoto = () => {
    const options = [tr('الكاميرا', 'Camera'), tr('من الصور', 'Photo library'), tr('إلغاء', 'Cancel')];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, (i) => {
        if (i === 0) pickImage(true);
        if (i === 1) pickImage(false);
      });
    } else {
      Alert.alert(tr('أرسل صورة', 'Send a photo'), undefined, [
        { text: options[0], onPress: () => pickImage(true) },
        { text: options[1], onPress: () => pickImage(false) },
        { text: options[2], style: 'cancel' },
      ]);
    }
  };

  const title = tr('المحادثة المباشرة', 'Live chat');
  if (!flag.on || !loggedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: C.white }}>
        <Header title={title} />
        {!loggedIn ? (
          <Empty icon="chat" title={tr('سجّل دخولك', 'Sign in')} text={tr('عشان تتكلم مع فريق GH مباشرة', 'to chat with the GH team')} action={tr('تسجيل الدخول', 'Sign in')} onAction={() => router.push('/login')} />
        ) : (
          <Empty icon="chat" title={tr('المحادثة غير متاحة حالياً', 'Chat is not available right now')} />
        )}
      </View>
    );
  }

  const renderItem = ({ item: m }: { item: Msg }) => {
    const mine = m.from === 'customer';
    const img = m.image_url ? (m.pending ? m.image_url : imageUrl(m.image_url)) : '';
    return (
      <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', marginVertical: 4, gap: 3 }}>
        {!mine && m.staff_name ? <T size={11} color={C.muted}>{m.staff_name}</T> : null}
        {m.product ? (
          <Pressable onPress={() => m.product && router.push({ pathname: '/product/[id]', params: { id: String(m.product.id) } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.bg }}>
            {m.product.image ? <Image source={{ uri: imageUrl(m.product.image) }} style={{ width: 34, height: 42, backgroundColor: C.surface }} contentFit="cover" /> : null}
            <T size={12} color={C.sub} lines={2} style={{ flexShrink: 1 }}>{m.product.name ?? ''}</T>
          </Pressable>
        ) : null}
        {m.ps_order ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: C.line, alignSelf: mine ? 'flex-end' : 'flex-start' }}>
            <Icon name="doc" size={13} color={C.sub} />
            <T latin size={11.5} color={C.sub}>{m.ps_order.invoice_no ?? ''}</T>
          </View>
        ) : null}
        {img ? (
          <Pressable onPress={() => setZoom(img)} accessibilityRole="imagebutton">
            <Image source={{ uri: img }} style={{ width: W * 0.56, height: W * 0.7, backgroundColor: C.surface, opacity: m.pending ? 0.6 : 1 }} contentFit="cover" transition={150} />
          </Pressable>
        ) : null}
        {m.body ? (
          <View style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: mine ? C.ink : C.surface, opacity: m.pending ? 0.6 : 1 }}>
            <T size={14} color={mine ? C.white : C.ink}>{m.body}</T>
          </View>
        ) : null}
        <T latin size={10.5} color={C.faint} style={{ alignSelf: mine ? 'flex-end' : 'flex-start' }}>{m.pending ? '…' : timeOf(m.created_at, isAr)}</T>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={title} />
      {loading ? <Loader /> : error && !messages.length ? <ErrorBox message={error} onRetry={() => { setLoading(true); fetchNew(true); }} /> : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <FlatList
            ref={list}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            renderItem={renderItem}
            contentContainerStyle={{ padding: S.gutter, paddingBottom: 12 }}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
            ListHeaderComponent={
              <View style={{ alignItems: 'center', gap: 6, paddingVertical: 14, marginBottom: 10 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.maroon, alignItems: 'center', justifyContent: 'center' }}>
                  <T latin w="medium" size={15} spacing={1.5} color={C.white}>GH</T>
                </View>
                <T size={15} w="medium" center>{tr('فريق GH Shopper', 'The GH Shopper team')}</T>
                {welcome ? <T size={13} color={C.sub} center>{welcome}</T> : null}
                {hours ? <T size={11.5} color={C.muted} center>{hours}</T> : null}
              </View>
            }
          />
          {about ? (
            <View style={{ marginHorizontal: S.gutter, marginBottom: 6, padding: 8, backgroundColor: C.surface2, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {about.product_image ? <Image source={{ uri: imageUrl(about.product_image) }} style={{ width: 30, height: 38, backgroundColor: C.surface }} contentFit="cover" /> : <Icon name={about.product_id ? 'tag' : 'doc'} size={18} color={C.sub} />}
              <T size={12} color={C.sub} lines={1} style={{ flex: 1 }}>
                {about.product_id ? tr(`عن: ${about.product_name ?? ''}`, `About: ${about.product_name ?? ''}`) : tr(`عن طلب ${about.invoice_no ?? ''}`, `About order ${about.invoice_no ?? ''}`)}
              </T>
              <Pressable onPress={() => setAbout(null)} hitSlop={10} accessibilityLabel={tr('إزالة', 'Remove')}><Icon name="close" size={14} color={C.muted} /></Pressable>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10), borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.white }}>
            <Pressable onPress={choosePhoto} disabled={sending} accessibilityRole="button" accessibilityLabel={tr('أرسل صورة', 'Send a photo')}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="camera" size={22} stroke={1.3} />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              placeholder={tr('اكتب رسالتك…', 'Write a message…')}
              placeholderTextColor={C.faint}
              style={{ flex: 1, maxHeight: 120, minHeight: 44, borderWidth: 1, borderColor: C.lineStrong, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 11, fontFamily: F.regular, fontSize: 14.5, color: C.ink, textAlign: isAr ? 'right' : 'left' }}
            />
            <Pressable onPress={() => send()} disabled={sending || !text.trim()} accessibilityRole="button" accessibilityLabel={tr('إرسال', 'Send')}
              style={{ width: 44, height: 44, backgroundColor: text.trim() ? C.ink : C.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
              {sending ? <ActivityIndicator color={C.white} /> : <Icon name="forward" size={18} color={C.white} stroke={1.8} flip={isAr} />}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal visible={!!zoom} animationType="fade" transparent onRequestClose={() => setZoom(null)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }} onPress={() => setZoom(null)} accessibilityLabel={tr('إغلاق', 'Close')}>
          {zoom ? <Image source={{ uri: zoom }} style={{ width: W, height: '80%' }} contentFit="contain" /> : null}
          <View style={{ position: 'absolute', top: insets.top + 10, left: 14 }}><Icon name="close" size={22} color="#fff" /></View>
        </Pressable>
      </Modal>
    </View>
  );
}

