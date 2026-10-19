import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { omr } from '@/format';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import { Btn, Field, Header, Kicker, T } from '@/ui';

const AMOUNTS = [25, 50, 100, 200];
const CARD = '#350304';
const GOLD = '#D6B08C';

interface Balance { balance: number; amount: number; usable: boolean; expires_at?: string | null }

/** Buy a GH gift card (paid on the pay page, then sent to the recipient's phone) and check a card's balance. */
export default function GiftCard() {
  const { tr } = useLang();
  const { user } = useAuth();
  const [amount, setAmount] = useState('50');
  const [toName, setToName] = useState('');
  const [toPhone, setToPhone] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const [code, setCode] = useState('');
  const [bal, setBal] = useState<Balance | null>(null);
  const [balErr, setBalErr] = useState<string | null>(null);

  const value = Number(amount) || 0;
  const custom = !AMOUNTS.includes(value);

  const buy = async () => {
    if (value < 10) return setErr(tr('أقل مبلغ 10 ر.ع', 'Minimum 10 OMR'));
    if (!toName.trim()) return setErr(tr('اكتب اسم المستلم', "Enter the recipient's name"));
    if (toPhone.replace(/\D/g, '').length < 8) return setErr(tr('اكتب رقم جوال المستلم صح', "Enter the recipient's phone number"));
    if (!name.trim()) return setErr(tr('اكتب اسمك', 'Enter your name'));
    if (phone.replace(/\D/g, '').length < 8) return setErr(tr('اكتب رقم جوالك صح', 'Enter a valid phone number'));
    setBusy(true);
    setErr(null);
    try {
      const r = await api.post<{ pay_url?: string; message?: string }>('/gift-cards/buy', {
        amount: value,
        recipient_name: toName.trim(),
        recipient_phone: toPhone.trim(),
        message: message.trim() || null,
        buyer_name: name.trim(),
        buyer_phone: phone.trim(),
        buyer_email: email.trim() || null,
      });
      if (!r?.pay_url) throw new Error(r?.message || tr('حدث خطأ', 'Something went wrong'));
      await WebBrowser.openBrowserAsync(r.pay_url);
      setPaid(true);
    } catch (x) {
      setErr(x instanceof Error ? x.message : tr('حدث خطأ', 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    if (!code.trim()) return;
    setBal(null);
    setBalErr(null);
    try {
      setBal(await api.get<Balance>('/gift-cards/balance', { code: code.trim() }));
    } catch (x) {
      setBalErr(x instanceof Error ? x.message : tr('الكود غير صحيح', 'Invalid code'));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('بطاقة هدية', 'Gift card')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: S.gutter, gap: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {/* the card */}
          <LinearGradient colors={['#4A0709', CARD, '#1E0102']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ aspectRatio: 1.6, padding: 22, justifyContent: 'space-between' }}>
            <View style={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderWidth: 0.7, borderColor: GOLD, opacity: 0.45 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T latin size={11} spacing={3} color={GOLD}>GH GIFT CARD</T>
              <Icon name="gift" size={20} color={GOLD} stroke={1.2} />
            </View>
            <View style={{ gap: 4 }}>
              <T latin size={34} color="#F6E9D8">{omr(value || 0)}</T>
              <T size={13} color="rgba(246,233,216,0.75)" lines={1}>{toName.trim() ? tr(`إلى ${toName.trim()}`, `To ${toName.trim()}`) : tr('أهدِ اللي تحبهم حرية الاختيار', 'Give them the freedom to choose')}</T>
            </View>
          </LinearGradient>

          {paid ? (
            <View style={{ padding: 16, backgroundColor: C.surface2, gap: 6 }}>
              <T size={14} w="medium">{tr('شكرًا لك 🤍', 'Thank you 🤍')}</T>
              <T size={13} color={C.sub}>{tr('أول ما يتأكد الدفع، توصل البطاقة للمستلم على جواله مع رسالتك. ولو ما كملت الدفع تقدر ترجع وتحاول مرة ثانية.', 'Once payment is confirmed, the card is sent to the recipient’s phone with your message. If you did not finish paying, you can try again.')}</T>
            </View>
          ) : null}

          <Kicker>{tr('القيمة', 'AMOUNT')}</Kicker>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -8 }}>
            {AMOUNTS.map((a) => {
              const on = value === a;
              return (
                <Pressable key={a} onPress={() => setAmount(String(a))} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={{ height: 42, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: on ? C.ink : C.line, backgroundColor: on ? C.ink : C.white }}>
                  <T latin size={13.5} color={on ? C.white : C.ink}>{omr(a)}</T>
                </Pressable>
              );
            })}
            <TextInput value={custom ? amount : ''} onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad"
              placeholder={tr('مبلغ آخر', 'Other')} placeholderTextColor={C.muted}
              style={{ height: 42, minWidth: 96, paddingHorizontal: 12, borderWidth: 1, borderColor: custom && amount ? C.ink : C.line, color: C.ink, textAlign: 'center' }} />
          </View>

          <Kicker>{tr('إلى', 'TO')}</Kicker>
          <Field label={tr('اسم المستلم', 'Recipient name')} value={toName} onChangeText={setToName} />
          <Field label={tr('جوال المستلم (توصله البطاقة عليه)', 'Recipient phone (the card is sent to it)')} value={toPhone} onChangeText={setToPhone} keyboardType="phone-pad" ltr placeholder="9XXXXXXX" />
          <Field label={tr('رسالتك (اختياري)', 'Your message (optional)')} value={message} onChangeText={setMessage} multiline maxLength={500} />

          <Kicker>{tr('من', 'FROM')}</Kicker>
          <Field label={tr('اسمك', 'Your name')} value={name} onChangeText={setName} />
          <Field label={tr('جوالك', 'Your phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" ltr />
          <Field label={tr('إيميلك (اختياري، يوصلك الإيصال)', 'Your email (optional, for the receipt)')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" ltr />

          {err ? <T size={13} color={C.red}>{err}</T> : null}
          <Btn label={tr(`ادفع ${omr(value || 0)}`, `Pay ${omr(value || 0)}`)} onPress={buy} loading={busy} />
          <T size={12} color={C.muted} center>{tr('الدفع بالبطاقة أو Apple Pay. البطاقة صالحة سنة، وتُستخدم على أكثر من طلب.', 'Pay by card or Apple Pay. Valid for a year, use it over several orders.')}</T>

          {/* balance */}
          <View style={{ borderTopWidth: 1, borderTopColor: C.line, paddingTop: 20, gap: 12, marginTop: 8 }}>
            <T size={15} w="medium">{tr('عندك بطاقة؟ شوف رصيدك', 'Have a card? Check your balance')}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" placeholder="GH-XXXX-XXXX" placeholderTextColor={C.muted}
                style={{ flex: 1, height: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: C.line, color: C.ink, textAlign: 'left' }} />
              <Btn kind="outline" label={tr('تحقق', 'Check')} onPress={check} height={48} style={{ paddingHorizontal: 18 }} />
            </View>
            {bal ? (
              <T size={13.5}>
                {tr('الرصيد', 'Balance')}: <T latin size={13.5} w="medium">{omr(bal.balance)}</T>
                <T size={13} color={C.muted}>{tr(` من ${omr(bal.amount)}`, ` of ${omr(bal.amount)}`)}{bal.expires_at ? tr(` · صالحة إلى ${bal.expires_at}`, ` · valid until ${bal.expires_at}`) : ''}</T>
                {!bal.usable ? <T size={13} color={C.red}>{tr(' · ما تقدر تستخدمها', ' · not usable')}</T> : null}
              </T>
            ) : null}
            {balErr ? <T size={13} color={C.red}>{balErr}</T> : null}
            <T size={12} color={C.muted}>{tr('تستخدمها في صفحة الدفع من زر «استخدم بطاقة هدية».', 'Use it at checkout with the “Use a gift card” button.')}</T>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
