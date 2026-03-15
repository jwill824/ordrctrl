import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ordrctrl.app',
  appName: 'ordrctrl',
  webDir: 'dist',
  server: {
    /**
     * Setting androidScheme to 'https' makes Android WebView treat the app as
     * served over HTTPS, which means SameSite=Lax cookies work correctly on Android.
     * Without this, cookies with SameSite=Lax would be silently dropped.
     */
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      /**
       * Android notification icon (must exist in res/drawable-* directories).
       * The value below is the default Capacitor sample icon name — replace with
       * a proper icon asset once branding assets are available.
       */
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#488AFF',
    },
  },
};

export default config;
