/* Helpdesk Hero — procedural Web Audio SFX engine (no external audio files needed) */
(function (HD) {
  'use strict';

  function AudioEngine() {
    this.ctx = null;
    this.master = null;
    this.enabled = this._pref('hd_sfx', true);
    this._ringOsc = null;
  }

  AudioEngine.prototype._pref = function (key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v === '1';
    } catch (e) {
      return fallback;
    }
  };

  AudioEngine.prototype._savePref = function (key, v) {
    try {
      localStorage.setItem(key, v ? '1' : '0');
    } catch (e) {}
  };

  AudioEngine.prototype.unlock = function () {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
  };

  AudioEngine.prototype.setEnabled = function (v) {
    this.enabled = v;
    this._savePref('hd_sfx', v);
  };

  AudioEngine.prototype._tone = function (freq, dur, opts) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx) return;
    opts = opts || {};
    const t0 = this.ctx.currentTime + (opts.delay || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + dur);
    }
    const peak = opts.gain !== undefined ? opts.gain : 0.5;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  };

  AudioEngine.prototype.click = function () {
    this._tone(620, 0.05, { type: 'square', gain: 0.25 });
  };

  AudioEngine.prototype.toggle = function () {
    this._tone(380, 0.06, { type: 'triangle', gain: 0.3 });
  };

  AudioEngine.prototype.success = function () {
    this._tone(523.25, 0.12, { type: 'sine', gain: 0.4 });
    this._tone(659.25, 0.14, { type: 'sine', gain: 0.35, delay: 0.1 });
    this._tone(783.99, 0.22, { type: 'sine', gain: 0.35, delay: 0.2 });
  };

  AudioEngine.prototype.error = function () {
    this._tone(220, 0.18, { type: 'sawtooth', gain: 0.3 });
    this._tone(160, 0.22, { type: 'sawtooth', gain: 0.28, delay: 0.09 });
  };

  AudioEngine.prototype.notify = function () {
    this._tone(880, 0.08, { type: 'sine', gain: 0.3 });
    this._tone(1108.73, 0.14, { type: 'sine', gain: 0.25, delay: 0.09 });
  };

  AudioEngine.prototype.type = function () {
    this._tone(1200 + Math.random() * 300, 0.02, { type: 'square', gain: 0.08 });
  };

  AudioEngine.prototype.cash = function () {
    this._tone(988, 0.05, { type: 'square', gain: 0.2 });
    this._tone(1318.5, 0.08, { type: 'square', gain: 0.22, delay: 0.06 });
    this._tone(1568, 0.1, { type: 'square', gain: 0.22, delay: 0.12 });
  };

  AudioEngine.prototype.openWindow = function () {
    this._tone(300, 0.1, { type: 'sine', slideTo: 700, gain: 0.25 });
  };

  AudioEngine.prototype.closeWindow = function () {
    this._tone(700, 0.1, { type: 'sine', slideTo: 250, gain: 0.25 });
  };

  AudioEngine.prototype.ringStart = function () {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx || this._ringOsc) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1000;
    lfo.type = 'square';
    lfo.frequency.value = 2.2;
    lfoGain.gain.value = 0.5;
    gain.gain.value = 0.0;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain).connect(this.master);
    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    osc.start();
    lfo.start();
    this._ringOsc = { osc, lfo, gain };
  };

  AudioEngine.prototype.ringStop = function () {
    if (!this._ringOsc) return;
    try {
      this._ringOsc.osc.stop();
      this._ringOsc.lfo.stop();
    } catch (e) {}
    this._ringOsc = null;
  };

  HD.Audio = new AudioEngine();
})(window.HD = window.HD || {});
