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

module.exports = function withAmwalPay(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let pod = fs.readFileSync(file, 'utf8');
      if (!pod.includes(MARK)) {
        pod = pod.replace(/post_install do \|installer\|\n/, (m) => m + SNIPPET);
        if (!pod.includes(MARK)) throw new Error('withAmwalPay: post_install block not found in Podfile');
        fs.writeFileSync(file, pod);
      }
      return cfg;
    },
  ]);
};
