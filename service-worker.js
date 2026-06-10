// Pinaki Alarm - Service Worker
// Handles background alarm notifications

const CACHE = "pinaki-v1";
const ASSETS = ["/", "/index.html", "/manifest.json"];

// ── Install: cache core files ──────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ─────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache, fall back to network ──────────
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// ── Background alarm check ─────────────────────────────────
// The app sends alarm times to the SW via postMessage.
// The SW checks every minute and fires a notification when it's time.

let scheduledAlarms = []; // array of "HH:MM" strings

self.addEventListener("message", e => {
  if (e.data && e.data.type === "SET_ALARMS") {
    scheduledAlarms = e.data.alarms || [];
    console.log("[SW] Alarms updated:", scheduledAlarms);
  }
});

// Check alarms every minute
let lastFired = "";
setInterval(() => {
  if (!scheduledAlarms.length) return;
  const now  = new Date();
  const hh   = String(now.getHours()).padStart(2, "0");
  const mm   = String(now.getMinutes()).padStart(2, "0");
  const cur  = hh + ":" + mm;
  if (scheduledAlarms.includes(cur) && cur !== lastFired) {
    lastFired = cur;
    fireAlarmNotification(cur);
  }
}, 10000); // check every 10 seconds for reliability

function fireAlarmNotification(time) {
  const [h, m] = time.split(":").map(Number);
  const ap  = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  const label = String(h12).padStart(2,"0") + ":" + String(m).padStart(2,"0") + " " + ap;

  self.registration.showNotification("⏰ Pinaki Alarm", {
    body: "Your " + label + " alarm is ringing! Open the app to earn a Charity Point.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "pinaki-alarm-" + time,
    requireInteraction: true,   // stays on screen until user taps
    vibrate: [500, 200, 500, 200, 500],
    actions: [
      { action: "open",  title: "Open App" },
      { action: "snooze", title: "Snooze 5 min" }
    ]
  });
}

// ── Notification click handler ─────────────────────────────
self.addEventListener("notificationclick", e => {
  e.notification.close();

  if (e.action === "snooze") {
    // Re-fire after 5 minutes
    const tag  = e.notification.tag; // "pinaki-alarm-HH:MM"
    const time = tag.replace("pinaki-alarm-", "");
    setTimeout(() => fireAlarmNotification(time), 5 * 60 * 1000);
    return;
  }

  // "open" or tapping the notification — focus or open the app
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow("/");
    })
  );
});
