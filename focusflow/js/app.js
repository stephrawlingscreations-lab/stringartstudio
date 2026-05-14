/**
 * App — main controller: initialises all modules, dashboard, onboarding,
 * keyboard shortcuts, export/import, and streak tracking.
 */

const App = (() => {

  /* ══════════════════════════════════════════════
     CALMING QUOTES — gentle, never pressuring
  ══════════════════════════════════════════════ */
  const QUOTES = [
    "Progress, not perfection.",
    "One small step is still a step forward.",
    "You're doing better than you think.",
    "Rest is part of the process.",
    "It's okay to go gently today.",
    "Small tasks add up to big things.",
    "You don't have to do everything at once.",
    "What matters is that you showed up.",
    "Be kind to yourself — always.",
    "Done is better than perfect.",
    "Even slow progress is movement.",
    "Take it one task at a time.",
    "Your pace is valid.",
  ];

  function getQuote() {
    const i = Math.floor((new Date().getDate() + new Date().getMonth()) % QUOTES.length);
    return QUOTES[i];
  }


  /* ══════════════════════════════════════════════
     GREETING
  ══════════════════════════════════════════════ */
  function updateGreeting() {
    const settings = Storage.getSettings();
    const name     = settings.userName ? `, ${settings.userName}` : '';
    const hour     = new Date().getHours();

    let greeting;
    if (hour < 5)       greeting = `Still going${name}?`;
    else if (hour < 12) greeting = `Good morning${name}`;
    else if (hour < 17) greeting = `Good afternoon${name}`;
    else if (hour < 21) greeting = `Good evening${name}`;
    else                greeting = `Good night${name}`;

    const dateStr = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const msg = document.getElementById('greeting-message');
    const dt  = document.getElementById('greeting-date');
    const qt  = document.getElementById('greeting-quote');

    if (msg) msg.textContent  = greeting;
    if (dt)  dt.textContent   = dateStr;
    if (qt)  qt.textContent   = `"${getQuote()}"`;
  }


  /* ══════════════════════════════════════════════
     DASHBOARD RENDERING
  ══════════════════════════════════════════════ */
  function renderDashboard() {
    updateGreeting();
    Reminders.renderDashboardWidget();
    renderNextActions();
    renderTodayTasks();
    renderOverdueTasks();
    renderQuickWins();
    renderWaitingTasks();
    renderUpcomingTasks();
    renderProgressOverview();
  }

  /* ── "What to do next" — the hero widget ── */
  function renderNextActions() {
    const container = document.getElementById('next-actions-container');
    const energyLabel = document.getElementById('energy-context-label');
    const energy = EnergyManager.get();
    const today  = DateUtil.today();

    const ENERGY_LABELS = {
      low:    'matched to your low energy today',
      medium: 'matched to your current energy',
      high:   'matched to your high focus today'
    };
    if (energyLabel) energyLabel.textContent = ENERGY_LABELS[energy];

    // Scoring algorithm — surfaces the most important next action
    const tasks = Storage.getTasks()
      .filter(t => !t.isArchived && t.status !== 'done')
      .map(t => {
        let score = 0;
        // Overdue is most urgent
        if (DateUtil.isOverdue(t.dueDate)) score += 100;
        // Due today
        if (DateUtil.isToday(t.dueDate)) score += 60;
        // Priority weight
        score += { high: 30, medium: 15, low: 5 }[t.priority] || 0;
        // In progress boost
        if (t.status === 'doing') score += 20;
        // Energy match
        if (energy === 'low') {
          if (t.energy === 'low')    score += 25;
          if (t.energy === 'high')   score -= 30;
        } else if (energy === 'high') {
          if (t.energy === 'high')   score += 15;
          if (t.energy === 'medium') score += 10;
        } else {
          if (t.energy === 'medium') score += 10;
          if (t.energy === 'low')    score += 5;
        }
        return { task: t, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(x => x.task);

    if (!tasks.length) {
      container.innerHTML = `
        <div class="next-action-card" style="cursor:default;border-color:var(--status-done)">
          <span class="next-action-number">✓</span>
          <div class="next-action-content">
            <div class="next-action-title">All caught up!</div>
            <div class="next-action-meta" style="color:var(--text-muted);font-size:0.875rem;">
              You have no pending tasks. Time to relax or add something new.
            </div>
          </div>
        </div>`;
      return;
    }

    container.innerHTML = tasks.map((task, i) => {
      const project = task.projectId ? Storage.getProject(task.projectId) : null;
      const isOver  = DateUtil.isOverdue(task.dueDate);
      const isToday = DateUtil.isToday(task.dueDate);
      return `
        <div class="next-action-card" data-task-id="${task.id}" style="${isOver ? 'border-color:var(--priority-high)' : ''}">
          <span class="next-action-number">${i + 1}</span>
          <div class="next-action-content">
            <div class="next-action-title">${escHtml(task.title)}</div>
            <div class="next-action-meta">
              ${Badges.priority(task.priority)}
              ${Badges.energy(task.energy)}
              ${isOver  ? Badges.dueDate(task.dueDate) : ''}
              ${isToday ? '<span class="badge badge-today">Today</span>' : ''}
              ${project ? `<span class="project-badge" style="background:${project.color}22;color:${project.color}"><span class="project-dot" style="background:${project.color}"></span>${escHtml(project.name)}</span>` : ''}
            </div>
          </div>
          <div class="task-compact-check ${task.status === 'done' ? 'is-checked' : ''}"
               data-check-task="${task.id}"
               style="flex-shrink:0;margin-top:4px;"></div>
        </div>`;
    }).join('');
  }

  function renderTodayTasks() {
    const container = document.getElementById('today-tasks-container');
    const tasks = Storage.getTasks()
      .filter(t => !t.isArchived && DateUtil.isToday(t.dueDate))
      .sort((a, b) => {
        const done = (t) => t.status === 'done' ? 1 : 0;
        if (done(a) !== done(b)) return done(a) - done(b);
        const pri = { high: 0, medium: 1, low: 2 };
        return pri[a.priority] - pri[b.priority];
      });

    if (!tasks.length) {
      container.innerHTML = '<div class="empty-mini">Nothing due today — enjoy a light day!</div>';
    } else {
      container.innerHTML = tasks.map(t => Tasks.renderCompact(t, true)).join('');
    }
  }

  function renderOverdueTasks() {
    const section = document.getElementById('overdue-section');
    const container = document.getElementById('overdue-tasks-container');
    const tasks = Storage.getTasks()
      .filter(t => !t.isArchived && t.status !== 'done' && DateUtil.isOverdue(t.dueDate))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    if (!tasks.length) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    container.innerHTML = tasks.map(t => Tasks.renderCompact(t, true)).join('');
  }

  function renderQuickWins() {
    const container = document.getElementById('quick-wins-container');
    const energy = EnergyManager.get();

    // On low/medium energy: show only low energy tasks; on high: show low + medium
    const maxEnergy = energy === 'high' ? ['low', 'medium'] : ['low'];

    const tasks = Storage.getTasks()
      .filter(t =>
        !t.isArchived &&
        t.status !== 'done' &&
        maxEnergy.includes(t.energy)
      )
      .sort((a, b) => {
        const pri = { high: 0, medium: 1, low: 2 };
        return pri[a.priority] - pri[b.priority];
      })
      .slice(0, 5);

    if (!tasks.length) {
      container.innerHTML = '<div class="empty-mini">No low-energy tasks right now</div>';
    } else {
      container.innerHTML = tasks.map(t => Tasks.renderCompact(t, true)).join('');
    }
  }

  function renderWaitingTasks() {
    const container = document.getElementById('waiting-tasks-container');
    const tasks = Storage.getTasks()
      .filter(t => !t.isArchived && t.status === 'waiting')
      .slice(0, 4);

    if (!tasks.length) {
      container.innerHTML = '<div class="empty-mini">Nothing waiting on others</div>';
    } else {
      container.innerHTML = tasks.map(t => Tasks.renderCompact(t, true)).join('');
    }
  }

  function renderUpcomingTasks() {
    const container = document.getElementById('upcoming-tasks-container');
    const today = DateUtil.today();
    const soon  = DateUtil.addDays(today, 7);

    const tasks = Storage.getTasks()
      .filter(t =>
        !t.isArchived &&
        t.status !== 'done' &&
        t.dueDate &&
        t.dueDate > today &&
        t.dueDate <= soon
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5);

    if (!tasks.length) {
      container.innerHTML = '<div class="empty-mini">Nothing due in the next 7 days</div>';
    } else {
      container.innerHTML = tasks.map(t => Tasks.renderCompact(t, true)).join('');
    }
  }

  function renderProgressOverview() {
    const container = document.getElementById('progress-overview');
    const all   = Storage.getTasks().filter(t => !t.isArchived);
    const done  = all.filter(t => t.status === 'done');
    const doing = all.filter(t => t.status === 'doing');
    const over  = all.filter(t => t.status !== 'done' && DateUtil.isOverdue(t.dueDate));

    // Completed today
    const doneToday = done.filter(t =>
      t.completedAt && t.completedAt.split('T')[0] === DateUtil.today()
    );

    container.innerHTML = `
      <div class="progress-stat">
        <div class="progress-stat-value">${all.filter(t => t.status !== 'done').length}</div>
        <div class="progress-stat-label">Open tasks</div>
      </div>
      <div class="progress-stat">
        <div class="progress-stat-value" style="color:var(--status-doing)">${doing.length}</div>
        <div class="progress-stat-label">In progress</div>
      </div>
      <div class="progress-stat">
        <div class="progress-stat-value" style="color:var(--status-done)">${doneToday.length}</div>
        <div class="progress-stat-label">Done today</div>
      </div>
      <div class="progress-stat">
        <div class="progress-stat-value" style="color:${over.length ? 'var(--priority-high)' : 'var(--text-muted)'}">${over.length}</div>
        <div class="progress-stat-label">Overdue</div>
      </div>
      <div class="progress-stat">
        <div class="progress-stat-value" style="color:var(--accent)">${done.length}</div>
        <div class="progress-stat-label">All-time done</div>
      </div>
    `;
  }


  /* ══════════════════════════════════════════════
     ONBOARDING
  ══════════════════════════════════════════════ */
  function initOnboarding() {
    const settings = Storage.getSettings();

    if (settings.onboardingComplete) {
      document.getElementById('modal-onboarding').classList.remove('is-active');
      return;
    }

    document.getElementById('btn-onboarding-start').addEventListener('click', () => {
      const name = document.getElementById('onboarding-name').value.trim();
      Storage.updateSetting('userName', name);
      Storage.updateSetting('onboardingComplete', true);
      document.getElementById('modal-onboarding').classList.remove('is-active');
      document.body.style.overflow = '';

      // Seed the 7 default projects (no demo tasks)
      seedProjects();

      // Re-render everything
      populateProjectSelects();
      Tasks.render();
      Projects.render();
      Notes.render();
      BrainDump.render();
      renderDashboard();
      Tasks.updateNavBadge();

      Toast.success(`Welcome${name ? ', ' + name : ''}! Your projects are ready.`);
    });

    // Allow pressing enter on name field
    document.getElementById('onboarding-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-onboarding-start').click();
    });
  }


  /* ══════════════════════════════════════════════
     KEYBOARD SHORTCUTS
  ══════════════════════════════════════════════ */
  /* ══════════════════════════════════════════════
     FAB SPEED-DIAL MENU
  ══════════════════════════════════════════════ */
  function initFabMenu() {
    const fab  = document.getElementById('fab-quick-add');
    const menu = document.getElementById('fab-menu');
    if (!fab || !menu) return;

    function closeFab() {
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      fab.classList.remove('is-open');
      fab.setAttribute('aria-expanded', 'false');
    }

    fab.addEventListener('click', e => {
      e.stopPropagation();
      const open = menu.classList.toggle('is-open');
      menu.setAttribute('aria-hidden', String(!open));
      fab.classList.toggle('is-open', open);
      fab.setAttribute('aria-expanded', String(open));
    });

    document.getElementById('fab-item-task').addEventListener('click', () => {
      closeFab();
      Tasks.openQuickAdd();
    });
    document.getElementById('fab-item-braindump').addEventListener('click', () => {
      closeFab();
      Router.navigate('braindump');
      setTimeout(() => document.getElementById('brain-dump-input')?.focus(), 100);
    });
    document.getElementById('fab-item-reminder').addEventListener('click', () => {
      closeFab();
      Router.navigate('reminders');
      setTimeout(() => document.getElementById('reminder-new-text')?.focus(), 100);
    });
    document.getElementById('fab-item-note').addEventListener('click', () => {
      closeFab();
      Router.navigate('notes');
      setTimeout(() => Notes.openForm(), 100);
    });

    /* Close menu when clicking outside */
    document.addEventListener('click', e => {
      if (!fab.contains(e.target) && !menu.contains(e.target)) closeFab();
    });
  }


  /* ══════════════════════════════════════════════
     DASHBOARD MORE TOGGLE
  ══════════════════════════════════════════════ */
  function initDashboardMore() {
    const toggle  = document.getElementById('dashboard-more-toggle');
    const content = document.getElementById('dashboard-more-content');
    if (!toggle || !content) return;

    toggle.addEventListener('click', () => {
      const open = content.classList.toggle('is-open');
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
  }


  function initKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      // Ignore when typing in inputs/textareas
      if (e.target.matches('input, textarea, select, [contenteditable]')) return;
      if (e.metaKey || e.ctrlKey) return;

      switch (e.key) {
        case 'n': case 'N':
          e.preventDefault();
          Tasks.openQuickAdd();
          break;
        case '1': Router.navigate('dashboard'); break;
        case '2': Router.navigate('tasks');     break;
        case '3': Router.navigate('projects');  break;
        case '4': Router.navigate('planner');   break;
        case '5': Router.navigate('braindump'); break;
        case '6': Router.navigate('notes');     break;
        case '?': showShortcutsHelp(); break;
      }
    });
  }

  function showShortcutsHelp() {
    Toast.info('N: New task  |  1-6: Switch views  |  Esc: Close modal', 4000);
  }


  /* ══════════════════════════════════════════════
     EXPORT / IMPORT
  ══════════════════════════════════════════════ */
  function initDataManagement() {
    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-import').addEventListener('click', () => {
      document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      importData(file);
      e.target.value = '';
    });
    document.getElementById('btn-reset-app').addEventListener('click', async () => {
      const ok = await confirmAction(
        'This will delete ALL your Focus Flow data permanently (tasks, projects, notes, reminders). Are you sure?'
      );
      if (!ok) return;
      await Storage.clearAll();
      location.reload();
    });
  }

  function exportData() {
    const data     = Storage.exportAll();
    const json     = JSON.stringify(data, null, 2);
    const blob     = new Blob([json], { type: 'application/json' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    const dateStr  = new Date().toISOString().split('T')[0];
    a.href         = url;
    a.download     = `focusflow-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('Backup downloaded!');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const data = JSON.parse(e.target.result);
        const ok = await confirmAction(
          'This will replace all your current data. Are you sure? (Your current data will be overwritten.)'
        );
        if (!ok) return;
        Storage.importAll(data);
        populateProjectSelects();
        Tasks.render();
        Projects.render();
        Notes.render();
        BrainDump.render();
        renderDashboard();
        Tasks.updateNavBadge();
        Toast.success('Data imported successfully!');
      } catch {
        Toast.error('Could not read the backup file. Make sure it\'s a valid Focus Flow backup.');
      }
    };
    reader.readAsText(file);
  }


  /* ══════════════════════════════════════════════
     THEME TOGGLES
  ══════════════════════════════════════════════ */
  function initThemeToggles() {
    document.getElementById('btn-theme-toggle').addEventListener('click', Theme.toggle);
    document.getElementById('btn-theme-toggle-mobile')?.addEventListener('click', Theme.toggle);
  }


  /* ══════════════════════════════════════════════
     ROUTER HOOKS — re-render view on navigate
  ══════════════════════════════════════════════ */
  function initRouter() {
    Router.setOnNavigate((view, params) => {
      switch (view) {
        case 'dashboard':
          renderDashboard();
          break;
        case 'tasks':
          populateProjectSelects();
          if (params?.filter) Tasks.setDateFilter(params.filter);
          else Tasks.clearFilters();
          Tasks.render();
          break;
        case 'projects':
          Projects.render();
          break;
        case 'planner':
          Planner.render();
          break;
        case 'braindump':
          BrainDump.render();
          break;
        case 'notes':
          populateProjectSelects();
          Notes.render();
          break;
        case 'training':
          Training.render();
          break;
      }
    });
  }


  /* ══════════════════════════════════════════════
     ENERGY CHANGE HOOK
  ══════════════════════════════════════════════ */
  function initEnergyHook() {
    EnergyManager.setOnChange(() => {
      if (Router.getCurrent() === 'dashboard') renderDashboard();
    });
  }


  /* ══════════════════════════════════════════════
     AUTO-REFRESH — keeps dashboard fresh
  ══════════════════════════════════════════════ */
  function initAutoRefresh() {
    // Refresh dashboard every minute (updates "today" check at midnight)
    setInterval(() => {
      if (Router.getCurrent() === 'dashboard') renderDashboard();
    }, 60_000);
  }


  /* ══════════════════════════════════════════════
     STREAK TRACKING (gentle, no pressure)
  ══════════════════════════════════════════════ */
  function updateStreak() {
    const settings  = Storage.getSettings();
    const today     = DateUtil.today();
    const lastDate  = settings.lastActiveDate;

    if (lastDate === today) return; // already counted today

    if (lastDate === DateUtil.addDays(today, -1)) {
      settings.completedStreak = (settings.completedStreak || 0) + 1;
    } else if (!lastDate) {
      settings.completedStreak = 1;
    } else {
      settings.completedStreak = 1; // reset but not harshly, just starts again
    }

    settings.lastActiveDate = today;
    Storage.saveSettings(settings);
  }


  /* ══════════════════════════════════════════════
     MAIN INIT
  ══════════════════════════════════════════════ */
  function init() {
    // Apply saved theme first to avoid flash
    Theme.init();

    // Init all modules
    Router.init();
    EnergyManager.init();
    Tasks.init();
    Projects.init();
    Notes.init();
    BrainDump.init();
    Planner.init();
    Reminders.init();
    Training.init();

    // Wire up app-level concerns
    initRouter();
    initEnergyHook();
    initThemeToggles();
    initFabMenu();
    initDashboardMore();
    initKeyboardShortcuts();
    initDataManagement();
    initAutoRefresh();
    initCollapsibles();

    // Onboarding (handles first-run seeding)
    initOnboarding();

    // If not first run, seed data is already there — just render
    const settings = Storage.getSettings();
    if (settings.onboardingComplete) {
      populateProjectSelects();
      renderDashboard();
      Tasks.updateNavBadge();
    }

    // Soft streak tracking
    updateStreak();

    // Keyboard shortcut hint on first load
    if (!settings.seenShortcutHint) {
      setTimeout(() => {
        Toast.info('Tip: Press N to add a task, or ? for keyboard shortcuts', 4000);
        Storage.updateSetting('seenShortcutHint', true);
      }, 2000);
    }
  }

  return {
    init,
    renderDashboard,
  };

})();


/* App.init() is called by the Firebase auth handler in index.html
   after sign-in and cloud data pull — not on DOMContentLoaded. */
