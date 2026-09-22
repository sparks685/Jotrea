import { App } from "@capacitor/app";
import packageJson from "../../package.json";
import { isNativeCapacitor } from "./capacitor";

export const WEB_APP_VERSION = packageJson.version;

export async function getInstalledAppVersion(): Promise<string> {
  if (!isNativeCapacitor()) return WEB_APP_VERSION;

  try {
    const info = await App.getInfo();
    return info.version || WEB_APP_VERSION;
  } catch (error) {
    console.warn("[Jotrea] Could not read the installed app version", error);
    return WEB_APP_VERSION;
  }
}