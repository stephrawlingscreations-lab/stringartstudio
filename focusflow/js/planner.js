/**
 * Planner — visual weekly calendar with drag-and-drop task scheduling.
 */

const Planner = (() => {

  let weekOffset = 0;
  let draggedTaskId = null;


  /* ══════════════════════════════════════════════
     RENDER — full weekly planner
  ══════════════════════════════════════════════ */
  function render() {
    renderWeekLabel();
    renderDayColumns();
    renderUnscheduled();
  }

  function renderWeekLabel() {
    const days  = DateUtil.weekDays(weekOffset);
    const start = new Date(days[0] + 'T12:00:00');
    const end   = new Date(days[6] + 'T12:00:00');

    const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    document.getElementById('planner-week-label').textContent =
      `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
  }

  function renderDayColumns() {
    const days  = DateUtil.weekDays(weekOffset);
    const today = DateUtil.today();
    const grid  = document.getElementById('planner-grid');
    const allTasks = Storage.getTasks().filter(t => !t.isArchived && t.status !== 'done');

    grid.innerHTML = days.map(dateStr => {
      const isToday  = dateStr === today;
      const dayTasks = allTasks.filter(t => t.dayPlanned === dateStr || t.dueDate === dateStr);
      const dayNum   = new Date(dateStr + 'T12:00:00').getDate();
      const dayName  = DateUtil.dayNameShort(dateStr);

      return `
        <div class="planner-day ${isToday ? 'is-today' : ''}"
             data-planner-date="${dateStr}">
          <div class="planner-day-header">
            <div class="planner-day-name">${dayName}</div>
            <div class="planner-day-date">${dayNum}</div>
          </div>
          <div class="planner-day-tasks" data-planner-date="${dateStr}">
            ${dayTasks.map(t => renderTaskChip(t)).join('')}
          </div>
        </div>`;
    }).join('');

    // Bind drag events on all day columns
    grid.querySelectorAll('.planner-day').forEach(day => {
      day.addEventListener('dragover', e => {
        e.preventDefault();
        day.classList.add('drag-over');
      });
      day.addEventListener('dragleave', e => {
        if (!day.contains(e.relatedTarget)) {
          day.classList.remove('drag-over');
        }
      });
      day.addEventListener('drop', e => {
        e.preventDefault();
        day.classList.remove('drag-over');
        if (!draggedTaskId) return;
        scheduleTask(draggedTaskId, day.dataset.plannerDate);
        draggedTaskId = null;
      });
    });

    // Bind drag start on task chips
    bindChipDrag(grid);
  }

  function renderTaskChip(task) {
    const project = task.projectId ? Storage.getProject(task.projectId) : null;
    const color   = project ? project.color : 'var(--accent)';
    const isOverdue = DateUtil.isOverdue(task.dueDate);

    return `
      <div class="planner-task-chip"
           data-task-id="${task.id}"
           draggable="true"
           title="${escHtml(task.title)}">
        <span class="planner-task-chip-dot" style="background:${isOverdue ? 'var(--priority-high)' : color}"></span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(task.title)}</span>
        <button class="planner-chip-remove" data-unschedule-task="${task.id}"
                style="padding:0 2px;color:var(--text-muted);font-size:0.9rem;line-height:1;"
                title="Remove from day">×</button>
      </div>`;
  }

  function renderUnscheduled() {
    const pool = document.getElementById('planner-unscheduled');
    const weekDays = DateUtil.weekDays(weekOffset);

    const unscheduled = Storage.getTasks().filter(t =>
      !t.isArchived &&
      t.status !== 'done' &&
      !t.dayPlanned &&
      !weekDays.includes(t.dueDate)
    ).sort((a, b) => {
      const pri = { high: 0, medium: 1, low: 2 };
      return pri[a.priority] - pri[b.priority];
    });

    if (!unscheduled.length) {
      pool.innerHTML = '<div class="empty-mini" style="width:100%;text-align:center;">All tasks are scheduled — well done!</div>';
    } else {
      pool.innerHTML = unscheduled.map(t => {
        const project = t.projectId ? Storage.getProject(t.projectId) : null;
        const color   = project ? project.color : 'var(--accent)';
        return `
          <div class="planner-task-chip"
               data-task-id="${t.id}"
               draggable="true"
               style="flex-shrink:0;max-width:200px;"
               title="${escHtml(t.title)}">
            <span class="planner-task-chip-dot" style="background:${color}"></span>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(t.title)}</span>
          </div>`;
      }).join('');
    }

    // Make pool a drag target (to unschedule)
    pool.addEventListener('dragover', e => {
      e.preventDefault();
      pool.style.borderColor = 'var(--accent)';
    });
    pool.addEventListener('dragleave', () => {
      pool.style.borderColor = '';
    });
    pool.addEventListener('drop', e => {
      e.preventDefault();
      pool.style.borderColor = '';
      if (!draggedTaskId) return;
      scheduleTask(draggedTaskId, null); // remove from day
      draggedTaskId = null;
    });

    bindChipDrag(pool);
  }


  /* ══════════════════════════════════════════════
     SCHEDULE / UNSCHEDULE
  ══════════════════════════════════════════════ */
  function scheduleTask(taskId, dateStr) {
    const task = Storage.getTask(taskId);
    if (!task) return;
    task.dayPlanned = dateStr;
    Storage.saveTask(task);
    render();
    Toast.success(dateStr ? `Scheduled for ${DateUtil.formatDisplay(dateStr)}` : 'Removed from day');
  }


  /* ══════════════════════════════════════════════
     DRAG BINDING HELPERS
  ══════════════════════════════════════════════ */
  function bindChipDrag(container) {
    container.querySelectorAll('[draggable="true"][data-task-id]').forEach(chip => {
      chip.addEventListener('dragstart', e => {
        draggedTaskId = chip.dataset.taskId;
        e.dataTransfer.setData('text/plain', draggedTaskId);
        e.dataTransfer.effectAllowed = 'move';
        chip.style.opacity = '0.5';
      });
      chip.addEventListener('dragend', () => {
        chip.style.opacity = '';
        draggedTaskId = null;
      });

      // Click chip to open task detail
      chip.addEventListener('click', e => {
        if (e.target.closest('[data-unschedule-task]')) return;
        Tasks.openDetail(chip.dataset.taskId);
      });
    });

    // Unschedule button on chips
    container.addEventListener('click', e => {
      const btn = e.target.closest('[data-unschedule-task]');
      if (btn) {
        e.stopPropagation();
        scheduleTask(btn.dataset.unscheduleTask, null);
      }
    });
  }


  /* ══════════════════════════════════════════════
     WEEK NAVIGATION
  ══════════════════════════════════════════════ */
  function prevWeek() { weekOffset--; render(); }
  function nextWeek() { weekOffset++; render(); }
  function goToToday() { weekOffset = 0; render(); }


  /* ══════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════ */
  function init() {
    document.getElementById('planner-prev-week').addEventListener('click', prevWeek);
    document.getElementById('planner-next-week').addEventListener('click', nextWeek);
    document.getElementById('planner-today-btn').addEventListener('click', goToToday);
    document.getElementById('btn-print-planner').addEventListener('click', () => window.print());
  }

  return { init, render };

})();
