import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexuswms.app', // Separate app from the legacy com.wms360.pro build
  appName: 'NEXUS WMS',
  webDir: 'out',
  server: {
    // Open on the mobile hub (/mobile) so every role lands on the full menu.
    // Requires an APK rebuild to take effect.
    url: 'https://nexus-wms-phi.vercel.app/mobile',
    cleartext: true
  }
};

export default config;
