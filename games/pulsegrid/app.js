"use strict";
const $ = (id) => document.getElementById(id);
const names = [
  "Kick",
  "Snare",
  "Closed hat",
  "Open hat",
  "Percussion",
  "Synth",
];
const colors = [
  "#cafa79",
  "#87d6ee",
  "#d4b1ff",
  "#f4c876",
  "#f299b8",
  "#90aea6",
];
const defaults = () => ({
  version: 1,
  steps: 16,
  bpm: 126,
  swing: 0,
  palette: "cyber",
  filterType: "lowpass",
  filter: 100,
  drive: 8,
  delay: 15,
  division: 0.5,
  reverb: 12,
  tracks: names.map(() => ({
    hits: Array(32).fill(0),
    length: 16,
    mute: false,
    solo: false,
    note: 45,
  })),
});
let state = defaults(),
  ctx,
  engine,
  playing = false,
  timer,
  nextTime = 0,
  tick = 0,
  visual = [],
  roll = 0,
  rollStep = 0;
function notify(text) {
  $("status").textContent = text;
}
function validate(data) {
  if (
    !data ||
    data.version !== 1 ||
    ![16, 32].includes(data.steps) ||
    !Array.isArray(data.tracks) ||
    data.tracks.length !== 6
  )
    throw Error("Invalid PulseGrid pattern");
  const s = defaults();
  for (const [key, min, max] of [
    ["bpm", 60, 200],
    ["swing", 0, 60],
    ["filter", 0, 100],
    ["drive", 0, 100],
    ["delay", 0, 75],
    ["reverb", 0, 70],
  ]) {
    if (!Number.isFinite(data[key]) || data[key] < min || data[key] > max)
      throw Error("Invalid " + key);
    s[key] = data[key];
  }
  s.steps = data.steps;
  s.palette = ["cyber", "future", "minimal"].includes(data.palette)
    ? data.palette
    : "cyber";
  s.filterType = data.filterType === "highpass" ? "highpass" : "lowpass";
  s.division = data.division === 1 ? 1 : 0.5;
  s.tracks = data.tracks.map((t) => {
    if (
      !Array.isArray(t.hits) ||
      t.hits.length !== 32 ||
      t.hits.some((v) => ![0, 1, 2, 3].includes(v)) ||
      !Number.isInteger(t.length) ||
      t.length < 1 ||
      t.length > 32
    )
      throw Error("Invalid track");
    return {
      hits: t.hits,
      length: t.length,
      mute: !!t.mute,
      solo: !!t.solo,
      note: [33, 36, 40, 43, 45, 48, 52, 55, 57, 60].includes(t.note)
        ? t.note
        : 45,
    };
  });
  return s;
}
function persist() {
  try {
    localStorage.setItem("pulsegrid-v1", JSON.stringify(state));
  } catch {}
}
function draw() {
  const matrix = $("matrix");
  matrix.style.setProperty("--steps", state.steps);
  matrix.innerHTML = "";
  const ruler = document.createElement("div");
  ruler.className = "ruler";
  ruler.innerHTML =
    "<span>VOICE / MUTE · SOLO · LENGTH</span>" +
    Array.from(
      { length: state.steps },
      (_, i) => `<span>${String(i + 1).padStart(2, "0")}</span>`,
    ).join("");
  matrix.append(ruler);
  state.tracks.forEach((t, r) => {
    const row = document.createElement("div");
    row.className = "lane" + (t.mute ? " muted" : "");
    row.style.setProperty("--color", colors[r]);
    const head = document.createElement("div");
    head.className = "track";
    const voice = document.createElement("button");
    voice.className = "voice";
    voice.textContent = names[r];
    voice.setAttribute("aria-pressed", String(t.mute));
    voice.onclick = () => {
      t.mute = !t.mute;
      draw();
      persist();
    };
    head.append(voice);
    const solo = document.createElement("button");
    solo.className = "solo" + (t.solo ? " selected" : "");
    solo.textContent = "S";
    solo.title = "Solo " + names[r];
    solo.setAttribute("aria-pressed", String(t.solo));
    solo.onclick = () => {
      t.solo = !t.solo;
      draw();
      persist();
    };
    head.append(solo);
    const length = document.createElement("select");
    length.setAttribute("aria-label", names[r] + " loop length");
    for (let i = 1; i <= 32; i++)
      length.add(new Option(i, i, false, t.length === i));
    length.onchange = () => {
      t.length = +length.value;
      persist();
    };
    head.append(length);
    if (r === 5) {
      const note = document.createElement("select");
      note.className = "note";
      note.setAttribute("aria-label", "Synth note");
      [33, 36, 40, 43, 45, 48, 52, 55, 57, 60].forEach((n, i) =>
        note.add(
          new Option(
            ["A1", "C2", "E2", "G2", "A2", "C3", "E3", "G3", "A3", "C4"][i],
            n,
            false,
            t.note === n,
          ),
        ),
      );
      note.onchange = () => {
        t.note = +note.value;
        persist();
      };
      head.append(note);
    }
    row.append(head);
    for (let i = 0; i < state.steps; i++) {
      const b = document.createElement("button");
      b.className =
        "step" +
        (Math.floor(i / 4) % 2 === 0 ? " group" : "") +
        ["", " on", " on accent", " on soft"][t.hits[i]];
      b.dataset.step = i;
      b.dataset.track = r;
      b.setAttribute(
        "aria-label",
        `${names[r]}, step ${i + 1}: ${["off", "normal", "accent", "soft"][t.hits[i]]}`,
      );
      b.setAttribute("aria-pressed", String(!!t.hits[i]));
      // Native keyboard activation has no pointer gesture.
      b.onclick = (event) => {
        if (event.detail !== 0) return;
        editStep(b, false, event.shiftKey);
        persist();
      };
      row.append(b);
    }
    matrix.append(row);
  });
}
// Delegate pointer gestures so the pointer stays captured while editing cells.
let gesture = null;
let lastTap = null;
function editStep(button, clear = false, velocity = false) {
  const r = Number(button.dataset.track);
  const i = Number(button.dataset.step);
  const track = state.tracks[r];
  track.hits[i] = clear ? 0 : velocity ? (track.hits[i] + 1) % 4 : track.hits[i] ? 0 : 1;
  const value = track.hits[i];
  button.classList.toggle("on", value !== 0);
  button.classList.toggle("accent", value === 2);
  button.classList.toggle("soft", value === 3);
  button.setAttribute("aria-pressed", String(value !== 0));
  button.setAttribute("aria-label", `${names[r]}, step ${i + 1}: ${["off", "normal", "accent", "soft"][value]}`);
}
function visitStep(button) {
  if (!button || !$("matrix").contains(button)) return;
  const key = button.dataset.track + ":" + button.dataset.step;
  if (gesture.visited.has(key)) return;
  gesture.visited.add(key);
  editStep(button, false, gesture.velocity);
}
$("matrix").addEventListener("pointerdown", (event) => {
  const button = event.target.closest(".step");
  if (!button || gesture || event.button !== 0 || !event.isPrimary) return;
  event.preventDefault();
  button.focus({ preventScroll: true });
  const key = button.dataset.track + ":" + button.dataset.step;
  const doubleTap = lastTap && lastTap.key === key && performance.now() - lastTap.time < 350;
  gesture = { id: event.pointerId, visited: new Set(), velocity: event.shiftKey,
    x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY,
    key, moved: false, doubleTap };
  $("matrix").setPointerCapture(event.pointerId);
  if (doubleTap) {
    editStep(button, true);
    gesture.visited.add(key);
  } else visitStep(button);
});
$("matrix").addEventListener("pointermove", (event) => {
  if (!gesture || gesture.id !== event.pointerId) return;
  event.preventDefault();
  if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 6) gesture.moved = true;
  if (!gesture.moved) return;
  // Sample the whole segment so quick swipes do not skip narrow cells.
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
  const count = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
  for (let n = 1; n <= count; n++) {
    const element = document.elementFromPoint(gesture.x + dx * n / count, gesture.y + dy * n / count);
    visitStep(element?.closest(".step"));
  }
  gesture.x = event.clientX;
  gesture.y = event.clientY;
});
function finishGesture(event) {
  if (!gesture || gesture.id !== event.pointerId) return;
  lastTap = event.type === "pointerup" && !gesture.moved && !gesture.doubleTap
    ? { key: gesture.key, time: performance.now() } : null;
  gesture = null;
  persist();
}
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  $("matrix").addEventListener(type, finishGesture);
}
function sync() {
  for (const k of [
    "steps",
    "bpm",
    "swing",
    "palette",
    "filterType",
    "filter",
    "drive",
    "delay",
    "division",
    "reverb",
  ])
    $(k).value = state[k];
  $("swingValue").textContent = state.swing + "%";
  draw();
  updateFX();
}
function preset(name) {
  state.tracks.forEach((t) => {
    t.hits.fill(0);
    t.length = state.steps;
    t.mute = false;
    t.solo = false;
  });
  const put = (r, steps, v = 1) =>
    steps.forEach((i) => {
      for (let j = i; j < 32; j += 16) state.tracks[r].hits[j] = v;
    });
  if (name === "house") {
    put(0, [0, 4, 8, 12], 2);
    put(1, [4, 12]);
    put(2, [0, 2, 4, 6, 8, 10, 12, 14]);
    put(3, [2, 6, 10, 14]);
    put(4, [7, 15], 3);
    put(5, [0, 3, 6, 10], 3);
    state.bpm = 126;
  }
  if (name === "dubstep") {
    put(0, [0, 7, 10]);
    put(1, [8], 2);
    put(2, [0, 2, 4, 6, 8, 10, 12, 13, 14, 15]);
    put(4, [6, 14]);
    put(5, [0, 6, 10]);
    state.bpm = 140;
  }
  if (name === "trance") {
    put(0, [0, 4, 8, 12], 2);
    put(1, [4, 12]);
    put(
      2,
      Array.from({ length: 16 }, (_, i) => i),
      3,
    );
    put(3, [2, 6, 10, 14]);
    put(5, [0, 2, 3, 6, 8, 10, 11, 14]);
    state.bpm = 138;
  }
  if (name === "dnb") {
    put(0, [0, 6, 10]);
    put(1, [4, 12], 2);
    put(2, [0, 2, 3, 6, 8, 10, 11, 14]);
    put(3, [7, 15]);
    put(4, [5, 13], 3);
    put(5, [0, 6, 10], 3);
    state.bpm = 174;
  }
  sync();
  persist();
}
function makeEngine(c) {
  const input = c.createGain(),
    filter = c.createBiquadFilter(),
    dist = c.createWaveShaper(),
    dry = c.createGain(),
    delay = c.createDelay(2),
    feedback = c.createGain(),
    wet = c.createGain(),
    verb = c.createConvolver(),
    space = c.createGain(),
    compress = c.createDynamicsCompressor(),
    master = c.createGain();
  input.gain.value = 0.65;
  master.gain.value = 0.7;
  input.connect(filter);
  filter.connect(dist);
  dist.connect(dry);
  dry.connect(compress);
  dist.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(compress);
  dist.connect(verb);
  verb.connect(space);
  space.connect(compress);
  compress.connect(master);
  master.connect(c.destination);
  const impulse = c.createBuffer(2, c.sampleRate * 1.6, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const a = impulse.getChannelData(ch);
    for (let i = 0; i < a.length; i++)
      a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / a.length, 3);
  }
  verb.buffer = impulse;
  const noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const n = noise.getChannelData(0);
  for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
  const e = { input, filter, dist, delay, feedback, wet, space, noise };
  applyFX(c, e);
  return e;
}
function applyFX(c, e) {
  e.filter.type = state.filterType;
  e.filter.frequency.setTargetAtTime(
    40 * Math.pow(500, state.filter / 100),
    c.currentTime,
    0.015,
  );
  const curve = new Float32Array(2048),
    k = state.drive * 0.6;
  for (let i = 0; i < curve.length; i++) {
    const x = (i * 2) / (curve.length - 1) - 1;
    curve[i] = k ? Math.tanh(x * (1 + k / 8)) / Math.tanh(1 + k / 8) : x;
  }
  e.dist.curve = curve;
  e.delay.delayTime.setTargetAtTime(
    (60 / state.bpm) * state.division,
    c.currentTime,
    0.02,
  );
  e.feedback.gain.value = state.delay / 100;
  e.wet.gain.value = (state.delay / 100) * 0.7;
  e.space.gain.value = state.reverb / 100;
}
function updateFX() {
  const hz = 40 * Math.pow(500, state.filter / 100);
  $("filterValue").textContent =
    hz >= 1000 ? (hz / 1000).toFixed(1) + " kHz" : Math.round(hz) + " Hz";
  $("driveValue").textContent = state.drive + "% GRIT";
  $("delayValue").textContent = state.delay + "% FEEDBACK";
  $("reverbValue").textContent = state.reverb + "% SPACE";
  if (ctx && engine) applyFX(ctx, engine);
}
function hit(c, e, r, time, velocity) {
  const palette = state.palette;
  const gain = [0, 0.65, 1, 0.32][velocity];
  const tight = palette === "minimal" ? 0.65 : palette === "future" ? 1.25 : 1;
  function tone(type, f, end, dur, vol) {
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, time);
    if (end) o.frequency.exponentialRampToValueAtTime(end, time + dur * 0.7);
    g.gain.setValueAtTime(Math.max(0.001, vol * gain), time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g);
    g.connect(e.input);
    o.start(time);
    o.stop(time + dur + 0.02);
  }
  function noise(freq, dur, vol, type = "highpass") {
    const s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = e.noise;
    f.type = type;
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol * gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    s.connect(f);
    f.connect(g);
    g.connect(e.input);
    s.start(time);
    s.stop(time + dur + 0.01);
  }
  if (r === 0) {
    tone("sine", 150, 40, 0.38 * tight, 1);
    tone("triangle", 90, 42, 0.12, 0.25);
  }
  if (r === 1) {
    noise(1300, 0.19 * tight, 0.65);
    tone("triangle", 180, 90, 0.12, 0.25);
  }
  if (r === 2) noise(7500, 0.055 * tight, 0.34);
  if (r === 3) noise(6500, 0.3 * tight, 0.28);
  if (r === 4) {
    tone(palette === "future" ? "sine" : "square", 650, 280, 0.075, 0.14);
    noise(2400, 0.045, 0.15, "bandpass");
  }
  if (r === 5) {
    const f = 440 * Math.pow(2, (state.tracks[5].note - 69) / 12);
    tone(
      palette === "future" ? "triangle" : "sawtooth",
      f,
      null,
      0.19 * tight,
      0.24,
    );
    tone("sine", f / 2, null, 0.23, 0.3);
  }
}
function scheduleStep(c, e, index, time) {
  const solo = state.tracks.some((t) => t.solo);
  state.tracks.forEach((t, r) => {
    const v = t.hits[index % t.length];
    if (v && !t.mute && (!solo || t.solo)) hit(c, e, r, time, v);
  });
}
function scheduler() {
  while (nextTime < ctx.currentTime + 0.12) {
    const index = roll ? rollStep : tick;
    scheduleStep(ctx, engine, index, nextTime);
    visual.push({ time: nextTime, index: tick % state.steps });
    const base = 60 / state.bpm / 4;
    nextTime += roll
      ? ((60 / state.bpm) * 4) / roll
      : base * (1 + ((tick % 2 ? -1 : 1) * state.swing) / 100);
    tick++;
  }
}
function animate() {
  if (!playing) return;
  let last;
  while (visual.length && visual[0].time <= ctx.currentTime)
    last = visual.shift();
  if (last) {
    document
      .querySelectorAll(".step.current")
      .forEach((b) => b.classList.remove("current"));
    document
      .querySelectorAll(`[data-step="${last.index}"]`)
      .forEach((b) => b.classList.add("current"));
    $("position").textContent =
      String(last.index + 1).padStart(2, "0") + " / " + state.steps;
  }
  requestAnimationFrame(animate);
}
async function play() {
  try {
    if (playing) {
      stop(false);
      return;
    }
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      engine = makeEngine(ctx);
    }
    await ctx.resume();
    playing = true;
    nextTime = ctx.currentTime + 0.04;
    $("play").innerHTML = "Ⅱ <span>Pause beat</span>";
    timer = setInterval(scheduler, 25);
    scheduler();
    animate();
    notify("Live · Your audio stays on this device.");
  } catch (e) {
    notify("Audio could not start: " + e.message);
  }
}
function stop(reset = true) {
  playing = false;
  clearInterval(timer);
  visual = [];
  roll = 0;
  document
    .querySelectorAll(".active,.current")
    .forEach((b) => b.classList.remove("active", "current"));
  if (ctx) ctx.suspend();
  if (reset) {
    tick = 0;
    $("position").textContent = "01 / " + state.steps;
  }
  $("play").innerHTML = "▶ <span>Play beat</span>";
}
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function encode() {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
function decode(s) {
  if (s.length > 20000) throw Error("Link is too large");
  return JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
        c.charCodeAt(0),
      ),
    ),
  );
}
$("play").onclick = play;
$("stop").onclick = () => stop();
$("preset").onchange = () => {
  stop();
  preset($("preset").value);
  notify("Preset loaded. Make it your own.");
};
$("clear").onclick = () => {
  state.tracks.forEach((t) => t.hits.fill(0));
  draw();
  persist();
  notify("Pattern cleared. A fresh canvas.");
};
for (const key of [
  "steps",
  "bpm",
  "swing",
  "palette",
  "filterType",
  "filter",
  "drive",
  "delay",
  "division",
  "reverb",
])
  $(key).addEventListener("input", () => {
    let value = $(key).value;
    if (!["palette", "filterType"].includes(key)) {
      value = Number(value);
      if (
        !Number.isFinite(value) ||
        value < Number($(key).min || 0) ||
        value > Number($(key).max || 1000)
      )
        return;
    }
    if (key === "steps") {
      stop();
      state.tracks.forEach((t) => {
        if (t.length === state.steps) t.length = value;
      });
    }
    state[key] = value;
    if (key === "steps") draw();
    $("swingValue").textContent = state.swing + "%";
    updateFX();
    persist();
  });
