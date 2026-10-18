// Amwal Pay's iOS SDK must not be built "for distribution" (their React Native
// guide, iOS step 3). This adds that to the generated Podfile's post_install.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARK = '# amwal-pay: build settings';
const SNIPPET = `
    ${MARK}
    installer.pods_project.targets.each do |t|
      if t.name == 'amwalsdk'
        t.build_configurations.each do |c|
          c.build_settings['BUILD_LIBRARY_FOR_DISTRIBUTION'] = 'NO'
        end
      end
    end
    # Pod resource bundles must not ask for a signing team.
    installer.pods_project.targets.each do |t|
      if t.respond_to?(:product_type) && t.product_type == 'com.apple.product-type.bundle'
        t.build_configurations.each { |c| c.build_settings['CODE_SIGNING_ALLOWED'] = 'NO' }
      end
    end
    installer.pods_project.build_configurations.each do |c|
      c.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = 'x86_64'
    end
`;

// Amwal's iOS SDK version. react-amwal-pay 0.1.19 pins 1.1.93, a build from
// Amwal's "loading sdk" fixes period; their React Native example now uses
// 1.1.110. The pin is lifted from the package's podspec and the newer pod is
// asked for here, without touching the bridge code or the payment flow.
const AMWAL_SDK = '1.1.110';
const POD_MARK = '# amwal-pay: sdk version';

function unpinPodspec(projectRoot) {
  const spec = path.join(projectRoot, 'node_modules', 'react-amwal-pay', 'ReactAmwalPay.podspec');
  if (!fs.existsSync(spec)) return;
  const text = fs.readFileSync(spec, 'utf8');
  const next = text.replace(/s\.dependency\s+"amwalsdk\/#\{amwal_subspec\}"\s*,\s*"[^"]+"/, 's.dependency "amwalsdk/#{amwal_subspec}"');
  if (next !== text) fs.writeFileSync(spec, next);
}

module.exports = function withAmwalPay(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      unpinPodspec(cfg.modRequest.projectRoot);
      const file = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let pod = fs.readFileSync(file, 'utf8');
      if (!pod.includes(POD_MARK)) {
        pod = pod.replace(/\n(\s*)use_react_native!\(/, (m, sp) => `\n${sp}${POD_MARK}\n${sp}pod 'amwalsdk/Release', '${AMWAL_SDK}'\n${sp}use_react_native!(`);
        if (!pod.includes(POD_MARK)) throw new Error('withAmwalPay: use_react_native! not found in Podfile');
      }
      if (!pod.includes(MARK)) {
        pod = pod.replace(/post_install do \|installer\|\n/, (m) => m + SNIPPET);
        if (!pod.includes(MARK)) throw new Error('withAmwalPay: post_install block not found in Podfile');
      }
      fs.writeFileSync(file, pod);
      return cfg;
    },
  ]);
};
