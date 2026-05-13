/**
 * Tasks — CRUD, rendering, filtering, drag-and-drop, and task detail modal.
 */

const Tasks = (() => {

  /* ── State ── */
  let draggedTaskId = null;
  let currentDetailId = null;
  let currentView = 'list'; // 'list' | 'kanban'

  /* ── Filter state ── */
  let filters = {
    search:   '',
    status:   '',
    priority: '',
    energy:   '',
    project:  '',
    dateFilter: ''
  };


  /* ══════════════════════════════════════════════
     FILTER & SORT
  ══════════════════════════════════════════════ */
  function applyFilters(tasks) {
    return tasks
      .filter(t => !t.isArchived)
      .filter(t => {
        if (filters.search) {
          const q = filters.search.toLowerCase();
          return (
            t.title.toLowerCase().includes(q) ||
            (t.notes || '').toLowerCase().includes(q) ||
            (t.tags || []).some(tag => tag.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .filter(t => !filters.status   || t.status   === filters.status)
      .filter(t => !filters.priority || t.priority === filters.priority)
      .filter(t => !filters.energy   || t.energy   === filters.energy)
      .filter(t => !filters.project  || t.projectId === filters.project)
      .filter(t => {
        if (!filters.dateFilter) return true;
        if (filters.dateFilter === 'today')   return DateUtil.isToday(t.dueDate);
        if (filters.dateFilter === 'overdue') return DateUtil.isOverdue(t.dueDate) && t.status !== 'done';
        return true;
      })
      .sort((a, b) => {
        // Done tasks always go to the bottom
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (b.status === 'done' && a.status !== 'done') return -1;
        // Overdue first
        const aOver = DateUtil.isOverdue(a.dueDate) && a.status !== 'done';
        const bOver = DateUtil.isOverdue(b.dueDate) && b.status !== 'done';
        if (aOver && !bOver) return -1;
        if (bOver && !aOver) return 1;
        // Priority
        const pri = { high: 0, medium: 1, low: 2 };
        if (pri[a.priority] !== pri[b.priority]) return pri[a.priority] - pri[b.priority];
        // Due date
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }


  /* ══════════════════════════════════════════════
     RENDER — full task card (list view)
  ══════════════════════════════════════════════ */
  function renderTaskCard(task) {
    const project = task.projectId ? Storage.getProject(task.projectId) : null;
    const isDone  = task.status === 'done';
    const isOver  = DateUtil.isOverdue(task.dueDate) && !isDone;
    const subtaskCount   = (task.subtasks || []).length;
    const subtaskDone    = (task.subtasks || []).filter(s => s.done).length;

    return `
      <div class="task-card priority-${task.priority} ${isDone ? 'is-done' : ''}"
           data-task-id="${task.id}"
           draggable="true"
           role="article">
        <div class="task-card-check ${isDone ? 'is-checked' : ''}"
             data-check-task="${task.id}"
             title="Mark as ${isDone ? 'incomplete' : 'done'}"></div>

        <div class="task-card-body">
          <div class="task-card-title">${escHtml(task.title)}</div>
          ${task.notes ? `<div class="task-card-notes">${escHtml(task.notes)}</div>` : ''}

          <div class="task-card-meta">
            ${Badges.dueDate(task.dueDate)}
            ${Badges.status(task.status)}
            ${Badges.priority(task.priority)}
            ${Badges.energy(task.energy)}
            ${project ? `<span class="project-badge" style="background:${project.color}22;color:${project.color}"><span class="project-dot" style="background:${project.color}"></span>${escHtml(project.name)}</span>` : ''}
            ${subtaskCount > 0 ? `<span class="badge badge-status">${subtaskDone}/${subtaskCount} steps</span>` : ''}
          </div>
        </div>

        <div class="task-card-drag" data-drag-handle title="Drag to reorder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <line x1="9" y1="6" x2="15" y2="6"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/>
          </svg>
        </div>
      </div>`;
  }

  /* ── Compact card (dashboard) ── */
  function renderTaskCompact(task, showProject = false) {
    const isDone  = task.status === 'done';
    const isOver  = DateUtil.isOverdue(task.dueDate) && !isDone;
    const project = showProject && task.projectId ? Storage.getProject(task.projectId) : null;

    return `
      <div class="task-compact ${isDone ? 'is-done' : ''}"
           data-task-id="${task.id}">
        <div class="task-compact-check ${isDone ? 'is-checked' : ''}"
             data-check-task="${task.id}"></div>
        <span class="task-compact-title">${escHtml(task.title)}</span>
        <div class="task-compact-right">
          ${isOver ? '<span class="badge badge-overdue">⚠</span>' : ''}
          ${task.dueDate && !isOver ? Badges.dueDate(task.dueDate) : ''}
          ${project ? `<span class="project-dot" style="background:${project.color}" title="${escHtml(project.name)}"></span>` : ''}
        </div>
      </div>`;
  }

  /* ── Kanban chip ── */
  function renderKanbanCard(task) {
    const project = task.projectId ? Storage.getProject(task.projectId) : null;
    const isDone  = task.status === 'done';

    return `
      <div class="task-card priority-${task.priority} ${isDone ? 'is-done' : ''}"
           data-task-id="${task.id}"
           draggable="true"
           style="padding:12px 14px;gap:10px;">
        <div class="task-card-check ${isDone ? 'is-checked' : ''}"
             data-check-task="${task.id}"></div>
        <div class="task-card-body">
          <div class="task-card-title" style="font-size:0.875rem;">${escHtml(task.title)}</div>
          <div class="task-card-meta" style="margin-top:6px;">
            ${Badges.dueDate(task.dueDate)}
            ${project ? `<span class="project-dot" style="background:${project.color};width:8px;height:8px;border-radius:50%;display:inline-block;" title="${escHtml(project.name)}"></span>` : ''}
          </div>
        </div>
      </div>`;
  }


  /* ══════════════════════════════════════════════
     RENDER — All Tasks view (list + kanban)
  ══════════════════════════════════════════════ */
  function renderTasksView() {
    if (currentView === 'list') renderListView();
    else renderKanbanView();
  }

  function renderListView() {
    const container = document.getElementById('tasks-container');
    const tasks = applyFilters(Storage.getTasks());

    if (!tasks.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">No tasks found</div>
          <div class="empty-state-text">Try changing the filters, or add a new task with the + button.</div>
        </div>`;
      return;
    }

    container.innerHTML = tasks.map(renderTaskCard).join('');
    initDragHandles(container);
    updateNavBadge();
  }

  function renderKanbanView() {
    const statuses = ['todo', 'doing', 'waiting', 'done'];
    const tasks = applyFilters(Storage.getTasks());

    statuses.forEach(status => {
      const col = document.getElementById(`kanban-${status}`);
      const count = document.getElementById(`kanban-count-${status}`);
      const colTasks = tasks.filter(t => t.status === status);

      count.textContent = colTasks.length;
      col.innerHTML = colTasks.length
        ? colTasks.map(renderKanbanCard).join('')
        : `<div class="empty-mini">Drop tasks here</div>`;

      // Kanban drag-over target
      col.addEventListener('dragover', e => {
        e.preventDefault();
        col.closest('.kanban-col').classList.add('drag-over');
      });
      col.addEventListener('dragleave', () => {
        col.closest('.kanban-col').classList.remove('drag-over');
      });
      col.addEventListener('drop', e => {
        e.preventDefault();
        col.closest('.kanban-col').classList.remove('drag-over');
        if (!draggedTaskId) return;
        const task = Storage.getTask(draggedTaskId);
        if (task) {
          task.status = status;
          if (status === 'done' && !task.completedAt) task.completedAt = new Date().toISOString();
          if (status !== 'done') task.completedAt = null;
          Storage.saveTask(task);
          renderKanbanView();
          refreshDashboard();
        }
        draggedTaskId = null;
      });
    });

    // Bind drag start on kanban cards
    document.querySelectorAll('#tasks-kanban-view .task-card').forEach(card => {
      card.addEventListener('dragstart', e => {
        draggedTaskId = card.dataset.taskId;
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', draggedTaskId);
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
  }


  /* ══════════════════════════════════════════════
     DRAG AND DROP — List view
  ══════════════════════════════════════════════ */
  function initDragHandles(container) {
    container.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('dragstart', e => {
        draggedTaskId = card.dataset.taskId;
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', draggedTaskId);
        e.dataTransfer.effectAllowed = 'move';
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        container.querySelectorAll('.task-card').forEach(c => c.classList.remove('drag-over'));
      });

      card.addEventListener('dragover', e => {
        e.preventDefault();
        if (card.dataset.taskId !== draggedTaskId) {
          card.classList.add('drag-over');
        }
      });

      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));

      card.addEventListener('drop', e => {
        e.preventDefault();
        card.classList.remove('drag-over');
        // Visual reorder only — no persistent order in this version
      });
    });
  }


  /* ══════════════════════════════════════════════
     TASK DETAIL MODAL
  ══════════════════════════════════════════════ */
  function openTaskDetail(taskId) {
    const task = Storage.getTask(taskId);
    if (!task) return;
    currentDetailId = taskId;

    const projects = Storage.getProjects().filter(p => !p.isArchived);
    const projectOptions = projects.map(p =>
      `<option value="${p.id}" ${task.projectId === p.id ? 'selected' : ''}>${escHtml(p.name)}</option>`
    ).join('');

    const body = document.getElementById('task-detail-body');
    body.innerHTML = `
      <input type="text" class="task-detail-title-edit" id="td-title" value="${escHtml(task.title)}" placeholder="Task title">

      <div class="task-detail-row">
        <div class="task-detail-field">
          <label class="task-detail-label">Status</label>
          <select class="form-select" id="td-status">
            <option value="todo"    ${task.status==='todo'    ? 'selected':''}>To Do</option>
            <option value="doing"   ${task.status==='doing'   ? 'selected':''}>Doing</option>
            <option value="waiting" ${task.status==='waiting' ? 'selected':''}>Waiting</option>
            <option value="done"    ${task.status==='done'    ? 'selected':''}>Done</option>
          </select>
        </div>
        <div class="task-detail-field">
          <label class="task-detail-label">Priority</label>
          <select class="form-select" id="td-priority">
            <option value="high"   ${task.priority==='high'   ? 'selected':''}>↑ High</option>
            <option value="medium" ${task.priority==='medium' ? 'selected':''}>– Medium</option>
            <option value="low"    ${task.priority==='low'    ? 'selected':''}>↓ Low</option>
          </select>
        </div>
      </div>

      <div class="task-detail-row">
        <div class="task-detail-field">
          <label class="task-detail-label">Due date</label>
          <input type="date" class="form-input" id="td-due-date" value="${task.dueDate || ''}">
        </div>
        <div class="task-detail-field">
          <label class="task-detail-label">Energy needed</label>
          <select class="form-select" id="td-energy">
            <option value="low"    ${task.energy==='low'    ? 'selected':''}>😴 Low energy</option>
            <option value="medium" ${task.energy==='medium' ? 'selected':''}>⚡ Some energy</option>
            <option value="high"   ${task.energy==='high'   ? 'selected':''}>🔥 High focus</option>
          </select>
        </div>
      </div>

      <div class="task-detail-row">
        <div class="task-detail-field">
          <label class="task-detail-label">Project</label>
          <select class="form-select" id="td-project">
            <option value="">No project</option>
            ${projectOptions}
          </select>
        </div>
        <div class="task-detail-field">
          <label class="task-detail-label">Est. time (mins)</label>
          <input type="number" class="form-input" id="td-time" value="${task.estimatedMins || ''}" placeholder="e.g. 30" min="1">
        </div>
      </div>

      <div class="form-group" style="margin-top:16px;">
        <label class="task-detail-label">Notes</label>
        <textarea class="form-textarea" id="td-notes" rows="3" placeholder="Any details, context, links…">${escHtml(task.notes || '')}</textarea>
      </div>

      <div class="form-group" style="margin-top:16px;">
        <label class="task-detail-label">Tags (comma separated)</label>
        <input type="text" class="form-input" id="td-tags" value="${(task.tags || []).join(', ')}" placeholder="e.g. admin, urgent">
      </div>

      <!-- Subtasks -->
      <div class="form-group" style="margin-top:20px;">
        <label class="task-detail-label">Checklist / Subtasks</label>
        <div class="subtask-list" id="td-subtask-list">
          ${renderSubtasks(task.subtasks || [])}
        </div>
        <div class="subtask-add-row">
          <input type="text" class="subtask-add-input" id="td-subtask-input" placeholder="Add a step…">
          <button class="btn btn-ghost btn-sm" id="btn-add-subtask">Add</button>
        </div>
      </div>

      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <button class="btn btn-primary" id="btn-save-task-detail">Save changes</button>
          <span style="font-size:0.75rem;color:var(--text-muted);">
            Created ${DateUtil.formatDatetime(task.createdAt)}
          </span>
        </div>
      </div>`;

    // Bind save
    document.getElementById('btn-save-task-detail').addEventListener('click', () => saveTaskDetail(task));

    // Bind add subtask
    document.getElementById('btn-add-subtask').addEventListener('click', () => {
      const input = document.getElementById('td-subtask-input');
      if (input.value.trim()) {
        addSubtask(task, input.value);
        input.value = '';
        input.focus();
      }
    });
    document.getElementById('td-subtask-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const input = e.target;
        if (input.value.trim()) {
          addSubtask(task, input.value);
          input.value = '';
        }
      }
    });

    // Bind subtask checks + deletes (event delegation)
    document.getElementById('td-subtask-list').addEventListener('click', e => {
      const check = e.target.closest('[data-subtask-check]');
      const del   = e.target.closest('[data-subtask-delete]');
      const task  = Storage.getTask(currentDetailId);
      if (!task) return;

      if (check) {
        const st = task.subtasks.find(s => s.id === check.dataset.subtaskCheck);
        if (st) { st.done = !st.done; Storage.saveTask(task); }
        document.getElementById('td-subtask-list').innerHTML = renderSubtasks(task.subtasks);
      }
      if (del) {
        task.subtasks = task.subtasks.filter(s => s.id !== del.dataset.subtaskDelete);
        Storage.saveTask(task);
        document.getElementById('td-subtask-list').innerHTML = renderSubtasks(task.subtasks);
      }
    });

    // Bind delete button
    const delBtn = document.getElementById('btn-delete-task');
    delBtn.onclick = async () => {
      const ok = await confirmAction('Delete this task? This cannot be undone.');
      if (ok) {
        Storage.deleteTask(taskId);
        Modal.close('modal-task-detail');
        renderTasksView();
        refreshDashboard();
        Toast.success('Task deleted');
      }
    };

    document.getElementById('modal-task-detail-panel')
      .querySelector('.modal-title').textContent = task.title.substring(0, 40) + (task.title.length > 40 ? '…' : '');

    Modal.open('modal-task-detail');
  }

  function renderSubtasks(subtasks) {
    if (!subtasks.length) return '';
    return subtasks.map(s => `
      <div class="subtask-item ${s.done ? 'is-done' : ''}">
        <div class="subtask-check ${s.done ? 'is-done' : ''}" data-subtask-check="${s.id}"></div>
        <span class="subtask-title">${escHtml(s.title)}</span>
        <button class="subtask-delete" data-subtask-delete="${s.id}" title="Remove step">×</button>
      </div>`).join('');
  }

  function addSubtask(task, title) {
    const freshTask = Storage.getTask(task.id);
    if (!freshTask) return;
    if (!freshTask.subtasks) freshTask.subtasks = [];
    freshTask.subtasks.push(createSubtask(title));
    Storage.saveTask(freshTask);
    document.getElementById('td-subtask-list').innerHTML = renderSubtasks(freshTask.subtasks);
  }

  function saveTaskDetail(originalTask) {
    const task = Storage.getTask(originalTask.id);
    if (!task) return;

    task.title    = document.getElementById('td-title').value.trim() || task.title;
    task.status   = document.getElementById('td-status').value;
    task.priority = document.getElementById('td-priority').value;
    task.dueDate  = document.getElementById('td-due-date').value || null;
    task.energy   = document.getElementById('td-energy').value;
    task.projectId = document.getElementById('td-project').value || null;
    task.notes    = document.getElementById('td-notes').value.trim();
    task.estimatedMins = parseInt(document.getElementById('td-time').value) || null;
    task.tags     = document.getElementById('td-tags').value
      .split(',').map(t => t.trim()).filter(Boolean);

    if (task.status === 'done' && !task.completedAt) task.completedAt = new Date().toISOString();
    if (task.status !== 'done') task.completedAt = null;

    Storage.saveTask(task);
    Modal.close('modal-task-detail');
    renderTasksView();
    refreshDashboard();
    Toast.success('Task saved');
  }


  /* ══════════════════════════════════════════════
     QUICK ADD FORM
  ══════════════════════════════════════════════ */
  function openQuickAdd() {
    document.getElementById('qa-title').value    = '';
    document.getElementById('qa-notes').value    = '';
    document.getElementById('qa-priority').value = 'medium';
    document.getElementById('qa-energy').value   = EnergyManager.get();
    document.getElementById('qa-due-date').value = '';
    /* Collapse details panel on each open */
    const details = document.getElementById('qa-details');
    const toggle  = document.getElementById('qa-details-toggle');
    if (details) details.classList.remove('is-open');
    if (toggle)  toggle.setAttribute('aria-expanded', 'false');
    populateProjectSelects();
    Modal.open('modal-quick-add');
    setTimeout(() => document.getElementById('qa-title').focus(), 50);
  }

  function initQuickAdd() {
    const btnNew = document.getElementById('btn-new-task-tasks');
    if (btnNew) btnNew.addEventListener('click', openQuickAdd);

    /* Details expand toggle */
    document.getElementById('qa-details-toggle').addEventListener('click', () => {
      const details = document.getElementById('qa-details');
      const toggle  = document.getElementById('qa-details-toggle');
      const open    = details.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    document.getElementById('btn-qa-save').addEventListener('click', saveQuickAdd);

    document.getElementById('qa-title').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveQuickAdd(); }
    });
  }

  function saveQuickAdd() {
    const title = document.getElementById('qa-title').value.trim();
    if (!title) {
      document.getElementById('qa-title').focus();
      Toast.warning('Please enter a task title');
      return;
    }

    const task = createTask({
      title,
      projectId:  document.getElementById('qa-project').value || null,
      priority:   document.getElementById('qa-priority').value,
      dueDate:    document.getElementById('qa-due-date').value || null,
      energy:     document.getElementById('qa-energy').value,
      notes:      document.getElementById('qa-notes').value.trim(),
    });

    Storage.saveTask(task);
    Modal.close('modal-quick-add');
    renderTasksView();
    refreshDashboard();
    Toast.success('Task added!');
    updateNavBadge();
  }


  /* ══════════════════════════════════════════════
     QUICK TOGGLE DONE
  ══════════════════════════════════════════════ */
  function toggleDone(taskId) {
    const task = Storage.getTask(taskId);
    if (!task) return;
    if (task.status === 'done') {
      task.status = 'todo';
      task.completedAt = null;
    } else {
      task.status = 'done';
      task.completedAt = new Date().toISOString();
    }
    Storage.saveTask(task);
    renderTasksView();
    refreshDashboard();
    Toast.success(task.status === 'done' ? '✓ Marked as done!' : 'Moved back to to-do');
  }


  /* ══════════════════════════════════════════════
     FILTERS INIT
  ══════════════════════════════════════════════ */
  function initFilters() {
    document.getElementById('task-search').addEventListener('input', e => {
      filters.search = e.target.value;
      renderTasksView();
    });
    document.getElementById('filter-status').addEventListener('change', e => {
      filters.status = e.target.value;
      renderTasksView();
    });
    document.getElementById('filter-priority').addEventListener('change', e => {
      filters.priority = e.target.value;
      renderTasksView();
    });
    document.getElementById('filter-energy').addEventListener('change', e => {
      filters.energy = e.target.value;
      renderTasksView();
    });
    document.getElementById('filter-project').addEventListener('change', e => {
      filters.project = e.target.value;
      renderTasksView();
    });

    // View toggle (list / kanban)
    document.querySelectorAll('[data-tasks-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentView = btn.dataset.tasksView;
        document.querySelectorAll('[data-tasks-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tasks-list-view').style.display   = currentView === 'list'   ? '' : 'none';
        document.getElementById('tasks-kanban-view').style.display  = currentView === 'kanban' ? '' : 'none';
        renderTasksView();
      });
    });
  }


  /* ══════════════════════════════════════════════
     NAV BADGE (overdue + today count)
  ══════════════════════════════════════════════ */
  function updateNavBadge() {
    const count = Storage.getTasks().filter(t =>
      !t.isArchived &&
      t.status !== 'done' &&
      (DateUtil.isOverdue(t.dueDate) || DateUtil.isToday(t.dueDate))
    ).length;

    const badge = document.getElementById('nav-badge-tasks');
    if (badge) badge.textContent = count || '';
  }


  /* ══════════════════════════════════════════════
     GLOBAL EVENT DELEGATION (clicks on task cards)
  ══════════════════════════════════════════════ */
  function initEvents() {
    document.addEventListener('click', e => {
      // Check button (toggle done)
      const checkBtn = e.target.closest('[data-check-task]');
      if (checkBtn) {
        e.stopPropagation();
        toggleDone(checkBtn.dataset.checkTask);
        return;
      }

      // Click on task card → open detail
      const card = e.target.closest('.task-card, .task-compact');
      if (card && card.dataset.taskId && !e.target.closest('[data-drag-handle]')) {
        openTaskDetail(card.dataset.taskId);
      }
    });
  }


  /* ══════════════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════════════ */
  function init() {
    initQuickAdd();
    initFilters();
    initEvents();
  }

  function setDateFilter(f) {
    filters.dateFilter = f;
    document.getElementById('filter-status').value   = '';
    document.getElementById('filter-priority').value = '';
    document.getElementById('filter-energy').value   = '';
    filters.status   = '';
    filters.priority = '';
    filters.energy   = '';
  }

  function clearFilters() {
    filters = { search: '', status: '', priority: '', energy: '', project: '', dateFilter: '' };
    document.getElementById('task-search').value     = '';
    document.getElementById('filter-status').value   = '';
    document.getElementById('filter-priority').value = '';
    document.getElementById('filter-energy').value   = '';
    document.getElementById('filter-project').value  = '';
  }

  return {
    init,
    openQuickAdd,
    render: renderTasksView,
    renderCompact: renderTaskCompact,
    applyFilters,
    openDetail: openTaskDetail,
    toggleDone,
    setDateFilter,
    clearFilters,
    updateNavBadge,
  };

})();

/* refreshDashboard is defined in app.js but called from here — forward ref */
function refreshDashboard() {
  if (typeof App !== 'undefined' && App.renderDashboard) App.renderDashboard();
}