for (const b of document.querySelectorAll("[data-roll]")) {
  const release = () => {
    roll = 0;
    b.classList.remove("active");
  };
  b.onpointerdown = (e) => {
    if (!playing) {
      notify("Start your beat, then hold a roll pad.");
      return;
    }
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    roll = +b.dataset.roll;
    rollStep = Math.max(0, tick - 1);
    b.classList.add("active");
  };
  b.onpointerup = release;
  b.onpointercancel = release;
  b.onlostpointercapture = release;
  b.onkeydown = (e) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat && playing) {
      e.preventDefault();
      roll = +b.dataset.roll;
      rollStep = Math.max(0, tick - 1);
      b.classList.add("active");
    }
  };
  b.onkeyup = release;
  b.onblur = release;
}
$("save").onclick = () =>
  download(
    new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    "pulsegrid-pattern.json",
  );
$("load").onclick = () => $("file").click();
$("file").onchange = async () => {
  try {
    const f = $("file").files[0];
    if (!f) return;
    if (f.size > 50000) throw Error("File too large");
    const next = validate(JSON.parse(await f.text()));
    stop();
    state = next;
    sync();
    persist();
    notify("Pattern imported.");
  } catch (e) {
    notify("Import failed: " + e.message);
  } finally {
    $("file").value = "";
  }
};
$("share").onclick = async () => {
  const url = new URL(location.href);
  url.hash = "beat=" + encode();
  try {
    await navigator.clipboard.writeText(url.href);
    history.replaceState(null, "", url);
    notify("Share link copied to clipboard.");
  } catch {
    history.replaceState(null, "", url);
    notify("Share link is ready in your address bar. Copy it to share.");
  }
};
$("wav").onclick = async () => {
  const b = $("wav");
  b.disabled = true;
  const wasPlaying = playing;
  stop(false);
  notify("Rendering your loop…");
  try {
    const rate = 44100,
      loop = (state.steps * 60) / state.bpm / 4;
    const offline = new OfflineAudioContext(
        2,
        Math.ceil((loop + 2.5) * rate),
        rate,
      ),
      e = makeEngine(offline);
    let time = 0;
    for (let i = 0; i < state.steps; i++) {
      scheduleStep(offline, e, i, time);
      time +=
        (60 / state.bpm / 4) * (1 + ((i % 2 ? -1 : 1) * state.swing) / 100);
    }
    const audio = await offline.startRendering(),
      length = audio.length,
      buffer = new ArrayBuffer(44 + length * 4),
      view = new DataView(buffer);
    const str = (offset, s) =>
      [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    str(0, "RIFF");
    view.setUint32(4, 36 + length * 4, true);
    str(8, "WAVE");
    str(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 2, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 4, true);
    view.setUint16(32, 4, true);
    view.setUint16(34, 16, true);
    str(36, "data");
    view.setUint32(40, length * 4, true);
    const left = audio.getChannelData(0),
      right = audio.getChannelData(1);
    for (let i = 0; i < length; i++)
      for (let ch = 0; ch < 2; ch++) {
        const s = Math.max(-1, Math.min(1, (ch ? right : left)[i]));
        view.setInt16(44 + i * 4 + ch * 2, s * (s < 0 ? 32768 : 32767), true);
      }
    download(
      new Blob([buffer], { type: "audio/wav" }),
      "pulsegrid-" + state.bpm + "bpm.wav",
    );
    notify("WAV exported · Stereo 44.1 kHz / 16-bit, with effects tail.");
  } catch (e) {
    notify("Export failed: " + e.message);
  } finally {
    b.disabled = false;
    if (wasPlaying) play();
  }
};
document.addEventListener("keydown", (e) => {
  if (
    e.code === "Space" &&
    !["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(
      document.activeElement.tagName,
    )
  ) {
    e.preventDefault();
    play();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && playing) stop(false);
});
try {
  if (location.hash.startsWith("#beat=")) {
    state = validate(decode(location.hash.slice(6)));
    notify("Shared beat loaded. Press play to listen.");
  } else {
    const saved = localStorage.getItem("pulsegrid-v1");
    if (saved) state = validate(JSON.parse(saved));
    else preset("house");
  }
} catch {
  notify("Could not load saved pattern. Starting a fresh house beat.");
  preset("house");
}
sync();
