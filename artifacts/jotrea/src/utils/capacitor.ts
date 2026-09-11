export interface CapacitorBridge {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
  registerPlugin?: <T>(name: string) => T;
  Plugins?: Record<string, unknown>;
}

export function getCapacitorBridge(): CapacitorBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
}

/**
 * Returns the Capacitor runtime platform without importing the native bridge.
 * Keeping this lookup defensive is important for the web build, where the
 * bridge is intentionally absent.
 */
export function getCapacitorPlatform(): string {
  return getCapacitorBridge()?.getPlatform?.() ?? "web";
}

export function isNativeCapacitor(): boolean {
  return getCapacitorBridge()?.isNativePlatform?.() === true;
}

export function isAndroidCapacitor(): boolean {
  return isNativeCapacitor() && getCapacitorPlatform() === "android";
}

export function isIosCapacitor(): boolean {
  return isNativeCapacitor() && getCapacitorPlatform() === "ios";
}

/**
 * Store subscription management pages are platform-owned URLs. The browser
 * build keeps the existing App Store destination; Android shells must not send
 * users to Apple's account page.
 */
export function getSubscriptionManagementUrl(): string {
  return getCapacitorPlatform() === "android"
    ? "https://play.google.com/store/account/subscriptions"
    : "https://apps.apple.com/account/subscriptions";
}

export function getNativePlugin<T>(name: string): T | null {
  const bridge = getCapacitorBridge();
  if (!bridge || !isNativeCapacitor()) return null;
  if (bridge.isPluginAvailable?.(name) === false) return null;
  if (typeof bridge.registerPlugin === "function") {
    return bridge.registerPlugin<T>(name);
  }
  return (bridge.Plugins?.[name] as T | undefined) ?? null;
}