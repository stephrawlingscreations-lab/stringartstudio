const Reminders = (() => {

  function createReminder(text, date) {
    return {
      id: 'rem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      text: text.trim(),
      date: date || null,
      done: false,
      createdAt: new Date().toISOString()
    };
  }

  function dateBadge(dateStr) {
    if (!dateStr) return '';
    const today    = DateUtil.today();
    const tomorrow = DateUtil.addDays(today, 1);
    let label, cls;
    if (dateStr < today)       { label = 'Overdue';   cls = 'badge-overdue'; }
    else if (dateStr === today) { label = 'Today';     cls = 'badge-today'; }
    else if (dateStr === tomorrow) { label = 'Tomorrow'; cls = 'badge-upcoming'; }
    else {
      const d = new Date(dateStr + 'T00:00:00');
      label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      cls   = 'badge-upcoming';
    }
    return `<span class="badge ${cls}">${escHtml(label)}</span>`;
  }

  function renderItem(r, compact) {
    const today    = DateUtil.today();
    const isOverdue = !r.done && r.date && r.date < today;
    const classes   = ['reminder-item',
      r.done      ? 'is-done'    : '',
      isOverdue   ? 'is-overdue' : ''
    ].filter(Boolean).join(' ');

    const deleteBtn = compact ? '' : `
      <button class="reminder-delete" data-action="delete" data-id="${r.id}" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>`;

    const taskTag = r.taskId
      ? `<span style="font-size:0.7rem;color:var(--text-muted);white-space:nowrap">📋 task</span>`
      : '';

    return `<div class="${classes}" data-id="${r.id}">
      <button class="reminder-cb${r.done ? ' is-checked' : ''}" data-action="toggle" data-id="${r.id}" title="${r.done ? 'Mark undone' : 'Mark done'}">
        ${r.done ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
      </button>
      <span class="reminder-text">${escHtml(r.text)}</span>
      ${taskTag}
      ${dateBadge(r.date)}
      ${deleteBtn}
    </div>`;
  }

  function group(label, items, cls) {
    if (!items.length) return '';
    return `<div class="reminder-group">
      <div class="reminder-group-label${cls ? ' ' + cls : ''}">${label}</div>
      ${items.map(r => renderItem(r, false)).join('')}
    </div>`;
  }

  function render() {
    const container = document.getElementById('reminders-list');
    if (!container) return;

    const all      = Storage.getReminders();
    const today    = DateUtil.today();
    const active   = all.filter(r => !r.done);
    const done     = all.filter(r => r.done).slice(0, 10);
    const overdue  = active.filter(r => r.date && r.date < today);
    const todayR   = active.filter(r => r.date === today);
    const upcoming = active.filter(r => r.date && r.date > today);
    const noDate   = active.filter(r => !r.date);

    const html = [
      group('Overdue',  overdue,  'label-overdue'),
      group('Today',    todayR,   'label-today'),
      group('Upcoming', upcoming, ''),
      group('No date',  noDate,   ''),
      done.length ? `<div class="reminder-group reminder-done-group">
        <div class="reminder-group-label label-muted">Done (${done.length})</div>
        ${done.map(r => renderItem(r, false)).join('')}
      </div>` : ''
    ].join('');

    container.innerHTML = html ||
      '<div class="empty-state"><p>No reminders yet — add one above.</p></div>';

    updateBadge(overdue.length + todayR.length);
  }

  function renderDashboardWidget() {
    const section   = document.getElementById('reminders-widget-section');
    const container = document.getElementById('reminders-widget-container');
    if (!section || !container) return;

    const today  = DateUtil.today();
    const urgent = Storage.getReminders()
      .filter(r => !r.done && r.date && r.date <= today);

    if (!urgent.length) { section.style.display = 'none'; return; }

    section.style.display = '';
    container.innerHTML   = urgent.slice(0, 5).map(r => renderItem(r, true)).join('');
  }

  function updateBadge(count) {
    const badge = document.getElementById('nav-badge-reminders');
    if (badge) badge.textContent = count > 0 ? String(count) : '';
  }

  function handleClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'toggle') {
      const r = Storage.getReminder(id);
      if (r) { r.done = !r.done; Storage.saveReminder(r); render(); renderDashboardWidget(); }
    }
    if (action === 'delete') {
      confirmAction('Delete this reminder?', () => {
        Storage.deleteReminder(id);
        render();
        renderDashboardWidget();
        Toast.success('Reminder deleted');
      });
    }
  }

  function saveNew() {
    const textEl = document.getElementById('reminder-new-text');
    const dateEl = document.getElementById('reminder-new-date');
    if (!textEl) return;
    const text = textEl.value.trim();
    if (!text) { textEl.focus(); return; }
    Storage.saveReminder(createReminder(text, dateEl ? dateEl.value : ''));
    textEl.value = '';
    if (dateEl) dateEl.value = '';
    render();
    renderDashboardWidget();
    Toast.success('Reminder added');
    textEl.focus();
  }

  function init() {
    const addBtn  = document.getElementById('btn-add-reminder');
    const textEl  = document.getElementById('reminder-new-text');
    const listEl  = document.getElementById('reminders-list');
    const widgetEl = document.getElementById('reminders-widget-container');

    if (addBtn)  addBtn.addEventListener('click', saveNew);
    if (textEl)  textEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveNew(); } });
    if (listEl)  listEl.addEventListener('click', handleClick);
    if (widgetEl) widgetEl.addEventListener('click', handleClick);

    render();
    renderDashboardWidget();

    // Register service worker + fire notifications for due reminders
    Notifications.init();
    Notifications.checkDue();
  }

  return { init, render, renderDashboardWidget };

})();
