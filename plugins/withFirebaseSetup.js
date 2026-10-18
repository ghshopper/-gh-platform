// react-native-firebase setup that its own plugin can't do on this Expo
// version: Firebase via CocoaPods (not SPM, which breaks static linking) and
// FirebaseApp.configure() at launch.
const { withDangerousMod, withAppDelegate } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withPodfileFlag(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let pod = fs.readFileSync(file, 'utf8');
      if (!pod.includes('$RNFirebaseDisableSPM')) {
        pod = `$RNFirebaseDisableSPM = true\n${pod}`;
        fs.writeFileSync(file, pod);
      }
      return cfg;
    },
  ]);
}

function withConfigure(config) {
  return withAppDelegate(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (cfg.modResults.language !== 'swift') throw new Error('withFirebaseSetup: expected a Swift AppDelegate');
    if (!src.includes('FirebaseApp.configure()')) {
      if (!src.includes('import FirebaseCore')) src = src.replace(/^(import [^\n]+\n)/m, '$1import FirebaseCore\n');
      const re = /(didFinishLaunchingWithOptions[^{]*\{)/;
      if (!re.test(src)) throw new Error('withFirebaseSetup: didFinishLaunchingWithOptions not found in AppDelegate.swift');
      src = src.replace(re, '$1\n    FirebaseApp.configure()');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = function withFirebaseSetup(config) {
  return withConfigure(withPodfileFlag(config));
};
