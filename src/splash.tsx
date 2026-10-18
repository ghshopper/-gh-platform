import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { api } from './api';
import { useLang } from './lang';
import { C } from './theme';
import { T } from './ui';

interface SplashData {
  is_active?: boolean | number;
  media_type?: 'image' | 'video' | string;
  full_media_url?: string | null;
  duration_seconds?: number;
}

function VideoSplash({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.muted = true;
    p.loop = false;
    p.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

/**
 * The opening screen set from the dashboard (image or video, with its
 * duration). Falls back to the logo; tapping skips it.
 */
export function BrandSplash({ onDone }: { onDone: () => void }) {
  const { tr } = useLang();
  const [data, setData] = useState<SplashData | null>(null);
  const opacity = useRef(new Animated.Value(1)).current;
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => onDone());
  };

  useEffect(() => {
    let seconds = 1.2;
    const timeout = setTimeout(finish, 2500); // never hang on a slow network
    api
      .get<{ success?: boolean; data?: SplashData }>('/app/splash')
      .then((r) => {
        const d = r?.data;
        if (d && d.is_active !== false && d.is_active !== 0 && d.full_media_url) {
          setData(d);
          seconds = Math.min(Math.max(Number(d.duration_seconds) || 3, 1), 8);
          clearTimeout(timeout);
          setTimeout(finish, seconds * 1000);
        } else {
          clearTimeout(timeout);
          setTimeout(finish, seconds * 1000);
        }
      })
      .catch(() => undefined);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const url = data?.full_media_url ?? null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: C.pure, opacity }]}>
      <Pressable style={{ flex: 1 }} onPress={finish} accessibilityRole="button" accessibilityLabel={tr('تخطي', 'Skip')}>
        {url && data?.media_type === 'video' ? (
          <VideoSplash url={url} />
        ) : url ? (
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Image source={require('../assets/logo.png')} style={{ width: 150, height: 150 }} contentFit="contain" />
          </View>
        )}
        {url ? (
          <View style={{ position: 'absolute', bottom: 50, left: 0, right: 0 }}>
            <T size={12} color={C.pure} center>{tr('اضغط للتخطي', 'Tap to skip')}</T>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}
