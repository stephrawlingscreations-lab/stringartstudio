/**
 * Projects — CRUD, card rendering, progress calculation, detail view.
 */

const Projects = (() => {

  let editingProjectId = null;

  /* ══════════════════════════════════════════════
     PROGRESS CALCULATION
  ══════════════════════════════════════════════ */
  function getProjectStats(projectId) {
    const tasks = Storage.getTasks().filter(t => t.projectId === projectId && !t.isArchived);
    const total = tasks.length;
    const done  = tasks.filter(t => t.status === 'done').length;
    const overdue = tasks.filter(t => DateUtil.isOverdue(t.dueDate) && t.status !== 'done').length;
    return {
      total,
      done,
      overdue,
      progress: total > 0 ? Math.round((done / total) * 100) : 0
    };
  }


  /* ══════════════════════════════════════════════
     RENDER — Projects grid
  ══════════════════════════════════════════════ */
  function renderProjectsView() {
    const grid = document.getElementById('projects-grid');
    const projects = Storage.getProjects().filter(p => !p.isArchived);

    if (!projects.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">📁</div>
          <div class="empty-state-title">No projects yet</div>
          <div class="empty-state-text">Create a project to group your tasks and keep things organised.</div>
          <button class="btn btn-primary" id="btn-empty-new-project">Create first project</button>
        </div>`;
      document.getElementById('btn-empty-new-project')?.addEventListener('click', openProjectForm);
      return;
    }

    grid.innerHTML = projects.map(renderProjectCard).join('');
  }

  function renderProjectCard(project) {
    const stats = getProjectStats(project.id);
    const deadlineHtml = project.deadline
      ? `<span class="badge ${DateUtil.isOverdue(project.deadline) ? 'badge-overdue' : 'badge-status'}">${DateUtil.formatDisplay(project.deadline)}</span>`
      : '';

    return `
      <div class="project-card" data-project-id="${project.id}" style="border-top:4px solid ${project.color}">
        <div class="project-card-header">
          <div>
            <div class="project-card-name">${escHtml(project.name)}</div>
            ${project.description ? `<div class="project-card-desc">${escHtml(project.description)}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-icon" data-edit-project="${project.id}" title="Edit project" style="width:28px;height:28px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${stats.progress}%;background:${project.color}"></div>
        </div>

        <div class="project-card-stats">
          <span class="project-card-stat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
            ${stats.done}/${stats.total} tasks
          </span>
          <span class="project-card-stat" style="font-weight:600;color:${project.color}">
            ${stats.progress}%
          </span>
          ${stats.overdue > 0 ? `<span class="badge badge-overdue">${stats.overdue} overdue</span>` : ''}
          ${deadlineHtml}
        </div>
      </div>`;
  }


  /* ══════════════════════════════════════════════
     RENDER — Project Detail view
  ══════════════════════════════════════════════ */
  function renderProjectDetail(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) return;

    const stats = getProjectStats(projectId);
    const allTasks = Storage.getTasks()
      .filter(t => t.projectId === projectId && !t.isArchived)
      .sort((a, b) => {
        const pri = { high: 0, medium: 1, low: 2 };
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (b.status === 'done' && a.status !== 'done') return -1;
        return pri[a.priority] - pri[b.priority];
      });

    const activeTasks = allTasks.filter(t => t.status !== 'done');
    const doneTasks   = allTasks.filter(t => t.status === 'done');

    const content = document.getElementById('project-detail-content');
    content.innerHTML = `
      <!-- Hero -->
      <div class="project-detail-hero">
        <div class="project-detail-color-bar" style="background:${project.color}"></div>
        <div class="project-detail-icon" style="background:${project.color}22">
          <span style="font-size:1.5rem">📁</span>
        </div>
        <div class="project-detail-info">
          <div class="project-detail-name">${escHtml(project.name)}</div>
          ${project.description ? `<div class="project-detail-desc">${escHtml(project.description)}</div>` : ''}
          <div style="display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap;">
            <div class="progress-bar-wrap" style="width:180px;height:8px;">
              <div class="progress-bar-fill" style="width:${stats.progress}%;background:${project.color}"></div>
            </div>
            <span style="font-size:0.9rem;font-weight:600;color:${project.color}">${stats.progress}% complete</span>
            <span style="font-size:0.85rem;color:var(--text-muted)">${stats.done}/${stats.total} tasks done</span>
            ${project.deadline ? `<span class="badge ${DateUtil.isOverdue(project.deadline) ? 'badge-overdue' : 'badge-status'}">Due ${DateUtil.formatDisplay(project.deadline)}</span>` : ''}
          </div>
        </div>
        <div class="project-detail-actions">
          <button class="btn btn-ghost btn-sm" data-edit-project="${project.id}">Edit</button>
          <button class="btn btn-primary btn-sm" data-add-task-project="${project.id}">+ Add task</button>
        </div>
      </div>

      <!-- Project notes -->
      ${project.notes ? `
        <div class="dashboard-section">
          <div class="section-header">
            <h2 class="section-title">Notes</h2>
          </div>
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:16px;font-size:0.9rem;color:var(--text-2);white-space:pre-wrap;line-height:1.7;">${escHtml(project.notes)}</div>
        </div>` : ''}

      <!-- Active tasks -->
      <div class="dashboard-section">
        <div class="section-header">
          <h2 class="section-title">Active Tasks</h2>
          <span class="section-subtitle">${activeTasks.length} tasks</span>
        </div>
        <div id="detail-active-tasks" class="task-list">
          ${activeTasks.length
            ? activeTasks.map(t => Tasks.renderCompact(t, false)).join('')
            : '<div class="empty-mini">No active tasks — great work!</div>'
          }
        </div>
      </div>

      <!-- Done tasks (collapsible) -->
      ${doneTasks.length ? `
        <div class="dashboard-section">
          <div class="section-header">
            <h2 class="section-title" data-collapse-target="detail-done-tasks" style="cursor:pointer;">
              <span>Completed</span>
              <span style="font-size:0.8rem;color:var(--text-muted);margin-left:6px;">(${doneTasks.length})</span>
              <span style="font-size:0.75rem;color:var(--text-muted);margin-left:auto;">click to toggle</span>
            </h2>
          </div>
          <div id="detail-done-tasks" class="task-list" style="display:none">
            ${doneTasks.map(t => Tasks.renderCompact(t, false)).join('')}
          </div>
        </div>` : ''}
    `;

    // Bind add task button
    content.querySelector(`[data-add-task-project="${project.id}"]`)?.addEventListener('click', () => {
      populateProjectSelects();
      document.getElementById('qa-project').value = project.id;
      Modal.open('modal-quick-add');
    });

    Router.navigate('project-detail');
  }


  /* ══════════════════════════════════════════════
     PROJECT FORM (create / edit)
  ══════════════════════════════════════════════ */
  function openProjectForm(projectId = null) {
    editingProjectId = projectId;

    const modal = document.getElementById('modal-project-form');
    document.getElementById('project-form-title').textContent = projectId ? 'Edit Project' : 'New Project';

    if (projectId) {
      const p = Storage.getProject(projectId);
      if (!p) return;
      document.getElementById('pf-id').value          = p.id;
      document.getElementById('pf-name').value        = p.name;
      document.getElementById('pf-description').value = p.description || '';
      document.getElementById('pf-deadline').value    = p.deadline || '';
      document.getElementById('pf-notes').value       = p.notes || '';

      // Set active color swatch
      document.querySelectorAll('#pf-color-picker .color-swatch').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.color === p.color);
      });
    } else {
      document.getElementById('pf-id').value          = '';
      document.getElementById('pf-name').value        = '';
      document.getElementById('pf-description').value = '';
      document.getElementById('pf-deadline').value    = '';
      document.getElementById('pf-notes').value       = '';

      document.querySelectorAll('#pf-color-picker .color-swatch').forEach((sw, i) => {
        sw.classList.toggle('active', i === 0);
      });
    }

    Modal.open('modal-project-form');
  }

  function saveProjectForm() {
    const name = document.getElementById('pf-name').value.trim();
    if (!name) {
      document.getElementById('pf-name').focus();
      Toast.warning('Please enter a project name');
      return;
    }

    const selectedSwatch = document.querySelector('#pf-color-picker .color-swatch.active');
    const color = selectedSwatch ? selectedSwatch.dataset.color : '#698F80';
    const existingId = document.getElementById('pf-id').value;

    const project = createProject({
      id:          existingId || undefined,
      name,
      description: document.getElementById('pf-description').value.trim(),
      color,
      deadline:    document.getElementById('pf-deadline').value || null,
      notes:       document.getElementById('pf-notes').value.trim(),
    });

    if (existingId) {
      // Preserve existing fields not in form
      const existing = Storage.getProject(existingId);
      project.id = existingId;
      project.createdAt = existing?.createdAt || project.createdAt;
    }

    Storage.saveProject(project);
    Modal.close('modal-project-form');
    renderProjectsView();
    populateProjectSelects();
    Toast.success(existingId ? 'Project updated' : 'Project created!');
  }


  /* ══════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════ */
  function init() {
    // New project button
    document.getElementById('btn-new-project').addEventListener('click', () => openProjectForm());

    // Save project form
    document.getElementById('btn-save-project').addEventListener('click', saveProjectForm);

    // Color swatch selection
    document.getElementById('pf-color-picker').addEventListener('click', e => {
      const swatch = e.target.closest('.color-swatch');
      if (!swatch) return;
      document.querySelectorAll('#pf-color-picker .color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
    });

    // Event delegation for project card clicks + edit buttons
    document.addEventListener('click', e => {
      const editBtn = e.target.closest('[data-edit-project]');
      if (editBtn) {
        e.stopPropagation();
        openProjectForm(editBtn.dataset.editProject);
        return;
      }

      const card = e.target.closest('.project-card');
      if (card && card.dataset.projectId && !e.target.closest('button')) {
        renderProjectDetail(card.dataset.projectId);
      }
    });

    // Back button from project detail
    document.getElementById('btn-back-projects').addEventListener('click', () => {
      Router.navigate('projects');
    });
  }

  return {
    init,
    render: renderProjectsView,
    renderCard: renderProjectCard,
    renderDetail: renderProjectDetail,
    getStats: getProjectStats,
    openForm: openProjectForm,
  };

})();
