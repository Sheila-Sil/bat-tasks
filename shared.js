/* Shared state + timer logic. Loaded by the popup (app.html) and the service worker. */
(function (root) {
  const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

  // Falls back to localStorage so app.html can be opened as a plain file for previewing.
  const store = {
    async get(keys) {
      if (hasChrome) return chrome.storage.local.get(keys);
      const out = {};
      for (const k of keys) {
        try {
          const v = localStorage.getItem("nw:" + k);
          if (v !== null) out[k] = JSON.parse(v);
        } catch (e) {}
      }
      return out;
    },
    async set(obj) {
      if (hasChrome) return chrome.storage.local.set(obj);
      for (const [k, v] of Object.entries(obj)) {
        try { localStorage.setItem("nw:" + k, JSON.stringify(v)); } catch (e) {}
      }
    },
    onChange(fn) {
      if (hasChrome) chrome.storage.onChanged.addListener((changes, area) => area === "local" && fn(changes));
    },
  };

  const DEFAULT_SETTINGS = { focus: 25, short: 5, long: 15, longEvery: 4, autoBreak: false, sound: true };

  const PHASES = { focus: "Focus", short: "Short break", long: "Long break" };

  function freshTimer(settings, phase = "focus", cycle = 0, targetId = null) {
    const total = settings[phase] * 60 * 1000;
    return { phase, running: false, endAt: null, remaining: total, total, cycle, targetId };
  }

  function dayKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function bumpStat(stats, field, by = 1) {
    stats.days = stats.days || {};
    const k = dayKey();
    const day = stats.days[k] || (stats.days[k] = { focusMin: 0, sessions: 0, closed: 0 });
    day[field] = Math.max(0, (day[field] || 0) + by);
    const keys = Object.keys(stats.days).sort();
    while (keys.length > 60) delete stats.days[keys.shift()];
    return stats;
  }

  // Completes the current phase if it has run out. Returns a notification, or null.
  async function completeIfDue() {
    const s = await store.get(["timer", "settings", "stats"]);
    const settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
    const timer = s.timer;
    if (!timer || !timer.running || !timer.endAt || timer.endAt > Date.now() + 500) return null;

    const stats = s.stats || { days: {} };
    let next, notice;

    if (timer.phase === "focus") {
      bumpStat(stats, "focusMin", Math.round(timer.total / 60000));
      bumpStat(stats, "sessions", 1);
      const cycle = timer.cycle + 1;
      const phase = cycle % settings.longEvery === 0 ? "long" : "short";
      next = freshTimer(settings, phase, cycle, timer.targetId);
      notice = { title: "Focus done", message: `Take ${settings[phase]} minutes.` };
      if (settings.autoBreak) {
        next.running = true;
        next.endAt = Date.now() + next.total;
      }
    } else {
      next = freshTimer(settings, "focus", timer.phase === "long" ? 0 : timer.cycle, timer.targetId);
      notice = { title: "Break over", message: "Back to it." };
    }

    await store.set({ timer: next, stats });
    return notice;
  }

  root.NW = { store, hasChrome, DEFAULT_SETTINGS, PHASES, freshTimer, dayKey, bumpStat, completeIfDue };
})(typeof self !== "undefined" ? self : window);
