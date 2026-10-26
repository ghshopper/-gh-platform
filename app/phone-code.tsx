import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { api, ApiError } from '@/api';
import { useAuth } from '@/auth';
import { useLang } from '@/lang';
import { C } from '@/theme';
import { Btn, Field, Header, Kicker, T } from '@/ui';

interface SendResponse {
  success?: boolean;
  channel?: 'whatsapp' | 'sms';
  message?: string;
  name?: string;
  has_email?: boolean;
  email_hint?: string | null;
}

const digits = (v: string) => v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

/**
 * The shop registered me by phone: a code on that number (WhatsApp or SMS),
 * then a password (and an e-mail if there is none) — same account, same orders.
 */
export default function PhoneCode() {
  const { tr } = useLang();
  const { phoneLogin } = useAuth();
  const params = useLocalSearchParams<{ phone?: string }>();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState(params.phone ?? '');
  const [sent, setSent] = useState<SendResponse | null>(null);
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (digits(phone).replace(/\D/g, '').length < 8) return setError(tr('اكتب رقمك', 'Enter your number'));
    setBusy(true);
    setError(null);
    setNotFound(false);
    try {
      const r = await api.post<SendResponse>('/auth/phone-code', { phone: digits(phone).trim() });
      setSent(r);
      setStep('code');
    } catch (e) {
      if (e instanceof ApiError && e.body?.not_found) setNotFound(true);
      setError(e instanceof Error ? e.message : tr('حدث خطأ', 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (code.length !== 6) return setError(tr('اكتب الرمز من 6 أرقام', 'Enter the 6-digit code'));
    if (!sent?.has_email && !email.trim()) return setError(tr('اكتب إيميلك عشان تدخل فيه بعدين', 'Enter your email for next time'));
    if (password.length < 6) return setError(tr('كلمة المرور لازم 6 حروف أو أكثر', 'Password must be at least 6 characters'));
    setBusy(true);
    setError(null);
    try {
      await phoneLogin({ phone: digits(phone), code, password, email: sent?.has_email ? undefined : email });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('الرمز غير صحيح أو انتهى', 'Wrong or expired code'));
    } finally {
      setBusy(false);
    }
  };

  const hello = sent?.name ? tr(`أهلاً ${sent.name}`, `Hi ${sent.name}`) : tr('أهلاً فيك', 'Welcome');

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header close title="" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 28, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 6 }}>
            <Kicker color={C.gold} center>GH MEMBERSHIP</Kicker>
            <T size={24} w="medium" center>{step === 'phone' ? tr('الدخول برقمك', 'Sign in with your number') : hello}</T>
            <T size={13.5} color={C.muted} center>
              {step === 'phone'
                ? tr('إذا سجّلناك عندنا برقمك، نرسل لك رمز وتكمّل على نفس حسابك بطلباتك ورصيدك ونقاطك.', 'If we registered you by phone, we send you a code and you continue on the same account.')
                : sent?.message ?? tr('أرسلنا لك رمز', 'We sent you a code')}
            </T>
          </View>

          <Field label={tr('رقم الهاتف', 'Phone number')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" ltr editable={step === 'phone'} />

          {step === 'code' ? (
            <>
              <Field
                label={tr('الرمز', 'Code')}
                value={code}
                onChangeText={(v: string) => setCode(digits(v).replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                ltr
              />
              {sent?.has_email ? (
                <T size={13} color={C.sub}>{tr(`بعدين تدخل بإيميلك ${sent.email_hint ?? ''} وكلمة المرور اللي بتختارها الحين.`, `Next time sign in with ${sent.email_hint ?? 'your email'} and the password you choose now.`)}</T>
              ) : (
                <Field label={tr('البريد الإلكتروني', 'Email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" ltr />
              )}
              <Field label={tr('اختر كلمة مرور', 'Choose a password')} value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password" onSubmitEditing={finish} />
            </>
          ) : null}

          {error ? <T size={13} color={C.red}>{error}</T> : null}

          {step === 'phone' ? (
            <>
              <Btn label={tr('أرسل الرمز', 'Send code')} loading={busy} onPress={send} />
              {notFound ? <Btn kind="link" label={tr('افتح حساب جديد', 'Create a new account')} onPress={() => router.replace('/register')} style={{ alignSelf: 'center' }} /> : null}
            </>
          ) : (
            <>
              <Btn label={tr('ادخل لحسابي', 'Open my account')} loading={busy} onPress={finish} />
              <Btn kind="link" label={tr('ما وصلك؟ أرسل رمز جديد', "Didn't get it? Send a new code")} onPress={send} style={{ alignSelf: 'center' }} />
              <Btn kind="link" label={tr('غيّر الرقم', 'Change number')} onPress={() => { setStep('phone'); setCode(''); setError(null); }} style={{ alignSelf: 'center' }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
