/** Jotrea Service Worker — notification scheduling + deep-link routing */

const JOTREA_PREFIX = 'jotrea-';
const pendingTimeouts = new Map(); // tag → timeoutId

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Message handler ──────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'SCHEDULE') {
    const { tag, title, body, data, delayMs } = payload;
    // Replace any existing pending notification for this tag
    if (pendingTimeouts.has(tag)) {
      clearTimeout(pendingTimeouts.get(tag));
      pendingTimeouts.delete(tag);
    }
    // Skip past-due or too-far-future notifications (>14 days — SW won't survive that long anyway)
    if (delayMs <= 0 || delayMs > 14 * 24 * 60 * 60 * 1000) return;

    const id = setTimeout(() => {
      pendingTimeouts.delete(tag);
      self.registration.showNotification(title, { body, tag, data, requireInteraction: false });
    }, delayMs);
    pendingTimeouts.set(tag, id);
  }

  if (type === 'CANCEL_TAG') {
    const { tag } = payload;
    if (pendingTimeouts.has(tag)) {
      clearTimeout(pendingTimeouts.get(tag));
      pendingTimeouts.delete(tag);
    }
    // Also dismiss any already-shown notification with this tag
    self.registration.getNotifications({ tag }).then((ns) => ns.forEach((n) => n.close()));
  }

  if (type === 'CANCEL_ALL') {
    for (const id of pendingTimeouts.values()) clearTimeout(id);
    pendingTimeouts.clear();
    self.registration.getNotifications().then((ns) =>
      ns.filter((n) => n.tag && n.tag.startsWith(JOTREA_PREFIX)).forEach((n) => n.close())
    );
  }
});

// ─── Notification tap → deep-link into app ────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data || {}).path || '/';
  const scope = self.registration.scope;
  const targetUrl = scope.endsWith('/') ? scope + path.replace(/^\//, '') : scope + path;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((wins) => {
        // Focus an already-open window and ask it to navigate
        for (const win of wins) {
          if (win.url.startsWith(scope)) {
            win.focus();
            win.postMessage({ type: 'NAVIGATE', path });
            return;
          }
        }
        // No window found — open a new one
        return self.clients.openWindow(targetUrl);
      })
  );
});
