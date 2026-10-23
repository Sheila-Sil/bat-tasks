(() => {
  const { store, DEFAULT_SETTINGS, PHASES, freshTimer, dayKey, bumpStat, completeIfDue } = NW;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const FULL = new URLSearchParams(location.search).has("full");
  if (FULL) document.body.classList.add("full");
  NightScene.mount($("#scene"), $("#rain"));

  const S = {
    tasks: [],
    timer: null,
    settings: { ...DEFAULT_SETTINGS },
    notes: "",
    stats: { days: {} },
    ui: { view: "tasks" },
  };
  const KEYS = ["tasks", "timer", "settings", "notes", "stats", "ui"];

  async function load() {
    const data = await store.get(KEYS);
    for (const [k, v] of Object.entries(data)) if (v !== undefined) S[k] = v;
    S.settings = { ...DEFAULT_SETTINGS, ...S.settings };
    S.ui = { view: "tasks", ...S.ui };
    // tasks from v1 used threat levels; keep level 3 as starred
    S.tasks = S.tasks.map((t) => ({ star: t.level === 3, ...t, doneAt: t.doneAt ?? t.closedAt ?? null }));
    if (!S.timer) S.timer = freshTimer(S.settings);
  }

  const save = (...keys) => store.set(Object.fromEntries(keys.map((k) => [k, S[k]])));

  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const two = (n) => String(n).padStart(2, "0");
  const hhmm = (t) => { const d = new Date(t); return `${two(d.getHours())}:${two(d.getMinutes())}`; };
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${two(Math.floor(s / 60))}:${two(s % 60)}`; };
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const icon = (id) => `<svg><use href="#i-${id}"/></svg>`;
  const today = () => (S.stats.days || {})[dayKey()] || { focusMin: 0, sessions: 0, closed: 0 };
  const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${two(m % 60)}m` : `${m}m`);

  /* ── Views ── */
  function setView(v) {
    S.ui.view = v;
    document.body.dataset.view = v;
    $$(".nav button").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
    $$(".view").forEach((el) => el.classList.toggle("on", el.dataset.view === v));
    save("ui");
  }

  /* ── Tasks ── */
  function renderTasks() {
    const d = new Date();
    const open = S.tasks.filter((t) => !t.done).length;
    $("#hero-day").textContent = DAYS[d.getDay()];
    $("#hero-sub").textContent = `${d.getDate()} ${MONTHS[d.getMonth()]} · ${open ? `${open} to do` : "All clear"}`;

    const list = [...S.tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.done) return (b.doneAt || 0) - (a.doneAt || 0);
      if (a.star !== b.star) return a.star ? -1 : 1;
      return a.createdAt - b.createdAt;
    });
    const active = S.timer.targetId;
    $("#tasks").innerHTML = list
      .map(
        (t) => `
      <li class="task${t.done ? " done" : ""}${t.id === active && !t.done ? " active" : ""}" data-id="${t.id}">
        <button class="check" data-act="toggle" aria-label="${t.done ? "Mark not done" : "Mark done"}">${icon("check")}</button>
        <div class="title" data-act="edit">${esc(t.title)}</div>
        <div class="acts">
          ${t.done ? "" : `<button data-act="focus" title="Focus on this">${icon("play")}</button>`}
          ${t.done ? "" : `<button class="star${t.star ? " on" : ""}" data-act="star" title="Priority">${icon("star")}</button>`}
          <button data-act="delete" title="Delete">${icon("x")}</button>
        </div>
      </li>`
      )
      .join("");
    $("#empty").hidden = S.tasks.length > 0;
    $("#clear-done").hidden = !S.tasks.some((t) => t.done);
  }

  async function addTask(title) {
    title = title.trim();
    if (!title) return;
    S.tasks.push({ id: crypto.randomUUID(), title, star: false, done: false, createdAt: Date.now(), doneAt: null });
    await save("tasks");
    renderTasks();
  }

  function editTitle(el, t) {
    el.contentEditable = "true";
    el.focus();
    document.getSelection().selectAllChildren(el);
    const finish = async (commit) => {
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("keydown", onKey);
      el.contentEditable = "false";
      const v = el.textContent.trim();
      if (commit && v && v !== t.title) {
        t.title = v.slice(0, 140);
        await save("tasks");
      }
      renderAll();
    };
    const onBlur = () => finish(true);
    const onKey = (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      if (e.key === "Escape") { e.preventDefault(); finish(false); }
    };
    el.addEventListener("blur", onBlur);
    el.addEventListener("keydown", onKey);
  }

  function bindTasks() {
    $("#add").addEventListener("submit", (e) => {
      e.preventDefault();
      addTask($("#add-input").value);
      $("#add-input").value = "";
    });
    $("#clear-done").addEventListener("click", async () => {
      S.tasks = S.tasks.filter((t) => !t.done);
      await save("tasks");
      renderTasks();
    });
    const list = $("#tasks");
    list.addEventListener("click", async (e) => {
      const act = e.target.closest("[data-act]");
      const li = e.target.closest(".task");
      if (!act || !li || act.dataset.act === "edit") return;
      const t = S.tasks.find((x) => x.id === li.dataset.id);
      if (!t) return;
      if (act.dataset.act === "toggle") {
        t.done = !t.done;
        t.doneAt = t.done ? Date.now() : null;
        bumpStat(S.stats, "closed", t.done ? 1 : -1);
        if (t.done && S.timer.targetId === t.id) S.timer.targetId = null;
        await save("tasks", "stats", "timer");
      } else if (act.dataset.act === "star") {
        t.star = !t.star;
        await save("tasks");
      } else if (act.dataset.act === "delete") {
        S.tasks = S.tasks.filter((x) => x !== t);
        if (S.timer.targetId === t.id) S.timer.targetId = null;
        await save("tasks", "timer");
      } else if (act.dataset.act === "focus") {
        if (S.timer.phase !== "focus") S.timer = freshTimer(S.settings, "focus", S.timer.cycle);
        S.timer.targetId = t.id;
        if (!S.timer.running) {
          S.timer.running = true;
          S.timer.endAt = Date.now() + S.timer.remaining;
        }
        await save("timer");
        if (!FULL) setView("timer");
      }
      renderAll();
    });
    list.addEventListener("dblclick", (e) => {
      const el = e.target.closest(".title");
      const li = e.target.closest(".task");
      const t = li && S.tasks.find((x) => x.id === li.dataset.id);
      if (el && t && !t.done) editTitle(el, t);
    });
  }

  /* ── Timer ── */
  const CIRC = 2 * Math.PI * 94;
  const remaining = () => (S.timer.running ? S.timer.endAt - Date.now() : S.timer.remaining);

  function renderTimer() {
    const t = S.timer;
    const rem = remaining();
    $("#digits").textContent = mmss(rem);
    $("#ring-fill").style.strokeDashoffset = CIRC * (1 - Math.min(1, Math.max(0, 1 - rem / t.total)));

    const target = S.tasks.find((x) => x.id === t.targetId && !x.done);
    $("#dial-task").textContent = t.phase === "focus" && target ? target.title : PHASES[t.phase];
    $$("#modes button").forEach((b) => b.classList.toggle("on", b.dataset.phase === t.phase));

    const every = S.settings.longEvery;
    const done = t.cycle % every;
    const doneCount = t.phase !== "focus" && done === 0 && t.cycle > 0 ? every : done;
    $("#dots").innerHTML = Array.from({ length: every }, (_, i) =>
      `<i class="${i < doneCount ? "on" : t.phase === "focus" && i === done ? "now" : ""}"></i>`
    ).join("");

    $("#play").innerHTML = icon(t.running ? "pause" : "play");
    $("#play").setAttribute("aria-label", t.running ? "Pause" : "Start");

    const navTimer = $("#nav-timer");
    const showLive = (t.running || rem < t.total) && S.ui.view !== "timer";
    navTimer.textContent = showLive ? mmss(rem) : "Timer";
    navTimer.classList.toggle("live", showLive);
    document.title = t.running ? `${mmss(rem)} · Nightwatch` : "Nightwatch";
  }

  async function toggleTimer() {
    const t = S.timer;
    if (t.running) {
      t.remaining = Math.max(0, t.endAt - Date.now());
      t.running = false;
      t.endAt = null;
    } else {
      t.running = true;
      t.endAt = Date.now() + t.remaining;
    }
    await save("timer");
    renderTimer();
  }

  async function setPhase(phase, cycle = S.timer.cycle) {
    S.timer = freshTimer(S.settings, phase, cycle, S.timer.targetId);
    await save("timer");
    renderAll();
  }

  function skip() {
    const t = S.timer;
    if (t.phase === "focus") {
      const next = (t.cycle + 1) % S.settings.longEvery === 0 ? "long" : "short";
      return setPhase(next, t.cycle + 1);
    }
    return setPhase("focus", t.phase === "long" ? 0 : t.cycle);
  }

  function bindTimer() {
    $("#play").addEventListener("click", toggleTimer);
    $("#reset").addEventListener("click", () => setPhase(S.timer.phase));
    $("#skip").addEventListener("click", skip);
    $("#modes").addEventListener("click", (e) => e.target.dataset.phase && setPhase(e.target.dataset.phase));
    $("#tune").addEventListener("click", () => ($("#sheet").hidden = !$("#sheet").hidden));
    $("#sheet-done").addEventListener("click", () => ($("#sheet").hidden = true));

    const fields = { "#set-focus": "focus", "#set-short": "short", "#set-long": "long", "#set-every": "longEvery" };
    for (const [sel, key] of Object.entries(fields)) {
      const el = $(sel);
      el.value = S.settings[key];
      el.addEventListener("change", async () => {
        const v = Math.min(+el.max, Math.max(+el.min, Math.round(+el.value || S.settings[key])));
        el.value = v;
        S.settings[key] = v;
        const t = S.timer;
        if (!t.running && t.remaining === t.total) S.timer = freshTimer(S.settings, t.phase, t.cycle, t.targetId);
        await save("settings", "timer");
        renderTimer();
      });
    }
    $("#set-auto").checked = S.settings.autoBreak;
    $("#set-sound").checked = S.settings.sound;
    $("#set-auto").addEventListener("change", (e) => { S.settings.autoBreak = e.target.checked; save("settings"); });
    $("#set-sound").addEventListener("change", (e) => { S.settings.sound = e.target.checked; save("settings"); });
  }

  function chime() {
    if (!S.settings.sound) return;
    try {
      const ctx = new AudioContext();
      [[523.25, 0], [783.99, 0.16]].forEach(([f, at]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
        g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.7);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + at);
        o.stop(ctx.currentTime + at + 0.75);
      });
    } catch (e) {}
  }

  let completing = false;
  async function tick() {
    if (FULL) $("#clock").textContent = hhmm(Date.now());
    const t = S.timer;
    if (!t.running) return;
    renderTimer();
    // The service worker completes phases via chrome.alarms; this covers previews outside Chrome
    // and alarms that fire late.
    if (!completing && Date.now() - t.endAt > (NW.hasChrome ? 4000 : 0)) {
      completing = true;
      await completeIfDue();
      if (!NW.hasChrome) {
        const prev = t.phase;
        await load();
        if (S.timer.phase !== prev) chime();
        renderAll();
      }
      completing = false;
    }
  }

  /* ── Notes ── */
  function bindNotes() {
    const ta = $("#notes");
    const meta = $("#notes-meta");
    ta.value = S.notes;
    let timer;
    ta.addEventListener("input", () => {
      S.notes = ta.value;
      meta.textContent = "Saving…";
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await save("notes");
        meta.textContent = "Saved";
      }, 350);
    });
    $("#notes-copy").addEventListener("click", async (e) => {
      try {
        await navigator.clipboard.writeText(ta.value);
        e.target.textContent = "Copied";
        setTimeout(() => (e.target.textContent = "Copy"), 1200);
      } catch (err) {}
    });
  }

  /* ── Stats ── */
  function streak() {
    const days = S.stats.days || {};
    const active = (k) => days[k] && (days[k].focusMin > 0 || days[k].closed > 0);
    const d = new Date();
    if (!active(dayKey(d))) d.setDate(d.getDate() - 1);
    let n = 0;
    while (active(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function renderStats() {
    const td = today();
    $("#st-focus").textContent = fmtMin(td.focusMin);
    $("#st-sessions").textContent = td.sessions;
    $("#st-done").textContent = td.closed;
    $("#st-streak").textContent = streak();

    const cols = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const rec = (S.stats.days || {})[dayKey(d)];
      cols.push({ day: DAYS[d.getDay()][0], min: rec ? rec.focusMin : 0, today: i === 0 });
    }
    const max = Math.max(60, ...cols.map((c) => c.min));
    const h = FULL ? 70 : 110;
    $("#chart").innerHTML = cols
      .map((c) => `
      <div class="col${c.today ? " today" : ""}">
        <span class="col-val">${c.min ? fmtMin(c.min) : ""}</span>
        <span class="col-bar" style="height:${Math.max(4, (c.min / max) * h)}px"></span>
        <span class="col-day">${c.day}</span>
      </div>`)
      .join("");
  }

  /* ── Glue ── */
  function renderAll() {
    renderTasks();
    renderTimer();
    renderStats();
  }

  function bindGlobal() {
    $$(".nav button").forEach((b) => b.addEventListener("click", () => { setView(b.dataset.view); renderTimer(); }));
    $("#expand").addEventListener("click", () => {
      if (NW.hasChrome && chrome.tabs) {
        chrome.tabs.create({ url: chrome.runtime.getURL("app.html?full=1") });
        window.close();
      } else window.open("app.html?full=1", "_blank");
    });

    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, textarea, [contenteditable='true']") || e.metaKey || e.ctrlKey || e.altKey) return;
      const views = ["tasks", "timer", "notes", "stats"];
      if (!FULL && e.key >= "1" && e.key <= "4") { setView(views[+e.key - 1]); renderTimer(); }
      else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        if (!FULL) setView("tasks");
        $("#add-input").focus();
      } else if (e.key === " " && (FULL || S.ui.view === "timer")) {
        e.preventDefault();
        toggleTimer();
      }
    });

    store.onChange((changes) => {
      if (changes.timer) {
        const a = changes.timer.oldValue, b = changes.timer.newValue;
        if (a && b && a.running && a.phase !== b.phase) chime();
      }
      for (const [k, { newValue }] of Object.entries(changes)) {
        if (k === "notes" || k === "ui" || newValue === undefined) continue;
        S[k] = k === "settings" ? { ...DEFAULT_SETTINGS, ...newValue } : newValue;
      }
      renderAll();
    });
  }

  (async function init() {
    await load();
    await completeIfDue(); // a phase may have ended while everything was closed
    await load();
    bindGlobal();
    bindTasks();
    bindTimer();
    bindNotes();
    setView(FULL ? "tasks" : S.ui.view);
    renderAll();
    tick();
    setInterval(tick, 250);
  })();
})();
