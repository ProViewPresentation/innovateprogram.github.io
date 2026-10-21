/* Helpdesk Hero — core game state, ticket lifecycle, scoring, save/load. */
(function (HD) {
  'use strict';
  const D = HD.Data;

  function Emitter() {
    this._l = {};
  }
  Emitter.prototype.on = function (evt, fn) {
    (this._l[evt] = this._l[evt] || []).push(fn);
    return this;
  };
  Emitter.prototype.off = function (evt, fn) {
    if (this._l[evt]) this._l[evt] = this._l[evt].filter((f) => f !== fn);
    return this;
  };
  Emitter.prototype.emit = function (evt, payload) {
    (this._l[evt] || []).forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error(e);
      }
    });
  };

  const SAVE_KEY = 'helpdeskHeroSave_v1';

  function Game() {
    Emitter.call(this);
    this.credits = 150;
    this.day = 1;
    this.level = 0; // index into D.levelNames
    this.ticketsResolvedTotal = 0;
    this.ticketsFailedTotal = 0;
    this.reputation = 72; // 0-100
    this.upgrades = { fastTools: 0, autoDiag: 0, dualMonitor: 0, coffee: 0, headset: 0, macro: 0 };
    this.settings = { sfx: true, reduceMotion: false };

    this.shiftLength = 210; // seconds
    this.shiftTime = this.shiftLength;
    this.running = false;
    this.paused = false;
    this.dayActive = false;

    this.dailyTarget = 5;
    this.dailyResolved = 0;
    this.dailyRatingSum = 0;
    this.dailyRatingCount = 0;
    this.dailyFailed = 0;

    this.queue = []; // waiting (silent) tickets
    this.activeTickets = []; // open tickets player is working
    this.ringingCall = null; // ticket currently ringing
    this.notifications = [];
    this.nextTicketSeq = 1;

    this.firewallRules = D.defaultFirewallRules.map((r) => Object.assign({}, r));
    this.registryState = JSON.parse(JSON.stringify(D.registryTemplate));
    (function tagBroken(node) {
      if (Array.isArray(node)) {
        node.forEach((entry) => {
          entry.brokenValue = entry.value;
        });
        return;
      }
      if (node && typeof node === 'object') {
        Object.keys(node).forEach((k) => tagBroken(node[k]));
      }
    })(this.registryState);
    this.recycleBin = []; // {file, restored}

    this._spawnTimer = null;
    this._tickTimer = null;

    this.load();
  }
  Game.prototype = Object.create(Emitter.prototype);

  Game.prototype.maxActiveTickets = function () {
    return 2 + this.upgrades.dualMonitor;
  };

  Game.prototype.speedMultiplier = function () {
    return 1 - this.upgrades.fastTools * 0.15;
  };

  Game.prototype.patienceMultiplier = function () {
    let m = 1;
    if (this._coffeeActiveToday) m *= 0.6;
    return m;
  };

  /* ---------------------------------------------------- persistence */
  Game.prototype.save = function () {
    try {
      const data = {
        credits: this.credits,
        day: this.day,
        level: this.level,
        ticketsResolvedTotal: this.ticketsResolvedTotal,
        ticketsFailedTotal: this.ticketsFailedTotal,
        reputation: this.reputation,
        upgrades: this.upgrades,
        settings: this.settings,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {}
  };

  Game.prototype.load = function () {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      Object.assign(this, {
        credits: data.credits ?? this.credits,
        day: data.day ?? this.day,
        level: data.level ?? this.level,
        ticketsResolvedTotal: data.ticketsResolvedTotal ?? 0,
        ticketsFailedTotal: data.ticketsFailedTotal ?? 0,
        reputation: data.reputation ?? this.reputation,
      });
      if (data.upgrades) Object.assign(this.upgrades, data.upgrades);
      if (data.settings) Object.assign(this.settings, data.settings);
    } catch (e) {}
  };

  Game.prototype.resetProgress = function () {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
  };

  /* ---------------------------------------------------- notifications */
  Game.prototype.notify = function (title, body, kind) {
    const n = { id: 'n' + Date.now() + Math.random().toString(16).slice(2), title, body, kind: kind || 'info', time: Date.now(), read: false };
    this.notifications.unshift(n);
    if (this.notifications.length > 40) this.notifications.length = 40;
    this.emit('notify', n);
    if (HD.Audio) HD.Audio.notify();
    return n;
  };

  /* ---------------------------------------------------- ticket generation */
  Game.prototype._availableTypes = function () {
    const lvl = this.level + 1;
    return Object.keys(D.ticketTypes).filter((k) => D.ticketTypes[k].minLevel <= lvl);
  };

  Game.prototype._fillTemplate = function (type, def, variant) {
    let host, pid, proc, file, port;
    let subject = variant.subject;
    let body = variant.body;
    const req = [];
    switch (type) {
      case 'password_reset':
        req.push({ id: 'verify', label: 'Verify identity & reset password', done: false });
        break;
      case 'email_config':
        req.push({ id: 'config', label: 'Submit correct mail server settings', done: false });
        break;
      case 'software_install':
        req.push({ id: 'install', label: 'Install the requested software', done: false });
        break;
      case 'peripheral':
        req.push({ id: 'cable', label: 'Check cable / connection', done: false });
        req.push({ id: 'restart', label: 'Restart driver / spooler', done: false });
        req.push({ id: 'test', label: 'Run test', done: false });
        break;
      case 'network_diag':
        host = D.ticketTypes.network_diag.hosts[(Math.random() * D.ticketTypes.network_diag.hosts.length) | 0];
        body = body.replace('{host}', host);
        req.push({ id: 'ping:' + host, label: 'ping ' + host + ' from the Terminal', done: false, host });
        break;
      case 'terminal_task':
        proc = D.ticketTypes.terminal_task.procs[(Math.random() * D.ticketTypes.terminal_task.procs.length) | 0];
        pid = 1000 + ((Math.random() * 9000) | 0);
        body = body.replace('{proc}', proc).replace(/\{pid\}/g, pid);
        req.push({ id: 'kill:' + pid, label: 'kill ' + pid + ' from the Terminal', done: false, pid, proc });
        break;
      case 'malware_scan':
        req.push({ id: 'scan', label: 'Run a scan and quarantine all threats', done: false });
        break;
      case 'file_recovery':
        file = D.ticketTypes.file_recovery.files[(Math.random() * D.ticketTypes.file_recovery.files.length) | 0];
        body = body.replace(/\{file\}/g, file);
        req.push({ id: 'restore:' + file, label: 'Restore ' + file + ' from Recycle Bin', done: false, file });
        if (!this.recycleBin.find((r) => r.file === file)) {
          this.recycleBin.push({ file, restored: false });
        }
        break;
      case 'registry_edit': {
        const paths = [
          { path: ['HKEY_LOCAL_MACHINE', 'SOFTWARE', 'Policies', 'Explorer'], key: 'DisableTaskbarFeatures' },
          { path: ['HKEY_LOCAL_MACHINE', 'SOFTWARE', 'Policies', 'TimesheetApp'], key: 'StartupAllowed' },
          { path: ['HKEY_LOCAL_MACHINE', 'SOFTWARE', 'Microsoft', 'Windows', 'USBSTOR'], key: 'Start' },
        ];
        const pick = paths[(Math.random() * paths.length) | 0];
        const entry = this._registryEntry(pick.path, pick.key);
        if (entry) entry.value = entry.brokenValue;
        req.push({ id: 'reg:' + pick.key, label: 'Fix ' + pick.key + ' in Registry Editor', done: false, path: pick.path, key: pick.key });
        break;
      }
      case 'firewall_rule':
        port = D.ticketTypes.firewall_rule.ports[(Math.random() * D.ticketTypes.firewall_rule.ports.length) | 0];
        body = body.replace(/\{port\}/g, port);
        req.push({ id: 'fw:' + port, label: 'Allow port ' + port + ' in the Firewall app', done: false, port });
        break;
    }
    return { subject, body, requirements: req };
  };

  Game.prototype._registryEntry = function (path, key) {
    let node = this.registryState;
    for (const seg of path) {
      if (!node) return null;
      node = node[seg];
    }
    if (!Array.isArray(node)) return null;
    return node.find((e) => e.name === key) || null;
  };

  Game.prototype.hasFirewallAllow = function (port) {
    return this.firewallRules.some((r) => r.enabled && r.action === 'Allow' && Number(r.port) === Number(port));
  };

  Game.prototype.createTicket = function (viaCall) {
    const types = this._availableTypes();
    const type = types[(Math.random() * types.length) | 0];
    const def = D.ticketTypes[type];
    const variant = def.variants[(Math.random() * def.variants.length) | 0];
    const filled = this._fillTemplate(type, def, variant);
    const person = D.randomPerson();
    const id = 'tk' + this.nextTicketSeq++;
    const diffMul = 1 + this.level * 0.12;
    const ticket = {
      id,
      type,
      icon: def.icon,
      label: def.label,
      customer: person.name,
      avatar: person.avatar,
      subject: filled.subject,
      body: filled.body,
      requirements: filled.requirements,
      app: def.app,
      viaCall: !!viaCall,
      status: viaCall ? 'ringing' : 'queued',
      mood: 50, // 0-100, 50 neutral
      patience: 100,
      patienceDecay: (viaCall ? 2.4 : 1.1) * diffMul,
      reward: Math.round(def.baseReward * diffMul),
      createdAt: Date.now(),
      attempts: 0,
      mistakes: 0,
      callAnswered: !viaCall,
    };
    return ticket;
  };

  /* ---------------------------------------------------- spawn & tick loop */
  Game.prototype.startDay = function () {
    this.dayActive = true;
    this.running = true;
    this.paused = false;
    this.shiftTime = this.shiftLength;
    this.dailyResolved = 0;
    this.dailyRatingSum = 0;
    this.dailyRatingCount = 0;
    this.dailyFailed = 0;
    this.dailyTarget = 4 + this.level + (this.day > 1 ? Math.min(this.day - 1, 4) : 0);
    this._coffeeActiveToday = this.upgrades.coffee > 0;
    this.queue = [];
    this.activeTickets = [];
    this.ringingCall = null;
    this.emit('day:start', { day: this.day });
    this._scheduleSpawn(true);
    this._startTick();
  };

  Game.prototype._scheduleSpawn = function (first) {
    clearTimeout(this._spawnTimer);
    const base = Math.max(6, 16 - this.level * 1.5 - this.day * 0.4);
    const delay = (first ? 2.5 : base + Math.random() * 6) * 1000;
    this._spawnTimer = setTimeout(() => {
      if (!this.running || this.paused) {
        this._scheduleSpawn();
        return;
      }
      this._spawnOne();
      this._scheduleSpawn();
    }, delay);
  };

  Game.prototype._spawnOne = function () {
    const asCall = Math.random() < 0.55 && !this.ringingCall;
    const ticket = this.createTicket(asCall);
    if (asCall) {
      this.ringingCall = ticket;
      this.emit('call:ring', ticket);
      this.notify('Incoming Call', ticket.customer + ' is calling about "' + ticket.subject + '"', 'call');
    } else {
      this.queue.push(ticket);
      this.notify('New Ticket', ticket.customer + ': ' + ticket.subject, 'ticket');
      this.emit('queue:update');
    }
  };

  Game.prototype._startTick = function () {
    clearInterval(this._tickTimer);
    this._tickTimer = setInterval(() => this._tick(), 1000);
  };

  Game.prototype._tick = function () {
    if (!this.running || this.paused) return;
    this.shiftTime -= 1;
    const pm = this.patienceMultiplier();

    if (this.ringingCall) {
      this.ringingCall.patience -= this.ringingCall.patienceDecay * pm;
      if (this.ringingCall.patience <= 0) {
        const missed = this.ringingCall;
        this.ringingCall = null;
        if (HD.Audio) HD.Audio.ringStop();
        this._failTicket(missed, 'missed');
      } else {
        this.emit('call:tick', this.ringingCall);
      }
    }

    this.activeTickets.forEach((t) => {
      t.patience -= t.patienceDecay * pm * 0.6;
    });
    const stillActive = [];
    this.activeTickets.forEach((t) => {
      if (t.patience <= 0) {
        this._failTicket(t, 'timeout');
      } else {
        stillActive.push(t);
      }
    });
    this.activeTickets = stillActive;

    // pull queued into active if slots free
    while (this.activeTickets.length < this.maxActiveTickets() && this.queue.length) {
      const t = this.queue.shift();
      t.status = 'active';
      this.activeTickets.push(t);
      this.emit('ticket:activated', t);
    }
    this.queue.forEach((t) => {
      t.patience -= t.patienceDecay * pm * 0.35;
    });
    this.queue = this.queue.filter((t) => {
      if (t.patience <= 0) {
        this._failTicket(t, 'abandoned');
        return false;
      }
      return true;
    });

    this.emit('tick', { shiftTime: this.shiftTime });

    if (this.shiftTime <= 0) {
      this.endDay();
    }
  };

  Game.prototype.pause = function (v) {
    this.paused = v;
  };

  /* ---------------------------------------------------- call handling */
  Game.prototype.answerCall = function () {
    if (!this.ringingCall) return null;
    const t = this.ringingCall;
    t.callAnswered = true;
    this.ringingCall = null;
    if (HD.Audio) HD.Audio.ringStop();
    t.status = 'active';
    if (this.activeTickets.length < this.maxActiveTickets()) {
      this.activeTickets.push(t);
    } else {
      t.status = 'queued';
      this.queue.push(t);
    }
    this.emit('call:answered', t);
    return t;
  };

  Game.prototype.declineCall = function () {
    if (!this.ringingCall) return;
    const t = this.ringingCall;
    this.ringingCall = null;
    if (HD.Audio) HD.Audio.ringStop();
    this._failTicket(t, 'declined');
  };

  Game.prototype.applyCallReply = function (ticket, option) {
    ticket.mood = Math.max(0, Math.min(100, ticket.mood + option.moodDelta * 5));
    ticket.patience = Math.max(0, Math.min(100, ticket.patience + option.patienceDelta));
  };

  /* ---------------------------------------------------- requirement + resolution */
  Game.prototype.markRequirement = function (ticketId, reqId, correct) {
    const t = this.findTicket(ticketId);
    if (!t) return;
    const req = t.requirements.find((r) => r.id === reqId);
    if (!req) return;
    t.attempts++;
    if (correct) {
      req.done = true;
      t.mood = Math.min(100, t.mood + 8);
      t.patience = Math.min(100, t.patience + 6);
      if (HD.Audio) HD.Audio.success();
    } else {
      t.mistakes++;
      t.mood = Math.max(0, t.mood - 14);
      t.patience = Math.max(0, t.patience - 10);
      if (HD.Audio) HD.Audio.error();
    }
    this.emit('ticket:update', t);
    return req.done;
  };

  Game.prototype.allRequirementsDone = function (t) {
    return t.requirements.every((r) => r.done);
  };

  Game.prototype.findTicket = function (id) {
    return this.activeTickets.find((t) => t.id === id) || this.queue.find((t) => t.id === id) || (this.ringingCall && this.ringingCall.id === id ? this.ringingCall : null);
  };

  Game.prototype.resolveTicket = function (ticketId) {
    const t = this.findTicket(ticketId);
    if (!t || !this.allRequirementsDone(t)) return null;
    this.activeTickets = this.activeTickets.filter((x) => x.id !== ticketId);
    this.queue = this.queue.filter((x) => x.id !== ticketId);

    const speedRatio = t.patience / 100;
    const mistakesPenalty = Math.min(2, t.mistakes * 0.4);
    let stars = 3 + speedRatio * 1.6 + (t.mood - 50) / 50 - mistakesPenalty;
    stars = Math.max(1, Math.min(5, Math.round(stars)));

    const payout = Math.round(t.reward * (0.6 + stars * 0.14));
    this.credits += payout;
    this.ticketsResolvedTotal += 1;
    this.dailyResolved += 1;
    this.dailyRatingSum += stars;
    this.dailyRatingCount += 1;
    this.reputation = Math.max(0, Math.min(100, Math.round(this.reputation * 0.88 + stars * 20 * 0.12)));

    const leveledUp = this._checkLevelUp();

    if (HD.Audio) HD.Audio.cash();
    this.notify('Ticket Resolved', t.customer + ' rated you ' + stars + '★ (+' + payout + ' credits)', 'resolved');
    this.emit('ticket:resolved', { ticket: t, stars, payout, leveledUp });
    this.save();
    return { stars, payout, leveledUp };
  };

  Game.prototype._failTicket = function (t, reason) {
    this.activeTickets = this.activeTickets.filter((x) => x.id !== t.id);
    this.queue = this.queue.filter((x) => x.id !== t.id);
    this.ticketsFailedTotal += 1;
    this.dailyFailed += 1;
    this.dailyRatingSum += 1;
    this.dailyRatingCount += 1;
    this.reputation = Math.max(0, this.reputation - 6);
    const reasonText =
      reason === 'missed' ? 'gave up waiting on hold.' : reason === 'timeout' ? 'escalated the ticket in frustration.' : reason === 'declined' ? 'call was declined.' : 'ticket was abandoned.';
    this.notify('Ticket Lost', t.customer + ' ' + reasonText, 'failed');
    this.emit('ticket:failed', { ticket: t, reason });
    this.save();
  };

  Game.prototype._checkLevelUp = function () {
    const next = this.level + 1;
    if (next < D.levelThresholds.length && this.ticketsResolvedTotal >= D.levelThresholds[next]) {
      this.level = next;
      this.notify('Promotion!', 'You have been promoted to ' + D.levelNames[this.level] + '!', 'promotion');
      this.emit('level:up', this.level);
      return true;
    }
    return false;
  };

  Game.prototype.endDay = function () {
    this.running = false;
    clearTimeout(this._spawnTimer);
    clearInterval(this._tickTimer);
    this.ringingCall = null;
    if (HD.Audio) HD.Audio.ringStop();
    const avg = this.dailyRatingCount ? this.dailyRatingSum / this.dailyRatingCount : 0;
    const metTarget = this.dailyResolved >= this.dailyTarget;
    const bonus = metTarget ? 40 + this.day * 6 : 0;
    this.credits += bonus;
    this.day += 1;
    this.save();
    this.emit('day:end', { avg, metTarget, bonus, resolved: this.dailyResolved, failed: this.dailyFailed, target: this.dailyTarget });
  };

  /* ---------------------------------------------------- shop */
  Game.prototype.upgradeCost = function (def) {
    const lvl = this.upgrades[def.id] || 0;
    if (lvl >= def.maxLevel && !def.consumable) return null;
    return Math.round(def.baseCost * Math.pow(def.costGrowth, lvl));
  };

  Game.prototype.buyUpgrade = function (id) {
    const def = D.upgrades.find((u) => u.id === id);
    if (!def) return false;
    const cost = this.upgradeCost(def);
    if (cost === null || this.credits < cost) return false;
    this.credits -= cost;
    if (def.consumable) {
      this.upgrades[id] = (this.upgrades[id] || 0) + 1;
      this._coffeeActiveToday = true;
    } else {
      this.upgrades[id] = Math.min(def.maxLevel, (this.upgrades[id] || 0) + 1);
    }
    this.save();
    this.emit('upgrade:bought', id);
    return true;
  };

  HD.Game = Game;
})(window.HD = window.HD || {});
