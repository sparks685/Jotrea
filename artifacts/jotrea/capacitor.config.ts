import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sparky.jotrea",
  appName: "Jotrea",
  webDir: "dist",
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