import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { useLoad } from '@/hooks';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import { Btn, Header, Kicker, Loader, T } from '@/ui';

interface RefInfo {
  enabled: boolean;
  code: string;
  link: string;
  friend_points: number;
  referrer_points: number;
  joined: number;
  ordered: number;
}

/** Invite a friend: your code and link; points for both when their first order arrives. */
export default function Invite() {
  const { tr } = useLang();
  const { user } = useAuth();
  const ref = useLoad(async () => (user ? await api.get<RefInfo>('/auth/referral') : null), [user?.id]);
  const [copied, setCopied] = useState(false);
  const r = ref.data;

  const text = r
    ? tr(
        `تسوّق من GH Shopper بكود الدعوة حقي ${r.code} وخذ ${r.friend_points} نقطة هدية مع أول طلب 🤍\n${r.link}`,
        `Shop at GH Shopper with my invite code ${r.code} and get ${r.friend_points} gift points on your first order 🤍\n${r.link}`,
      )
    : '';

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('ادعُ صديقك', 'Invite a friend')} />
      {!r ? (
        ref.loading ? <Loader /> : <T center color={C.muted} style={{ marginTop: 40 }}>{tr('مب متاح الحين', 'Not available right now')}</T>
      ) : (
        <ScrollView contentContainerStyle={{ padding: S.gutter, gap: 20, paddingBottom: 60 }}>
          <View style={{ backgroundColor: '#350304', padding: 24, gap: 10, alignItems: 'center' }}>
            <Icon name="gift" size={34} color="#E8D3A6" stroke={1.2} />
            <T size={20} w="medium" color="#FFFFFF" center>{tr('هدية لك ولصديقك', 'A gift for you and a friend')}</T>
            <T size={13.5} color="#E8D3A6" center>
              {tr(
                `صديقك ياخذ ${r.friend_points} نقطة، وأنت تاخذ ${r.referrer_points} نقطة لما يستلم أول طلب له.`,
                `Your friend gets ${r.friend_points} points, and you get ${r.referrer_points} when their first order arrives.`,
              )}
            </T>
          </View>

          <View style={{ gap: 8 }}>
            <Kicker>{tr('كود الدعوة حقك', 'Your invite code')}</Kicker>
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(r.code);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              style={{ borderWidth: 1, borderColor: C.line, paddingVertical: 18, alignItems: 'center', gap: 4 }}
              accessibilityRole="button"
            >
              <T latin size={26} w="medium" spacing={4}>{r.code}</T>
              <T size={12} color={C.muted}>{copied ? tr('انسخ ✓', 'Copied ✓') : tr('اضغط للنسخ', 'Tap to copy')}</T>
            </Pressable>
          </View>

          <Btn label={tr('شارك مع صديق', 'Share with a friend')} onPress={() => Share.share({ message: text }).catch(() => undefined)} />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: C.surface, padding: 16, gap: 4 }}>
              <T latin size={22} w="medium">{r.joined}</T>
              <T size={12} color={C.muted}>{tr('سجّلوا بدعوتك', 'Joined with your code')}</T>
            </View>
            <View style={{ flex: 1, backgroundColor: C.surface, padding: 16, gap: 4 }}>
              <T latin size={22} w="medium">{r.ordered}</T>
              <T size={12} color={C.muted}>{tr('استلموا أول طلب', 'Received a first order')}</T>
            </View>
          </View>

          <T size={12} color={C.muted}>
            {tr('صديقك يكتب الكود وقت إنشاء الحساب. النقاط تنضاف للاثنين لما يتسلّم أول طلب له.', 'Your friend enters the code when creating an account. Points are added for both when their first order is delivered.')}
          </T>
        </ScrollView>
      )}
    </View>
  );
}
