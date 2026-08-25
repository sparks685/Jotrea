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

export function isNativeCapacitor(): boolean {
  return getCapacitorBridge()?.isNativePlatform?.() === true;
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