// Procedural Web Audio API Synthesizer for Color Flood: Neon Overload
// Generates rising synthwave spread chords, cascading tile pops, overload shockwaves,
// victory/defeat fanfares, and an optional lookahead-scheduled 112 BPM darksynth loop.

class NeonAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;

    this.sfxEnabled = this._readPref('cf_sfx', true);
    this.beatEnabled = this._readPref('cf_beat', false);

    // 112 BPM 16th-note lookahead scheduler state
    this.bpm = 112;
    this.stepIndex = 0;
    this.nextNoteTime = 0;
    this.schedulerId = null;
    this.noiseBuffer = null;

    // Distinct synthwave voicings per palette color (MIDI notes around C4)
    this.colorChords = [
      [60, 67, 70, 74], // Cyan:    Cm9   (C4, G4, Bb4, D5)
      [56, 63, 67, 72], // Magenta: Abmaj7(Ab3, Eb4, G4, C5)
      [58, 65, 69, 74], // Lime:    Bb6/9 (Bb3, F4, A4, D5)
      [63, 70, 74, 79], // Yellow:  Ebmaj7(Eb4, Bb4, D5, G5)
      [53, 60, 63, 68], // Purple:  Fm7   (F3, C4, Eb4, Ab4)
      [55, 62, 67, 70], // Solar:   Gm7   (G3, D4, G4, Bb4)
    ];

    // C minor pentatonic + 9th degrees for melodic pop cascades
    this.popScale = [60, 62, 63, 67, 70, 72, 74, 75, 79, 82, 84, 86];
  }

  _readPref(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : raw === '1';
    } catch {
      return fallback;
    }
  }

  _savePref(key, val) {
    try {
      localStorage.setItem(key, val ? '1' : '0');
    } catch {
      // Ignore storage quota errors
    }
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.18;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxEnabled ? 1.0 : 0.0;

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0;

      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(comp);
      comp.connect(this.ctx.destination);

      this.noiseBuffer = this._createNoiseBuffer();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (this.beatEnabled && !this.schedulerId) {
      this._startBeatLoop();
    }
    return true;
  }

  _createNoiseBuffer() {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * 0.4);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  setSfx(enabled) {
    this.sfxEnabled = enabled;
    this._savePref('cf_sfx', enabled);
    if (this.ctx && this.sfxGain) {
      const now = this.ctx.currentTime;
      this.sfxGain.gain.cancelScheduledValues(now);
      this.sfxGain.gain.setTargetAtTime(enabled ? 1.0 : 0.0, now, 0.02);
    }
    if (enabled) this.playUiClick(76);
  }

  setBeat(enabled) {
    this.beatEnabled = enabled;
    this._savePref('cf_beat', enabled);
    if (enabled) {
      this.unlock();
      this._startBeatLoop();
    } else {
      this._stopBeatLoop();
    }
  }

  _startBeatLoop() {
    if (!this.ctx || this.schedulerId) return;
    const now = this.ctx.currentTime;
    this.nextNoteTime = now + 0.05;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(0.32, now, 0.25);

    this.schedulerId = setInterval(() => this._scheduleBeat(), 40);
  }

  _stopBeatLoop() {
    if (this.schedulerId) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    if (this.ctx && this.musicGain) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setTargetAtTime(0.0, now, 0.08);
    }
  }

  _scheduleBeat() {
    if (!this.ctx || !this.beatEnabled) return;
    const stepDur = 60 / this.bpm / 4; // 16th note
    while (this.nextNoteTime < this.ctx.currentTime + 0.14) {
      this._triggerBeatStep(this.stepIndex, this.nextNoteTime, stepDur);
      this.nextNoteTime += stepDur;
      this.stepIndex = (this.stepIndex + 1) % 64;
    }
  }

  _triggerBeatStep(step, time, dur) {
    // 4-bar synthwave progression: Cm -> Ab -> Fm -> G (16 steps each)
    const bar = Math.floor(step / 16);
    const roots = [36, 44, 41, 43]; // C2, Ab2, F2, G2
    const padChords = [
      [60, 63, 67, 70], // Cm7
      [56, 60, 63, 67], // Abmaj7
      [53, 56, 60, 63], // Fm7
      [55, 59, 62, 67], // G7
    ];
    const root = roots[bar];
    const stepInBar = step % 16;

    // 1. Kick on 0, 8 (beats 1 & 3), soft ghost on 14 on bar 3
    if (stepInBar === 0 || stepInBar === 8 || (bar === 3 && stepInBar === 14)) {
      this._synthKick(time, stepInBar === 14 ? 0.28 : 0.48);
    }

    // 2. Retro gated snare on 4 & 12 (beats 2 & 4)
    if (stepInBar === 4 || stepInBar === 12) {
      this._synthSnare(time, 0.22);
    }

    // 3. Soft hi-hat on off-beats & subtle 16th groove
    if (stepInBar % 2 === 1 || stepInBar % 4 === 2) {
      this._synthHat(time, stepInBar % 4 === 2 ? 0.085 : 0.042);
    }

    // 4. Rolling darksynth 16th bassline (ducked slightly under kick)
    const isKickStep = stepInBar === 0 || stepInBar === 8;
    const octaveHop = stepInBar % 4 === 2 ? 12 : 0;
    const bassMidi = root + octaveHop;
    this._synthBassNote(
      this.midiToFreq(bassMidi),
      time,
      dur * 0.82,
      isKickStep ? 0.11 : 0.22
    );

    // 5. Lush synth pad swell at start of each bar
    if (stepInBar === 0) {
      this._synthPadBar(padChords[bar], time, dur * 15.5);
    }
  }

  _synthKick(time, amp) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(132, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.14);

    gain.gain.setValueAtTime(amp, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  _synthSnare(time, amp) {
    if (!this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1650, time);
    filter.Q.value = 0.85;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(amp, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.17);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
    src.stop(time + 0.19);
  }

  _synthHat(time, amp) {
    if (!this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7200, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(amp, time);
    gain.gain.exponentialRampToValueAtTime(0.0008, time + 0.055);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(time);
    src.stop(time + 0.065);
  }

  _synthBassNote(freq, time, dur, amp) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 4.5, time);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.6, time + dur);
    filter.Q.value = 2.4;

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(amp, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  _synthPadBar(notes, time, dur) {
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, time);
    filter.frequency.linearRampToValueAtTime(1600, time + dur * 0.6);
    filter.frequency.linearRampToValueAtTime(800, time + dur);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.065, time + dur * 0.3);
    gain.gain.setValueAtTime(0.055, time + dur * 0.75);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    filter.connect(gain);
    gain.connect(this.musicGain);

    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(this.midiToFreq(notes[i]), time);
      osc.detune.setValueAtTime((i - 1.5) * 6, time);
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    }
  }

  // Main color flood sound: lush synth chord + cascading neon pops
  playSpread(colorIndex, capturedCount, comboStep = 0) {
    if (!this.sfxEnabled || !this.unlock()) return;
    const now = this.ctx.currentTime;
    const baseChord = this.colorChords[colorIndex % this.colorChords.length];
    // Pitch upward gently with combo streak (capped at +12 semitones)
    const transpose = Math.min(12, comboStep * 2);

    // 1. Warm detuned synthwave chord swell
    const chordFilter = this.ctx.createBiquadFilter();
    chordFilter.type = 'lowpass';
    const peakCutoff = Math.min(5400, 1800 + capturedCount * 95 + comboStep * 320);
    chordFilter.frequency.setValueAtTime(550, now);
    chordFilter.frequency.exponentialRampToValueAtTime(peakCutoff, now + 0.055);
    chordFilter.frequency.exponentialRampToValueAtTime(620, now + 0.42);
    chordFilter.Q.value = 1.8;

    const chordGain = this.ctx.createGain();
    const vol = Math.min(0.24, 0.13 + Math.min(capturedCount, 24) * 0.004);
    chordGain.gain.setValueAtTime(0.001, now);
    chordGain.gain.linearRampToValueAtTime(vol, now + 0.018);
    chordGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.46);

    chordFilter.connect(chordGain);
    chordGain.connect(this.sfxGain);

    baseChord.forEach((midi, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = idx === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(this.midiToFreq(midi + transpose), now);
      osc.detune.setValueAtTime((idx - 1.5) * 7, now);
      osc.connect(chordFilter);
      osc.start(now + idx * 0.012);
      osc.stop(now + 0.48);
    });

    // 2. Bubbly neon tile "pop" cascade scaled to captured count
    const pops = Math.min(8, Math.max(2, Math.ceil(capturedCount / 3)));
    for (let i = 0; i < pops; i++) {
      const t = now + i * 0.028;
      const scaleIdx = (i + comboStep) % this.popScale.length;
      const popFreq = this.midiToFreq(this.popScale[scaleIdx] + (comboStep >= 3 ? 12 : 0));

      const pOsc = this.ctx.createOscillator();
      const pGain = this.ctx.createGain();
      pOsc.type = 'sine';
      pOsc.frequency.setValueAtTime(popFreq * 0.86, t);
      pOsc.frequency.exponentialRampToValueAtTime(popFreq * 1.18, t + 0.045);

      pGain.gain.setValueAtTime(0.001, t);
      pGain.gain.linearRampToValueAtTime(0.095, t + 0.006);
      pGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.085);

      pOsc.connect(pGain);
      pGain.connect(this.sfxGain);
      pOsc.start(t);
      pOsc.stop(t + 0.095);
    }
  }

  playOverloadReady() {
    if (!this.sfxEnabled || !this.unlock()) return;
    const now = this.ctx.currentTime;
    [72, 75, 79, 84].forEach((midi, i) => {
      const t = now + i * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(this.midiToFreq(midi), t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  playOverloadBlast() {
    if (!this.sfxEnabled || !this.unlock()) return;
    const now = this.ctx.currentTime;

    // Sub-bass impact drop
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(150, now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.45);
    subGain.gain.setValueAtTime(0.42, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.52);

    // Wide supersaw power chord sweep
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(6800, now + 0.18);
    filter.frequency.exponentialRampToValueAtTime(1100, now + 0.78);
    filter.Q.value = 2.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.82);

    filter.connect(gain);
    gain.connect(this.sfxGain);

    [48, 55, 60, 63, 67, 74, 79].forEach((midi, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(this.midiToFreq(midi), now);
      osc.detune.setValueAtTime((idx - 3) * 8, now);
      osc.connect(filter);
      osc.start(now + idx * 0.016);
      osc.stop(now + 0.85);
    });
  }

  playWin() {
    if (!this.sfxEnabled || !this.unlock()) return;
    const now = this.ctx.currentTime;
    const notes = [60, 63, 67, 72, 75, 79, 84];
    notes.forEach((midi, i) => {
      const t = now + i * 0.068;
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc2.type = 'triangle';
      const freq = this.midiToFreq(midi);
      osc.frequency.setValueAtTime(freq, t);
      osc2.frequency.setValueAtTime(freq * 0.5, t);
      osc.detune.setValueAtTime(6, t);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3400, t);

      const dur = i === notes.length - 1 ? 0.75 : 0.32;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc2.start(t);
      osc.stop(t + dur + 0.03);
      osc2.stop(t + dur + 0.03);
    });
  }

  playLose() {
    if (!this.sfxEnabled || !this.unlock()) return;
    const now = this.ctx.currentTime;
    const notes = [67, 63, 60, 55];
    notes.forEach((midi, i) => {
      const t = now + i * 0.11;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      const f = this.midiToFreq(midi);
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * 0.96, t + 0.34);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.frequency.exponentialRampToValueAtTime(280, t + 0.34);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  }

  playUiClick(midi = 72) {
    if (!this.sfxEnabled || !this.unlock()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.midiToFreq(midi), now);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playInvalid() {
    if (!this.sfxEnabled || !this.unlock()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.setValueAtTime(118, now + 0.055);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }
}

window.NeonAudio = new NeonAudioEngine();
