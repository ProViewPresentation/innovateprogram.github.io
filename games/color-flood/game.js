// Color Flood: Neon Overload — Core Game Engine, Canvas Renderer & Modes

(() => {
  'use strict';

  const PALETTE = [
    { name: 'Cyan', hex: '#00F0FF', dark: '#009BB0', glow: 'rgba(0, 240, 255, 0.36)', sym: '●' },
    { name: 'Magenta', hex: '#FF1E8A', dark: '#A80B56', glow: 'rgba(255, 30, 138, 0.36)', sym: '◆' },
    { name: 'Lime', hex: '#39FF14', dark: '#1FA308', glow: 'rgba(57, 255, 20, 0.32)', sym: '▲' },
    { name: 'Yellow', hex: '#FFE600', dark: '#B39B00', glow: 'rgba(255, 230, 0, 0.32)', sym: '★' },
    { name: 'Purple', hex: '#B026FF', dark: '#6E0EB0', glow: 'rgba(176, 38, 255, 0.40)', sym: '■' },
    { name: 'Solar', hex: '#FF5E1A', dark: '#AD3400', glow: 'rgba(255, 94, 26, 0.36)', sym: '✦' },
  ];

  const MODES = {
    chill: { id: 'chill', label: '12×12 Chill', size: 12, colors: 5, moves: 18, cluster: 0.08, chargeScale: 0.70, undos: 3 },
    standard: { id: 'standard', label: '14×14 Standard', size: 14, colors: 5, moves: 22, cluster: 0.04, chargeScale: 0.56, undos: 3 },
    hard: { id: 'hard', label: '16×16 Hard', size: 16, colors: 5, moves: 23, cluster: 0.04, chargeScale: 0.45, undos: 3 },
    hyper: { id: 'hyper', label: '16×16+ Hyper', size: 16, colors: 6, moves: 26, cluster: 0.05, chargeScale: 0.44, undos: 3 },
    endless: { id: 'endless', label: '∞ Endless Run', endless: true },
  };

  const COMBO_STEPS = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];
  const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Endless sector configuration generator
  function getEndlessSectorConfig(sector) {
    if (sector === 1) return { size: 12, colors: 5, moves: 18, cluster: 0.08, chargeScale: 0.70, undos: 2 };
    if (sector === 2) return { size: 14, colors: 5, moves: 22, cluster: 0.04, chargeScale: 0.56, undos: 2 };
    if (sector === 3) return { size: 14, colors: 5, moves: 20, cluster: 0.04, chargeScale: 0.54, undos: 1 };
    if (sector === 4) return { size: 16, colors: 5, moves: 23, cluster: 0.04, chargeScale: 0.45, undos: 1 };
    if (sector === 5) return { size: 16, colors: 6, moves: 26, cluster: 0.05, chargeScale: 0.44, undos: 1 };
    const tighten = Math.min(3, Math.floor((sector - 5) / 2));
    return { size: 16, colors: 6, moves: 26 - tighten, cluster: 0.05, chargeScale: 0.44, undos: 1 };
  }

  // DOM Elements
  const dom = {
    canvasFrame: document.getElementById('canvasFrame'),
    canvas: document.getElementById('boardCanvas'),
    paletteGrid: document.getElementById('paletteGrid'),
    modeBadge: document.getElementById('modeBadge'),
    coverageText: document.getElementById('coverageText'),
    progressFill: document.getElementById('progressFill'),
    statMovesTile: document.getElementById('statMovesTile'),
    statMoves: document.getElementById('statMoves'),
    statMovesSub: document.getElementById('statMovesSub'),
    reservePill: document.getElementById('reservePill'),
    statTimer: document.getElementById('statTimer'),
    statBestTime: document.getElementById('statBestTime'),
    statScore: document.getElementById('statScore'),
    statBestScore: document.getElementById('statBestScore'),
    statComboTile: document.getElementById('statComboTile'),
    statCombo: document.getElementById('statCombo'),
    statComboSub: document.getElementById('statComboSub'),
    overloadPct: document.getElementById('overloadPct'),
    overloadBarFill: document.getElementById('overloadBarFill'),
    btnOverload: document.getElementById('btnOverload'),
    overloadHint: document.getElementById('overloadHint'),
    btnUndo: document.getElementById('btnUndo'),
    btnRestart: document.getElementById('btnRestart'),
    btnSfx: document.getElementById('btnSfx'),
    btnBeat: document.getElementById('btnBeat'),
    btnSymbols: document.getElementById('btnSymbols'),
    comboToast: document.getElementById('comboToast'),
    resultOverlay: document.getElementById('resultOverlay'),
    resultCard: document.getElementById('resultCard'),
    resultKicker: document.getElementById('resultKicker'),
    resultTitle: document.getElementById('resultTitle'),
    resultSub: document.getElementById('resultSub'),
    resMetric1Label: document.getElementById('resMetric1Label'),
    resMetric1Val: document.getElementById('resMetric1Val'),
    resMetric2Label: document.getElementById('resMetric2Label'),
    resMetric2Val: document.getElementById('resMetric2Val'),
    resMetric3Label: document.getElementById('resMetric3Label'),
    resMetric3Val: document.getElementById('resMetric3Val'),
    newBestPill: document.getElementById('newBestPill'),
    btnResultPrimary: document.getElementById('btnResultPrimary'),
    btnResultRetrySame: document.getElementById('btnResultRetrySame'),
    btnResultSecondary: document.getElementById('btnResultSecondary'),
    modeButtons: Array.from(document.querySelectorAll('.mode-pill')),
  };

  const ctx = dom.canvas.getContext('2d');

  // Game State
  const state = {
    modeId: 'standard',
    sector: 1,
    reserveMoves: 0,

    size: 14,
    numColors: 5,
    maxMoves: 22,
    chargeScale: 0.56,
    movesLeft: 22,
    movesUsed: 0,

    initialGrid: null,
    grid: null,        // Current logical color index per cell (0..numColors-1)
    prevColors: null,  // Previous visual hex before wave flip
    flipStart: null,   // Timestamp (ms) when cell flips to current color
    owned: null,       // Uint8Array mask: 1 = flooded territory
    ownedCount: 0,
    currentColor: 0,

    score: 0,
    displayScore: 0,
    comboStep: 0,      // Index into COMBO_STEPS
    maxComboMult: 1.0,
    overload: 0,       // 0..100+ (100 = 1 charge ready, max stored 150)

    timerRunning: false,
    startTimeMs: 0,
    elapsedMs: 0,

    undosLeft: 3,
    history: [],

    status: 'playing', // 'playing' | 'won' | 'lost'
    hoverColor: -1,
    hoverOverload: false,
    previewMask: null,
    candidateGains: [],

    showSymbols: false,

    // Visual FX
    particles: [],
    shockwaves: [],
    shakeMag: 0,
    canvasCssSize: 480,
    dpr: 1,
  };

  // Persistence helpers
  function getHighScore(modeId) {
    try {
      return parseInt(localStorage.getItem(`cf_best_${modeId}`) || '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  function setHighScore(modeId, score) {
    try {
      localStorage.setItem(`cf_best_${modeId}`, String(Math.floor(score)));
    } catch {
      // Ignore storage errors
    }
  }

  function getBestTime(modeId) {
    try {
      const v = parseFloat(localStorage.getItem(`cf_time_${modeId}`) || '0');
      return v > 0 ? v : null;
    } catch {
      return null;
    }
  }

  function setBestTime(modeId, sec) {
    try {
      localStorage.setItem(`cf_time_${modeId}`, sec.toFixed(1));
    } catch {
      // Ignore storage errors
    }
  }

  // Board Generation & Solvability Verification
  function randomClusteredGrid(N, C, clusterBias) {
    const g = new Uint8Array(N * N);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const idx = r * N + c;
        if ((r > 0 || c > 0) && Math.random() < clusterBias) {
          if (r > 0 && c > 0) {
            g[idx] = Math.random() < 0.5 ? g[(r - 1) * N + c] : g[r * N + (c - 1)];
          } else if (r > 0) {
            g[idx] = g[(r - 1) * N + c];
          } else {
            g[idx] = g[r * N + (c - 1)];
          }
        } else {
          g[idx] = (Math.random() * C) | 0;
        }
      }
    }
    return g;
  }

  // Fast greedy solver check so every random board is guaranteed solvable within par moves
  function greedyMovesNeeded(grid, N, C) {
    const total = N * N;
    let owned = new Uint8Array(total);
    const startCol = grid[0];
    const q = [0];
    owned[0] = 1;
    let count = 1;

    while (q.length) {
      const u = q.pop();
      const r = (u / N) | 0;
      const c = u % N;
      if (r > 0 && !owned[u - N] && grid[u - N] === startCol) { owned[u - N] = 1; count++; q.push(u - N); }
      if (r + 1 < N && !owned[u + N] && grid[u + N] === startCol) { owned[u + N] = 1; count++; q.push(u + N); }
      if (c > 0 && !owned[u - 1] && grid[u - 1] === startCol) { owned[u - 1] = 1; count++; q.push(u - 1); }
      if (c + 1 < N && !owned[u + 1] && grid[u + 1] === startCol) { owned[u + 1] = 1; count++; q.push(u + 1); }
    }

    let moves = 0;
    while (count < total && moves < 45) {
      let bestGain = -1;
      let bestOwned = null;
      for (let col = 0; col < C; col++) {
        const vis = new Uint8Array(owned);
        const st = [];
        let gain = 0;
        for (let i = 0; i < total; i++) {
          if (owned[i]) st.push(i);
        }
        while (st.length) {
          const u = st.pop();
          const r = (u / N) | 0;
          const c = u % N;
          if (r > 0 && !vis[u - N] && grid[u - N] === col) { vis[u - N] = 1; gain++; st.push(u - N); }
          if (r + 1 < N && !vis[u + N] && grid[u + N] === col) { vis[u + N] = 1; gain++; st.push(u + N); }
          if (c > 0 && !vis[u - 1] && grid[u - 1] === col) { vis[u - 1] = 1; gain++; st.push(u - 1); }
          if (c + 1 < N && !vis[u + 1] && grid[u + 1] === col) { vis[u + 1] = 1; gain++; st.push(u + 1); }
        }
        if (gain > bestGain) {
          bestGain = gain;
          bestOwned = vis;
        }
      }
      if (bestGain <= 0) break;
      owned = bestOwned;
      count += bestGain;
      moves++;
    }
    return moves;
  }

  function generateSolvableBoard(N, C, maxMoves, clusterBias) {
    let fallback = null;
    let bestMoves = 999;
    for (let attempt = 0; attempt < 35; attempt++) {
      const candidate = randomClusteredGrid(N, C, clusterBias);
      const est = greedyMovesNeeded(candidate, N, C);
      if (est <= maxMoves) return candidate;
      if (est < bestMoves) {
        bestMoves = est;
        fallback = candidate;
      }
    }
    return fallback;
  }

  // Compute candidate expansion for picking `targetColor`
  function computeExpansion(targetColor) {
    const N = state.size;
    const total = N * N;
    const captured = [];
    if (targetColor === state.currentColor || targetColor < 0 || targetColor >= state.numColors) {
      return { captured, depth: new Int16Array(total) };
    }

    const vis = new Uint8Array(state.owned);
    const depth = new Int16Array(total);
    const queue = [];

    for (let i = 0; i < total; i++) {
      if (state.owned[i]) queue.push(i);
    }

    let head = 0;
    while (head < queue.length) {
      const u = queue[head++];
      const d = depth[u];
      const r = (u / N) | 0;
      const c = u % N;

      const neighbors = [];
      if (r > 0) neighbors.push(u - N);
      if (r + 1 < N) neighbors.push(u + N);
      if (c > 0) neighbors.push(u - 1);
      if (c + 1 < N) neighbors.push(u + 1);

      for (let k = 0; k < neighbors.length; k++) {
        const v = neighbors[k];
        if (!vis[v] && state.grid[v] === targetColor) {
          vis[v] = 1;
          depth[v] = d + 1;
          captured.push(v);
          queue.push(v);
        }
      }
    }

    return { captured, depth };
  }

  // Compute Overload Shockwave: absorbs entire bordering frontier ring of ALL colors
  // PLUS chains any matching clusters of currentColor beyond them!
  function computeOverloadExpansion() {
    const N = state.size;
    const total = N * N;
    const vis = new Uint8Array(state.owned);
    const depth = new Int16Array(total);
    const captured = [];
    const chainQueue = [];

    // Step 1: Every direct neighbor touching current territory joins regardless of color
    for (let u = 0; u < total; u++) {
      if (!state.owned[u]) continue;
      const r = (u / N) | 0;
      const c = u % N;
      const neighbors = [];
      if (r > 0) neighbors.push(u - N);
      if (r + 1 < N) neighbors.push(u + N);
      if (c > 0) neighbors.push(u - 1);
      if (c + 1 < N) neighbors.push(u + 1);

      for (let k = 0; k < neighbors.length; k++) {
        const v = neighbors[k];
        if (!vis[v]) {
          vis[v] = 1;
          depth[v] = 1;
          captured.push(v);
          chainQueue.push(v);
        }
      }
    }

    // Step 2: Any adjacent unowned tiles matching state.currentColor also chain in!
    let head = 0;
    while (head < chainQueue.length) {
      const u = chainQueue[head++];
      const r = (u / N) | 0;
      const c = u % N;
      const neighbors = [];
      if (r > 0) neighbors.push(u - N);
      if (r + 1 < N) neighbors.push(u + N);
      if (c > 0) neighbors.push(u - 1);
      if (c + 1 < N) neighbors.push(u + 1);

      for (let k = 0; k < neighbors.length; k++) {
        const v = neighbors[k];
        if (!vis[v] && state.grid[v] === state.currentColor) {
          vis[v] = 1;
          depth[v] = depth[u] + 1;
          captured.push(v);
          chainQueue.push(v);
        }
      }
    }

    return { captured, depth };
  }

  function refreshCandidates() {
    state.candidateGains = [];
    for (let c = 0; c < state.numColors; c++) {
      if (c === state.currentColor) {
        state.candidateGains.push(0);
      } else {
        state.candidateGains.push(computeExpansion(c).captured.length);
      }
    }
    updatePreviewMask();
    renderPaletteButtons();
    updateHud();
  }

  function updatePreviewMask() {
    const total = state.size * state.size;
    const mask = new Uint8Array(total);
    if (state.status === 'playing') {
      if (state.hoverOverload && state.overload >= 100) {
        const { captured } = computeOverloadExpansion();
        for (const idx of captured) mask[idx] = 2; // 2 = golden overload preview
      } else if (state.hoverColor >= 0 && state.hoverColor !== state.currentColor) {
        const { captured } = computeExpansion(state.hoverColor);
        for (const idx of captured) mask[idx] = 1; // 1 = standard preview
      }
    }
    state.previewMask = mask;
  }

  // Board Initialization
  function startBoard({ modeId = state.modeId, reuseGrid = null, advanceEndless = false } = {}) {
    state.modeId = modeId;

    let cfg;
    if (modeId === 'endless') {
      if (!advanceEndless && !reuseGrid) {
        state.sector = 1;
        state.reserveMoves = 0;
        state.score = 0;
        state.displayScore = 0;
        state.comboStep = 0;
        state.overload = 0;
      }
      cfg = getEndlessSectorConfig(state.sector);
    } else {
      cfg = MODES[modeId];
      state.sector = 1;
      state.reserveMoves = 0;
      state.score = 0;
      state.displayScore = 0;
      state.comboStep = 0;
      state.overload = 0;
    }

    state.size = cfg.size;
    state.numColors = cfg.colors;
    state.chargeScale = cfg.chargeScale || 0.56;
    state.maxMoves = cfg.moves + (modeId === 'endless' ? state.reserveMoves : 0);
    state.movesLeft = state.maxMoves;
    state.movesUsed = 0;
    state.maxComboMult = COMBO_STEPS[state.comboStep] || 1.0;

    state.undosLeft = cfg.undos;
    state.history = [];

    const total = state.size * state.size;
    const freshGrid = reuseGrid
      ? new Uint8Array(reuseGrid)
      : generateSolvableBoard(state.size, state.numColors, cfg.moves, cfg.cluster);

    state.initialGrid = new Uint8Array(freshGrid);
    state.grid = new Uint8Array(freshGrid);
    state.prevColors = new Array(total).fill(null);
    state.flipStart = new Float64Array(total);
    state.owned = new Uint8Array(total);

    // Flood initial connected cluster from top-left (0,0)
    const startCol = state.grid[0];
    state.currentColor = startCol;
    const q = [0];
    state.owned[0] = 1;
    let count = 1;
    while (q.length) {
      const u = q.pop();
      const r = (u / state.size) | 0;
      const c = u % state.size;
      const nbs = [];
      if (r > 0) nbs.push(u - state.size);
      if (r + 1 < state.size) nbs.push(u + state.size);
      if (c > 0) nbs.push(u - 1);
      if (c + 1 < state.size) nbs.push(u + 1);
      for (const v of nbs) {
        if (!state.owned[v] && state.grid[v] === startCol) {
          state.owned[v] = 1;
          count++;
          q.push(v);
        }
      }
    }
    state.ownedCount = count;

    state.timerRunning = false;
    state.startTimeMs = 0;
    state.elapsedMs = 0;
    state.status = 'playing';
    state.hoverColor = -1;
    state.hoverOverload = false;

    dom.resultOverlay.classList.remove('visible');
    dom.modeButtons.forEach((btn) => {
      btn.classList.toggle('is-selected', btn.dataset.mode === state.modeId);
    });

    applyActiveThemeColor();
    buildPaletteDom();
    refreshCandidates();
    resizeCanvas();
  }

  function applyActiveThemeColor() {
    const col = PALETTE[state.currentColor];
    document.documentElement.style.setProperty('--active-color', col.hex);
    document.documentElement.style.setProperty('--active-glow', col.glow);
  }

  // Push snapshot for Undo
  function saveSnapshot() {
    state.history.push({
      grid: new Uint8Array(state.grid),
      owned: new Uint8Array(state.owned),
      ownedCount: state.ownedCount,
      currentColor: state.currentColor,
      movesLeft: state.movesLeft,
      movesUsed: state.movesUsed,
      score: state.score,
      comboStep: state.comboStep,
      overload: state.overload,
    });
    if (state.history.length > 5) state.history.shift();
  }

  function undoMove() {
    if (state.status !== 'playing' || state.undosLeft <= 0 || state.history.length === 0) {
      window.NeonAudio.playInvalid();
      return;
    }
    const snap = state.history.pop();
    state.undosLeft--;
    state.grid = snap.grid;
    state.owned = snap.owned;
    state.ownedCount = snap.ownedCount;
    state.currentColor = snap.currentColor;
    state.movesLeft = snap.movesLeft;
    state.movesUsed = snap.movesUsed;
    state.score = snap.score;
    state.displayScore = snap.score;
    state.comboStep = snap.comboStep;
    state.overload = snap.overload;
    state.prevColors.fill(null);

    window.NeonAudio.playUiClick(65);
    applyActiveThemeColor();
    refreshCandidates();
  }

  // Trigger a standard color move
  function handlePickColor(colorIndex) {
    if (state.status !== 'playing') return;
    if (colorIndex < 0 || colorIndex >= state.numColors) return;
    window.NeonAudio.unlock();

    if (colorIndex === state.currentColor) {
      window.NeonAudio.playInvalid();
      return;
    }

    const { captured, depth } = computeExpansion(colorIndex);
    if (captured.length === 0) {
      window.NeonAudio.playInvalid();
      showToast(`No adjacent ${PALETTE[colorIndex].name} tiles!`);
      return;
    }

    // Start stopwatch on first move of board
    if (!state.timerRunning) {
      state.timerRunning = true;
      state.startTimeMs = performance.now() - state.elapsedMs;
    }

    saveSnapshot();

    const oldColorIdx = state.currentColor;
    const oldHex = PALETTE[oldColorIdx].hex;
    const now = performance.now();
    const unownedBefore = state.size * state.size - state.ownedCount;

    // Animate ripple across existing territory + newly captured tiles
    const N = state.size;
    for (let i = 0; i < N * N; i++) {
      if (state.owned[i]) {
        const r = (i / N) | 0;
        const c = i % N;
        state.prevColors[i] = oldHex;
        state.flipStart[i] = now + (r + c) * 9;
        state.grid[i] = colorIndex;
      }
    }

    for (let k = 0; k < captured.length; k++) {
      const idx = captured[k];
      state.prevColors[idx] = PALETTE[state.grid[idx]].hex;
      state.flipStart[idx] = now + 45 + depth[idx] * 22;
      state.owned[idx] = 1;
      state.grid[idx] = colorIndex;
      spawnTileParticles(idx, PALETTE[colorIndex].hex, captured.length >= 10 ? 3 : 2);
    }

    state.currentColor = colorIndex;
    state.ownedCount += captured.length;
    state.movesLeft--;
    state.movesUsed++;

    // Combo & Multiplier Evaluation
    const qualifiesCombo = captured.length >= 6 || captured.length >= Math.ceil(unownedBefore * 0.35);
    if (qualifiesCombo) {
      state.comboStep = Math.min(COMBO_STEPS.length - 1, state.comboStep + 1);
    } else {
      state.comboStep = Math.max(0, state.comboStep - 1);
    }

    const mult = COMBO_STEPS[state.comboStep];
    state.maxComboMult = Math.max(state.maxComboMult, mult);

    // Points & Overload Meter Charge
    const basePts = captured.length * 40 + Math.max(0, captured.length - 5) * 25;
    const earnedPts = Math.round(basePts * mult);
    state.score += earnedPts;

    const wasReady = state.overload >= 100;
    const chargeGain = Math.min(
      25,
      Math.round((captured.length * state.chargeScale + (qualifiesCombo ? 3.5 : 1)) * (0.85 + mult * 0.15))
    );
    state.overload = Math.min(100, state.overload + chargeGain);
    if (!wasReady && state.overload >= 100) {
      window.NeonAudio.playOverloadReady();
    }

    // Audio & Visual Callouts
    window.NeonAudio.playSpread(colorIndex, captured.length, state.comboStep);
    applyActiveThemeColor();

    if (captured.length >= 18) {
      triggerShake(6);
      spawnBoardShockwave(PALETTE[colorIndex].hex);
      showToast(`HYPER FLOOD +${captured.length} · ${mult.toFixed(1)}×!`);
    } else if (captured.length >= 10 || state.comboStep >= 3) {
      triggerShake(3.2);
      showToast(`+${captured.length} TILES · ${mult.toFixed(1)}× COMBO!`);
    } else if (!wasReady && state.overload >= 100) {
      showToast('⚡ NEON OVERLOAD READY! [SPACE]');
    }

    checkEndConditions();
    refreshCandidates();
  }

  // Trigger Neon Overload Shockwave Power-Up (Costs 0 moves + grants +1 move!)
  function triggerOverloadSurge() {
    if (state.status !== 'playing' || state.overload < 100) {
      window.NeonAudio.playInvalid();
      return;
    }

    window.NeonAudio.unlock();
    const { captured, depth } = computeOverloadExpansion();
    if (captured.length === 0) return;

    if (!state.timerRunning) {
      state.timerRunning = true;
      state.startTimeMs = performance.now() - state.elapsedMs;
    }

    saveSnapshot();

    const now = performance.now();
    const activeHex = PALETTE[state.currentColor].hex;

    for (let k = 0; k < captured.length; k++) {
      const idx = captured[k];
      state.prevColors[idx] = '#FFFFFF';
      state.flipStart[idx] = now + depth[idx] * 28;
      state.owned[idx] = 1;
      state.grid[idx] = state.currentColor;
      spawnTileParticles(idx, k % 2 === 0 ? '#FFFFFF' : activeHex, 4);
    }

    state.ownedCount += captured.length;
    state.overload = 0;
    state.comboStep = Math.min(COMBO_STEPS.length - 1, state.comboStep + 1);
    const mult = COMBO_STEPS[state.comboStep];
    state.maxComboMult = Math.max(state.maxComboMult, mult);

    const surgePoints = Math.round((captured.length * 55 + 350) * mult);
    state.score += surgePoints;

    state.hoverOverload = false;
    window.NeonAudio.playOverloadBlast();
    triggerShake(8.5);
    spawnBoardShockwave('#00F0FF');
    spawnBoardShockwave('#FF1E8A', 90);
    showToast(`⚡ OVERLOAD SURGE! +${captured.length} FREE TILES!`);

    checkEndConditions();
    refreshCandidates();
  }

  function checkEndConditions() {
    const total = state.size * state.size;
    if (state.ownedCount >= total) {
      handleWin();
    } else if (state.movesLeft <= 0) {
      // Wait: if player has an unspent Overload charge with 0 moves left, let them use it!
      if (state.overload >= 100) {
        showToast('0 MOVES — USE OVERLOAD [SPACE] TO SURVIVE!');
        return;
      }
      handleLoss();
    }
  }

  function handleWin() {
    state.status = 'won';
    state.timerRunning = false;

    const elapsedSec = state.elapsedMs / 1000;
    const moveBonus = state.movesLeft * 500;
    const speedBonus = Math.max(0, Math.round((65 - elapsedSec) * 28));
    const clearBonus = 1000 + state.sector * 250;
    state.score += moveBonus + speedBonus + clearBonus;

    // Celebration fireworks
    spawnVictoryFireworks();
    window.NeonAudio.playWin();

    const prevBest = getHighScore(state.modeId);
    const isNewBest = state.score > prevBest;
    if (isNewBest) setHighScore(state.modeId, state.score);

    if (state.modeId !== 'endless' && elapsedSec > 0.2) {
      const prevTime = getBestTime(state.modeId);
      if (prevTime === null || elapsedSec < prevTime) {
        setBestTime(state.modeId, elapsedSec);
      }
    }

    // Populate Result Overlay
    dom.resultCard.classList.remove('is-loss');
    dom.newBestPill.hidden = !isNewBest;

    if (state.modeId === 'endless') {
      const nextReserve = Math.min(4, Math.ceil(state.movesLeft * 0.5));
      state.reserveMoves = nextReserve;
      dom.resultKicker.textContent = `SECTOR ${String(state.sector).padStart(2, '0')} CLEARED`;
      dom.resultTitle.textContent = 'SECTOR FLOODED!';
      dom.resultSub.textContent =
        nextReserve > 0
          ? `Efficiency bonus! Carrying +${nextReserve} reserve move${nextReserve > 1 ? 's' : ''} & score into Sector ${state.sector + 1}.`
          : `All tiles synchronized! Ready to warp into Sector ${state.sector + 1}.`;
      dom.resMetric1Label.textContent = 'Run Score';
      dom.resMetric1Val.textContent = state.score.toLocaleString();
      dom.resMetric2Label.textContent = 'Moves Left';
      dom.resMetric2Val.textContent = `${state.movesLeft}`;
      dom.resMetric3Label.textContent = 'Max Combo';
      dom.resMetric3Val.textContent = `${state.maxComboMult.toFixed(1)}×`;

      dom.btnResultPrimary.textContent = `Next: Sector ${state.sector + 1} →`;
      dom.btnResultRetrySame.style.display = 'none';
      dom.btnResultSecondary.textContent = 'Restart Run';
    } else {
      dom.resultKicker.textContent = MODES[state.modeId].label.toUpperCase();
      dom.resultTitle.textContent = 'BOARD FLOODED!';
      dom.resultSub.textContent = `Cleared in ${state.movesUsed}/${state.maxMoves} moves (+${moveBonus.toLocaleString()} move bonus, +${speedBonus.toLocaleString()} speed bonus).`;
      dom.resMetric1Label.textContent = 'Final Score';
      dom.resMetric1Val.textContent = state.score.toLocaleString();
      dom.resMetric2Label.textContent = 'Clear Time';
      dom.resMetric2Val.textContent = formatTime(state.elapsedMs);
      dom.resMetric3Label.textContent = 'Max Combo';
      dom.resMetric3Val.textContent = `${state.maxComboMult.toFixed(1)}×`;

      dom.btnResultPrimary.textContent = 'Play New Board';
      dom.btnResultRetrySame.style.display = '';
      dom.btnResultRetrySame.textContent = 'Replay Board';
      dom.btnResultSecondary.textContent = '∞ Endless Mode';
    }

    setTimeout(() => {
      if (state.status === 'won') dom.resultOverlay.classList.add('visible');
    }, 340);
  }

  function handleLoss() {
    state.status = 'lost';
    state.timerRunning = false;
    window.NeonAudio.playLose();
    triggerShake(5);

    const prevBest = getHighScore(state.modeId);
    const isNewBest = state.score > prevBest && state.score > 0;
    if (isNewBest) setHighScore(state.modeId, state.score);

    const pct = Math.floor((state.ownedCount / (state.size * state.size)) * 100);
    dom.resultCard.classList.add('is-loss');
    dom.newBestPill.hidden = !isNewBest;

    if (state.modeId === 'endless') {
      dom.resultKicker.textContent = `RUN ENDED AT SECTOR ${String(state.sector).padStart(2, '0')}`;
      dom.resultTitle.textContent = 'OUT OF MOVES';
      dom.resultSub.textContent = `Reached ${pct}% territory coverage on Sector ${state.sector}. Retry this board or start a fresh Endless Run!`;
      dom.resMetric1Label.textContent = 'Final Score';
      dom.resMetric1Val.textContent = state.score.toLocaleString();
      dom.resMetric2Label.textContent = 'Sector';
      dom.resMetric2Val.textContent = `${state.sector}`;
      dom.resMetric3Label.textContent = 'Flooded';
      dom.resMetric3Val.textContent = `${pct}%`;

      dom.btnResultPrimary.textContent = 'New Endless Run';
      dom.btnResultRetrySame.style.display = '';
      dom.btnResultRetrySame.textContent = 'Practice Board';
      dom.btnResultSecondary.textContent = '14×14 Classic';
    } else {
      dom.resultKicker.textContent = ' CONTAINMENT BREACHED';
      dom.resultTitle.textContent = 'OUT OF MOVES';
      dom.resultSub.textContent = `Flooded ${pct}% (${state.ownedCount}/${state.size * state.size} tiles). Try the exact same puzzle again or generate a new board!`;
      dom.resMetric1Label.textContent = 'Score';
      dom.resMetric1Val.textContent = state.score.toLocaleString();
      dom.resMetric2Label.textContent = 'Flooded';
      dom.resMetric2Val.textContent = `${pct}%`;
      dom.resMetric3Label.textContent = 'Max Combo';
      dom.resMetric3Val.textContent = `${state.maxComboMult.toFixed(1)}×`;

      dom.btnResultPrimary.textContent = '↻ Retry Same Board';
      dom.btnResultRetrySame.style.display = 'none';
      dom.btnResultSecondary.textContent = '✦ New Random Board';
    }

    setTimeout(() => {
      if (state.status === 'lost') dom.resultOverlay.classList.add('visible');
    }, 260);
  }

  // UI Rendering Helpers
  function buildPaletteDom() {
    dom.paletteGrid.style.setProperty('--palette-count', String(state.numColors));
    dom.paletteGrid.innerHTML = '';

    for (let i = 0; i < state.numColors; i++) {
      const col = PALETTE[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch-btn';
      btn.dataset.color = String(i);
      btn.style.setProperty('--swatch-hex', col.hex);
      btn.style.setProperty('--swatch-glow', col.glow);
      btn.setAttribute('aria-label', `${col.name} color (Shortcut ${i + 1})`);

      btn.innerHTML = `
        <span class="swatch-top">
          <span class="swatch-key">${i + 1}</span>
          <span class="swatch-gain" data-role="gain">+0</span>
        </span>
        <span class="swatch-bottom">
          <span class="swatch-name">${col.name}</span>
          <span class="swatch-symbol" aria-hidden="true">${col.sym}</span>
        </span>
      `;

      btn.addEventListener('click', () => handlePickColor(i));
      btn.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') {
          state.hoverColor = i;
          updatePreviewMask();
        }
      });
      btn.addEventListener('pointerleave', () => {
        if (state.hoverColor === i) {
          state.hoverColor = -1;
          updatePreviewMask();
        }
      });
      btn.addEventListener('focus', () => {
        state.hoverColor = i;
        updatePreviewMask();
      });
      btn.addEventListener('blur', () => {
        if (state.hoverColor === i) {
          state.hoverColor = -1;
          updatePreviewMask();
        }
      });

      dom.paletteGrid.appendChild(btn);
    }
  }

  function renderPaletteButtons() {
    const buttons = dom.paletteGrid.querySelectorAll('.swatch-btn');
    buttons.forEach((btn, idx) => {
      const isCurrent = idx === state.currentColor;
      const gain = state.candidateGains[idx] || 0;
      btn.classList.toggle('is-current', isCurrent);
      btn.classList.toggle('is-zero', !isCurrent && gain === 0);
      const gainEl = btn.querySelector('[data-role="gain"]');
      if (gainEl) {
        gainEl.textContent = isCurrent ? 'OWN' : `+${gain}`;
      }
    });
  }

  function formatTime(ms) {
    const totalTenths = Math.floor(ms / 100);
    const tenths = totalTenths % 10;
    const secs = Math.floor(totalTenths / 10) % 60;
    const mins = Math.floor(totalTenths / 600);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
  }

  function updateHud() {
    const total = state.size * state.size;
    const pct = Math.floor((state.ownedCount / total) * 100);

    // Stage top bar & progress bar
    if (state.modeId === 'endless') {
      dom.modeBadge.textContent = `∞ SECTOR ${String(state.sector).padStart(2, '0')} · ${state.size}×${state.size}`;
    } else {
      dom.modeBadge.textContent = MODES[state.modeId].label.toUpperCase();
    }
    dom.coverageText.textContent = `${pct}% FLOODED (${state.ownedCount}/${total})`;
    dom.progressFill.style.width = `${pct}%`;

    // Moves tile
    dom.statMoves.textContent = String(state.movesLeft);
    dom.statMovesSub.textContent = `Used ${state.movesUsed} of ${state.maxMoves}`;
    dom.statMovesTile.classList.toggle('moves-warn', state.movesLeft <= 5 && state.movesLeft > 2 && state.status === 'playing');
    dom.statMovesTile.classList.toggle('moves-danger', state.movesLeft <= 2 && state.status === 'playing');

    if (state.modeId === 'endless' && state.reserveMoves > 0) {
      dom.reservePill.hidden = false;
      dom.reservePill.textContent = `+${state.reserveMoves} RSV`;
    } else {
      dom.reservePill.hidden = true;
    }

    // Score & Best
    const best = Math.max(getHighScore(state.modeId), state.score);
    dom.statBestScore.textContent = `Best ${best.toLocaleString()}`;

    const bestTime = getBestTime(state.modeId);
    dom.statBestTime.textContent =
      state.modeId === 'endless'
        ? `Sector ${state.sector} Active`
        : bestTime !== null
          ? `Best ${bestTime.toFixed(1)}s`
          : 'Starts on 1st move';

    // Combo
    const mult = COMBO_STEPS[state.comboStep];
    dom.statCombo.textContent = `${mult.toFixed(1)}×`;
    dom.statComboSub.textContent =
      state.comboStep === 0 ? 'Capture 6+ tiles to chain' : `Streak Lv.${state.comboStep} active!`;
    dom.statComboTile.classList.toggle('combo-hot', state.comboStep >= 1);

    // Overload Meter & Button
    const displayCharge = Math.min(100, state.overload);
    dom.overloadBarFill.style.width = `${displayCharge}%`;
    if (state.overload >= 100) {
      const surgeCount = computeOverloadExpansion().captured.length;
      dom.overloadPct.textContent = 'READY!';
      dom.btnOverload.classList.add('is-ready');
      dom.btnOverload.disabled = false;
      dom.btnOverload.textContent = `⚡ OVERLOAD SURGE (+${surgeCount} TILES) [SPACE]`;
      dom.overloadHint.textContent = `Free shockwave! Absorbs entire frontier ring (+${surgeCount} tiles) without spending a move.`;
    } else {
      dom.overloadPct.textContent = `${displayCharge}%`;
      dom.btnOverload.classList.remove('is-ready');
      dom.btnOverload.disabled = true;
      dom.btnOverload.textContent = `CHARGING OVERLOAD (${displayCharge}%)`;
      dom.overloadHint.textContent = 'Chain big tile captures & combos to charge a free border-absorbing shockwave.';
    }

    // Undo button
    dom.btnUndo.disabled = state.status !== 'playing' || state.undosLeft <= 0 || state.history.length === 0;
    dom.btnUndo.textContent = `↶ Undo (${state.undosLeft})`;
  }

  let toastTimer = null;
  function showToast(text) {
    dom.comboToast.textContent = text;
    dom.comboToast.classList.remove('show');
    // Force reflow so animation cleanly restarts on rapid moves
    void dom.comboToast.offsetWidth;
    dom.comboToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.comboToast.classList.remove('show'), 1000);
  }

  // Particles & Screen Shake FX
  function triggerShake(amount) {
    if (prefersReducedMotion()) return;
    state.shakeMag = Math.max(state.shakeMag, amount);
  }

  function spawnTileParticles(cellIdx, hex, count) {
    if (prefersReducedMotion() || state.particles.length > 260) return;
    const N = state.size;
    const cellPx = state.canvasCssSize / N;
    const cx = ((cellIdx % N) + 0.5) * cellPx;
    const cy = (((cellIdx / N) | 0) + 0.5) * cellPx;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 2.8;
      state.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        size: 2 + Math.random() * 2.6,
        alpha: 1,
        decay: 0.024 + Math.random() * 0.02,
        hex,
      });
    }
  }

  function spawnBoardShockwave(hex, delayMs = 0) {
    if (prefersReducedMotion()) return;
    setTimeout(() => {
      state.shockwaves.push({
        x: state.canvasCssSize * 0.25,
        y: state.canvasCssSize * 0.25,
        radius: 12,
        maxRadius: state.canvasCssSize * 1.15,
        alpha: 0.85,
        hex,
      });
    }, delayMs);
  }

  function spawnVictoryFireworks() {
    if (prefersReducedMotion()) return;
    const S = state.canvasCssSize;
    [0, 140, 280].forEach((delay, waveIdx) => {
      setTimeout(() => {
        const bx = S * (0.25 + 0.25 * waveIdx);
        const by = S * (0.3 + (waveIdx % 2) * 0.28);
        for (let i = 0; i < 28; i++) {
          const angle = (Math.PI * 2 * i) / 28 + Math.random() * 0.2;
          const speed = 1.6 + Math.random() * 4.2;
          const hex = PALETTE[i % state.numColors].hex;
          state.particles.push({
            x: bx,
            y: by,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 2.5 + Math.random() * 3,
            alpha: 1,
            decay: 0.016 + Math.random() * 0.012,
            hex,
          });
        }
      }, delay);
    });
  }

  // Canvas Sizing & Coordinate Mapping
  function resizeCanvas() {
    const rect = dom.canvasFrame.getBoundingClientRect();
    const cssSize = Math.max(240, Math.floor(rect.width));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.canvasCssSize = cssSize;
    state.dpr = dpr;

    if (dom.canvas.width !== Math.round(cssSize * dpr) || dom.canvas.height !== Math.round(cssSize * dpr)) {
      dom.canvas.width = Math.round(cssSize * dpr);
      dom.canvas.height = Math.round(cssSize * dpr);
    }
  }

  function cellFromPointerEvent(e) {
    const rect = dom.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return -1;
    const col = Math.floor((x / rect.width) * state.size);
    const row = Math.floor((y / rect.height) * state.size);
    if (row < 0 || row >= state.size || col < 0 || col >= state.size) return -1;
    return row * state.size + col;
  }

  function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Main 60fps Render Loop
  function renderFrame(now) {
    // Update live timer & smooth score counter
    if (state.timerRunning && state.status === 'playing') {
      state.elapsedMs = now - state.startTimeMs;
    }
    dom.statTimer.textContent = formatTime(state.elapsedMs);

    if (state.displayScore !== state.score) {
      const diff = state.score - state.displayScore;
      state.displayScore += Math.abs(diff) < 3 ? diff : Math.ceil(diff * 0.22);
      dom.statScore.textContent = state.displayScore.toLocaleString();
    } else if (dom.statScore.textContent !== state.score.toLocaleString()) {
      dom.statScore.textContent = state.score.toLocaleString();
    }

    const S = state.canvasCssSize;
    const dpr = state.dpr;
    const N = state.size;
    const pad = 6;
    const boardPx = S - pad * 2;
    const cell = boardPx / N;
    const gap = Math.max(1.6, cell * 0.075);
    const radius = Math.max(2.5, cell * 0.19);

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear board canvas
    ctx.fillStyle = '#0b0b0f';
    ctx.fillRect(0, 0, S, S);

    // Micro screen-shake on big captures
    if (state.shakeMag > 0.1) {
      const sx = (Math.random() - 0.5) * state.shakeMag;
      const sy = (Math.random() - 0.5) * state.shakeMag;
      ctx.translate(sx, sy);
      state.shakeMag *= 0.84;
    } else {
      state.shakeMag = 0;
    }

    const activeHex = PALETTE[state.currentColor].hex;
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.0055);

    // Pass 1: Draw all tiles (seamless merged fill for owned territory!)
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const idx = r * N + c;
        const isOwned = state.owned[idx] === 1;
        const x = pad + c * cell;
        const y = pad + r * cell;

        // Check wave transition animation
        let drawHex = PALETTE[state.grid[idx]].hex;
        let flashAlpha = 0;
        if (state.prevColors[idx] !== null) {
          const dt = now - state.flipStart[idx];
          if (dt < 0) {
            drawHex = state.prevColors[idx];
          } else if (dt < 190) {
            flashAlpha = (1 - dt / 190) * 0.58;
          } else {
            state.prevColors[idx] = null;
          }
        }

        if (isOwned) {
          // Seamless liquid territory: bridge across right & bottom owned neighbors
          const rightOwned = c + 1 < N && state.owned[idx + 1] === 1;
          const downOwned = r + 1 < N && state.owned[idx + N] === 1;
          const leftOwned = c > 0 && state.owned[idx - 1] === 1;
          const upOwned = r > 0 && state.owned[idx - N] === 1;

          const rx = leftOwned ? x : x + gap * 0.5;
          const ry = upOwned ? y : y + gap * 0.5;
          const rw = cell - (leftOwned ? 0 : gap * 0.5) - (rightOwned ? -0.6 : gap * 0.5);
          const rh = cell - (upOwned ? 0 : gap * 0.5) - (downOwned ? -0.6 : gap * 0.5);

          ctx.fillStyle = drawHex;
          drawRoundedRect(rx, ry, rw, rh, leftOwned || rightOwned || upOwned || downOwned ? 2.5 : radius);
          ctx.fill();

          if (flashAlpha > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha.toFixed(3)})`;
            ctx.fillRect(rx, ry, rw, rh);
          }
        } else {
          // Crisp individual unowned neon block
          const tx = x + gap;
          const ty = y + gap;
          const tw = cell - gap * 2;
          const th = cell - gap * 2;

          ctx.fillStyle = drawHex;
          drawRoundedRect(tx, ty, tw, th, radius);
          ctx.fill();

          // Subtle top inner highlight for tactile depth
          ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
          drawRoundedRect(tx + 1.5, ty + 1.5, tw - 3, Math.max(2, th * 0.22), Math.max(1.5, radius * 0.6));
          ctx.fill();

          // Hover / Overload Preview highlight
          const prev = state.previewMask ? state.previewMask[idx] : 0;
          if (prev > 0) {
            ctx.save();
            ctx.lineWidth = prev === 2 ? 2.6 : 2.1;
            ctx.strokeStyle =
              prev === 2
                ? `rgba(255, 255, 255, ${(0.72 + pulse * 0.28).toFixed(2)})`
                : `rgba(255, 255, 255, ${(0.62 + pulse * 0.34).toFixed(2)})`;
            ctx.fillStyle =
              prev === 2
                ? `rgba(255, 255, 255, ${(0.22 + pulse * 0.18).toFixed(2)})`
                : 'rgba(255, 255, 255, 0.18)';
            drawRoundedRect(tx - 0.5, ty - 0.5, tw + 1, th + 1, radius + 1);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
        }

        // Optional colorblind / high-contrast symbol overlay
        if (state.showSymbols) {
          ctx.fillStyle = isOwned ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.68)';
          ctx.font = `900 ${Math.max(9, Math.floor(cell * 0.42))}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(PALETTE[state.grid[idx]].sym, x + cell * 0.5, y + cell * 0.53);
        }
      }
    }

    // Pass 2: Glowing Live Territory Perimeter Border
    if (state.status === 'playing') {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.55 + pulse * 0.35).toFixed(2)})`;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = activeHex;
      ctx.shadowBlur = 10;
      ctx.beginPath();

      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const idx = r * N + c;
          if (!state.owned[idx]) continue;
          const x = pad + c * cell;
          const y = pad + r * cell;
          if (r === 0 || !state.owned[idx - N]) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + cell, y);
          }
          if (r === N - 1 || !state.owned[idx + N]) {
            ctx.moveTo(x, y + cell);
            ctx.lineTo(x + cell, y + cell);
          }
          if (c === 0 || !state.owned[idx - 1]) {
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + cell);
          }
          if (c === N - 1 || !state.owned[idx + 1]) {
            ctx.moveTo(x + cell, y);
            ctx.lineTo(x + cell, y + cell);
          }
        }
      }
      ctx.stroke();
      ctx.restore();

      // Origin Beacon Marker at Top-Left (0,0)
      const ox = pad + cell * 0.5;
      const oy = pad + cell * 0.5;
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ox, oy, Math.max(3.5, cell * 0.2 * (0.9 + pulse * 0.2)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ox, oy, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Pass 3: Shockwave Rings
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const sw = state.shockwaves[i];
      sw.radius += (sw.maxRadius - sw.radius) * 0.11 + 4;
      sw.alpha -= 0.028;
      if (sw.alpha <= 0) {
        state.shockwaves.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.strokeStyle = sw.hex;
      ctx.globalAlpha = sw.alpha;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Pass 4: Neon Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.045;
      p.alpha -= p.decay;
      if (p.alpha <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.hex;
      ctx.shadowColor = p.hex;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
    requestAnimationFrame(renderFrame);
  }

  // Event Listeners
  function bindEvents() {
    // Canvas click directly floods clicked tile's color!
    dom.canvas.addEventListener('click', (e) => {
      if (state.status !== 'playing') return;
      const idx = cellFromPointerEvent(e);
      if (idx < 0) return;
      const clickedColor = state.grid[idx];
      handlePickColor(clickedColor);
    });

    dom.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || state.status !== 'playing') return;
      const idx = cellFromPointerEvent(e);
      const nextHover = idx >= 0 && !state.owned[idx] ? state.grid[idx] : -1;
      if (nextHover !== state.hoverColor) {
        state.hoverColor = nextHover;
        updatePreviewMask();
      }
    });

    dom.canvas.addEventListener('pointerleave', () => {
      if (state.hoverColor !== -1) {
        state.hoverColor = -1;
        updatePreviewMask();
      }
    });

    // Overload button click & board preview hover
    dom.btnOverload.addEventListener('click', triggerOverloadSurge);
    dom.btnOverload.addEventListener('pointerenter', () => {
      if (state.overload >= 100) {
        state.hoverOverload = true;
        updatePreviewMask();
      }
    });
    dom.btnOverload.addEventListener('pointerleave', () => {
      if (state.hoverOverload) {
        state.hoverOverload = false;
        updatePreviewMask();
      }
    });

    // Undo & New Board buttons
    dom.btnUndo.addEventListener('click', undoMove);
    dom.btnRestart.addEventListener('click', () => {
      window.NeonAudio.playUiClick(74);
      startBoard({ modeId: state.modeId });
    });

    // Mode switcher pills
    dom.modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetMode = btn.dataset.mode;
        if (!targetMode) return;
        window.NeonAudio.playUiClick(78);
        startBoard({ modeId: targetMode });
      });
    });

    // Result Overlay actions
    dom.btnResultPrimary.addEventListener('click', () => {
      window.NeonAudio.playUiClick(79);
      if (state.status === 'won' && state.modeId === 'endless') {
        state.sector += 1;
        startBoard({ modeId: 'endless', advanceEndless: true });
      } else if (state.status === 'lost' && state.modeId !== 'endless') {
        // Retry exact same board seed
        startBoard({ modeId: state.modeId, reuseGrid: state.initialGrid });
      } else {
        startBoard({ modeId: state.modeId });
      }
    });

    dom.btnResultRetrySame.addEventListener('click', () => {
      window.NeonAudio.playUiClick(75);
      if (state.modeId === 'endless') {
        // Retry same board as standard practice board
        startBoard({ modeId: 'standard', reuseGrid: state.size === 14 ? state.initialGrid : null });
      } else {
        startBoard({ modeId: state.modeId, reuseGrid: state.initialGrid });
      }
    });

    dom.btnResultSecondary.addEventListener('click', () => {
      window.NeonAudio.playUiClick(76);
      if (state.status === 'won' && state.modeId !== 'endless') {
        startBoard({ modeId: 'endless' });
      } else if (state.status === 'lost' && state.modeId === 'endless') {
        startBoard({ modeId: 'standard' });
      } else {
        startBoard({ modeId: state.modeId });
      }
    });

    // Audio & Accessibility toolbar controls
    const syncAudioButtons = () => {
      dom.btnSfx.classList.toggle('is-active', window.NeonAudio.sfxEnabled);
      dom.btnSfx.textContent = window.NeonAudio.sfxEnabled ? '🔊 SFX: ON' : '🔇 SFX: OFF';
      dom.btnBeat.classList.toggle('beat-active', window.NeonAudio.beatEnabled);
      dom.btnBeat.textContent = window.NeonAudio.beatEnabled ? '🎵 Beat: ON' : '🎵 Beat: OFF';
    };
    syncAudioButtons();

    dom.btnSfx.addEventListener('click', () => {
      window.NeonAudio.setSfx(!window.NeonAudio.sfxEnabled);
      syncAudioButtons();
    });

    dom.btnBeat.addEventListener('click', () => {
      window.NeonAudio.setBeat(!window.NeonAudio.beatEnabled);
      syncAudioButtons();
    });

    dom.btnSymbols.addEventListener('click', () => {
      state.showSymbols = !state.showSymbols;
      document.body.classList.toggle('show-symbols', state.showSymbols);
      dom.btnSymbols.classList.toggle('is-active', state.showSymbols);
      window.NeonAudio.playUiClick(74);
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      // Result modal Enter shortcut
      if (state.status !== 'playing' && e.key === 'Enter') {
        e.preventDefault();
        dom.btnResultPrimary.click();
        return;
      }

      if (e.key >= '1' && e.key <= '6') {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < state.numColors) {
          e.preventDefault();
          handlePickColor(idx);
        }
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (state.overload >= 100 && state.status === 'playing') {
          triggerOverloadSurge();
        }
      } else if (e.key === 'z' || e.key === 'Z' || e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        undoMove();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        startBoard({ modeId: state.modeId });
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        dom.btnBeat.click();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        dom.btnSfx.click();
      }
    });

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => resizeCanvas());
      ro.observe(dom.canvasFrame);
    } else {
      window.addEventListener('resize', resizeCanvas);
    }
  }

  // Boot Game
  bindEvents();
  startBoard({ modeId: 'standard' });
  requestAnimationFrame(renderFrame);
})();
