import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { useLang } from '@/lang';
import { C } from '@/theme';
import { Btn, Field, Header, T } from '@/ui';

/** Forgot password: e-mail → 6-digit code → new password (then signed in). */
export default function ForgotPassword() {
  const { tr } = useLang();
  const { resetPassword } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!email.trim()) return setError(tr('اكتب إيميلك', 'Enter your email'));
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ message?: string }>('/auth/forgot-password', { email: email.trim() });
      setInfo(r?.message ?? tr('أرسلنا رمز على إيميلك', 'We sent a code to your email'));
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('حدث خطأ', 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (code.length !== 6) return setError(tr('اكتب الرمز من 6 أرقام', 'Enter the 6-digit code'));
    if (password.length < 6) return setError(tr('كلمة المرور لازم 6 حروف أو أكثر', 'Password must be at least 6 characters'));
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email, code, password);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('الرمز غير صحيح أو انتهى', 'Wrong or expired code'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header close title={tr('نسيت كلمة المرور', 'Forgot password')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 28, gap: 18 }} keyboardShouldPersistTaps="handled">
          <T size={14} color={C.sub}>
            {step === 'email' ? tr('اكتب إيميل حسابك ونرسل لك رمز من 6 أرقام.', 'Enter your account email and we will send you a 6-digit code.') : info}
          </T>
          <Field label={tr('البريد الإلكتروني', 'Email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" ltr />
          {step === 'code' ? (
            <>
              <Field
                label={tr('الرمز', 'Code')}
                value={code}
                onChangeText={(v) => setCode(v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                ltr
              />
              <Field label={tr('كلمة المرور الجديدة', 'New password')} value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" autoComplete="new-password" onSubmitEditing={reset} />
            </>
          ) : null}
          {error ? <T size={13} color={C.red}>{error}</T> : null}
          {step === 'email' ? (
            <Btn label={tr('أرسل الرمز', 'Send code')} loading={busy} onPress={send} />
          ) : (
            <>
              <Btn label={tr('غيّر كلمة المرور وادخل', 'Change password & sign in')} loading={busy} onPress={reset} />
              <Btn kind="link" label={tr('ما وصلك؟ أرسل رمز جديد', "Didn't get it? Send a new code")} onPress={send} style={{ alignSelf: 'center' }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
