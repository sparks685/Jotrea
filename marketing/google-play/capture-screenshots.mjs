/**
 * Repeatable Google Play raw-capture script.
 *
 * Provenance: each PNG is captured from the current shared React app running
 * at the configured preview URL in Chromium CDP. The isolated browser context
 * uses a browser-only Android Capacitor platform shim so Android-only branches
 * can render; it is not a physical Android screenshot. Demo localStorage data
 * is fictional and is never sent to the app server. No purchase, reviewer-code,
 * Apple Health, or Reviewer Access UI is used for these captures.
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import process from "node:process";

const ROOT = new URL(".", import.meta.url);
const OUTPUT_DIR = new URL("./raw/", ROOT);
const SEED_URL = new URL("./demo-seed.json", ROOT);
const PREVIEW_URL = process.env.PREVIEW_URL
  ?? (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/`
    : "http://127.0.0.1:5173/");
const WIDTH = 432;
const HEIGHT = Number(process.env.CAPTURE_HEIGHT ?? 650);
const DEVICE_SCALE_FACTOR = 2.5;
const CHROMIUM = process.env.CHROMIUM ?? "/repl/tools/bin/chromium";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} while reading ${url}`);
  return response.json();
}

class CdpConnection {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.nextId = 0;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id === undefined) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
      } else {
        pending.resolve(message.result);
      }
    });
    this.socket.addEventListener("close", () => {
      for (const { reject } of this.pending.values()) {
        reject(new Error("CDP connection closed"));
      }
      this.pending.clear();
    });
  }

  async send(method, params = {}, sessionId) {
    await this.ready;
    const id = ++this.nextId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(payload));
    });
  }

  close() {
    this.socket.close();
  }
}

function todayAtMidnight() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function dateAtOffset(offset, includeTime = false) {
  const value = todayAtMidnight();
  value.setDate(value.getDate() + Number(offset));
  return includeTime ? value.toISOString() : value.toISOString().slice(0, 10);
}

function materializeSeed(definition) {
  const date = (offset) => dateAtOffset(offset);
  const dateTime = (offset) => dateAtOffset(offset, true);

  const user = {
    ...definition.user,
    glpStartDate: date(-42),
  };
  const medication = {
    ...definition.medication,
    startDate: date(-42),
  };
  const doses = definition.doses.map(({ dateOffset, ...dose }) => ({
    ...dose,
    date: date(dateOffset),
  }));
  const weights = definition.weights.map(({ dateOffset, ...weight }) => ({
    ...weight,
    date: date(dateOffset),
  }));
  const cabinet = definition.cabinet.map(({ createdAtOffset, refillReminderDateOffset, ...item }) => ({
    ...item,
    startDate: item.cabinetId === "cab-current" ? date(-42) : date(-126),
    createdAt: dateTime(createdAtOffset),
    ...(refillReminderDateOffset === undefined
      ? {}
      : { refillReminderDate: date(refillReminderDateOffset) }),
  }));
  const visitNotes = definition.visitNotes.map(({
    visitDateOffset,
    createdAtOffset,
    followUps,
    ...note
  }) => ({
    ...note,
    visitDate: date(visitDateOffset),
    createdAt: dateTime(createdAtOffset),
    updatedAt: dateTime(visitDateOffset),
    followUps: (followUps ?? []).map(({ dateOffset, ...followUp }) => ({
      ...followUp,
      ...(dateOffset === undefined ? {} : { date: date(dateOffset) }),
    })),
  }));

  return {
    jotrea_user: user,
    jotrea_medication: medication,
    jotrea_doses: doses,
    jotrea_weights: weights,
    jotrea_medication_cabinet: cabinet,
    jotrea_companion_medications: definition.companions.map(({ createdAtOffset, ...companion }) => ({
      ...companion,
      createdAt: dateTime(createdAtOffset),
    })),
    jotrea_cabinet_activity: definition.cabinetActivity,
    jotrea_visit_notes: visitNotes,
    jotrea_daily_checkin: {
      date: date(0),
      water: true,
      protein: true,
      steps: false,
    },
    jotrea_why_dismissed: true,
    jotrea_theme: "light",
    // Premium is the app's existing browser cache path. It keeps the Plus
    // feature gates open without showing or submitting reviewer access UI.
  };
}

const ANDROID_SHIM = `
(() => {
  // @capacitor/core reads this before creating its Capacitor global.
  window.CapacitorCustomPlatform = { name: "android" };
  // The platform check only needs the Android bridge marker. No native
  // plugins are installed and no purchase/share operation is invoked.
  window.androidBridge = window.androidBridge || {};
  // Ask the preview host not to add its own proxy banner. This touches only
  // the host banner's documented dismissal key, never app storage or UI.
  if (window.location.hostname) {
    window.localStorage.setItem(
      "replitDevBannerClosed-" + window.location.hostname,
      "true",
    );
  }
  // Also remove a banner if the host injected one before the dismissal key
  // became available. Reset only the host's body padding left behind by it.
  const removePreviewBanner = () => {
    const root = document.querySelector("#root");
    let removed = false;
    const banner = document.querySelector("#replit-dev-banner");
    if (banner && banner !== root) {
      banner.remove();
      removed = true;
    }
    for (const node of Array.from(document.body?.children ?? [])) {
      if (
        node !== root
        && /temporary development preview/i.test(node.textContent ?? "")
      ) {
        node.remove();
        removed = true;
      }
    }
    if (removed && document.body) document.body.style.paddingTop = "0";
  };
  const installPreviewBannerObserver = () => {
    if (!document.documentElement) {
      setTimeout(installPreviewBannerObserver, 0);
      return;
    }
    new MutationObserver(removePreviewBanner).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    removePreviewBanner();
  };
  setTimeout(installPreviewBannerObserver, 0);
})();
`;

function seedScript(seed) {
  const serialized = JSON.stringify(seed);
  return `
(() => {
  ${ANDROID_SHIM}
  const seed = ${serialized};
  window.localStorage.clear();
  if (window.location.hostname) {
    window.localStorage.setItem(
      "replitDevBannerClosed-" + window.location.hostname,
      "true",
    );
  }
  for (const [key, value] of Object.entries(seed)) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
})();
`;
}

async function evaluate(cdp, sessionId, expression, awaitPromise = true) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description
        ?? result.exceptionDetails.text
        ?? "Runtime evaluation failed",
    );
  }
  return result.result?.value;
}

async function waitFor(cdp, sessionId, expression, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(cdp, sessionId, expression)) return;
    await sleep(100);
  }
  const bodyText = await evaluate(cdp, sessionId, "document.body?.innerText ?? ''").catch(() => "");
  const storageKeys = await evaluate(cdp, sessionId, "Object.keys(localStorage)").catch(() => []);
  throw new Error(`Timed out waiting for: ${expression}\nBody text: ${bodyText.slice(0, 500)}\nStorage keys: ${JSON.stringify(storageKeys)}`);
}

async function waitForText(cdp, sessionId, text) {
  const escaped = JSON.stringify(text);
  await waitFor(
    cdp,
    sessionId,
    `document.body?.innerText?.includes(${escaped}) === true`,
  );
}

async function clickTestId(cdp, sessionId, testId) {
  const escaped = JSON.stringify(`[data-testid="${testId}"]`);
  const clicked = await evaluate(
    cdp,
    sessionId,
    `(() => { const node = document.querySelector(${escaped}); if (!node) return false; node.click(); return true; })()`,
  );
  if (!clicked) throw new Error(`Could not click data-testid=${testId}`);
}

async function waitForTestId(cdp, sessionId, testId) {
  const selector = JSON.stringify(`[data-testid="${testId}"]`);
  await waitFor(cdp, sessionId, `Boolean(document.querySelector(${selector}))`);
}

async function clickText(cdp, sessionId, text) {
  const escaped = JSON.stringify(text);
  const clicked = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const node = Array.from(document.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(${escaped}));
      if (!node) return false;
      node.click();
      return true;
    })()`,
  );
  if (!clicked) throw new Error(`Could not click button containing ${text}`);
}

async function scrollTextToTop(cdp, sessionId, text, topOffset = 0) {
  const escaped = JSON.stringify(text);
  const serializedOffset = JSON.stringify(topOffset);
  const found = await evaluate(
    cdp,
    sessionId,
    `(() => {
      const nodes = Array.from(document.querySelectorAll("h1,h2,h3,h4,p"));
      const node = nodes.find((candidate) => candidate.textContent?.trim() === ${escaped});
      if (!node) return false;
      node.scrollIntoView({ block: "start", inline: "nearest" });
      if (${serializedOffset}) {
        const scrollable = Array.from(document.querySelectorAll("*"))
          .find((candidate) => candidate.contains(node)
            && candidate.scrollHeight > candidate.clientHeight + 2);
        if (scrollable) {
          scrollable.scrollTop = Math.max(0, scrollable.scrollTop - ${serializedOffset});
        } else {
          window.scrollBy(0, -${serializedOffset});
        }
      }
      return true;
    })()`,
  );
  if (!found) throw new Error(`Could not find text to scroll: ${text}`);
}

async function resetToTop(cdp, sessionId) {
  await evaluate(cdp, sessionId, `(() => {
    const scrollables = Array.from(document.querySelectorAll("*"))
      .filter((node) => node.scrollHeight > node.clientHeight + 2);
    for (const node of scrollables) node.scrollTop = 0;
    window.scrollTo(0, 0);
    return true;
  })()`);
}

async function settle(cdp, sessionId) {
  await evaluate(cdp, sessionId, "document.fonts?.ready ?? Promise.resolve()");
  await sleep(350);
}

async function dismissAndCheckPreviewBanner(cdp, sessionId) {
  const status = await evaluate(cdp, sessionId, `(() => {
    const marker = /temporary development preview|publish your app for secure sharing/i;
    const root = document.querySelector("#root");
    const removed = [];
    const banner = document.querySelector("#replit-dev-banner");
    if (banner && banner !== root) {
      banner.remove();
      removed.push("#replit-dev-banner");
    }
    for (const node of Array.from(document.body?.children ?? [])) {
      if (node !== root && marker.test(node.textContent ?? "")) {
        node.remove();
        removed.push(node.tagName.toLowerCase());
      }
    }
    if (removed.length && document.body) document.body.style.paddingTop = "0";
    const iframes = Array.from(document.querySelectorAll("iframe")).map((frame) => ({
      src: frame.getAttribute("src") ?? "",
      title: frame.getAttribute("title") ?? "",
      id: frame.id,
    }));
    const bodyText = document.body?.innerText ?? "";
    return {
      removed,
      bannerNodes: Array.from(document.querySelectorAll("#replit-dev-banner")).length,
      bodyTextHasBanner: marker.test(bodyText),
      iframes,
    };
  })()`);
  if (
    status.bannerNodes > 0
    || status.bodyTextHasBanner
    || status.iframes.length > 0
  ) {
    throw new Error(
      `Preview banner check failed before capture: ${JSON.stringify(status)}`,
    );
  }
  return status;
}

async function capture(cdp, sessionId, filename) {
  const proxyStatus = await dismissAndCheckPreviewBanner(cdp, sessionId);
  const result = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  }, sessionId);
  await writeFile(new URL(`./raw/${filename}`, ROOT), Buffer.from(result.data, "base64"));
  console.log(
    `Captured ${filename} (proxy banner clear; removed ${proxyStatus.removed.length}, iframes ${proxyStatus.iframes.length})`,
  );
}

async function navigate(cdp, sessionId, path) {
  const url = new URL(path, PREVIEW_URL).toString();
  await cdp.send("Page.navigate", { url }, sessionId);
  await waitFor(cdp, sessionId, "document.readyState === 'complete'", 15000);
  await waitForText(cdp, sessionId, path === "/" ? "Log My Dose" : ({
    "/calendar": "Dose Log",
    "/weight": "Weight",
    "/medication-cabinet": "Medication History & Context",
    "/visit-summary": "Provider Visit Summary",
    "/visit-notes": "Visit Notes",
    "/settings": "Settings",
  }[path] ?? "Jotrea"));
  await settle(cdp, sessionId);
}

async function runCaptures(cdp, sessionId) {
  await navigate(cdp, sessionId, "/");
  await resetToTop(cdp, sessionId);
  await capture(cdp, sessionId, "01-dashboard.png");

  await navigate(cdp, sessionId, "/calendar");
  await clickTestId(cdp, sessionId, "list-view-btn");
  await settle(cdp, sessionId);
  await resetToTop(cdp, sessionId);
  await capture(cdp, sessionId, "02-dose-history.png");

  await navigate(cdp, sessionId, "/weight");
  await resetToTop(cdp, sessionId);
  await capture(cdp, sessionId, "03-weight.png");

  await navigate(cdp, sessionId, "/calendar");
  await clickTestId(cdp, sessionId, "add-dose-btn");
  await waitForTestId(cdp, sessionId, "save-dose-btn");
  await clickTestId(cdp, sessionId, "save-dose-btn");
  await waitForTestId(cdp, sessionId, "dose-confirm-screen");
  await clickText(cdp, sessionId, "Nausea");
  await settle(cdp, sessionId);
  await capture(cdp, sessionId, "04-symptoms.png");

  await navigate(cdp, sessionId, "/medication-cabinet");
  await resetToTop(cdp, sessionId);
  await capture(cdp, sessionId, "05-medication-cabinet.png");

  await navigate(cdp, sessionId, "/visit-summary");
  await resetToTop(cdp, sessionId);
  await capture(cdp, sessionId, "06-provider-summary.png");

  await navigate(cdp, sessionId, "/visit-notes");
  await resetToTop(cdp, sessionId);
  await capture(cdp, sessionId, "07-visit-notes.png");

  await navigate(cdp, sessionId, "/settings");
  // Keep the export heading just below the top edge for context while
  // minimizing the following About section. This changes only scroll position.
  await scrollTextToTop(cdp, sessionId, "Export & Share", 32);
  await settle(cdp, sessionId);
  await capture(cdp, sessionId, "08-exports.png");
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const definition = JSON.parse(await readFile(SEED_URL, "utf8"));
  const seed = materializeSeed(definition);
  const port = await freePort();
  const chrome = spawn(CHROMIUM, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--hide-scrollbars",
    "--mute-audio",
    "--timezone=UTC",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=/tmp/jotrea-google-play-${process.pid}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  try {
    let version;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        version = await readJson(`http://127.0.0.1:${port}/json/version`);
        break;
      } catch {
        await sleep(100);
      }
    }
    if (!version?.webSocketDebuggerUrl) throw new Error("Chromium CDP endpoint did not start");

    const cdp = new CdpConnection(version.webSocketDebuggerUrl);
    const { browserContextId } = await cdp.send("Target.createBrowserContext", {
      disposeOnDetach: true,
    });
    const { targetId } = await cdp.send("Target.createTarget", {
      url: "about:blank",
      browserContextId,
    });
    const { sessionId } = await cdp.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      mobile: true,
      screenWidth: WIDTH,
      screenHeight: HEIGHT,
    }, sessionId);
    await cdp.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 5,
    }, sessionId);
    await cdp.send("Network.enable", {}, sessionId);
    await cdp.send("Network.setBlockedURLs", {
      urls: [
        "*revenuecat.com*",
        "*api.revenuecat.com*",
        "*appsflyer.com*",
        "*google-analytics.com*",
      ],
    }, sessionId);
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: seedScript(seed),
    }, sessionId);
    await runCaptures(cdp, sessionId);
    await cdp.send("Target.disposeBrowserContext", { browserContextId }).catch(() => {});
    cdp.close();
  } finally {
    chrome.kill("SIGTERM");
    await sleep(100);
    if (!chrome.killed) chrome.kill("SIGKILL");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});