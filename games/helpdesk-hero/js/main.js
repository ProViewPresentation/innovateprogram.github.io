/* Helpdesk Hero — bootstrap: desktop, taskbar, start menu, HUD, day flow, shortcuts. */
(function (HD) {
  'use strict';
  const D = HD.Data;

  document.addEventListener('DOMContentLoaded', () => {
    const desktopEl = document.getElementById('desktop');
    const taskbarButtonsEl = document.getElementById('taskbar-windows');
    const startMenuEl = document.getElementById('start-menu');
    const startBtn = document.getElementById('start-btn');
    const notifBell = document.getElementById('notif-bell');
    const notifBadge = document.getElementById('notif-badge');
    const creditsEl = document.getElementById('hud-credits');
    const repEl = document.getElementById('hud-reputation');
    const timerEl = document.getElementById('hud-timer');
    const dayEl = document.getElementById('hud-day');
    const levelEl = document.getElementById('hud-level');
    const overlay = document.getElementById('overlay');
    const callBanner = document.getElementById('call-banner');
    const mobileBar = document.getElementById('mobile-quickbar');
    const sfxToggle = document.getElementById('sfx-toggle');

    const game = new HD.Game();
    if (HD.Audio) HD.Audio.setEnabled(game.settings.sfx);
    document.body.classList.toggle('reduce-motion', !!game.settings.reduceMotion);

    const wm = new HD.WindowManager(desktopEl, taskbarButtonsEl);

    const ctx = {
      game,
      wm,
      openApp(id, ticketId) {
        apps[id].open(ticketId);
      },
    };

    const apps = {
      tickets: HD.Apps.tickets(ctx),
      telephony: HD.Apps.telephony(ctx),
      terminal: HD.Apps.terminal(ctx),
      browser: HD.Apps.browser(ctx),
      files: HD.Apps.files(ctx),
      registry: HD.Apps.registry(ctx),
      firewall: HD.Apps.firewall(ctx),
      security: HD.Apps.security(ctx),
      shop: HD.Apps.shop(ctx),
      settings: HD.Apps.settings(ctx),
      notifications: HD.Apps.notificationCenter(ctx),
    };

    const desktopApps = [
      { id: 'tickets', label: 'Tickets', icon: '🎫' },
      { id: 'telephony', label: 'Phone', icon: '☎️' },
      { id: 'terminal', label: 'Terminal', icon: '🖥️' },
      { id: 'browser', label: 'HelpNet', icon: '🌐' },
      { id: 'files', label: 'Files', icon: '🗂️' },
      { id: 'registry', label: 'Registry', icon: '🧩' },
      { id: 'firewall', label: 'Firewall', icon: '🛡️' },
      { id: 'security', label: 'Security', icon: '🦠' },
      { id: 'shop', label: 'Shop', icon: '🛒' },
      { id: 'settings', label: 'Settings', icon: '⚙️' },
    ];

    /* ---------------------------------------------------------- Desktop icons */
    function buildDesktopIcons() {
      const grid = document.getElementById('desktop-icons');
      grid.innerHTML = '';
      desktopApps.forEach((a) => {
        const btn = document.createElement('button');
        btn.className = 'desktop-icon';
        btn.type = 'button';
        btn.innerHTML = '<span class="di-icon">' + a.icon + '</span><span class="di-label">' + a.label + '</span>';
        btn.addEventListener('click', () => {
          if (HD.Audio) HD.Audio.click();
          apps[a.id].open();
        });
        grid.appendChild(btn);
      });
    }
    buildDesktopIcons();

    /* ---------------------------------------------------------- Start menu */
    function buildStartMenu() {
      const grid = startMenuEl.querySelector('.start-grid');
      grid.innerHTML = '';
      desktopApps.forEach((a) => {
        const btn = document.createElement('button');
        btn.className = 'start-item';
        btn.type = 'button';
        btn.innerHTML = '<span>' + a.icon + '</span>' + a.label;
        btn.addEventListener('click', () => {
          if (HD.Audio) HD.Audio.click();
          apps[a.id].open();
          closeStartMenu();
        });
        grid.appendChild(btn);
      });
    }
    buildStartMenu();

    function closeStartMenu() {
      startMenuEl.classList.remove('open');
      startBtn.classList.remove('active');
    }
    startBtn.addEventListener('click', () => {
      const open = startMenuEl.classList.toggle('open');
      startBtn.classList.toggle('active', open);
      if (HD.Audio) HD.Audio.click();
    });
    document.addEventListener('pointerdown', (e) => {
      if (startMenuEl.classList.contains('open') && !startMenuEl.contains(e.target) && e.target !== startBtn && !startBtn.contains(e.target)) {
        closeStartMenu();
      }
    });
    document.getElementById('end-shift-btn').addEventListener('click', () => {
      if (game.dayActive && game.running) {
        game.endDay();
      }
      closeStartMenu();
    });

    /* ---------------------------------------------------------- Mobile quick bar */
    function buildMobileBar() {
      mobileBar.innerHTML = '';
      ['tickets', 'telephony', 'terminal', 'shop'].forEach((id) => {
        const def = desktopApps.find((a) => a.id === id);
        const btn = document.createElement('button');
        btn.className = 'mq-btn';
        btn.type = 'button';
        btn.innerHTML = '<span>' + def.icon + '</span>' + def.label;
        btn.addEventListener('click', () => {
          if (HD.Audio) HD.Audio.click();
          apps[id].open();
        });
        mobileBar.appendChild(btn);
      });
    }
    buildMobileBar();

    /* ---------------------------------------------------------- Notification bell */
    let unread = 0;
    notifBell.addEventListener('click', () => {
      unread = 0;
      updateNotifBadge();
      apps.notifications.open();
      if (HD.Audio) HD.Audio.click();
    });
    function updateNotifBadge() {
      notifBadge.textContent = unread > 9 ? '9+' : String(unread);
      notifBadge.classList.toggle('show', unread > 0);
    }
    game.on('notify', () => {
      unread += 1;
      updateNotifBadge();
    });

    /* ---------------------------------------------------------- SFX toggle */
    sfxToggle.checked = game.settings.sfx;
    sfxToggle.addEventListener('change', () => {
      game.settings.sfx = sfxToggle.checked;
      if (HD.Audio) HD.Audio.setEnabled(sfxToggle.checked);
      game.save();
    });

    /* ---------------------------------------------------------- HUD */
    function renderHUD() {
      creditsEl.textContent = '💳 ' + game.credits;
      repEl.textContent = '⭐ ' + game.reputation + '%';
      timerEl.textContent = '⏱ ' + fmtClock(Math.max(0, game.shiftTime));
      dayEl.textContent = 'Day ' + game.day;
      levelEl.textContent = D.levelNames[game.level];
    }
    function fmtClock(sec) {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    }
    game.on('tick', renderHUD);
    game.on('ticket:resolved', renderHUD);
    game.on('ticket:failed', renderHUD);
    game.on('upgrade:bought', renderHUD);
    game.on('level:up', renderHUD);
    renderHUD();

    /* ---------------------------------------------------------- Call banner */
    function renderCallBanner() {
      const call = game.ringingCall;
      if (!call) {
        callBanner.classList.remove('show');
        callBanner.innerHTML = '';
        return;
      }
      callBanner.classList.add('show');
      callBanner.innerHTML =
        '<span class="call-ring-icon">📞</span><span>Incoming call: <strong>' + call.customer + '</strong> — ' + call.subject + '</span>' +
        '<button type="button" class="btn btn-primary btn-sm" id="banner-answer">Answer</button>' +
        '<button type="button" class="btn btn-danger btn-sm" id="banner-decline">Decline</button>';
      document.getElementById('banner-answer').addEventListener('click', () => {
        apps.telephony.open();
      });
      document.getElementById('banner-decline').addEventListener('click', () => game.declineCall());
    }
    game.on('call:ring', () => {
      renderCallBanner();
      wm.flash('telephony');
      if (HD.Audio) HD.Audio.ringStart();
    });
    game.on('call:answered', renderCallBanner);
    game.on('ticket:failed', renderCallBanner);
    game.on('call:tick', () => {});

    /* ---------------------------------------------------------- Auto-open ticket windows for new tickets */
    game.on('queue:update', () => {});
    game.on('ticket:activated', (t) => {
      // Gently surface newly activated tickets without forcing focus away from current work.
      wm.flash('tickets');
    });

    /* ---------------------------------------------------------- Day start / summary overlays */
    function showOverlay(html) {
      overlay.innerHTML = '<div class="overlay-card">' + html + '</div>';
      overlay.classList.add('show');
    }
    function hideOverlay() {
      overlay.classList.remove('show');
      overlay.innerHTML = '';
    }

    function showDayIntro() {
      const target = 4 + game.level + (game.day > 1 ? Math.min(game.day - 1, 4) : 0);
      showOverlay(
        '<h1>Day ' + game.day + '</h1>' +
          '<p>' + D.levelNames[game.level] + ' — Reputation ' + game.reputation + '%</p>' +
          '<p class="overlay-target">🎯 Resolve at least <strong>' + target + '</strong> tickets to hit today\'s target and earn a bonus.</p>' +
          '<button type="button" class="btn btn-primary btn-lg" id="begin-shift">Begin Shift</button>'
      );
      document.getElementById('begin-shift').addEventListener('click', () => {
        if (HD.Audio) HD.Audio.unlock();
        hideOverlay();
        game.startDay();
      });
    }

    game.on('day:end', (summary) => {
      const avgStars = summary.resolved || summary.failed ? (summary.avg).toFixed(1) : '0.0';
      showOverlay(
        '<h1>Shift Complete</h1>' +
          '<p>Day ' + (game.day - 1) + ' summary</p>' +
          '<ul class="overlay-stats">' +
          '<li>Resolved: <strong>' + summary.resolved + '</strong> / target ' + summary.target + '</li>' +
          '<li>Failed: <strong>' + summary.failed + '</strong></li>' +
          '<li>Average rating: <strong>' + avgStars + '★</strong></li>' +
          '<li>' + (summary.metTarget ? 'Target met! Bonus: <strong>+' + summary.bonus + '</strong> credits' : 'Target missed — no bonus this time.') + '</li>' +
          '</ul>' +
          '<button type="button" class="btn btn-primary btn-lg" id="next-day">Start Day ' + game.day + '</button>'
      );
      wm.closeAll();
      document.getElementById('next-day').addEventListener('click', () => {
        hideOverlay();
        showDayIntro();
      });
    });

    showDayIntro();

    /* ---------------------------------------------------------- Keyboard shortcuts (desktop) */
    document.addEventListener('keydown', (e) => {
      if (e.altKey) {
        const map = { t: 'terminal', c: 'tickets', p: 'telephony', b: 'browser', s: 'shop', n: 'notifications' };
        const key = e.key.toLowerCase();
        if (map[key]) {
          e.preventDefault();
          if (map[key] === 'notifications') apps.notifications.open();
          else apps[map[key]].open();
        }
      } else if (e.key === 'Escape') {
        const f = wm.getFocused();
        if (f) wm.close(f);
      }
    });

    /* ---------------------------------------------------------- Responsive relayout */
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => wm.relayoutForViewport(), 150);
    });

    /* ---------------------------------------------------------- Unlock audio on first interaction */
    ['pointerdown', 'keydown'].forEach((evt) => {
      window.addEventListener(
        evt,
        () => {
          if (HD.Audio) HD.Audio.unlock();
        },
        { once: true }
      );
    });

    /* ---------------------------------------------------------- Live clock in system tray */
    setInterval(() => {
      const el = document.getElementById('hud-clock');
      if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 1000 * 15);
    const clockEl = document.getElementById('hud-clock');
    if (clockEl) clockEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
})(window.HD = window.HD || {});
