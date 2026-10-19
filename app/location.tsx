import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { setPickedLocation } from '@/location-store';
import { C } from '@/theme';
import { Btn, Header, T } from '@/ui';

// Apple Maps on iPhone (Google Maps on Android) with a fixed centre pin:
// the customer moves the map under the pin.
export default function LocationPicker() {
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const insets = useSafeAreaInsets();
  const { tr } = useLang();
  const start = { lat: Number(params.lat) || 23.588, lng: Number(params.lng) || 58.3829 }; // Muscat
  const [center, setCenter] = useState(start);
  const [locating, setLocating] = useState(false);
  const [moving, setMoving] = useState(false);
  const map = useRef<MapView | null>(null);

  const locate = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        map.current?.animateToRegion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 }, 600);
      }
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('حدد موقع التوصيل', 'Pick delivery location')} />
      <View style={{ flex: 1 }}>
        <MapView
          ref={map}
          style={{ flex: 1 }}
          mapType="mutedStandard"
          showsUserLocation
          showsMyLocationButton={false}
          showsPointsOfInterest
          showsCompass={false}
          initialRegion={{ latitude: start.lat, longitude: start.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
          onRegionChange={() => !moving && setMoving(true)}
          onRegionChangeComplete={(r: Region) => {
            setMoving(false);
            setCenter({ lat: r.latitude, lng: r.longitude });
          }}
        />
        {/* the pin lifts a little while the map moves */}
        <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -16, marginTop: moving ? -56 : -46, alignItems: 'center' }}>
          <Svg width={32} height={46} viewBox="0 0 24 34">
            <Path d="M12 33s11-11.5 11-20A11 11 0 0 0 1 13c0 8.5 11 20 11 20z" fill={C.ink} />
            <Circle cx={12} cy={12.5} r={4} fill="#fff" />
          </Svg>
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -5, marginTop: -3, width: 10, height: 6, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.25)' }} />
        <Pressable onPress={locate} accessibilityLabel={tr('موقعي الحالي', 'My location')}
          style={{ position: 'absolute', bottom: 20, end: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8 }}>
          {locating ? <ActivityIndicator color={C.ink} /> : <Icon name="locate" size={22} />}
        </Pressable>
      </View>
      <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16), borderTopWidth: 1, borderTopColor: C.line, gap: 8 }}>
        <T size={12} color={C.muted} center>{tr('حرّك الخريطة لين يصير الدبوس على بيتك', 'Move the map until the pin is on your place')}</T>
        <Btn label={tr('تأكيد هذا الموقع', 'Confirm this location')} onPress={() => { setPickedLocation(center); router.back(); }} />
      </View>
    </View>
  );
}
