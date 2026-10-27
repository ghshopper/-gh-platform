#!/bin/bash
# Screenshots of the demo app on an iPhone simulator (light, plus a few in dark).
# Screens come from ci/screens.txt (one key per line; "dark:" prefix for dark mode,
# "driver:" prefix to sign in as a driver).
set -u
APP=$(find build/Build/Products -name "GHAdmin.app" -maxdepth 3 | head -1)
UDID=$(xcrun simctl list devices available -j | python3 -c '
import json,sys
d=json.load(sys.stdin)["devices"]
best=None
for rt,devs in d.items():
    if "iOS" not in rt: continue
    for x in devs:
        n=x["name"]
        if n.startswith("iPhone") and "Pro" in n and "Max" not in n:
            best=x["udid"]
print(best or "")')
echo "simulator $UDID app $APP"
[ -n "$UDID" ] && [ -n "$APP" ] || exit 1
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1 || sleep 20
xcrun simctl status_bar "$UDID" override --time "9:41" --batteryState charged --batteryLevel 100 --cellularBars 4 2>/dev/null || true
xcrun simctl install "$UDID" "$APP"
mkdir -p shots
while read -r line; do
  [ -z "$line" ] && continue
  mode=light; role=admin; key="$line"
  case "$key" in dark:*) mode=dark; key="${key#dark:}";; esac
  case "$key" in driver:*) role=driver; key="${key#driver:}";; esac
  xcrun simctl ui "$UDID" appearance "$mode"
  xcrun simctl launch --terminate-running-process "$UDID" app.ghshopper.com -demo -role "$role" -screen "$key" >/dev/null
  sleep 7
  name="$key"; [ "$mode" = dark ] && name="dark-$key"; [ "$role" = driver ] && name="driver-$name"
  xcrun simctl io "$UDID" screenshot "shots/$name.png" >/dev/null 2>&1
  echo "shot $name"
done < ci/screens.txt
xcrun simctl ui "$UDID" appearance light

# iPad: the side menu and the wide pages ("ipad:" lines in ci/screens-ipad.txt)
[ -f ci/screens-ipad.txt ] || exit 0
PAD=$(xcrun simctl list devices available -j | python3 -c '
import json,sys
d=json.load(sys.stdin)["devices"]
best=None
for rt,devs in d.items():
    if "iOS" not in rt: continue
    for x in devs:
        if x["name"].startswith("iPad") and "mini" not in x["name"]: best=x["udid"]
print(best or "")')
[ -n "$PAD" ] || { echo "no iPad simulator"; exit 0; }
xcrun simctl boot "$PAD" 2>/dev/null || true
xcrun simctl bootstatus "$PAD" -b >/dev/null 2>&1 || sleep 20
xcrun simctl install "$PAD" "$APP"
while read -r line; do
  [ -z "$line" ] && continue
  mode=light; key="$line"
  case "$key" in dark:*) mode=dark; key="${key#dark:}";; esac
  xcrun simctl ui "$PAD" appearance "$mode"
  xcrun simctl launch --terminate-running-process "$PAD" app.ghshopper.com -demo -role admin -screen "$key" >/dev/null
  sleep 8
  name="ipad-$key"; [ "$mode" = dark ] && name="ipad-dark-$key"
  xcrun simctl io "$PAD" screenshot "shots/$name.png" >/dev/null 2>&1
  echo "shot $name"
done < ci/screens-ipad.txt
xcrun simctl shutdown "$PAD" 2>/dev/null || true
