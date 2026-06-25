import type { CapacitorConfig } from '@capacitor/cli';

// PRODUCTION builds (no env var set) load the bundled web assets from `webDir`
// (dist/). The app then boots React Router and lands on /auth — never on the
// Lovable preview sandbox.
//
// LOCAL DEVELOPMENT only: export CAP_SERVER_URL before `npx cap sync` to
// hot-reload the device against your dev server, e.g.
//   CAP_SERVER_URL="https://7f537c65-877a-4327-ba61-217e1a56fd12.lovableproject.com?forceHideBadge=true" npx cap sync
// CI / release builds must NEVER set CAP_SERVER_URL.
const devServerUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.mypromovers.app',
  appName: 'My Pro Movers',
  webDir: 'dist',
  ...(devServerUrl ? { server: { url: devServerUrl, cleartext: true } } : {}),
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
      keystorePassword: undefined,
      keystoreAliasPassword: undefined,
      releaseType: 'AAB',
    },
  },
  ios: {
    contentInset: 'always',
    scheme: 'My Pro Movers',
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: '#ffffff',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
