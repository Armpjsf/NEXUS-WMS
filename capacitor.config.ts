import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexuswms.app', // Separate app from the legacy com.wms360.pro build
  appName: 'NEXUS WMS',
  webDir: 'out',
  server: {
    // Warehouse staff use the APK primarily; open straight to the jobs menu
    // so cold-starts (incl. notification taps) land on the right page instead
    // of the root spinner. Requires an APK rebuild to take effect.
    url: 'https://nexus-wms-phi.vercel.app/mobile/jobs',
    cleartext: true
  }
};

export default config;
