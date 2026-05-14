/**
 * Training — personal training portal embedded in Focus Flow.
 * Data syncs to Firebase via Storage.getTrainingData / saveTrainingData.
 */

const Training = (() => {

  /* ══════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════ */
  let currentProgramId = null;


  /* ══════════════════════════════════════════════
     DEFAULT PROGRAM — Software Development
  ══════════════════════════════════════════════ */
  function buildDefaultProgram() {
    return {
      id: 'software_dev',
      title: 'Software Development Training',
      description: 'Web development, Firebase, GitHub, hosting, and your real projects.',
      createdAt: new Date().toISOString(),
      checks: {},
      notes: {},
      weeklyChecks: {},
      sections: [
        {
          id: 's1',
          title: 'How the Internet Actually Works',
          goal: 'Understand what happens when someone types your domain into a browser.',
          content: 'When someone visits a site like stephrawlingscreations.ie, the browser has to find where that website lives.',
          bullets: [
            'Domain: the web address people type.',
            'DNS: the internet phonebook — it translates the domain name to an IP address.',
            'Hosting: where the website files actually live on a server.',
            'Browser: downloads those files and builds the page using HTML, CSS, and JavaScript.'
          ],
          extra: "Your domain points to a host. The host sends your website files. The visitor's browser displays them."
        },
        {
          id: 's2',
          title: 'Static Websites vs Web Apps',
          goal: 'Know why your projects do not all run the same way.',
          content: 'A static website is mostly files — it looks the same for every visitor. A web app has moving parts like logins, databases, and user-specific data.',
          bullets: [
            'Static site: business site, landing page, portfolio, simple tools.',
            'Web app: tracker, portal, dashboard, booking system.',
            'Your string art designer is closer to a static/browser-based app.',
            'Your sales trackers and Lakeside portal are more like web apps — they need data and logins.'
          ]
        },
        {
          id: 's3',
          title: 'Frontend, Backend and Database',
          goal: 'Understand the three main layers of most apps.',
          content: 'Most modern apps have three layers that work together.',
          bullets: [
            'Frontend: what the user sees in their browser.',
            'Backend: logic, rules, processing — runs on a server.',
            'Database: where information is stored and retrieved.'
          ],
          code: 'Browser (Frontend)\n       |\nBackend / Cloud Services\n       |\nDatabase'
        },
        {
          id: 's4',
          title: 'What Firebase Actually Is',
          goal: 'Understand why Firebase feels like lots of things at once.',
          content: "Firebase is Google's cloud development platform. It bundles together the backend services most apps need, so you don't have to set up a traditional server.",
          bullets: [
            'Firebase Hosting: serves your website or app files.',
            'Firestore / Realtime Database: stores your app data.',
            'Firebase Auth: ready-made login system (email, Google, etc.).',
            'Storage: for user-uploaded files and images.',
            'Security Rules: control who can read or write data.'
          ]
        },
        {
          id: 's5',
          title: 'GitHub and Version Control',
          goal: 'Understand GitHub as your project history and safety net.',
          content: 'GitHub stores your code online and tracks every change. Each commit is a labelled checkpoint you can return to if something goes wrong.',
          bullets: [
            'Repository (repo): your project folder stored online.',
            'Commit: a saved checkpoint with a description of what changed.',
            'Push: upload your local changes to GitHub.',
            'Pull: download the latest version from GitHub.',
            'Branch: a separate copy for testing new features safely.'
          ]
        },
        {
          id: 's6',
          title: 'Hosting Types',
          goal: 'Know what to use for different kinds of projects.',
          bullets: [
            'Netlify / GitHub Pages / Vercel: great for static websites and frontend apps.',
            'Firebase Hosting: best when you also use Firestore and Firebase Auth.',
            'Wix: easy drag-and-drop builder, less flexible for custom code.',
            'Traditional server (VPS): powerful but more advanced — not needed for your current projects.'
          ]
        },
        {
          id: 's7',
          title: 'Deployment',
          goal: 'Understand how changes go live.',
          content: 'Deployment means publishing your latest version so users can see it. Some hosts auto-deploy whenever you push to GitHub.',
          code: 'VS Code (edit code)\n       |\nGitHub (save & version)\n       |\nNetlify / Firebase (publish)\n       |\nLive Website'
        },
        {
          id: 's8',
          title: 'Development, Staging and Production',
          goal: 'Avoid breaking live apps while learning.',
          content: 'Professional developers work across multiple environments to reduce risk.',
          bullets: [
            'Development: your local or private testing version — only you can see it.',
            'Staging: a test version that mirrors the live site — good for final checks.',
            'Production: the actual live site that real users see.'
          ],
          extra: 'The rule of thumb: never experiment directly on the live app if you can avoid it.'
        },
        {
          id: 's9',
          title: 'Database Thinking',
          goal: 'Learn to think like an app designer.',
          content: 'Instead of just thinking "I need a form", start thinking about what data the form creates and how it will be stored.',
          code: 'Customer\n  |-- Name\n  |-- Email\n  |-- Phone\n  |-- Jobs[]\n  |   |-- Description\n  |   |-- Date\n  |   +-- Status\n  +-- Notes',
          extra: 'This kind of thinking helps you design better trackers, portals, and dashboards from the start.'
        },
        {
          id: 's10',
          title: 'Authentication and Permissions',
          goal: 'Understand logins and access control.',
          content: 'Authentication identifies who the user is. Permissions decide what they are allowed to do.',
          bullets: [
            'Admin users: see and edit everything.',
            'Staff users: see only assigned jobs or their own area.',
            'Customers: see only their own records and history.'
          ],
          extra: 'Getting permissions right is especially important for business portals and multi-user systems.'
        },
        {
          id: 's11',
          title: 'Firebase Security Rules',
          goal: 'Know why database rules matter.',
          content: 'Firebase security rules control who can read, write, or update data in your database and Storage.',
          bullets: [
            'Rules are written in a special Firebase syntax and deployed separately.',
            'A common beginner mistake: leaving the database fully open to everyone.',
            'For any app with customer or business data, rules are not optional.',
            'You can test rules in the Firebase console before deploying them.'
          ]
        },
        {
          id: 's12',
          title: 'APIs Explained Simply',
          goal: 'Understand how software talks to software.',
          content: 'An API (Application Programming Interface) is a controlled, structured way for one system to communicate with another.',
          code: 'Frontend\n   | (makes a request)\nAPI\n   | (fetches/saves data)\nBackend / Database\n   | (returns a response)\nFrontend (updates the page)',
          extra: "Think of an API like a waiter between you and the kitchen. You don't go in yourself — you order through a clear process."
        },
        {
          id: 's13',
          title: 'Your String Art Site Architecture',
          goal: 'Understand your own site as a real software system.',
          content: 'Your string art designer mostly runs entirely in the browser — no server needed for the core features.',
          bullets: [
            'User opens the site.',
            'JavaScript downloads and runs.',
            'Canvas element draws the string art design.',
            'Export / PDF logic also runs in the browser.',
            'Static hosting (like Netlify) works well for this kind of app.'
          ]
        },
        {
          id: 's14',
          title: 'Your Lakeside Portal Architecture',
          goal: 'Understand why the portal is more complex than a normal website.',
          content: 'The Lakeside portal is more like a SaaS-style web app. It needs persistent data, user accounts, and access control.',
          code: 'Browser (Dashboard)\n       |\nFirebase Auth (who is this user?)\n       |\nFirestore (Job / Quote / Invoice data)\n       |\nSecurity Rules (what can they see?)',
          bullets: [
            'Users log in with Firebase Auth.',
            'Jobs and quotes are stored in Firestore.',
            'Different roles (admin, staff, client) need different permissions.',
            'Data can update in real time without a page refresh.'
          ]
        },
        {
          id: 's15',
          title: 'SaaS Basics',
          goal: 'Understand the business model behind portals and online tools.',
          content: 'SaaS stands for Software as a Service. Instead of buying software once, users access it online — usually on a subscription.',
          bullets: [
            'Examples: Canva, Gmail, Trello, Monday.com, QuickBooks.',
            'Key features: login, user data, always up to date, accessible anywhere.',
            'Your portals and trackers are moving in this direction.'
          ]
        },
        {
          id: 's16',
          title: 'Project Organisation',
          goal: 'Stop projects becoming chaotic as they grow.',
          content: 'As a project grows, good folder structure and clear file names become important for staying in control.',
          code: 'project/\n  |-- frontend/\n  |-- backend/\n  |-- assets/\n  |-- docs/\n  |-- config/\n  +-- tests/',
          extra: 'Even small projects benefit from clear names and at least a basic README explaining what it does.'
        },
        {
          id: 's17',
          title: 'Debugging Basics',
          goal: 'Learn how to calmly find what is broken.',
          content: "Debugging is a skill — it gets easier with practice. Good developers are not people who never break things. They're people who know how to find out what went wrong.",
          bullets: [
            '1. Reproduce the issue — can you make it happen reliably?',
            '2. Check browser console errors (F12 in most browsers).',
            '3. Look at recent changes — what did you just edit?',
            '4. Test one fix at a time.',
            '5. Commit once fixed, so you have a clean checkpoint.'
          ]
        },
        {
          id: 's18',
          title: 'Managing Live Apps',
          goal: 'Know what needs checking after launch.',
          content: 'Once an app is live, it needs occasional care to stay healthy and secure.',
          bullets: [
            'Backups: make sure important data is backed up.',
            'Security rules: review and tighten periodically.',
            'Login issues: have a plan if users get locked out.',
            'Error logs: Firebase and Netlify both have logs to check.',
            'Storage usage: watch for unexpected growth.',
            'Hosting costs: check billing alerts are set.',
            'Domain renewals: set a calendar reminder before expiry.'
          ]
        },
        {
          id: 's19',
          title: 'GDPR and Data Responsibility',
          goal: 'Be aware of data protection basics for Irish and EU projects.',
          content: "If you store customer or staff data, GDPR applies. This is about treating people's information with care.",
          bullets: [
            'Only collect data you actually need.',
            'Protect access properly — use authentication and security rules.',
            'Keep backups secure and not publicly accessible.',
            'Know who can view or edit each type of record.',
            'Have a process if someone asks what data you hold about them.'
          ]
        },
        {
          id: 's20',
          title: 'React, Node.js and Next Steps',
          goal: 'Know what to learn next without feeling overwhelmed.',
          content: 'There is always more to learn in software development. The key is to build skills in the order most useful for your actual projects.',
          bullets: [
            'React: helps build better, more organised frontends for complex UIs.',
            'Node.js: runs JavaScript on a server — useful for custom backend logic.',
            'APIs: knowing how to use and build APIs opens up a lot.',
            'Architecture: planning before building saves a lot of rework.'
          ],
          extra: "You don't need to rush. Focus on: GitHub workflow, Firebase basics, database structure thinking, and safe deployment habits."
        }
      ]
    };
  }


  /* ══════════════════════════════════════════════
     DATA HELPERS
  ══════════════════════════════════════════════ */
  function getData() {
    let data = Storage.getTrainingData();
    if (!data) {
      data = { programs: [buildDefaultProgram()] };
      Storage.saveTrainingData(data);
    }
    return data;
  }

  function saveData(data) {
    Storage.saveTrainingData(data);
  }


  /* ══════════════════════════════════════════════
     INTERNAL VIEW SWITCHING
  ══════════════════════════════════════════════ */
  function showHome() {
    currentProgramId = null;
    document.getElementById('tr-home').style.display = '';
    document.getElementById('tr-program').style.display = 'none';
    const scroll = document.querySelector('#view-training .view-scroll');
    if (scroll) scroll.scrollTop = 0;
    renderHome();
  }

  function showProgram(programId) {
    currentProgramId = programId;
    document.getElementById('tr-home').style.display = 'none';
    document.getElementById('tr-program').style.display = '';
    const scroll = document.querySelector('#view-training .view-scroll');
    if (scroll) scroll.scrollTop = 0;
    renderProgram();
  }


  /* ══════════════════════════════════════════════
     HOME — stats + program cards
  ══════════════════════════════════════════════ */
  function renderHome() {
    renderStats();
    renderProgramCards();
  }

  function renderStats() {
    const data = getData();
    let totalSections = 0, totalChecked = 0;
    data.programs.forEach(p => {
      (p.sections || []).forEach(s => {
        totalSections++;
        if (p.checks && p.checks[s.id]) totalChecked++;
      });
    });
    const pct = totalSections > 0 ? Math.round((totalChecked / totalSections) * 100) : 0;

    document.getElementById('tr-stats').innerHTML = `
      <div class="tr-stats-row">
        <div class="tr-stat"><div class="tr-stat-num">${data.programs.length}</div><div class="tr-stat-lbl">Programs</div></div>
        <div class="tr-stat"><div class="tr-stat-num">${totalSections}</div><div class="tr-stat-lbl">Sections</div></div>
        <div class="tr-stat"><div class="tr-stat-num">${totalChecked}</div><div class="tr-stat-lbl">Done</div></div>
        <div class="tr-stat"><div class="tr-stat-num">${pct}%</div><div class="tr-stat-lbl">Overall</div></div>
      </div>
    `;
  }

  function renderProgramCards() {
    const data = getData();
    let html = '<div class="tr-grid">';

    data.programs.forEach(program => {
      const sections = program.sections || [];
      const total   = sections.length;
      const checked = sections.filter(s => program.checks && program.checks[s.id]).length;
      const pct     = total > 0 ? Math.round((checked / total) * 100) : 0;

      html += `
        <div class="tr-card" onclick="Training._openProgram('${tEsc(program.id)}')">
          <button class="tr-card-del" title="Delete program"
            onclick="event.stopPropagation(); Training._confirmDelete('${tEsc(program.id)}')">&#x2715;</button>
          <div class="tr-card-title">${tEscHtml(program.title)}</div>
          <div class="tr-card-desc">${tEscHtml(program.description || '')}</div>
          <div class="tr-prog-wrap"><div class="tr-prog-bar" style="width:${pct}%"></div></div>
          <div class="tr-prog-lbl">${pct}% &bull; ${checked} of ${total} sections</div>
        </div>
      `;
    });

    html += `
      <button class="tr-add-card" onclick="Training.openNewProgramModal()">+ New Training Program</button>
    </div>`;

    document.getElementById('tr-grid').innerHTML = html;
  }


  /* ══════════════════════════════════════════════
     PROGRAM DETAIL
  ══════════════════════════════════════════════ */
  function renderProgram() {
    const data    = getData();
    const program = data.programs.find(p => p.id === currentProgramId);
    if (!program) { showHome(); return; }

    document.getElementById('tr-program-title').textContent = program.title;
    renderSections(program);
    updateProgress(program);
    loadWeeklyChecks(program);
  }

  function updateProgress(program) {
    const sections = program.sections || [];
    const total   = sections.length;
    const checked = sections.filter(s => program.checks && program.checks[s.id]).length;
    const pct     = total > 0 ? Math.round((checked / total) * 100) : 0;

    document.getElementById('tr-prog-bar2').style.width = pct + '%';
    document.getElementById('tr-prog-text').textContent =
      `${pct}% complete (${checked} of ${total} sections)`;
  }

  function renderSections(program) {
    const container = document.getElementById('tr-sections');
    const sections  = program.sections || [];

    if (!sections.length) {
      container.innerHTML = `
        <div class="tr-empty">
          <strong>No sections yet.</strong>
          <p>Use the form below to add your first section.</p>
        </div>`;
      return;
    }

    container.innerHTML = sections.map((section, index) => {
      const isChecked = program.checks && program.checks[section.id] ? 'checked' : '';
      const noteVal   = (program.notes  && program.notes[section.id]) || '';

      let body = '';
      if (section.goal)    body += `<div class="tr-callout">${tEscHtml(section.goal)}</div>`;
      if (section.content) body += `<p>${tEscHtml(section.content)}</p>`;
      if (section.bullets && section.bullets.length) {
        body += '<ul>' + section.bullets.map(b => `<li>${tEscHtml(b)}</li>`).join('') + '</ul>';
      }
      if (section.code)    body += `<pre class="tr-code">${tEscHtml(section.code)}</pre>`;
      if (section.extra)   body += `<p><em>${tEscHtml(section.extra)}</em></p>`;

      return `
        <details class="tr-details" id="trdet-${tEsc(section.id)}">
          <summary class="tr-summary">
            <input type="checkbox" ${isChecked}
              onclick="event.stopPropagation()"
              onchange="Training._toggleSection('${tEsc(section.id)}', this.checked)">
            <span class="tr-sum-title">Section ${index + 1} &ndash; ${tEscHtml(section.title)}</span>
            <svg class="tr-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>
          </summary>
          <div class="tr-sec-body">
            <div class="tr-sec-content">${body}</div>
            <p class="tr-notes-lbl">Your notes</p>
            <textarea class="tr-textarea"
              placeholder="Write your notes here..."
              oninput="Training._saveNote('${tEsc(section.id)}', this.value)"
            >${tEscHtml(noteVal)}</textarea>
            <div class="tr-sec-footer">
              <button class="tr-del-sec-btn"
                onclick="Training._deleteSection('${tEsc(section.id)}')">Remove section</button>
            </div>
          </div>
        </details>`;
    }).join('');
  }


  /* ══════════════════════════════════════════════
     SECTION ACTIONS
  ══════════════════════════════════════════════ */
  function toggleSection(sectionId, checked) {
    const data    = getData();
    const program = data.programs.find(p => p.id === currentProgramId);
    if (!program) return;
    if (!program.checks) program.checks = {};
    program.checks[sectionId] = checked;
    saveData(data);
    updateProgress(program);
  }

  function saveNote(sectionId, value) {
    const data    = getData();
    const program = data.programs.find(p => p.id === currentProgramId);
    if (!program) return;
    if (!program.notes) program.notes = {};
    program.notes[sectionId] = value;
    saveData(data);
  }

  function deleteSection(sectionId) {
    if (!confirm('Remove this section? Your notes for it will also be deleted.')) return;
    const data    = getData();
    const program = data.programs.find(p => p.id === currentProgramId);
    if (!program) return;
    program.sections = program.sections.filter(s => s.id !== sectionId);
    if (program.checks) delete program.checks[sectionId];
    if (program.notes)  delete program.notes[sectionId];
    saveData(data);
    renderProgram();
  }

  function addSection() {
    const titleEl   = document.getElementById('tr-new-title');
    const contentEl = document.getElementById('tr-new-content');
    const title     = titleEl.value.trim();
    const content   = contentEl.value.trim();

    if (!title) {
      Toast.warning('Please enter a section title.');
      titleEl.focus();
      return;
    }

    const data    = getData();
    const program = data.programs.find(p => p.id === currentProgramId);
    if (!program) return;

    const newSection = { id: 'sec_' + Date.now(), title, content };
    if (!program.sections) program.sections = [];
    program.sections.push(newSection);
    saveData(data);

    titleEl.value   = '';
    contentEl.value = '';
    renderProgram();
    Toast.success('Section added.');

    setTimeout(() => {
      const el = document.getElementById('trdet-' + newSection.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }


  /* ══════════════════════════════════════════════
     WEEKLY CHECKLIST
  ══════════════════════════════════════════════ */
  function loadWeeklyChecks(program) {
    const checks = program.weeklyChecks || {};
    document.querySelectorAll('[data-tr-weekly]').forEach(cb => {
      cb.checked  = !!checks[cb.dataset.trWeekly];
      cb.onchange = () => {
        const data = getData();
        const p    = data.programs.find(p => p.id === currentProgramId);
        if (!p) return;
        if (!p.weeklyChecks) p.weeklyChecks = {};
        p.weeklyChecks[cb.dataset.trWeekly] = cb.checked;
        saveData(data);
      };
    });
  }


  /* ══════════════════════════════════════════════
     PROGRAM MANAGEMENT
  ══════════════════════════════════════════════ */
  function openNewProgramModal() {
    document.getElementById('tr-modal-title').value = '';
    document.getElementById('tr-modal-desc').value  = '';
    Modal.open('modal-new-program');
  }

  function closeNewProgramModal() {
    Modal.close('modal-new-program');
  }

  function createProgram() {
    const title = document.getElementById('tr-modal-title').value.trim();
    const desc  = document.getElementById('tr-modal-desc').value.trim();
    if (!title) {
      Toast.warning('Please enter a program title.');
      document.getElementById('tr-modal-title').focus();
      return;
    }
    const data = getData();
    const newProgram = {
      id: 'prog_' + Date.now(),
      title,
      description: desc,
      createdAt: new Date().toISOString(),
      sections: [],
      checks: {},
      notes: {},
      weeklyChecks: {}
    };
    data.programs.push(newProgram);
    saveData(data);
    Modal.close('modal-new-program');
    Toast.success(`"${title}" created.`);
    showProgram(newProgram.id);
  }

  function confirmDeleteProgram(programId) {
    const data    = getData();
    const program = data.programs.find(p => p.id === programId);
    if (!program) return;
    if (data.programs.length === 1) {
      Toast.warning('You need at least one training program.');
      return;
    }
    if (!confirm(`Delete "${program.title}"? This cannot be undone.`)) return;
    data.programs = data.programs.filter(p => p.id !== programId);
    saveData(data);
    Toast.success('Program deleted.');
    renderHome();
  }

  function deleteCurrentProgram() {
    if (!currentProgramId) return;
    const data    = getData();
    const program = data.programs.find(p => p.id === currentProgramId);
    if (!program) return;
    if (data.programs.length === 1) {
      Toast.warning('You need at least one training program.');
      return;
    }
    if (!confirm(`Delete "${program.title}"? This cannot be undone.`)) return;
    data.programs = data.programs.filter(p => p.id !== currentProgramId);
    saveData(data);
    Toast.success('Program deleted.');
    showHome();
  }

  function resetCurrentProgram() {
    if (!currentProgramId) return;
    if (!confirm('Reset all ticks and notes for this program? This cannot be undone.')) return;
    const data    = getData();
    const program = data.programs.find(p => p.id === currentProgramId);
    if (!program) return;
    program.checks      = {};
    program.notes       = {};
    program.weeklyChecks = {};
    saveData(data);
    renderProgram();
    Toast.success('Progress reset.');
  }


  /* ══════════════════════════════════════════════
     OPEN / CLOSE ALL
  ══════════════════════════════════════════════ */
  function openAll()  { document.querySelectorAll('#tr-sections details').forEach(d => d.open = true);  }
  function closeAll() { document.querySelectorAll('#tr-sections details').forEach(d => d.open = false); }


  /* ══════════════════════════════════════════════
     UTILITIES
  ══════════════════════════════════════════════ */
  function tEscHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function tEsc(str) {
    return String(str).replace(/'/g, "\\'");
  }


  /* ══════════════════════════════════════════════
     INIT + PUBLIC API
  ══════════════════════════════════════════════ */
  function init() {
    // Ensure default data exists (creates it in Firebase if first run)
    getData();

    // Wire up buttons in the training view
    document.getElementById('tr-btn-open-all').addEventListener('click', openAll);
    document.getElementById('tr-btn-close-all').addEventListener('click', closeAll);
    document.getElementById('tr-btn-reset').addEventListener('click', resetCurrentProgram);
    document.getElementById('tr-btn-delete-prog').addEventListener('click', deleteCurrentProgram);
    document.getElementById('tr-btn-add-section').addEventListener('click', addSection);
    document.getElementById('tr-btn-create-program').addEventListener('click', createProgram);
    document.getElementById('tr-btn-cancel-modal').addEventListener('click', closeNewProgramModal);
    document.getElementById('tr-btn-new-program').addEventListener('click', openNewProgramModal);
  }

  function render() {
    if (currentProgramId) {
      renderProgram();
    } else {
      showHome();
    }
  }

  return {
    init,
    render,
    showHome,
    openNewProgramModal,

    // Called from inline HTML (onclick=)
    _openProgram:    showProgram,
    _confirmDelete:  confirmDeleteProgram,
    _toggleSection:  toggleSection,
    _saveNote:       saveNote,
    _deleteSection:  deleteSection,
  };

})();
