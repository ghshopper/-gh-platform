import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';
import { api } from '@/api';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { C, S } from '@/theme';
import { Empty, Header, T } from '@/ui';

interface FaqTopic {
  topic_ar: string;
  topic_en?: string | null;
  items: { id: number; question_ar: string; question_en?: string | null; answer_ar: string; answer_en?: string | null }[];
}

/** Frequently asked questions: a list of topics, each opens its questions. */
export default function Faq() {
  const { tr, isAr } = useLang();
  const [topics, setTopics] = useState<FaqTopic[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState<number | null>(null);
  useEffect(() => {
    api.get<{ data?: FaqTopic[] }>('/customer/faqs').then((r) => setTopics(r?.data ?? [])).catch(() => setTopics([]));
  }, []);
  const t = (ar: string, en?: string | null) => (isAr ? ar : en || ar);

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('الأسئلة الشائعة', 'FAQ')} />
      <ScrollView contentContainerStyle={{ padding: S.gutter, paddingBottom: 40 }}>
        {topics === null ? <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} /> : null}
        {topics && topics.length === 0 ? <Empty icon="info" title={tr('ما في أسئلة للحين', 'No questions yet')} /> : null}
        {(topics ?? []).map((tp) => {
          const on = open === tp.topic_ar;
          return (
            <View key={tp.topic_ar} style={{ borderBottomWidth: 1, borderBottomColor: C.line }}>
              <Pressable onPress={() => { setOpen(on ? null : tp.topic_ar); setQ(null); }} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 60 }} accessibilityRole="button" accessibilityState={{ expanded: on }}>
                <T size={15.5} w={on ? 'medium' : 'regular'} style={{ flex: 1 }}>{t(tp.topic_ar, tp.topic_en)}</T>
                <Icon name={on ? 'minus' : 'plus'} size={16} color={C.gold} />
              </Pressable>
              {on ? (
                <View style={{ paddingBottom: 10 }}>
                  {tp.items.map((it) => (
                    <View key={it.id} style={{ borderTopWidth: 1, borderTopColor: C.line }}>
                      <Pressable onPress={() => setQ(q === it.id ? null : it.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 }} accessibilityRole="button">
                        <T size={14} style={{ flex: 1 }}>{t(it.question_ar, it.question_en)}</T>
                        <Icon name={q === it.id ? 'minus' : 'plus'} size={13} color={C.muted} />
                      </Pressable>
                      {q === it.id ? <T size={13.5} color={C.sub} style={{ paddingBottom: 14, lineHeight: 22 }}>{t(it.answer_ar, it.answer_en)}</T> : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
        <Pressable onPress={() => Linking.openURL('https://wa.me/96877246972')} style={{ marginTop: 26, alignItems: 'center' }}>
          <T size={13} color={C.sub}>{tr('ما لقيت جوابك؟ ', "Didn't find your answer? ")}<T size={13} style={{ textDecorationLine: 'underline' }}>{tr('كلمنا بالواتساب', 'Message us on WhatsApp')}</T></T>
        </Pressable>
      </ScrollView>
    </View>
  );
}
