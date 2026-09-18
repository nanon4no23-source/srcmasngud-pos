import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.srcmasngud.kasir',
  appName: 'SRC MASNGUD',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      androidScaleType: "CENTER_INSIDE",
      splashFullScreen: false,
      splashImmersive: false
    }
  }
};

export default config;
