import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useAuth } from '@/auth';
import { useLang } from '@/lang';
import { C } from '@/theme';
import { Btn, Field, Header, Kicker, T } from '@/ui';

export default function Register() {
  const { tr } = useLang();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !email.trim()) return setError(tr('الاسم والبريد مطلوبين', 'Name and email are required'));
    if (password.length < 6) return setError(tr('كلمة المرور ٦ أحرف على الأقل', 'Password must be at least 6 characters'));
    setBusy(true);
    setError(null);
    try {
      await register(name, email, phone, password);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('حدث خطأ أثناء إنشاء الحساب', 'Could not create the account'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header close title="" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 28, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 6 }}>
            <Kicker color={C.gold} center>GH MEMBERSHIP</Kicker>
            <T size={24} w="medium" center>{tr('إنشاء حساب جديد', 'Create your account')}</T>
            <T size={13.5} color={C.muted} center>{tr('انضم واستمتع بتجربة تسوق فريدة ونقاط مع كل طلب', 'Join for a unique experience and points on every order')}</T>
          </View>
          <Field label={tr('الاسم الكامل', 'Full name')} value={name} onChangeText={setName} textContentType="name" />
          <Field label={tr('البريد الإلكتروني', 'Email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" ltr />
          <Field label={tr('رقم الهاتف (اختياري)', 'Phone (optional)')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" ltr />
          <Field label={tr('كلمة المرور', 'Password')} value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" />
          {error ? <T size={13} color={C.red}>{error}</T> : null}
          <Btn label={tr('إنشاء الحساب', 'Create account')} loading={busy} onPress={submit} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            <T size={13.5} color={C.sub}>{tr('عندك حساب؟', 'Have an account?')}</T>
            <T size={13.5} w="medium" style={{ textDecorationLine: 'underline' }} onPress={() => router.replace('/login')}>{tr('تسجيل الدخول', 'Sign in')}</T>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
