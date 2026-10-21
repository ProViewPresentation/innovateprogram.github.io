/* Helpdesk Hero — static content data: tickets, callers, KB articles, filesystem, registry, firewall, shop */
(function (HD) {
  'use strict';

  const D = {};

  /* ---------------------------------------------------------- Customers */
  D.firstNames = ['Alex', 'Jordan', 'Sam', 'Priya', 'Lucas', 'Mei', 'Omar', 'Grace', 'Noah', 'Ivy', 'Deshawn', 'Fatima', 'Liam', 'Sofia', 'Ethan', 'Chloe', 'Raj', 'Nina', 'Carlos', 'Tasha'];
  D.lastNames = ['Chen', 'Walker', 'Patel', 'Nguyen', 'Garcia', 'Smith', 'Kowalski', 'Haddad', 'Johansson', 'Mbeki', 'Rossi', 'Kim', 'Dubois', 'Flores', 'Okafor'];
  D.avatars = ['🧑‍💼', '👩‍💻', '🧑‍🔧', '👨‍🏫', '🧑‍🎨', '👩‍⚕️', '🧑‍🍳', '👨‍💼', '🧑‍🌾', '👩‍🔬', '🧑‍🚀', '👨‍🎤'];

  function randomPerson() {
    const f = D.firstNames[(Math.random() * D.firstNames.length) | 0];
    const l = D.lastNames[(Math.random() * D.lastNames.length) | 0];
    const a = D.avatars[(Math.random() * D.avatars.length) | 0];
    return { name: f + ' ' + l, avatar: a };
  }
  D.randomPerson = randomPerson;

  /* ---------------------------------------------------------- Ticket templates by type */
  // Each template produces a ticket spec consumed by game.js: requirements[], hints, app linkage.
  D.ticketTypes = {
    password_reset: {
      label: 'Password Reset',
      icon: '🔑',
      minLevel: 1,
      baseReward: 18,
      baseTime: 55,
      app: 'ticket',
      variants: [
        { subject: 'Locked out of my account', body: "I typed my password wrong a few times and now it says my account is locked. I have a meeting in five minutes!" },
        { subject: "Can't log into my laptop", body: 'I just got back from leave and I completely forgot my Windows password. Can you reset it?' },
        { subject: 'Forgot VPN password', body: "My VPN client keeps rejecting my password and I need to connect from home today." },
      ],
    },
    email_config: {
      label: 'Email Setup',
      icon: '📧',
      minLevel: 1,
      baseReward: 24,
      baseTime: 70,
      app: 'ticket',
      variants: [
        { subject: 'New phone needs email', body: "I got a new phone and I can't remember the mail server settings to set up my work email." },
        { subject: 'Outlook keeps asking for password', body: 'Outlook on my desktop will not stop prompting for a password — I think the server settings are wrong.' },
        { subject: 'Email not syncing', body: "My tablet's mail app says it can't connect. I think the port might be wrong." },
      ],
    },
    software_install: {
      label: 'Software Install',
      icon: '💿',
      minLevel: 1,
      baseReward: 16,
      baseTime: 50,
      app: 'ticket',
      variants: [
        { subject: 'Need design software installed', body: 'My manager approved a license for the new design suite — can you install it on my machine remotely?' },
        { subject: 'Missing PDF reader', body: "I can't open any PDFs, the reader must have been removed in the last update." },
        { subject: 'Conferencing app required', body: 'I have a client call tomorrow and need the video conferencing app installed before then.' },
      ],
    },
    peripheral: {
      label: 'Peripheral Issue',
      icon: '🖨️',
      minLevel: 1,
      baseReward: 20,
      baseTime: 60,
      app: 'ticket',
      variants: [
        { subject: 'Printer offline', body: 'The printer on the third floor says offline but the power light is on.' },
        { subject: 'Mouse not responding', body: 'My wireless mouse cursor keeps freezing, I have tried moving it closer to the receiver.' },
        { subject: 'Headset no sound', body: 'My headset shows as connected but I get no audio during calls.' },
      ],
    },
    network_diag: {
      label: 'Network Diagnostics',
      icon: '📡',
      minLevel: 1,
      baseReward: 30,
      baseTime: 80,
      app: 'terminal',
      variants: [
        { subject: 'Cannot reach file server', body: 'I can\'t reach the file server at {host}. Can you check if it is even online?' },
        { subject: 'Intermittent connection drops', body: 'My connection to {host} keeps dropping every few minutes, please check the link.' },
        { subject: 'Website unreachable', body: 'Our internal site {host} will not load for anyone on my floor.' },
      ],
      hosts: ['fileserver01', '10.0.4.12', 'intranet.corp.local', 'printsrv02', '192.168.1.50'],
    },
    terminal_task: {
      label: 'Hung Process',
      icon: '🖥️',
      minLevel: 2,
      baseReward: 32,
      baseTime: 75,
      app: 'terminal',
      variants: [
        { subject: 'Application frozen', body: '{proc} has stopped responding and is using all my CPU. Process ID shown is {pid}.' },
        { subject: 'Computer running hot and slow', body: 'My laptop fan is blasting and everything is sluggish — Task Manager shows {proc} (PID {pid}) pegged at 100%.' },
      ],
      procs: ['update_agent.exe', 'sync_worker.exe', 'legacy_report.exe', 'winword.exe', 'backup_svc.exe'],
    },
    malware_scan: {
      label: 'Malware Scan',
      icon: '🦠',
      minLevel: 2,
      baseReward: 38,
      baseTime: 90,
      app: 'security',
      variants: [
        { subject: 'Pop-ups everywhere', body: 'My browser is covered in pop-up ads even when I am not browsing. I think I clicked something I should not have.' },
        { subject: 'Antivirus alert ignored', body: 'I got a scary warning about a virus and clicked it away by accident. The computer feels off now.' },
        { subject: 'Files renamed strangely', body: 'Some of my files now have weird extensions and I cannot open them anymore.' },
      ],
    },
    file_recovery: {
      label: 'File Recovery',
      icon: '🗃️',
      minLevel: 2,
      baseReward: 34,
      baseTime: 85,
      app: 'files',
      variants: [
        { subject: 'Accidentally deleted report', body: 'I deleted {file} by mistake and emptied the recycle bin — I desperately need it back for the board meeting.' },
        { subject: 'Lost presentation file', body: 'I think I deleted {file} while cleaning up my desktop. Please tell me it can be restored.' },
      ],
      files: ['Q3_Budget_Report.xlsx', 'Client_Presentation.pptx', 'Project_Plan_Final.docx', 'Payroll_Summary.csv', 'Server_Migration_Notes.docx'],
    },
    registry_edit: {
      label: 'Registry Fix',
      icon: '🧩',
      minLevel: 3,
      baseReward: 42,
      baseTime: 95,
      app: 'registry',
      variants: [
        { subject: 'Taskbar features disabled by policy', body: 'Some icons are missing from my taskbar since the last policy push, a key may have been left disabled.' },
        { subject: 'Startup app will not launch', body: 'Our custom timesheet app refuses to start and mentions a registry permission error.' },
        { subject: 'USB drives not detected', body: 'My computer will not recognize any USB drive since IT pushed an update last week.' },
      ],
    },
    firewall_rule: {
      label: 'Firewall Rule',
      icon: '🛡️',
      minLevel: 3,
      baseReward: 44,
      baseTime: 95,
      app: 'firewall',
      variants: [
        { subject: 'Blocked from internal app', body: 'The new scheduling tool cannot connect, it probably needs a firewall rule opened for port {port}.' },
        { subject: 'Remote backup failing', body: 'Our offsite backup job fails every night — it likely needs outbound access on port {port}.' },
        { subject: 'VoIP calls keep dropping', body: 'My desk phone drops calls constantly, I suspect port {port} is being blocked.' },
      ],
      ports: [443, 3389, 5060, 8080, 21, 25],
    },
  };

  /* ---------------------------------------------------------- Call-only openers (used by Telephony) */
  D.callOpeners = [
    "Hi, thanks for picking up — I've been on hold forever!",
    'Oh good, a real person! I really need help with this.',
    "Hey there, sorry to bother you, this is kind of urgent.",
    'Finally! Okay so here is my problem...',
    "Hi, is this the helpdesk? Great, I have an issue.",
  ];

  D.callReplyOptions = [
    {
      text: "I understand, let's get this sorted right away.",
      tone: 'empathetic',
      moodDelta: 2,
      patienceDelta: 10,
    },
    {
      text: 'Okay, give me a second to look into it.',
      tone: 'neutral',
      moodDelta: 0,
      patienceDelta: 2,
    },
    {
      text: "That's not really my problem to explain, let's just fix it.",
      tone: 'curt',
      moodDelta: -2,
      patienceDelta: -8,
    },
  ];

  /* ---------------------------------------------------------- Knowledge Base articles (Browser app) */
  D.kbArticles = [
    {
      id: 'kb-email',
      title: 'Standard Email Server Settings',
      url: 'helpnet://kb/email-settings',
      body:
        '<h3>Corporate Mail Settings</h3><table><tr><th>Field</th><th>Value</th></tr>' +
        '<tr><td>Incoming (IMAP)</td><td>imap.corpmail.net</td></tr>' +
        '<tr><td>IMAP Port</td><td>993 (SSL)</td></tr>' +
        '<tr><td>Outgoing (SMTP)</td><td>smtp.corpmail.net</td></tr>' +
        '<tr><td>SMTP Port</td><td>465 (SSL)</td></tr></table>' +
        '<p>Always use SSL/TLS encryption. Never configure plain-text ports 25 or 143 for end users.</p>',
    },
    {
      id: 'kb-firewall',
      title: 'Common Service Ports Reference',
      url: 'helpnet://kb/firewall-ports',
      body:
        '<h3>Allow-list Reference</h3><table><tr><th>Service</th><th>Port</th></tr>' +
        '<tr><td>HTTPS / Scheduling Tool</td><td>443</td></tr>' +
        '<tr><td>Remote Desktop</td><td>3389</td></tr>' +
        '<tr><td>VoIP (SIP)</td><td>5060</td></tr>' +
        '<tr><td>Alt Web / Backup Agent</td><td>8080</td></tr>' +
        '<tr><td>Legacy FTP (deprecated)</td><td>21</td></tr>' +
        '<tr><td>Legacy SMTP (deprecated)</td><td>25</td></tr></table>' +
        '<p>Open only the specific port required by the ticket — do not open unrelated ports.</p>',
    },
    {
      id: 'kb-malware',
      title: 'Malware Triage Checklist',
      url: 'helpnet://kb/malware-checklist',
      body:
        '<h3>Steps</h3><ol><li>Open the Security Scanner app.</li><li>Run a full scan.</li>' +
        '<li>Quarantine every threat found — never leave residual items.</li>' +
        '<li>Advise the customer to avoid unknown pop-ups in future.</li></ol>',
    },
    {
      id: 'kb-registry',
      title: 'Registry Policy Keys',
      url: 'helpnet://kb/registry-keys',
      body:
        '<h3>Known Problem Keys</h3><p>Policy pushes sometimes set <code>DisablePolicy</code> or <code>Start</code> ' +
        'values to a blocking state. Use the Registry Editor app, locate the highlighted key for the ticket, ' +
        'and set it back to the enabled value (<code>0</code> for Disable flags, <code>1</code> for service Start flags, ' +
        'unless otherwise noted).</p>',
    },
    {
      id: 'kb-recovery',
      title: 'File Recovery Procedure',
      url: 'helpnet://kb/file-recovery',
      body:
        '<h3>Recycle Bin Recovery</h3><p>Open the File Explorer app, go to the Recycle Bin, locate the file named ' +
        'in the ticket, and press Restore. If the file is not listed, check Documents first — sometimes it was only moved.</p>',
    },
    {
      id: 'kb-network',
      title: 'Network Diagnostics Guide',
      url: 'helpnet://kb/network-diagnostics',
      body:
        '<h3>Basic Triage</h3><p>Open the Terminal app and run <code>ping &lt;host&gt;</code> against the host named ' +
        'in the ticket to confirm reachability, then run <code>ipconfig</code> to double check your own adapter. ' +
        'For a frozen application, use <code>kill &lt;pid&gt;</code> with the PID shown in the ticket.</p>',
    },
    {
      id: 'kb-password',
      title: 'Identity Verification Policy',
      url: 'helpnet://kb/password-policy',
      body:
        '<h3>Before Resetting a Password</h3><p>Confirm the employee ID matches the ticket, then use the Reset ' +
        'Password action inside the ticket window. Never read a password aloud — always force a reset instead.</p>',
    },
  ];

  D.downloads = [
    { name: 'AutoDiag Utility v2.1', size: '4.2 MB', bonus: 12 },
    { name: 'Remote Repair Toolkit', size: '9.8 MB', bonus: 18 },
    { name: 'Driver Pack (Universal)', size: '21 MB', bonus: 8 },
  ];

  /* ---------------------------------------------------------- Virtual filesystem (Terminal + Explorer) */
  D.filesystem = {
    name: 'C:',
    type: 'dir',
    children: {
      Users: {
        type: 'dir',
        children: {
          tech: {
            type: 'dir',
            children: {
              Desktop: { type: 'dir', children: { 'notes.txt': { type: 'file', size: '1 KB' } } },
              Documents: {
                type: 'dir',
                children: {
                  'Q3_Budget_Report.xlsx': { type: 'file', size: '220 KB' },
                  'Client_Presentation.pptx': { type: 'file', size: '4.1 MB' },
                  'Project_Plan_Final.docx': { type: 'file', size: '86 KB' },
                  'Payroll_Summary.csv': { type: 'file', size: '12 KB' },
                  'Server_Migration_Notes.docx': { type: 'file', size: '54 KB' },
                },
              },
              Downloads: { type: 'dir', children: {} },
              RecycleBin: { type: 'dir', children: {} }, // populated dynamically per deleted ticket file
            },
          },
        },
      },
      Windows: { type: 'dir', children: { System32: { type: 'dir', children: {} } } },
    },
  };

  /* ---------------------------------------------------------- Registry tree (Registry Editor) */
  D.registryTemplate = {
    'HKEY_LOCAL_MACHINE': {
      'SOFTWARE': {
        'Policies': {
          'Explorer': [{ name: 'DisableTaskbarFeatures', type: 'REG_DWORD', value: '1', fixedValue: '0' }],
          'TimesheetApp': [{ name: 'StartupAllowed', type: 'REG_DWORD', value: '0', fixedValue: '1' }],
        },
        'Microsoft': {
          'Windows': {
            'USBSTOR': [{ name: 'Start', type: 'REG_DWORD', value: '4', fixedValue: '3' }],
          },
        },
      },
    },
  };

  /* ---------------------------------------------------------- Default firewall rules */
  D.defaultFirewallRules = [
    { id: 'r1', name: 'Core Web Traffic', dir: 'Outbound', port: 80, proto: 'TCP', action: 'Allow', enabled: true, locked: true },
    { id: 'r2', name: 'DNS', dir: 'Outbound', port: 53, proto: 'UDP', action: 'Allow', enabled: true, locked: true },
    { id: 'r3', name: 'Block Legacy Telnet', dir: 'Inbound', port: 23, proto: 'TCP', action: 'Block', enabled: true, locked: true },
  ];

  /* ---------------------------------------------------------- Upgrades (Shop) */
  D.upgrades = [
    {
      id: 'fastTools',
      name: 'Rapid Repair Toolkit',
      icon: '🛠️',
      desc: 'Cuts install/scan/progress timers. Each level stacks a 15% speed boost.',
      maxLevel: 3,
      baseCost: 60,
      costGrowth: 1.8,
    },
    {
      id: 'autoDiag',
      name: 'Auto-Diagnostic Script',
      icon: '🤖',
      desc: 'Automatically completes a portion of terminal diagnostics for you.',
      maxLevel: 3,
      baseCost: 90,
      costGrowth: 1.9,
    },
    {
      id: 'dualMonitor',
      name: 'Dual Monitor Rig',
      icon: '🖥️',
      desc: 'Increases how many tickets you can actively juggle at once (+1 slot/level).',
      maxLevel: 3,
      baseCost: 120,
      costGrowth: 2.0,
    },
    {
      id: 'coffee',
      name: 'Coffee Boost',
      icon: '☕',
      desc: 'Slows down every customer patience meter for the rest of the day.',
      maxLevel: 3,
      baseCost: 40,
      costGrowth: 1.6,
      consumable: true,
    },
    {
      id: 'headset',
      name: 'Noise-Cancelling Headset',
      icon: '🎧',
      desc: 'Calls ring longer before they are missed, and start with better mood.',
      maxLevel: 2,
      baseCost: 100,
      costGrowth: 2.0,
    },
    {
      id: 'macro',
      name: 'Terminal Macro Pack',
      icon: '⌨️',
      desc: 'Unlocks quick-fill buttons for common terminal commands.',
      maxLevel: 1,
      baseCost: 70,
      costGrowth: 1,
    },
  ];

  D.levelNames = ['Tier 1 Support', 'Tier 2 Support', 'Senior Technician', 'Lead Specialist', 'IT Director'];
  D.levelThresholds = [0, 6, 16, 32, 55]; // tickets resolved cumulative required

  HD.Data = D;
})(window.HD = window.HD || {});
