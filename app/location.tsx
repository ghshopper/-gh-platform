import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Icon } from '@/icons';
import { useLang } from '@/lang';
import { setPickedLocation } from '@/location-store';
import { C } from '@/theme';
import { Btn, Header, T } from '@/ui';

// OpenStreetMap (same map the previous app used) with a fixed centre pin:
// the customer moves the map under the pin.
function mapHtml(lat: number, lng: number): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{margin:0;height:100%;}#pin{position:absolute;left:50%;top:50%;width:30px;height:42px;margin:-42px 0 0 -15px;z-index:999;pointer-events:none}</style></head>
<body><div id="m"></div>
<svg id="pin" viewBox="0 0 24 34"><path d="M12 33s11-11.5 11-20A11 11 0 0 0 1 13c0 8.5 11 20 11 20z" fill="#111"/><circle cx="12" cy="12.5" r="4" fill="#fff"/></svg>
<script>
var m=L.map('m',{zoomControl:false,attributionControl:true}).setView([${lat},${lng}],15);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);
function send(){var c=m.getCenter();window.ReactNativeWebView.postMessage(JSON.stringify({lat:c.lat,lng:c.lng}));}
m.on('moveend',send);send();
document.addEventListener('message',function(e){try{var d=JSON.parse(e.data);m.setView([d.lat,d.lng],17);}catch(x){}});
window.addEventListener('message',function(e){try{var d=JSON.parse(e.data);m.setView([d.lat,d.lng],17);}catch(x){}});
</script></body></html>`;
}

export default function LocationPicker() {
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const insets = useSafeAreaInsets();
  const { tr } = useLang();
  const start = { lat: Number(params.lat) || 23.588, lng: Number(params.lng) || 58.3829 }; // Muscat
  const [center, setCenter] = useState(start);
  const [locating, setLocating] = useState(false);
  const web = useRef<WebView>(null);

  const locate = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        web.current?.postMessage(JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
      }
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <Header title={tr('حدد موقع التوصيل', 'Pick delivery location')} />
      <View style={{ flex: 1 }}>
        <WebView
          ref={web}
          originWhitelist={['*']}
          source={{ html: mapHtml(start.lat, start.lng) }}
          onMessage={(e) => {
            try {
              const d = JSON.parse(e.nativeEvent.data) as { lat: number; lng: number };
              if (Number.isFinite(d.lat) && Number.isFinite(d.lng)) setCenter(d);
            } catch {
              // ignore
            }
          }}
        />
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
