import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sparky.jotrea",
  appName: "Jotrea",
  webDir: "dist",
  android: {
    backgroundColor: "#FFFCF5",
    // API 35+ enforces edge-to-edge: inset the WebView there. Earlier Android
    // versions already fit system windows; forcing margins would double-inset.
    adjustMarginsForEdgeToEdge: "auto",
    // Apple Health remains iOS-only; do not bundle unused Health Connect permissions.
    includePlugins: [
      "@capacitor/app",
      "@capacitor/filesystem",
      "@capacitor/local-notifications",
      "@capacitor/share",
      "@capacitor/splash-screen",
      "@revenuecat/purchases-capacitor",
    ],
  },
  ios: {
    backgroundColor: "#FFFCF5",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 200,
      backgroundColor: "#FFFCF5",
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#4F46E5",
    },
  },
};

export default config;