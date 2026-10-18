import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, View } from 'react-native';
import { useAuth } from '@/auth';
import { useLang } from '@/lang';
import { C } from '@/theme';
import { Btn, Field, Header, T } from '@/ui';

export default function Login() {
  const { tr } = useLang();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError(tr('اكتب البريد وكلمة المرور', 'Enter your email and password'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('البريد الإلكتروني أو كلمة المرور غير صحيحة', 'Wrong email or password'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header close title="" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 28, gap: 18 }} keyboardShouldPersistTaps="handled">
          <Image source={require('../assets/logo.png')} style={{ width: 70, height: 70, alignSelf: 'center' }} contentFit="contain" />
          <View style={{ gap: 4 }}>
            <T size={24} w="medium" center>{tr('مرحباً بعودتك', 'Welcome back')}</T>
            <T size={13.5} color={C.muted} center>{tr('سجّل دخولك للمتابعة', 'Sign in to continue')}</T>
          </View>
          <Field label={tr('البريد الإلكتروني', 'Email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" ltr />
          <Field label={tr('كلمة المرور', 'Password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
          {error ? <T size={13} color={C.red}>{error}</T> : null}
          <Btn label={tr('تسجيل الدخول', 'Sign in')} loading={busy} onPress={submit} />
          <Btn kind="link" label={tr('نسيت كلمة المرور؟ كلمنا على واتساب', 'Forgot password? WhatsApp us')} onPress={() => Linking.openURL(`https://wa.me/96877246972?text=${encodeURIComponent(tr('مرحبا، نسيت كلمة المرور لحسابي في التطبيق', 'Hi, I forgot my app password'))}`).catch(() => undefined)} style={{ alignSelf: 'center' }} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
            <T size={13.5} color={C.sub}>{tr('ما عندك حساب؟', 'No account?')}</T>
            <T size={13.5} w="medium" style={{ textDecorationLine: 'underline' }} onPress={() => router.replace('/register')}>{tr('إنشاء حساب', 'Create one')}</T>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
