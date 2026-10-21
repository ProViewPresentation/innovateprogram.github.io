/* Helpdesk Hero — application windows: Tickets CRM, Telephony, Terminal, Browser,
   File Explorer, Registry Editor, Firewall, Security Scanner, Shop, Settings, Notifications. */
(function (HD) {
  'use strict';
  const D = HD.Data;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtClock(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function moodEmoji(mood) {
    if (mood >= 75) return '😄';
    if (mood >= 55) return '🙂';
    if (mood >= 35) return '😐';
    if (mood >= 15) return '😠';
    return '🤬';
  }
  function patienceClass(p) {
    if (p > 60) return 'ok';
    if (p > 30) return 'warn';
    return 'bad';
  }

  HD.Apps = {};

  /* =========================================================== Shared: Ticket Detail Window */
  function openTicketWindow(ctx, ticket) {
    const { game, wm } = ctx;
    const winId = 'ticket-' + ticket.id;
    if (wm.has(winId)) {
      wm.restore(winId);
      wm.focus(winId);
      return;
    }

    wm.open({
      id: winId,
      title: ticket.label + ' — ' + ticket.customer,
      icon: ticket.icon,
      width: 420,
      height: 420,
      minWidth: 320,
      minHeight: 340,
      buildContent: (body, rec) => {
        body.classList.add('app-ticket');
        render();

        const onTick = () => updateMeters();
        const onUpdate = (t) => {
          if (t.id === ticket.id) render();
        };
        const onResolved = (payload) => {
          if (payload.ticket.id === ticket.id) {
            showRatingToast(payload.stars, payload.payout);
            setTimeout(() => wm.close(winId), 1400);
          }
        };
        const onFailed = (payload) => {
          if (payload.ticket.id === ticket.id) {
            wm.close(winId);
          }
        };
        game.on('tick', onTick);
        game.on('ticket:update', onUpdate);
        game.on('ticket:resolved', onResolved);
        game.on('ticket:failed', onFailed);

        rec.opts.onClose = () => {
          game.off('tick', onTick);
          game.off('ticket:update', onUpdate);
          game.off('ticket:resolved', onResolved);
          game.off('ticket:failed', onFailed);
        };

        function showRatingToast(stars, payout) {
          body.innerHTML = '';
          const box = el('div', 'ticket-resolved-toast');
          box.innerHTML =
            '<div class="stars">' + '★'.repeat(stars) + '☆'.repeat(5 - stars) + '</div>' +
            '<div class="credit-gain">+' + payout + ' credits</div>' +
            '<div class="sub">' + esc(ticket.customer) + ' says thanks!</div>';
          body.appendChild(box);
        }

        function updateMeters() {
          const bar = body.querySelector('.patience-fill');
          const wrap = body.querySelector('.patience-bar');
          const moodEl = body.querySelector('.mood-emoji');
          if (bar && wrap) {
            bar.style.width = Math.max(0, ticket.patience) + '%';
            wrap.className = 'patience-bar ' + patienceClass(ticket.patience);
          }
          if (moodEl) moodEl.textContent = moodEmoji(ticket.mood);
        }

        function render() {
          body.innerHTML = '';
          const head = el(
            'div',
            'ticket-head',
            '<div class="ticket-avatar">' + ticket.avatar + '</div>' +
              '<div class="ticket-meta"><strong>' + esc(ticket.customer) + '</strong><span>' + esc(ticket.subject) + '</span></div>' +
              '<div class="mood-emoji">' + moodEmoji(ticket.mood) + '</div>'
          );
          body.appendChild(head);

          const desc = el('p', 'ticket-desc', esc(ticket.body));
          body.appendChild(desc);

          const panel = el('div', 'ticket-panel');
          panel.appendChild(buildResolutionPanel(ctx, ticket, () => render()));
          body.appendChild(panel);

          const patWrap = el('div', 'patience-bar ' + patienceClass(ticket.patience));
          patWrap.innerHTML = '<div class="patience-fill" style="width:' + Math.max(0, ticket.patience) + '%"></div>';
          body.appendChild(el('div', 'patience-label', 'Customer patience'));
          body.appendChild(patWrap);

          const footer = el('div', 'ticket-footer');
          const resolveBtn = el('button', 'btn btn-primary', 'Resolve &amp; Close Ticket');
          resolveBtn.type = 'button';
          resolveBtn.disabled = !game.allRequirementsDone(ticket);
          resolveBtn.addEventListener('click', () => {
            if (HD.Audio) HD.Audio.click();
            game.resolveTicket(ticket.id);
          });
          footer.appendChild(resolveBtn);
          body.appendChild(footer);
        }
      },
    });
  }
  HD.Apps.openTicketWindow = openTicketWindow;

  function buildResolutionPanel(ctx, ticket, refresh) {
    const { game, wm } = ctx;
    const wrap = el('div', 'resolution');

    function jumpTo(appId) {
      if (HD.Audio) HD.Audio.click();
      ctx.openApp(appId, ticket.id);
    }

    switch (ticket.type) {
      case 'password_reset': {
        const correct = ticket.customer;
        const decoyPool = D.firstNames.map((f) => f + ' ' + D.lastNames[(Math.random() * D.lastNames.length) | 0]);
        const options = Array.from(new Set([correct, decoyPool[0], decoyPool[1]])).sort(() => Math.random() - 0.5);
        const sel = el('select', 'select');
        options.forEach((o) => sel.appendChild(el('option', '', esc(o))));
        const btn = el('button', 'btn btn-accent', 'Verify &amp; Reset Password');
        btn.type = 'button';
        btn.disabled = ticket.requirements[0].done;
        btn.addEventListener('click', () => {
          const ok = sel.value === correct;
          game.markRequirement(ticket.id, 'verify', ok);
          refresh();
        });
        wrap.appendChild(el('label', 'field-label', 'Confirm employee identity before reset:'));
        wrap.appendChild(sel);
        wrap.appendChild(btn);
        if (ticket.requirements[0].done) wrap.appendChild(el('p', 'req-done', '✅ Password reset & identity verified.'));
        break;
      }
      case 'email_config': {
        const servers = ['imap.corpmail.net', 'mail.internal.local', 'pop.corpmail.net'];
        const ports = ['993', '143', '110'];
        const s1 = el('select', 'select');
        servers.forEach((o) => s1.appendChild(el('option', '', o)));
        const s2 = el('select', 'select');
        ports.forEach((o) => s2.appendChild(el('option', '', o)));
        const btn = el('button', 'btn btn-accent', 'Apply Settings');
        btn.type = 'button';
        btn.disabled = ticket.requirements[0].done;
        btn.addEventListener('click', () => {
          const ok = s1.value === 'imap.corpmail.net' && s2.value === '993';
          game.markRequirement(ticket.id, 'config', ok);
          refresh();
        });
        wrap.appendChild(el('label', 'field-label', 'Incoming mail server:'));
        wrap.appendChild(s1);
        wrap.appendChild(el('label', 'field-label', 'Port:'));
        wrap.appendChild(s2);
        wrap.appendChild(el('p', 'hint-text', 'Tip: check the Browser app knowledge base for the standard settings.'));
        wrap.appendChild(btn);
        if (ticket.requirements[0].done) wrap.appendChild(el('p', 'req-done', '✅ Mail account reconfigured.'));
        break;
      }
      case 'software_install': {
        const req = ticket.requirements[0];
        const btn = el('button', 'btn btn-accent', req.done ? 'Installed ✅' : 'Install Software');
        btn.type = 'button';
        btn.disabled = req.done || ticket._installing;
        const prog = el('div', 'progress-track');
        prog.innerHTML = '<div class="progress-fill" style="width:0%"></div>';
        wrap.appendChild(el('p', 'hint-text', 'Push the install package to the customer machine.'));
        wrap.appendChild(btn);
        wrap.appendChild(prog);
        btn.addEventListener('click', () => {
          if (req.done || ticket._installing) return;
          ticket._installing = true;
          btn.disabled = true;
          btn.textContent = 'Installing…';
          const duration = 3500 * game.speedMultiplier();
          const start = Date.now();
          const fill = prog.querySelector('.progress-fill');
          const timer = setInterval(() => {
            const pct = Math.min(100, ((Date.now() - start) / duration) * 100);
            fill.style.width = pct + '%';
            if (pct >= 100) {
              clearInterval(timer);
              ticket._installing = false;
              game.markRequirement(ticket.id, 'install', true);
              refresh();
            }
          }, 100);
        });
        if (req.done) wrap.appendChild(el('p', 'req-done', '✅ Software installed and verified.'));
        break;
      }
      case 'peripheral': {
        ticket.requirements.forEach((req) => {
          const row = el('div', 'check-row');
          const btn = el('button', 'btn btn-toggle' + (req.done ? ' done' : ''), req.done ? '✅ ' + req.label : 'Do: ' + req.label);
          btn.type = 'button';
          btn.disabled = req.done;
          btn.addEventListener('click', () => {
            game.markRequirement(ticket.id, req.id, true);
            refresh();
          });
          row.appendChild(btn);
          wrap.appendChild(row);
        });
        break;
      }
      case 'network_diag': {
        const req = ticket.requirements[0];
        wrap.appendChild(el('p', 'hint-text', 'Open the Terminal and run: <code>ping ' + esc(req.host) + '</code>'));
        const btn = el('button', 'btn btn-accent', 'Open Terminal');
        btn.type = 'button';
        btn.addEventListener('click', () => jumpTo('terminal'));
        wrap.appendChild(btn);
        if (req.done) wrap.appendChild(el('p', 'req-done', '✅ Network link confirmed.'));
        break;
      }
      case 'terminal_task': {
        const req = ticket.requirements[0];
        wrap.appendChild(el('p', 'hint-text', 'Open the Terminal and run: <code>kill ' + req.pid + '</code>'));
        const btn = el('button', 'btn btn-accent', 'Open Terminal');
        btn.type = 'button';
        btn.addEventListener('click', () => jumpTo('terminal'));
        wrap.appendChild(btn);
        if (req.done) wrap.appendChild(el('p', 'req-done', '✅ Process terminated.'));
        break;
      }
      case 'malware_scan': {
        const req = ticket.requirements[0];
        wrap.appendChild(el('p', 'hint-text', 'Open the Security Scanner, run a scan, and quarantine every threat.'));
        const btn = el('button', 'btn btn-accent', 'Open Security Scanner');
        btn.type = 'button';
        btn.addEventListener('click', () => jumpTo('security'));
        wrap.appendChild(btn);
        if (req.done) wrap.appendChild(el('p', 'req-done', '✅ System cleaned.'));
        break;
      }
      case 'file_recovery': {
        const req = ticket.requirements[0];
        wrap.appendChild(el('p', 'hint-text', 'Open File Explorer → Recycle Bin and restore <strong>' + esc(req.file) + '</strong>.'));
        const btn = el('button', 'btn btn-accent', 'Open File Explorer');
        btn.type = 'button';
        btn.addEventListener('click', () => jumpTo('files'));
        wrap.appendChild(btn);
        if (req.done) wrap.appendChild(el('p', 'req-done', '✅ File restored.'));
        break;
      }
      case 'registry_edit': {
        const req = ticket.requirements[0];
        wrap.appendChild(el('p', 'hint-text', 'Open Registry Editor and fix <strong>' + esc(req.key) + '</strong>.'));
        const btn = el('button', 'btn btn-accent', 'Open Registry Editor');
        btn.type = 'button';
        btn.addEventListener('click', () => jumpTo('registry'));
        wrap.appendChild(btn);
        if (req.done) wrap.appendChild(el('p', 'req-done', '✅ Registry key corrected.'));
        break;
      }
      case 'firewall_rule': {
        const req = ticket.requirements[0];
        wrap.appendChild(el('p', 'hint-text', 'Open the Firewall app and allow port <strong>' + req.port + '</strong>.'));
        const btn = el('button', 'btn btn-accent', 'Open Firewall');
        btn.type = 'button';
        btn.addEventListener('click', () => jumpTo('firewall'));
        wrap.appendChild(btn);
        if (req.done) wrap.appendChild(el('p', 'req-done', '✅ Firewall updated.'));
        break;
      }
    }
    return wrap;
  }

  /* =========================================================== Tickets CRM */
  HD.Apps.tickets = function (ctx) {
    const { game, wm } = ctx;
    return {
      open() {
        wm.open({
          id: 'tickets',
          title: 'Ticket Manager',
          icon: '🎫',
          width: 360,
          height: 440,
          minWidth: 300,
          buildContent(body, rec) {
            body.classList.add('app-tickets');
            render();
            const onAny = () => render();
            game.on('tick', onAny);
            game.on('queue:update', onAny);
            game.on('ticket:activated', onAny);
            game.on('ticket:update', onAny);
            game.on('ticket:resolved', onAny);
            game.on('ticket:failed', onAny);
            game.on('call:answered', onAny);
            rec.opts.onClose = () => {
              game.off('tick', onAny);
              game.off('queue:update', onAny);
              game.off('ticket:activated', onAny);
              game.off('ticket:update', onAny);
              game.off('ticket:resolved', onAny);
              game.off('ticket:failed', onAny);
              game.off('call:answered', onAny);
            };

            function row(t, statusLabel) {
              const card = el('div', 'ticket-row');
              card.innerHTML =
                '<div class="tr-avatar">' + t.avatar + '</div>' +
                '<div class="tr-info"><strong>' + esc(t.customer) + '</strong><span>' + t.icon + ' ' + esc(t.subject) + '</span></div>' +
                '<div class="tr-status">' + statusLabel + '</div>';
              const bar = el('div', 'tr-patience ' + patienceClass(t.patience));
              bar.innerHTML = '<div style="width:' + Math.max(0, t.patience) + '%"></div>';
              card.appendChild(bar);
              card.addEventListener('click', () => openTicketWindow(ctx, t));
              return card;
            }

            function render() {
              body.innerHTML = '';
              if (!game.activeTickets.length && !game.queue.length) {
                body.appendChild(el('p', 'empty-state', 'No open tickets right now. Nice and quiet! 🎧'));
                return;
              }
              if (game.activeTickets.length) {
                body.appendChild(el('h3', 'section-title', 'Active (' + game.activeTickets.length + '/' + game.maxActiveTickets() + ')'));
                game.activeTickets.forEach((t) => body.appendChild(row(t, 'Open ▸')));
              }
              if (game.queue.length) {
                body.appendChild(el('h3', 'section-title', 'Waiting'));
                game.queue.forEach((t) => body.appendChild(row(t, 'Queued')));
              }
            }
          },
        });
      },
    };
  };

  /* =========================================================== Telephony */
  HD.Apps.telephony = function (ctx) {
    const { game, wm } = ctx;
    return {
      open() {
        wm.open({
          id: 'telephony',
          title: 'Telephony',
          icon: '☎️',
          width: 340,
          height: 380,
          minWidth: 300,
          buildContent(body, rec) {
            body.classList.add('app-phone');
            render();
            const onRing = () => render();
            game.on('call:ring', onRing);
            game.on('call:tick', onRing);
            game.on('call:answered', onRing);
            game.on('ticket:failed', onRing);
            rec.opts.onClose = () => {
              game.off('call:ring', onRing);
              game.off('call:tick', onRing);
              game.off('call:answered', onRing);
              game.off('ticket:failed', onRing);
            };

            function render() {
              body.innerHTML = '';
              const call = game.ringingCall;
              if (!call) {
                body.appendChild(el('div', 'phone-idle', '<div class="phone-icon">☎️</div><p>No incoming calls right now.</p>'));
                return;
              }
              const panel = el('div', 'phone-call');
              panel.innerHTML =
                '<div class="phone-ring">📞 Incoming Call</div>' +
                '<div class="phone-caller">' + call.avatar + ' <strong>' + esc(call.customer) + '</strong></div>' +
                '<p class="phone-opener">"' + esc(D.callOpeners[0]) + '"</p>';
              const bar = el('div', 'patience-bar ' + patienceClass(call.patience));
              bar.innerHTML = '<div class="patience-fill" style="width:' + Math.max(0, call.patience) + '%"></div>';
              panel.appendChild(bar);
              const actions = el('div', 'phone-actions');
              const answerBtn = el('button', 'btn btn-primary', 'Answer');
              answerBtn.type = 'button';
              answerBtn.addEventListener('click', () => {
                if (HD.Audio) HD.Audio.click();
                const ticket = game.answerCall();
                if (ticket) showReplyStage(ticket);
              });
              const declineBtn = el('button', 'btn btn-danger', 'Decline');
              declineBtn.type = 'button';
              declineBtn.addEventListener('click', () => {
                if (HD.Audio) HD.Audio.click();
                game.declineCall();
              });
              actions.appendChild(answerBtn);
              actions.appendChild(declineBtn);
              panel.appendChild(actions);
              body.appendChild(panel);
            }

            function showReplyStage(ticket) {
              body.innerHTML = '';
              const panel = el('div', 'phone-call');
              panel.innerHTML =
                '<div class="phone-caller">' + ticket.avatar + ' <strong>' + esc(ticket.customer) + '</strong></div>' +
                '<p class="phone-opener">"' + esc(ticket.body) + '"</p>' +
                '<p class="hint-text">How do you respond?</p>';
              const options = el('div', 'reply-options');
              D.callReplyOptions.forEach((opt) => {
                const b = el('button', 'btn btn-reply', esc(opt.text));
                b.type = 'button';
                b.addEventListener('click', () => {
                  if (HD.Audio) HD.Audio.click();
                  game.applyCallReply(ticket, opt);
                  finishCall(ticket);
                });
                options.appendChild(b);
              });
              panel.appendChild(options);
              body.appendChild(panel);
            }

            function finishCall(ticket) {
              body.innerHTML = '';
              body.appendChild(el('div', 'phone-idle', '<div class="phone-icon">✅</div><p>Ticket opened in Ticket Manager.</p>'));
              openTicketWindow(ctx, ticket);
              setTimeout(render, 1200);
            }
          },
        });
      },
    };
  };

  /* =========================================================== Terminal */
  HD.Apps.terminal = function (ctx) {
    const { game, wm } = ctx;
    let cwd = ['C:', 'Users', 'tech'];

    function resolveNode(pathArr) {
      let node = D.filesystem;
      for (let i = 1; i < pathArr.length; i++) {
        if (!node.children || !node.children[pathArr[i]]) return null;
        node = node.children[pathArr[i]];
      }
      return node;
    }

    return {
      open(focusTicketId) {
        wm.open({
          id: 'terminal',
          title: 'Terminal',
          icon: '🖥️',
          width: 460,
          height: 360,
          minWidth: 320,
          minHeight: 240,
          buildContent(body) {
            body.classList.add('app-terminal');
            const log = el('div', 'term-log');
            const inputRow = el('div', 'term-input-row');
            const prompt = el('span', 'term-prompt');
            const input = el('input', 'term-input');
            input.type = 'text';
            input.autocomplete = 'off';
            input.spellcheck = false;
            inputRow.appendChild(prompt);
            inputRow.appendChild(input);
            body.appendChild(log);
            body.appendChild(inputRow);

            if (game.upgrades.macro) {
              const macros = el('div', 'term-macros');
              ['ipconfig', 'ping ', 'kill ', 'clean', 'dir'].forEach((cmd) => {
                const b = el('button', 'btn btn-macro', cmd.trim());
                b.type = 'button';
                b.addEventListener('click', () => {
                  input.value = cmd;
                  input.focus();
                });
                macros.appendChild(b);
              });
              body.insertBefore(macros, inputRow);
            }

            const history = [];
            let hIdx = -1;

            function promptText() {
              return cwd.join('\\') + '>';
            }
            function refreshPrompt() {
              prompt.textContent = promptText();
            }
            function print(text, cls) {
              const line = el('div', 'term-line' + (cls ? ' ' + cls : ''));
              line.textContent = text;
              log.appendChild(line);
              log.scrollTop = log.scrollHeight;
            }
            function printHTML(html, cls) {
              const line = el('div', 'term-line' + (cls ? ' ' + cls : ''));
              line.innerHTML = html;
              log.appendChild(line);
              log.scrollTop = log.scrollHeight;
            }

            print('Helpdesk Terminal v3.2 — type "help" for commands.');
            refreshPrompt();

            function findTicketsNeeding(predicate) {
              return game.activeTickets.concat(game.queue).filter(predicate);
            }

            function run(cmdline) {
              print(promptText() + ' ' + cmdline, 'term-echo');
              const parts = cmdline.trim().split(/\s+/);
              const cmd = (parts[0] || '').toLowerCase();
              const arg = parts.slice(1).join(' ');
              if (HD.Audio) HD.Audio.type();

              switch (cmd) {
                case '':
                  break;
                case 'help':
                  print('Commands: help, ping <host>, ipconfig, kill <pid>, clean, cd <dir>, dir/ls, cat <file>, recover <file>, scan, whoami, clear');
                  break;
                case 'whoami':
                  print('CORP\\\\tech (Tier ' + (game.level + 1) + ' Support)');
                  break;
                case 'ipconfig':
                  print('Ethernet adapter Local Area Connection:');
                  print('   IPv4 Address. . . . . . . . . . : 10.0.' + (4 + game.level) + '.' + (10 + (game.day % 50)));
                  print('   Subnet Mask . . . . . . . . . . : 255.255.255.0');
                  print('   Default Gateway . . . . . . . . : 10.0.' + (4 + game.level) + '.1');
                  break;
                case 'cd': {
                  if (!arg || arg === '..') {
                    if (cwd.length > 1) cwd.pop();
                  } else {
                    const node = resolveNode(cwd);
                    if (node && node.children && node.children[arg] && node.children[arg].type === 'dir') {
                      cwd.push(arg);
                    } else {
                      print('The system cannot find the path specified: ' + arg, 'term-error');
                    }
                  }
                  refreshPrompt();
                  break;
                }
                case 'dir':
                case 'ls': {
                  const node = resolveNode(cwd);
                  const names = node && node.children ? Object.keys(node.children) : [];
                  if (cwd[cwd.length - 1] === 'RecycleBin') {
                    const items = game.recycleBin.filter((r) => !r.restored);
                    if (!items.length) print('(Recycle Bin is empty)');
                    items.forEach((r) => print('  ' + r.file));
                  } else if (!names.length) {
                    print('(empty)');
                  } else {
                    names.forEach((n) => {
                      const child = node.children[n];
                      print((child.type === 'dir' ? '[DIR]  ' : '       ') + n);
                    });
                  }
                  break;
                }
                case 'cat':
                case 'type':
                  if (!arg) print('Usage: cat <file>', 'term-error');
                  else print(arg + ': (binary or unreadable content)');
                  break;
                case 'ping': {
                  if (!arg) {
                    print('Usage: ping <host>', 'term-error');
                    break;
                  }
                  print('Pinging ' + arg + ' with 32 bytes of data:');
                  const matches = findTicketsNeeding((t) => t.requirements.some((r) => r.id === 'ping:' + arg && !r.done));
                  const reachable = matches.length > 0 || Math.random() < 0.5;
                  for (let i = 0; i < 4; i++) {
                    if (reachable) print('Reply from ' + arg + ': bytes=32 time=' + (8 + ((Math.random() * 40) | 0)) + 'ms TTL=64');
                    else print('Request timed out.');
                  }
                  if (matches.length) {
                    matches.forEach((t) => {
                      game.markRequirement(t.id, 'ping:' + arg, true);
                    });
                    printHTML('<span class="term-ok">✔ Diagnostic requirement satisfied for ticket(s).</span>');
                  }
                  break;
                }
                case 'kill': {
                  if (!arg) {
                    print('Usage: kill <pid>', 'term-error');
                    break;
                  }
                  const matches = findTicketsNeeding((t) => t.requirements.some((r) => r.id === 'kill:' + arg && !r.done));
                  if (matches.length) {
                    print('Process ' + arg + ' has been terminated.');
                    matches.forEach((t) => game.markRequirement(t.id, 'kill:' + arg, true));
                    printHTML('<span class="term-ok">✔ Hung process cleared.</span>');
                  } else {
                    print('ERROR: Process ' + arg + ' not found or already stopped.', 'term-error');
                  }
                  break;
                }
                case 'clean':
                  print('Cleaning temporary files...');
                  print('Freed ' + (40 + ((Math.random() * 400) | 0)) + ' MB of disk space.');
                  break;
                case 'scan':
                  print('Use the Security Scanner app for a full malware scan (type "help" for app list).');
                  break;
                case 'recover':
                  if (!arg) {
                    print('Usage: recover <file>', 'term-error');
                    break;
                  }
                  print('Use the File Explorer app Recycle Bin to restore files reliably.');
                  break;
                case 'clear':
                  log.innerHTML = '';
                  break;
                default:
                  print('"' + cmd + '" is not recognized as an internal or external command.', 'term-error');
              }
            }

            input.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                const v = input.value;
                if (v.trim()) {
                  history.push(v);
                  hIdx = history.length;
                }
                input.value = '';
                run(v);
              } else if (e.key === 'ArrowUp') {
                if (hIdx > 0) {
                  hIdx--;
                  input.value = history[hIdx] || '';
                }
                e.preventDefault();
              } else if (e.key === 'ArrowDown') {
                if (hIdx < history.length) {
                  hIdx++;
                  input.value = history[hIdx] || '';
                }
                e.preventDefault();
              }
            });

            setTimeout(() => input.focus(), 50);
            body.addEventListener('pointerdown', (e) => {
              if (e.target !== input) input.focus();
            });
          },
        });
      },
    };
  };

  /* =========================================================== Browser */
  HD.Apps.browser = function (ctx) {
    const { wm, game } = ctx;
    return {
      open() {
        wm.open({
          id: 'browser',
          title: 'HelpNet Browser',
          icon: '🌐',
          width: 480,
          height: 420,
          minWidth: 340,
          buildContent(body) {
            body.classList.add('app-browser');
            const bar = el('div', 'browser-bar');
            const back = el('button', 'btn btn-icon', '←');
            back.type = 'button';
            const addr = el('input', 'browser-addr');
            addr.type = 'text';
            addr.value = 'helpnet://home';
            const go = el('button', 'btn btn-icon', 'Go');
            go.type = 'button';
            bar.appendChild(back);
            bar.appendChild(addr);
            bar.appendChild(go);
            const content = el('div', 'browser-content');
            body.appendChild(bar);
            body.appendChild(content);

            const historyStack = [];

            function renderHome() {
              addr.value = 'helpnet://home';
              content.innerHTML = '<h2>HelpNet Internal Portal</h2><p class="hint-text">Search the knowledgebase or grab a diagnostic utility.</p>';
              const search = el('input', 'browser-search');
              search.placeholder = 'Search knowledgebase…';
              content.appendChild(search);
              const results = el('div', 'kb-list');
              content.appendChild(results);
              function renderList(filter) {
                results.innerHTML = '';
                D.kbArticles
                  .filter((a) => !filter || a.title.toLowerCase().includes(filter.toLowerCase()))
                  .forEach((a) => {
                    const item = el('a', 'kb-item', '📄 ' + esc(a.title));
                    item.href = 'javascript:void(0)';
                    item.addEventListener('click', () => openArticle(a));
                    results.appendChild(item);
                  });
              }
              renderList('');
              search.addEventListener('input', () => renderList(search.value));

              const dlBtn = el('button', 'btn btn-accent', 'Go to Downloads');
              dlBtn.type = 'button';
              dlBtn.addEventListener('click', renderDownloads);
              content.appendChild(dlBtn);
            }

            function openArticle(a) {
              addr.value = a.url;
              historyStack.push(renderHome);
              content.innerHTML = '<button class="btn btn-icon kb-back">← Back</button>' + a.body;
              content.querySelector('.kb-back').addEventListener('click', goBack);
            }

            function renderDownloads() {
              addr.value = 'helpnet://downloads';
              historyStack.push(renderHome);
              content.innerHTML = '<button class="btn btn-icon kb-back">← Back</button><h2>Downloads</h2>';
              content.querySelector('.kb-back').addEventListener('click', goBack);
              const list = el('div', 'dl-list');
              D.downloads.forEach((d) => {
                const row = el('div', 'dl-row');
                row.innerHTML = '<span>' + esc(d.name) + '</span><span class="dl-size">' + d.size + '</span>';
                const btn = el('button', 'btn btn-accent', 'Download');
                btn.type = 'button';
                btn.addEventListener('click', () => {
                  btn.disabled = true;
                  btn.textContent = 'Downloaded ✓ (+' + d.bonus + ' credits)';
                  game.credits += d.bonus;
                  if (HD.Audio) HD.Audio.cash();
                  game.save();
                });
                row.appendChild(btn);
                list.appendChild(row);
              });
              content.appendChild(list);
            }

            function goBack() {
              const fn = historyStack.pop();
              if (fn) fn();
            }

            back.addEventListener('click', goBack);
            go.addEventListener('click', () => {
              const v = addr.value.trim().toLowerCase();
              const article = D.kbArticles.find((a) => a.url === v);
              if (article) openArticle(article);
              else if (v.includes('download')) renderDownloads();
              else renderHome();
            });

            renderHome();
          },
        });
      },
    };
  };

  /* =========================================================== File Explorer */
  HD.Apps.files = function (ctx) {
    const { wm, game } = ctx;
    return {
      open() {
        wm.open({
          id: 'files',
          title: 'File Explorer',
          icon: '🗂️',
          width: 440,
          height: 380,
          minWidth: 340,
          buildContent(body) {
            body.classList.add('app-files');
            const sidebar = el('div', 'files-sidebar');
            const main = el('div', 'files-main');
            body.appendChild(sidebar);
            body.appendChild(main);

            const folders = {
              Desktop: ['notes.txt'],
              Documents: Object.keys(D.filesystem.children.Users.children.tech.children.Documents.children),
              Downloads: [],
            };

            let current = 'Documents';

            function renderSidebar() {
              sidebar.innerHTML = '';
              Object.keys(folders).forEach((name) => {
                const item = el('button', 'files-nav-item' + (current === name ? ' active' : ''), '📁 ' + name);
                item.type = 'button';
                item.addEventListener('click', () => {
                  current = name;
                  render();
                });
                sidebar.appendChild(item);
              });
              const bin = el('button', 'files-nav-item' + (current === 'RecycleBin' ? ' active' : ''), '🗑️ Recycle Bin');
              bin.type = 'button';
              bin.addEventListener('click', () => {
                current = 'RecycleBin';
                render();
              });
              sidebar.appendChild(bin);
            }

            function render() {
              renderSidebar();
              main.innerHTML = '';
              main.appendChild(el('h3', 'section-title', current));
              if (current === 'RecycleBin') {
                const items = game.recycleBin.filter((r) => !r.restored);
                if (!items.length) {
                  main.appendChild(el('p', 'empty-state', 'Recycle Bin is empty.'));
                  return;
                }
                items.forEach((r) => {
                  const row = el('div', 'file-row');
                  row.innerHTML = '<span>🗎 ' + esc(r.file) + '</span>';
                  const btn = el('button', 'btn btn-accent', 'Restore');
                  btn.type = 'button';
                  btn.addEventListener('click', () => {
                    r.restored = true;
                    const matches = game.activeTickets.concat(game.queue).filter((t) => t.requirements.some((req) => req.id === 'restore:' + r.file && !req.done));
                    matches.forEach((t) => game.markRequirement(t.id, 'restore:' + r.file, true));
                    if (HD.Audio) HD.Audio.success();
                    render();
                  });
                  row.appendChild(btn);
                  main.appendChild(row);
                });
              } else {
                const names = folders[current] || [];
                if (!names.length) {
                  main.appendChild(el('p', 'empty-state', 'This folder is empty.'));
                  return;
                }
                names.forEach((n) => {
                  main.appendChild(el('div', 'file-row', '<span>🗎 ' + esc(n) + '</span>'));
                });
              }
            }

            render();
          },
        });
      },
    };
  };

  /* =========================================================== Registry Editor */
  HD.Apps.registry = function (ctx) {
    const { wm, game } = ctx;
    return {
      open() {
        wm.open({
          id: 'registry',
          title: 'Registry Editor',
          icon: '🧩',
          width: 460,
          height: 400,
          minWidth: 360,
          buildContent(body) {
            body.classList.add('app-registry');
            const tree = el('div', 'registry-tree');
            const main = el('div', 'registry-main');
            body.appendChild(tree);
            body.appendChild(main);

            let selectedPath = ['HKEY_LOCAL_MACHINE', 'SOFTWARE', 'Policies', 'Explorer'];

            function buildTree(node, path, container, depth) {
              Object.keys(node).forEach((key) => {
                const fullPath = path.concat(key);
                const isLeafGroup = Array.isArray(node[key]);
                const item = el('div', 'reg-node');
                item.style.paddingLeft = depth * 14 + 'px';
                const btn = el(
                  'button',
                  'reg-node-btn' + (fullPath.join('/') === selectedPath.join('/') ? ' active' : ''),
                  (isLeafGroup ? '🔑 ' : '📁 ') + key
                );
                btn.type = 'button';
                btn.addEventListener('click', () => {
                  selectedPath = fullPath;
                  renderMain();
                  renderTree();
                });
                item.appendChild(btn);
                container.appendChild(item);
                if (!isLeafGroup && typeof node[key] === 'object') {
                  buildTree(node[key], fullPath, container, depth + 1);
                }
              });
            }

            function renderTree() {
              tree.innerHTML = '';
              buildTree(game.registryState, [], tree, 0);
            }

            function getValuesAt(path) {
              let node = game.registryState;
              for (const seg of path) {
                if (!node) return null;
                node = node[seg];
              }
              return Array.isArray(node) ? node : null;
            }

            function renderMain() {
              main.innerHTML = '';
              main.appendChild(el('h3', 'section-title', selectedPath.join('\\\\')));
              const values = getValuesAt(selectedPath);
              if (!values || !values.length) {
                main.appendChild(el('p', 'empty-state', 'No values in this key.'));
                return;
              }
              values.forEach((v) => {
                const row = el('div', 'reg-value-row');
                const isBroken = v.value !== v.fixedValue;
                row.innerHTML =
                  '<div><strong>' + esc(v.name) + '</strong><span class="reg-type">' + v.type + '</span></div>' +
                  '<div class="reg-current ' + (isBroken ? 'bad' : 'ok') + '">Value: ' + esc(v.value) + '</div>';
                const btn = el('button', 'btn btn-accent', isBroken ? 'Set to ' + v.fixedValue : 'Fixed ✅');
                btn.type = 'button';
                btn.disabled = !isBroken;
                btn.addEventListener('click', () => {
                  v.value = v.fixedValue;
                  const matches = game.activeTickets.concat(game.queue).filter((t) => t.requirements.some((req) => req.id === 'reg:' + v.name && !req.done));
                  matches.forEach((t) => game.markRequirement(t.id, 'reg:' + v.name, true));
                  if (HD.Audio) HD.Audio.success();
                  renderMain();
                });
                row.appendChild(btn);
                main.appendChild(row);
              });
            }

            renderTree();
            renderMain();
          },
        });
      },
    };
  };

  /* =========================================================== Firewall */
  HD.Apps.firewall = function (ctx) {
    const { wm, game } = ctx;
    return {
      open() {
        wm.open({
          id: 'firewall',
          title: 'Firewall Manager',
          icon: '🛡️',
          width: 460,
          height: 400,
          minWidth: 360,
          buildContent(body) {
            body.classList.add('app-firewall');
            const table = el('div', 'fw-table');
            const addForm = el('div', 'fw-add');
            body.appendChild(table);
            body.appendChild(addForm);

            function syncRequirements(port) {
              if (!game.hasFirewallAllow(port)) return;
              const matches = game.activeTickets.concat(game.queue).filter((t) => t.requirements.some((req) => req.id === 'fw:' + port && !req.done));
              matches.forEach((t) => game.markRequirement(t.id, 'fw:' + port, true));
            }

            function renderTable() {
              table.innerHTML = '';
              table.appendChild(el('div', 'fw-head', '<span>Name</span><span>Port</span><span>Proto</span><span>Action</span><span>On</span>'));
              game.firewallRules.forEach((r) => {
                const row = el('div', 'fw-row');
                row.innerHTML =
                  '<span>' + esc(r.name) + '</span><span>' + r.port + '</span><span>' + r.proto + '</span>' +
                  '<span class="' + (r.action === 'Allow' ? 'fw-allow' : 'fw-block') + '">' + r.action + '</span>';
                const toggle = el('button', 'btn btn-toggle' + (r.enabled ? ' done' : ''), r.enabled ? 'On' : 'Off');
                toggle.type = 'button';
                toggle.disabled = !!r.locked && r.enabled;
                toggle.addEventListener('click', () => {
                  r.enabled = !r.enabled;
                  if (r.enabled && r.action === 'Allow') syncRequirements(r.port);
                  if (HD.Audio) HD.Audio.toggle();
                  renderTable();
                });
                row.appendChild(toggle);
                table.appendChild(row);
              });
            }

            function renderAddForm() {
              addForm.innerHTML = '';
              addForm.appendChild(el('h3', 'section-title', 'Add Rule'));
              const nameInput = el('input', 'fw-input');
              nameInput.placeholder = 'Rule name';
              const portInput = el('input', 'fw-input');
              portInput.placeholder = 'Port';
              portInput.type = 'number';
              const actionSel = el('select', 'select');
              ['Allow', 'Block'].forEach((o) => actionSel.appendChild(el('option', '', o)));
              const addBtn = el('button', 'btn btn-accent', 'Add Rule');
              addBtn.type = 'button';
              addBtn.addEventListener('click', () => {
                const port = Number(portInput.value);
                if (!port) return;
                const rule = {
                  id: 'r' + Date.now(),
                  name: nameInput.value.trim() || 'Custom Rule',
                  dir: 'Inbound',
                  port,
                  proto: 'TCP',
                  action: actionSel.value,
                  enabled: true,
                  locked: false,
                };
                game.firewallRules.push(rule);
                if (rule.action === 'Allow') syncRequirements(port);
                if (HD.Audio) HD.Audio.success();
                nameInput.value = '';
                portInput.value = '';
                renderTable();
              });
              addForm.appendChild(nameInput);
              addForm.appendChild(portInput);
              addForm.appendChild(actionSel);
              addForm.appendChild(addBtn);
            }

            renderTable();
            renderAddForm();
          },
        });
      },
    };
  };

  /* =========================================================== Security Scanner */
  HD.Apps.security = function (ctx) {
    const { wm, game } = ctx;
    const threatNames = ['Trojan.GenericKD', 'Adware.PopUpInject', 'Worm.NetSpread', 'Spyware.KeyTrack', 'PUP.ToolbarX'];
    return {
      open() {
        wm.open({
          id: 'security',
          title: 'Security Scanner',
          icon: '🦠',
          width: 380,
          height: 360,
          minWidth: 300,
          buildContent(body) {
            body.classList.add('app-security');
            render();

            function render() {
              body.innerHTML = '';
              body.appendChild(el('div', 'sec-shield', '🛡️'));
              const scanBtn = el('button', 'btn btn-primary', 'Run Full Scan');
              scanBtn.type = 'button';
              const prog = el('div', 'progress-track');
              prog.innerHTML = '<div class="progress-fill" style="width:0%"></div>';
              body.appendChild(scanBtn);
              body.appendChild(prog);
              const resultsBox = el('div', 'sec-results');
              body.appendChild(resultsBox);

              scanBtn.addEventListener('click', () => {
                scanBtn.disabled = true;
                scanBtn.textContent = 'Scanning…';
                const duration = 3200 * game.speedMultiplier();
                const start = Date.now();
                const fill = prog.querySelector('.progress-fill');
                const timer = setInterval(() => {
                  const pct = Math.min(100, ((Date.now() - start) / duration) * 100);
                  fill.style.width = pct + '%';
                  if (pct >= 100) {
                    clearInterval(timer);
                    showResults();
                  }
                }, 100);
              });

              function showResults() {
                const count = 2 + ((Math.random() * 3) | 0);
                const found = Array.from({ length: count }, () => threatNames[(Math.random() * threatNames.length) | 0]);
                resultsBox.innerHTML = '<h3 class="section-title">Threats found: ' + count + '</h3>';
                found.forEach((n) => resultsBox.appendChild(el('div', 'threat-row', '⚠️ ' + n)));
                const qBtn = el('button', 'btn btn-accent', 'Quarantine All');
                qBtn.type = 'button';
                qBtn.addEventListener('click', () => {
                  const matches = game.activeTickets.concat(game.queue).filter((t) => t.requirements.some((req) => req.id === 'scan' && !req.done));
                  matches.forEach((t) => game.markRequirement(t.id, 'scan', true));
                  if (HD.Audio) HD.Audio.success();
                  resultsBox.innerHTML = '<p class="req-done">✅ All threats quarantined.</p>';
                  scanBtn.textContent = 'Run Full Scan';
                  scanBtn.disabled = false;
                  prog.querySelector('.progress-fill').style.width = '0%';
                });
                resultsBox.appendChild(qBtn);
              }
            }
          },
        });
      },
    };
  };

  /* =========================================================== Shop */
  HD.Apps.shop = function (ctx) {
    const { wm, game } = ctx;
    return {
      open() {
        wm.open({
          id: 'shop',
          title: 'IT Upgrade Shop',
          icon: '🛒',
          width: 420,
          height: 440,
          minWidth: 320,
          buildContent(body) {
            body.classList.add('app-shop');
            render();

            function render() {
              body.innerHTML = '';
              body.appendChild(el('div', 'shop-credits', '💳 ' + game.credits + ' credits'));
              D.upgrades.forEach((def) => {
                const lvl = game.upgrades[def.id] || 0;
                const cost = game.upgradeCost(def);
                const card = el('div', 'shop-card');
                card.innerHTML =
                  '<div class="shop-icon">' + def.icon + '</div>' +
                  '<div class="shop-info"><strong>' + def.name + (def.consumable ? '' : ' (Lv.' + lvl + '/' + def.maxLevel + ')') + '</strong>' +
                  '<span>' + def.desc + '</span></div>';
                const btn = el('button', 'btn btn-accent', cost === null ? 'Maxed' : 'Buy — ' + cost + ' credits');
                btn.type = 'button';
                btn.disabled = cost === null || game.credits < cost;
                btn.addEventListener('click', () => {
                  if (game.buyUpgrade(def.id)) render();
                });
                card.appendChild(btn);
                body.appendChild(card);
              });
            }

            game.on('upgrade:bought', render);
          },
        });
      },
    };
  };

  /* =========================================================== Settings */
  HD.Apps.settings = function (ctx) {
    const { wm, game } = ctx;
    return {
      open() {
        wm.open({
          id: 'settings',
          title: 'Settings',
          icon: '⚙️',
          width: 360,
          height: 380,
          minWidth: 300,
          buildContent(body) {
            body.classList.add('app-settings');
            render();
            function render() {
              body.innerHTML = '';
              body.appendChild(el('h3', 'section-title', 'Stats'));
              body.appendChild(
                el(
                  'p',
                  'settings-stats',
                  'Level: ' + D.levelNames[game.level] + '<br/>Resolved: ' + game.ticketsResolvedTotal + ' · Failed: ' + game.ticketsFailedTotal + '<br/>Reputation: ' + game.reputation + '%'
                )
              );
              body.appendChild(el('h3', 'section-title', 'Audio'));
              const sfxRow = el('label', 'settings-row');
              const sfxCb = el('input');
              sfxCb.type = 'checkbox';
              sfxCb.checked = game.settings.sfx;
              sfxCb.addEventListener('change', () => {
                game.settings.sfx = sfxCb.checked;
                if (HD.Audio) HD.Audio.setEnabled(sfxCb.checked);
                game.save();
              });
              sfxRow.appendChild(sfxCb);
              sfxRow.appendChild(document.createTextNode(' Sound effects'));
              body.appendChild(sfxRow);

              body.appendChild(el('h3', 'section-title', 'Accessibility'));
              const motionRow = el('label', 'settings-row');
              const motionCb = el('input');
              motionCb.type = 'checkbox';
              motionCb.checked = game.settings.reduceMotion;
              motionCb.addEventListener('change', () => {
                game.settings.reduceMotion = motionCb.checked;
                document.body.classList.toggle('reduce-motion', motionCb.checked);
                game.save();
              });
              motionRow.appendChild(motionCb);
              motionRow.appendChild(document.createTextNode(' Reduce animations'));
              body.appendChild(motionRow);

              body.appendChild(el('h3', 'section-title', 'Keyboard Shortcuts (desktop)'));
              body.appendChild(
                el(
                  'ul',
                  'shortcut-list',
                  '<li><kbd>Alt+T</kbd> Terminal</li><li><kbd>Alt+C</kbd> Tickets</li><li><kbd>Alt+P</kbd> Phone</li>' +
                    '<li><kbd>Alt+B</kbd> Browser</li><li><kbd>Alt+S</kbd> Shop</li><li><kbd>Alt+N</kbd> Notifications</li><li><kbd>Esc</kbd> Close focused window</li>'
                )
              );

              const resetBtn = el('button', 'btn btn-danger', 'Reset Save Data');
              resetBtn.type = 'button';
              resetBtn.addEventListener('click', () => {
                if (confirm('Reset all progress? This cannot be undone.')) {
                  game.resetProgress();
                  location.reload();
                }
              });
              body.appendChild(resetBtn);
            }
          },
        });
      },
    };
  };

  /* =========================================================== Notifications Center */
  HD.Apps.notificationCenter = function (ctx) {
    const { wm, game } = ctx;
    return {
      open() {
        wm.open({
          id: 'notifications',
          title: 'Notifications',
          icon: '🔔',
          width: 340,
          height: 420,
          minWidth: 280,
          buildContent(body) {
            body.classList.add('app-notifications');
            render();
            game.on('notify', render);

            function render() {
              body.innerHTML = '';
              if (!game.notifications.length) {
                body.appendChild(el('p', 'empty-state', 'No notifications yet.'));
                return;
              }
              const clearBtn = el('button', 'btn btn-icon', 'Clear All');
              clearBtn.type = 'button';
              clearBtn.addEventListener('click', () => {
                game.notifications = [];
                render();
              });
              body.appendChild(clearBtn);
              game.notifications.forEach((n) => {
                const row = el('div', 'notif-row notif-' + n.kind);
                const time = new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                row.innerHTML = '<strong>' + esc(n.title) + '</strong><span>' + esc(n.body) + '</span><time>' + time + '</time>';
                body.appendChild(row);
              });
            }
          },
        });
      },
    };
  };
})(window.HD = window.HD || {});
