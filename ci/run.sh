set -e
node -v; npm -v
cd /tmp
npx --yes create-expo-app@latest gh --template blank-typescript --yes
cd gh
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar \
  expo-image expo-secure-store @react-native-async-storage/async-storage expo-image-picker expo-location react-native-webview \
  expo-font expo-splash-screen expo-localization expo-haptics expo-clipboard expo-sharing expo-web-browser expo-file-system \
  expo-build-properties react-native-reanimated react-native-gesture-handler expo-notifications expo-blur expo-linear-gradient \
  react-native-svg expo-video expo-updates
npx expo install @react-native-firebase/app @react-native-firebase/messaging || echo "firebase install failed"
npm install @expo-google-fonts/ibm-plex-sans-arabic @expo-google-fonts/jost @expo-google-fonts/cormorant-garamond
npm install react-amwal-pay || echo "amwal install failed"
npm view react-amwal-pay versions --json | tail -5 || true
npm view react-amwal-pay peerDependencies dependencies --json || true
cp package.json package-lock.json tsconfig.json app.json "$GITHUB_WORKSPACE/ci-out/"
ls node_modules/react-amwal-pay 2>/dev/null && cp -r node_modules/react-amwal-pay/README.md "$GITHUB_WORKSPACE/ci-out/amwal-README.md" 2>/dev/null || true
ls node_modules/react-amwal-pay/src node_modules/react-amwal-pay/lib 2>/dev/null | head -40
find node_modules/react-amwal-pay -maxdepth 2 -name "*.d.ts" | head
find node_modules/react-amwal-pay -name "*.d.ts" -path "*typescript*" | head -20
mkdir -p "$GITHUB_WORKSPACE/ci-out/amwal-types" && find node_modules/react-amwal-pay -name "*.d.ts" -not -path "*/node_modules/react-amwal-pay/node_modules/*" -exec cp --parents {} "$GITHUB_WORKSPACE/ci-out/amwal-types/" \; || true
cp node_modules/react-amwal-pay/package.json "$GITHUB_WORKSPACE/ci-out/amwal-package.json" || true
ls node_modules/react-amwal-pay/*.podspec node_modules/react-amwal-pay/ios 2>/dev/null | head
cat node_modules/react-amwal-pay/*.podspec 2>/dev/null | head -60
