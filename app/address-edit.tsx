import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { useLang } from '@/lang';
import { GOVERNORATES } from '@/oman';
import { C, S } from '@/theme';
import type { Address } from '@/types';
import { Btn, Check, Field, Header, T } from '@/ui';

export default function AddressEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { tr, isAr } = useLang();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [recipient, setRecipient] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [gov, setGov] = useState(GOVERNORATES[0].ar);
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [details, setDetails] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<Address>(`/customer/addresses/${id}`).then((a) => {
      setTitle(a.title ?? '');
      setRecipient(a.recipient_name);
      setPhone(a.phone);
      setGov(a.governorate || GOVERNORATES[0].ar);
      setCity(a.city);
      setStreet(a.street ?? '');
      setBuilding(a.building ?? '');
      setDetails(a.details ?? '');
      setIsDefault(!!a.is_default);
    }).catch(() => undefined);
  }, [id]);

  const save = async () => {
    if (!recipient.trim() || !phone.trim() || !city.trim()) return Alert.alert(tr('أكمل الحقول المطلوبة', 'Fill in the required fields'));
    setBusy(true);
    const body = { title: title.trim() || null, recipient_name: recipient.trim(), phone: phone.trim(), country: 'عُمان', governorate: gov, city: city.trim(), street: street.trim() || null, building: building.trim() || null, details: details.trim() || null, is_default: isDefault };
    try {
      if (id) await api.put(`/customer/addresses/${id}`, body);
      else await api.post('/customer/addresses', body);
      router.back();
    } catch (e) {
      Alert.alert(tr('ما قدرنا نحفظ', 'Could not save'), e instanceof Error ? e.message : '');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={id ? tr('تعديل العنوان', 'Edit address') : tr('عنوان جديد', 'New address')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: S.gutter, gap: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Field label={tr('اسم العنوان (مثال: البيت، العمل)', 'Label (e.g. Home, Work)')} value={title} onChangeText={setTitle} />
          <Field label={tr('اسم المستلم', 'Recipient')} value={recipient} onChangeText={setRecipient} />
          <Field label={tr('رقم الهاتف', 'Phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" ltr />
          <View style={{ gap: 8 }}>
            <T size={12.5} color={C.sub}>{tr('المحافظة', 'Governorate')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {GOVERNORATES.map((g) => (
                <Pressable key={g.ar} onPress={() => setGov(g.ar)} style={{ paddingHorizontal: 12, height: 36, justifyContent: 'center', borderWidth: 1, borderColor: gov === g.ar ? C.ink : C.lineStrong, backgroundColor: gov === g.ar ? C.ink : C.white }}>
                  <T size={12.5} color={gov === g.ar ? C.white : C.ink}>{isAr ? g.ar : g.en}</T>
                </Pressable>
              ))}
            </View>
          </View>
          <Field label={tr('الولاية / المدينة', 'Wilayat / city')} value={city} onChangeText={setCity} />
          <Field label={tr('اسم الشارع / الحي', 'Street / area')} value={street} onChangeText={setStreet} />
          <Field label={tr('رقم المبنى / المنزل', 'Building / house no.')} value={building} onChangeText={setBuilding} />
          <Field label={tr('علامة مميزة (اختياري)', 'Landmark (optional)')} value={details} onChangeText={setDetails} />
          <Check on={isDefault} onPress={() => setIsDefault(!isDefault)} label={tr('تعيين كعنوان افتراضي', 'Make default')} />
          <Btn label={tr('حفظ', 'Save')} loading={busy} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
