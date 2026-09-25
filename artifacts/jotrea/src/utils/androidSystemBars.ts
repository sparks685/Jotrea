import { registerPlugin } from "@capacitor/core";
import type { Theme } from "@/hooks/useTheme";
import { isAndroidCapacitor } from "./capacitor";

interface JotreaSystemBars {
  setMode(options: { mode: Theme }): Promise<void>;
}

const systemBars = registerPlugin<JotreaSystemBars>("JotreaSystemBars");

/** Native Android owns bar contrast; web and iOS keep their existing behavior. */
export function syncAndroidSystemBars(theme: Theme): void {
  if (!isAndroidCapacitor()) return;
  void systemBars.setMode({ mode: theme }).catch((error: unknown) => {
    console.error("Unable to update Android system bars:", error);
  });
}