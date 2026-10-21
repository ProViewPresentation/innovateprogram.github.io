/* Helpdesk Hero — Window Manager: draggable / resizable / focusable app windows.
   Uses Pointer Events so mouse, touch and pen all work identically. */
(function (HD) {
  'use strict';

  function WindowManager(desktopEl, taskbarButtonsEl) {
    this.desktop = desktopEl;
    this.taskbarButtons = taskbarButtonsEl;
    this.windows = new Map(); // id -> win record
    this.zTop = 10;
    this.cascadeOffset = 0;
    this.onFocus = null;
    this.onClose = null;
    this.onMinimize = null;
  }

  WindowManager.prototype.isMobile = function () {
    return window.matchMedia('(max-width: 760px)').matches;
  };

  WindowManager.prototype.get = function (id) {
    return this.windows.get(id);
  };

  WindowManager.prototype.has = function (id) {
    return this.windows.has(id);
  };

  WindowManager.prototype.focus = function (id) {
    const w = this.windows.get(id);
    if (!w) return;
    this.zTop += 1;
    w.el.style.zIndex = this.zTop;
    this.focusedId = id;
    this.windows.forEach((rec) => rec.el.classList.toggle('is-active', rec === w));
    this.taskbarButtons.querySelectorAll('.taskbtn').forEach((b) => b.classList.toggle('active', b.dataset.winid === id));
    if (typeof this.onFocus === 'function') this.onFocus(id);
  };

  WindowManager.prototype.open = function (opts) {
    // opts: {id, title, icon, width, height, x, y, minWidth, minHeight, resizable, buildContent(body), onClose}
    if (this.windows.has(opts.id)) {
      this.restore(opts.id);
      this.focus(opts.id);
      return this.windows.get(opts.id);
    }

    const mobile = this.isMobile();
    const win = document.createElement('div');
    win.className = 'hd-window' + (mobile ? ' is-mobile-full' : '');
    win.dataset.id = opts.id;

    const width = opts.width || 480;
    const height = opts.height || 360;
    let x = opts.x;
    let y = opts.y;
    if (x === undefined || y === undefined) {
      this.cascadeOffset = (this.cascadeOffset + 1) % 6;
      x = 40 + this.cascadeOffset * 28;
      y = 30 + this.cascadeOffset * 24;
    }

    if (!mobile) {
      win.style.width = width + 'px';
      win.style.height = height + 'px';
      win.style.left = x + 'px';
      win.style.top = y + 'px';
    }

    win.innerHTML =
      '<div class="hd-titlebar">' +
      '<span class="hd-wicon" aria-hidden="true">' + (opts.icon || '🗔') + '</span>' +
      '<span class="hd-wtitle"></span>' +
      '<div class="hd-wactions">' +
      '<button type="button" class="hd-wbtn hd-min" title="Minimize" aria-label="Minimize">&#8211;</button>' +
      '<button type="button" class="hd-wbtn hd-max" title="Maximize" aria-label="Maximize">&#9723;</button>' +
      '<button type="button" class="hd-wbtn hd-close" title="Close" aria-label="Close">&#10005;</button>' +
      '</div></div>' +
      '<div class="hd-wbody"></div>' +
      (opts.resizable === false ? '' : '<div class="hd-resize-handle" aria-hidden="true"></div>');

    win.querySelector('.hd-wtitle').textContent = opts.title || '';
    const body = win.querySelector('.hd-wbody');
    this.desktop.appendChild(win);

    const rec = { id: opts.id, el: win, body, opts, minimized: false, maximized: false, prevRect: null };
    this.windows.set(opts.id, rec);

    // Taskbar button
    const tb = document.createElement('button');
    tb.className = 'taskbtn';
    tb.type = 'button';
    tb.dataset.winid = opts.id;
    tb.innerHTML = '<span aria-hidden="true">' + (opts.icon || '🗔') + '</span><span class="taskbtn-label">' + (opts.title || '') + '</span>';
    tb.addEventListener('click', () => {
      if (rec.minimized) {
        this.restore(opts.id);
        this.focus(opts.id);
      } else if (this._isActive(opts.id)) {
        this.minimize(opts.id);
      } else {
        this.focus(opts.id);
      }
    });
    this.taskbarButtons.appendChild(tb);
    rec.taskBtn = tb;

    // Build content
    if (typeof opts.buildContent === 'function') opts.buildContent(body, rec);

    this._wireChrome(rec, { minWidth: opts.minWidth || 260, minHeight: opts.minHeight || 180 });

    win.addEventListener('pointerdown', () => this.focus(opts.id));
    this.focus(opts.id);
    if (HD.Audio) HD.Audio.openWindow();

    if (mobile) this._applyMobileFull(rec);

    return rec;
  };

  WindowManager.prototype._isActive = function (id) {
    const w = this.windows.get(id);
    return w && w.el.classList.contains('is-active') && !w.minimized;
  };

  WindowManager.prototype._applyMobileFull = function (rec) {
    rec.el.classList.add('is-mobile-full');
    rec.el.style.left = '';
    rec.el.style.top = '';
    rec.el.style.width = '';
    rec.el.style.height = '';
  };

  WindowManager.prototype._wireChrome = function (rec, bounds) {
    const win = rec.el;
    const titlebar = win.querySelector('.hd-titlebar');
    const handle = win.querySelector('.hd-resize-handle');
    const minBtn = win.querySelector('.hd-min');
    const maxBtn = win.querySelector('.hd-max');
    const closeBtn = win.querySelector('.hd-close');

    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.minimize(rec.id);
    });
    maxBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMaximize(rec.id);
    });
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close(rec.id);
    });
    titlebar.addEventListener('dblclick', () => this.toggleMaximize(rec.id));

    // Drag
    let dragging = false;
    let startX = 0,
      startY = 0,
      origX = 0,
      origY = 0;

    const onMove = (e) => {
      if (!dragging) return;
      if (this.isMobile() || rec.maximized) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let nx = origX + dx;
      let ny = origY + dy;
      const desktopRect = this.desktop.getBoundingClientRect();
      nx = Math.max(-win.offsetWidth + 80, Math.min(nx, desktopRect.width - 40));
      ny = Math.max(0, Math.min(ny, desktopRect.height - 36));
      win.style.left = nx + 'px';
      win.style.top = ny + 'px';
    };
    const onUp = (e) => {
      dragging = false;
      titlebar.releasePointerCapture && titlebar.hasPointerCapture && titlebar.hasPointerCapture(e.pointerId) && titlebar.releasePointerCapture(e.pointerId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    titlebar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.hd-wbtn')) return;
      if (this.isMobile() || rec.maximized) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origX = win.offsetLeft;
      origY = win.offsetTop;
      this.focus(rec.id);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    // Resize
    if (handle) {
      let resizing = false;
      let rStartX = 0,
        rStartY = 0,
        startW = 0,
        startH = 0;
      const onRMove = (e) => {
        if (!resizing) return;
        const dw = e.clientX - rStartX;
        const dh = e.clientY - rStartY;
        const desktopRect = this.desktop.getBoundingClientRect();
        const w = Math.max(bounds.minWidth, Math.min(startW + dw, desktopRect.width - win.offsetLeft));
        const h = Math.max(bounds.minHeight, Math.min(startH + dh, desktopRect.height - win.offsetTop));
        win.style.width = w + 'px';
        win.style.height = h + 'px';
      };
      const onRUp = () => {
        resizing = false;
        window.removeEventListener('pointermove', onRMove);
        window.removeEventListener('pointerup', onRUp);
      };
      handle.addEventListener('pointerdown', (e) => {
        if (this.isMobile() || rec.maximized) return;
        e.stopPropagation();
        resizing = true;
        rStartX = e.clientX;
        rStartY = e.clientY;
        startW = win.offsetWidth;
        startH = win.offsetHeight;
        this.focus(rec.id);
        window.addEventListener('pointermove', onRMove);
        window.addEventListener('pointerup', onRUp);
      });
    }
  };

  WindowManager.prototype.toggleMaximize = function (id) {
    const rec = this.windows.get(id);
    if (!rec || this.isMobile()) return;
    const win = rec.el;
    if (!rec.maximized) {
      rec.prevRect = { l: win.style.left, t: win.style.top, w: win.style.width, h: win.style.height };
      win.classList.add('is-maximized');
      rec.maximized = true;
    } else {
      win.classList.remove('is-maximized');
      if (rec.prevRect) {
        win.style.left = rec.prevRect.l;
        win.style.top = rec.prevRect.t;
        win.style.width = rec.prevRect.w;
        win.style.height = rec.prevRect.h;
      }
      rec.maximized = false;
    }
    this.focus(id);
  };

  WindowManager.prototype.minimize = function (id) {
    const rec = this.windows.get(id);
    if (!rec) return;
    rec.minimized = true;
    rec.el.classList.add('is-minimized');
    rec.taskBtn.classList.remove('active');
    if (typeof this.onMinimize === 'function') this.onMinimize(id);
  };

  WindowManager.prototype.restore = function (id) {
    const rec = this.windows.get(id);
    if (!rec) return;
    rec.minimized = false;
    rec.el.classList.remove('is-minimized');
    if (this.isMobile()) this._applyMobileFull(rec);
  };

  WindowManager.prototype.close = function (id) {
    const rec = this.windows.get(id);
    if (!rec) return;
    if (typeof rec.opts.onClose === 'function') {
      const allow = rec.opts.onClose();
      if (allow === false) return;
    }
    rec.el.remove();
    rec.taskBtn.remove();
    this.windows.delete(id);
    if (HD.Audio) HD.Audio.closeWindow();
    if (typeof this.onClose === 'function') this.onClose(id);
  };

  WindowManager.prototype.setTitle = function (id, title) {
    const rec = this.windows.get(id);
    if (!rec) return;
    rec.el.querySelector('.hd-wtitle').textContent = title;
    rec.taskBtn.querySelector('.taskbtn-label').textContent = title;
  };

  WindowManager.prototype.flash = function (id) {
    const rec = this.windows.get(id);
    if (!rec) return;
    rec.taskBtn.classList.add('flash');
    setTimeout(() => rec.taskBtn && rec.taskBtn.classList.remove('flash'), 1600);
  };

  WindowManager.prototype.relayoutForViewport = function () {
    const mobile = this.isMobile();
    this.windows.forEach((rec) => {
      if (mobile) {
        this._applyMobileFull(rec);
      } else {
        rec.el.classList.remove('is-mobile-full');
      }
    });
  };

  WindowManager.prototype.getFocused = function () {
    return this.focusedId && this.windows.has(this.focusedId) ? this.focusedId : null;
  };

  WindowManager.prototype.closeAll = function () {
    Array.from(this.windows.keys()).forEach((id) => this.close(id));
  };

  HD.WindowManager = WindowManager;
})(window.HD = window.HD || {});
