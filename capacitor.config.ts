import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.kunjdodiya.mototrack',
  appName: 'MotoTrack',
  webDir: 'dist',
  // Optional but recommended: ship over local bundle URL (fast, offline)
  // instead of loading from a server.
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Ask for WhenInUse at launch; we upgrade to Always in-app before the
    // first ride so the OS shows the correct rationale sheet.
    Geolocation: {
      // Plugin reads these via the Info.plist / AndroidManifest — kept here
      // as documentation of the intended privacy strings.
    },
  },
  ios: {
    // Background location must also be declared in Info.plist under
    // UIBackgroundModes: [location] — Capacitor won't add it automatically.
    // contentInset stays 'never' (the default) so the WKWebView content
    // extends under the status bar AND the home indicator. The html-level
    // gradient in index.css fills those regions; safe-area insets are
    // applied in CSS (env(safe-area-inset-*)) to keep content below the
    // notch and above the tab bar.
    contentInset: 'never',
    // iOS >=13: make the WebView background match our dark mesh so the
    // half-frame that sits under the status bar / home indicator before
    // the first paint doesn't flash white.
    backgroundColor: '#07070a',
  },
  android: {
    // Required by @capacitor-community/background-geolocation: without the
    // legacy bridge, Android halts location updates ~5 min after backgrounding.
    // https://github.com/capacitor-community/background-geolocation/issues/89
    useLegacyBridge: true,
  },
}

export default config
