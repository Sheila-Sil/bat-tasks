importScripts("shared.js");

const PHASE_ALARM = "nw-phase-end";
const BADGE_ALARM = "nw-badge";

async function sync() {
  const { timer } = await NW.store.get(["timer"]);
  await chrome.alarms.clear(PHASE_ALARM);
  await chrome.alarms.clear(BADGE_ALARM);

  if (timer && timer.running && timer.endAt) {
    if (timer.endAt <= Date.now()) return finish();
    chrome.alarms.create(PHASE_ALARM, { when: timer.endAt });
    chrome.alarms.create(BADGE_ALARM, { periodInMinutes: 0.5 });
  }
  updateBadge(timer);
}

function updateBadge(timer) {
  if (!timer || (!timer.running && timer.remaining === timer.total)) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }
  const ms = timer.running ? timer.endAt - Date.now() : timer.remaining;
  const mins = Math.max(0, Math.ceil(ms / 60000));
  chrome.action.setBadgeText({ text: timer.running ? `${mins}m` : "II" });
  chrome.action.setBadgeBackgroundColor({ color: timer.phase === "focus" ? "#F2F4F7" : "#5B6B82" });
  if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: timer.phase === "focus" ? "#0B1018" : "#FFFFFF" });
}

async function finish() {
  const notice = await NW.completeIfDue();
  if (notice) {
    chrome.notifications.create("nw-" + Date.now(), {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: notice.title,
      message: notice.message,
      priority: 2,
    });
  }
  // storage change will trigger sync() again
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === PHASE_ALARM) return finish();
  if (alarm.name === BADGE_ALARM) {
    const { timer } = await NW.store.get(["timer"]);
    if (timer && timer.running && timer.endAt <= Date.now()) return finish();
    updateBadge(timer);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.timer) sync();
});

chrome.runtime.onStartup.addListener(sync);
chrome.runtime.onInstalled.addListener(sync);
