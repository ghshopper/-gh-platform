import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useAuth } from '@/auth';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import { Btn, Divider, Field, Header, T } from '@/ui';

export default function Profile() {
  const { tr } = useLang();
  const { user, updateProfile, deleteAccount } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return Alert.alert(tr('الاسم مطلوب', 'Name is required'));
    if (next && next.length < 6) return Alert.alert(tr('كلمة المرور ٦ أحرف على الأقل', 'Password must be at least 6 characters'));
    if (next && !current) return Alert.alert(tr('اكتب كلمة المرور الحالية', 'Enter your current password'));
    setBusy(true);
    try {
      const msg = await updateProfile({ name: name.trim(), email: email.trim(), current_password: current || undefined, new_password: next || undefined });
      setCurrent('');
      setNext('');
      Alert.alert(tr('تم', 'Done'), msg);
    } catch (e) {
      Alert.alert(tr('ما قدرنا نحفظ', 'Could not save'), e instanceof Error ? e.message : '');
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert(
      tr('حذف الحساب نهائياً', 'Delete account'),
      tr('ما يمكن التراجع عن هذا، وبتنحذف بياناتك.', 'This cannot be undone and your data will be deleted.'),
      [
        { text: tr('إلغاء', 'Cancel'), style: 'cancel' },
        {
          text: tr('حذف نهائي', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              router.replace('/');
            } catch (e) {
              Alert.alert(tr('ما قدرنا نحذف الحساب', 'Could not delete the account'), e instanceof Error ? e.message : '');
            }
          },
        },
      ],
    );

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('تعديل الحساب', 'Edit account')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: S.gutter, gap: 18, paddingBottom: 60 }}>
          <T latin w="medium" size={12} spacing={2.2}>{tr('PERSONAL · معلوماتك', 'PERSONAL')}</T>
          <Field label={tr('الاسم الكامل', 'Full name')} value={name} onChangeText={setName} />
          <Field label={tr('البريد الإلكتروني', 'Email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" ltr />
          <T latin w="medium" size={12} spacing={2.2} style={{ marginTop: 10 }}>{tr('PASSWORD · كلمة المرور', 'PASSWORD')}</T>
          <T size={12} color={C.muted}>{tr('اتركها فارغة إذا ما تبي تغيّرها', 'Leave empty to keep it')}</T>
          <Field label={tr('كلمة المرور الحالية', 'Current password')} value={current} onChangeText={setCurrent} secureTextEntry />
          <Field label={tr('كلمة المرور الجديدة', 'New password')} value={next} onChangeText={setNext} secureTextEntry />
          <Btn label={tr('حفظ التغييرات', 'Save changes')} loading={busy} onPress={save} />
          <Divider style={{ marginTop: 20 }} />
          <View style={{ gap: 8 }}>
            <T size={13} color={C.red}>{tr('منطقة الخطر', 'Danger zone')}</T>
            <Btn kind="outline" label={tr('حذف الحساب نهائياً', 'Delete account')} onPress={remove} style={{ borderColor: C.red }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
