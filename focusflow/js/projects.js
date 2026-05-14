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
    const all  = Storage.getProjects().filter(p => !p.isArchived);

    if (!all.length) {
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

    const topLevel  = all.filter(p => !p.parentId);
    const subs      = all.filter(p =>  p.parentId);
    const parentIds = new Set(topLevel.map(p => p.id));

    // orphaned sub-projects whose parent was deleted → treat as top-level
    subs.filter(s => !parentIds.has(s.parentId)).forEach(s => topLevel.push(s));

    grid.innerHTML = topLevel.map(project => {
      const children = subs.filter(c => c.parentId === project.id);
      if (children.length) {
        return `
          <div class="project-parent-group">
            ${renderProjectCard(project, children.length)}
            <div class="project-children-row">
              ${children.map(renderChildCard).join('')}
              <button class="project-add-child-btn" data-add-child="${project.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add sub-project
              </button>
            </div>
          </div>`;
      }
      return renderProjectCard(project);
    }).join('');
  }

  function renderProjectCard(project, childCount = 0) {
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
          <span class="project-card-stat" style="font-weight:600;color:${project.color}">${stats.progress}%</span>
          ${childCount ? `<span class="badge badge-status">📁 ${childCount} sub-${childCount === 1 ? 'project' : 'projects'}</span>` : ''}
          ${stats.overdue > 0 ? `<span class="badge badge-overdue">${stats.overdue} overdue</span>` : ''}
          ${deadlineHtml}
        </div>
      </div>`;
  }

  function renderChildCard(project) {
    const stats = getProjectStats(project.id);
    return `
      <div class="project-child-card" data-project-id="${project.id}" style="border-top:3px solid ${project.color}">
        <div class="project-child-name">${escHtml(project.name)}</div>
        ${project.description ? `<div class="project-child-desc">${escHtml(project.description)}</div>` : ''}
        <div class="progress-bar-wrap" style="height:4px;">
          <div class="progress-bar-fill" style="width:${stats.progress}%;background:${project.color}"></div>
        </div>
        <div class="project-child-meta">
          <span>${stats.done}/${stats.total} tasks</span>
          ${stats.overdue > 0 ? `<span class="badge badge-overdue">${stats.overdue} overdue</span>` : ''}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:4px;">
          <button class="btn-icon" data-edit-project="${project.id}" title="Edit" style="width:24px;height:24px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
      </div>`;
  }


  /* ══════════════════════════════════════════════
     RENDER — Project Detail view
  ══════════════════════════════════════════════ */
  function renderProjectDetail(projectId) {
    const project = Storage.getProject(projectId);
    if (!project) return;

    const parent   = project.parentId ? Storage.getProject(project.parentId) : null;
    const children = Storage.getProjects().filter(p => !p.isArchived && p.parentId === projectId);
    const stats    = getProjectStats(projectId);
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
      ${parent ? `
        <div class="project-breadcrumb">
          <button data-project-detail="${parent.id}">${escHtml(parent.name)}</button>
          <span>›</span>
          <span>${escHtml(project.name)}</span>
        </div>` : ''}

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

      <!-- Sub-projects (if this is a parent) -->
      ${children.length ? `
        <div class="dashboard-section">
          <div class="section-header">
            <h2 class="section-title">Sub-projects</h2>
            <button class="btn btn-ghost btn-sm" data-add-child="${projectId}">+ Add sub-project</button>
          </div>
          <div class="project-children-row" style="border:none;border-radius:0;background:none;padding:0;margin-bottom:var(--sp-4);">
            ${children.map(renderChildCard).join('')}
          </div>
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
  function openProjectForm(projectId = null, defaultParentId = null) {
    editingProjectId = projectId;

    document.getElementById('project-form-title').textContent = projectId ? 'Edit Project' : 'New Project';

    // Populate parent select — only top-level projects, excluding self
    const parentSel = document.getElementById('pf-parent');
    const topLevel  = Storage.getProjects().filter(p => !p.isArchived && !p.parentId && p.id !== projectId);
    parentSel.innerHTML = '<option value="">None — top-level project</option>' +
      topLevel.map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`).join('');

    if (projectId) {
      const p = Storage.getProject(projectId);
      if (!p) return;
      document.getElementById('pf-id').value          = p.id;
      document.getElementById('pf-name').value        = p.name;
      document.getElementById('pf-description').value = p.description || '';
      document.getElementById('pf-deadline').value    = p.deadline || '';
      document.getElementById('pf-notes').value       = p.notes || '';
      parentSel.value = p.parentId || '';

      document.querySelectorAll('#pf-color-picker .color-swatch').forEach(sw => {
        sw.classList.toggle('active', sw.dataset.color === p.color);
      });
    } else {
      document.getElementById('pf-id').value          = '';
      document.getElementById('pf-name').value        = '';
      document.getElementById('pf-description').value = '';
      document.getElementById('pf-deadline').value    = '';
      document.getElementById('pf-notes').value       = '';
      parentSel.value = defaultParentId || '';

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
      name,
      description: document.getElementById('pf-description').value.trim(),
      color,
      deadline:    document.getElementById('pf-deadline').value || null,
      notes:       document.getElementById('pf-notes').value.trim(),
    });

    project.parentId = document.getElementById('pf-parent').value || null;

    if (existingId) {
      const existing = Storage.getProject(existingId);
      project.id        = existingId;
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
      // Edit button
      const editBtn = e.target.closest('[data-edit-project]');
      if (editBtn) {
        e.stopPropagation();
        openProjectForm(editBtn.dataset.editProject);
        return;
      }

      // Add sub-project button
      const addChildBtn = e.target.closest('[data-add-child]');
      if (addChildBtn) {
        e.stopPropagation();
        openProjectForm(null, addChildBtn.dataset.addChild);
        return;
      }

      // Breadcrumb → parent detail
      const detailBtn = e.target.closest('[data-project-detail]');
      if (detailBtn) {
        renderProjectDetail(detailBtn.dataset.projectDetail);
        return;
      }

      // Click on child card or parent card → detail
      const card = e.target.closest('.project-card, .project-child-card');
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
