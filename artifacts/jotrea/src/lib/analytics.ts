// Google Analytics 4
// Set VITE_GA_MEASUREMENT_ID in your Vercel environment variables (e.g. G-XXXXXXXXXX)

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

export function initGA(): void {
  if (!GA_ID) return;
  if (document.getElementById("ga-script")) return;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function (...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { send_page_view: false });

  const script = document.createElement("script");
  script.id = "ga-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
}

export function pageView(path: string): void {
  if (!GA_ID || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    send_to: GA_ID,
  });
}

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (!GA_ID || !window.gtag) return;
  window.gtag("event", name, params);
}
