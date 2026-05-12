/**
 * UI — Toast notifications, modal management, theme, routing, navigation.
 */

/* ══════════════════════════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════════════════════════ */
const Toast = (() => {
  const container = () => document.getElementById('toast-container');

  function show(message, type = 'default', duration = 2800) {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;

    container().appendChild(el);

    setTimeout(() => {
      el.classList.add('toast-exit');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, duration);

    return el;
  }

  return {
    success: (msg, d) => show(msg, 'success', d),
    error:   (msg, d) => show(msg, 'error', d),
    warning: (msg, d) => show(msg, 'warning', d),
    info:    (msg, d) => show(msg, 'default', d),
  };
})();


/* ══════════════════════════════════════════════
   MODAL MANAGEMENT
══════════════════════════════════════════════ */
const Modal = (() => {
  let activeModals = [];

  function open(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('is-active');
    activeModals.push(id);
    document.body.style.overflow = 'hidden';

    // Auto-focus first input
    setTimeout(() => {
      const input = overlay.querySelector('input:not([type=hidden]):not([type=file]), textarea');
      if (input) input.focus();
    }, 100);
  }

  function close(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('is-active');
    activeModals = activeModals.filter(m => m !== id);
    if (activeModals.length === 0) document.body.style.overflow = '';
  }

  function closeAll() {
    document.querySelectorAll('.modal-overlay.is-active').forEach(m => {
      if (m.id !== 'modal-onboarding') m.classList.remove('is-active');
    });
    activeModals = [];
    document.body.style.overflow = '';
  }

  // Close on overlay click
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) {
      close(e.target.id);
    }
  });

  // Close on [data-close-modal] buttons
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-close-modal]');
    if (btn) close(btn.dataset.closeModal);
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && activeModals.length > 0) {
      close(activeModals[activeModals.length - 1]);
    }
  });

  return { open, close, closeAll, isOpen: (id) => activeModals.includes(id) };
})();


/* ══════════════════════════════════════════════
   THEME MANAGEMENT
══════════════════════════════════════════════ */
const Theme = (() => {
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    Storage.updateSetting('theme', theme);
  }

  function toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    apply(current === 'dark' ? 'light' : 'dark');
  }

  function init() {
    const settings = Storage.getSettings();
    let theme = settings.theme || 'light';

    // Respect system preference if not explicitly set
    if (theme === 'system' || !settings.theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    apply(theme);
  }

  return { apply, toggle, init };
})();


/* ══════════════════════════════════════════════
   ROUTER / VIEW MANAGEMENT
══════════════════════════════════════════════ */
const Router = (() => {
  let currentView = 'dashboard';
  let onNavigate = null;

  function navigate(view, params = {}) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('is-active'));

    // Show target view
    const target = document.getElementById(`view-${view}`);
    if (target) {
      target.classList.add('is-active');
      currentView = view;
    } else {
      // Fallback to dashboard
      document.getElementById('view-dashboard').classList.add('is-active');
      currentView = 'dashboard';
    }

    // Update sidebar nav
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.view === currentView);
    });

    // Update bottom nav
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === currentView);
    });

    // Scroll to top
    const scroll = target?.querySelector('.view-scroll');
    if (scroll) scroll.scrollTop = 0;

    if (onNavigate) onNavigate(view, params);
  }

  function getCurrent() { return currentView; }

  function setOnNavigate(fn) { onNavigate = fn; }

  function init() {
    // All nav links
    document.addEventListener('click', e => {
      const link = e.target.closest('[data-view]');
      if (!link) return;

      const view = link.dataset.view;
      if (!view) return;

      e.preventDefault();

      // Section link with filter
      if (link.dataset.filter) {
        navigate(view, { filter: link.dataset.filter });
      } else {
        navigate(view);
      }
    });
  }

  return { navigate, getCurrent, setOnNavigate, init };
})();


/* ══════════════════════════════════════════════
   ENERGY LEVEL MANAGEMENT
══════════════════════════════════════════════ */
const EnergyManager = (() => {
  let current = 'medium';
  let onChange = null;

  function set(level) {
    current = level;
    Storage.updateSetting('energyLevel', level);

    // Sync all energy pill groups
    document.querySelectorAll('.energy-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.energy === level);
    });

    if (onChange) onChange(level);
  }

  function get() { return current; }

  function setOnChange(fn) { onChange = fn; }

  function init() {
    const settings = Storage.getSettings();
    current = settings.energyLevel || 'medium';

    document.querySelectorAll('.energy-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.energy === current);
      pill.addEventListener('click', () => set(pill.dataset.energy));
    });
  }

  return { set, get, setOnChange, init };
})();


/* ══════════════════════════════════════════════
   BADGE / CHIP HELPERS — render pure HTML strings
══════════════════════════════════════════════ */
const Badges = {
  priority(p) {
    const labels = { high: '↑ High', medium: '– Med', low: '↓ Low' };
    return `<span class="badge badge-priority-${p}">${labels[p] || p}</span>`;
  },
  energy(e) {
    const labels = { low: '😴 Low', medium: '⚡ Some', high: '🔥 Focus' };
    return `<span class="badge badge-energy-${e}">${labels[e] || e}</span>`;
  },
  status(s) {
    const labels = { todo: 'To Do', doing: 'Doing', waiting: 'Waiting', done: 'Done' };
    const extra  = s !== 'todo' ? `badge-status-${s}` : '';
    return `<span class="badge badge-status ${extra}">${labels[s] || s}</span>`;
  },
  dueDate(dateStr) {
    if (!dateStr) return '';
    const overdue = DateUtil.isOverdue(dateStr);
    const today   = DateUtil.isToday(dateStr);
    if (overdue) return `<span class="badge badge-overdue">⚠ ${DateUtil.formatDisplay(dateStr)}</span>`;
    if (today)   return `<span class="badge badge-today">Today</span>`;
    return `<span class="badge badge-status">${DateUtil.formatDisplay(dateStr)}</span>`;
  },
  project(projectId) {
    if (!projectId) return '';
    const project = Storage.getProject(projectId);
    if (!project) return '';
    return `<span class="project-badge" style="background:${project.color}22; color:${project.color}">
      <span class="project-dot" style="background:${project.color}"></span>
      ${escHtml(project.name)}
    </span>`;
  }
};


/* ══════════════════════════════════════════════
   HTML ESCAPE
══════════════════════════════════════════════ */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


/* ══════════════════════════════════════════════
   PROJECT SELECT POPULATION
  (populates all <select> dropdowns with project options)
══════════════════════════════════════════════ */
function populateProjectSelects() {
  const projects = Storage.getProjects().filter(p => !p.isArchived);

  const selects = document.querySelectorAll(
    '#qa-project, #filter-project, #nf-project, #filter-notes-project'
  );

  selects.forEach(sel => {
    const isFilter = sel.id.startsWith('filter');
    const firstOpt = isFilter ? '<option value="">All projects</option>' : '<option value="">No project</option>';
    sel.innerHTML = firstOpt + projects
      .map(p => `<option value="${p.id}">${escHtml(p.name)}</option>`)
      .join('');
  });
}


/* ══════════════════════════════════════════════
   COLLAPSIBLE SECTIONS
══════════════════════════════════════════════ */
function initCollapsibles() {
  document.addEventListener('click', e => {
    const toggle = e.target.closest('[data-collapse-target]');
    if (!toggle) return;
    const target = document.getElementById(toggle.dataset.collapseTarget);
    if (target) {
      const isOpen = target.style.display !== 'none';
      target.style.display = isOpen ? 'none' : '';
      toggle.classList.toggle('collapsed', isOpen);
    }
  });
}


/* ══════════════════════════════════════════════
   CONFIRM DIALOG (inline — no browser dialogs)
══════════════════════════════════════════════ */
function confirmAction(message) {
  return new Promise(resolve => {
    const div = document.createElement('div');
    div.className = 'modal-overlay is-active';
    div.innerHTML = `
      <div class="modal" style="max-width:360px">
        <div class="modal-body" style="padding:2rem">
          <p style="font-size:1rem;color:var(--text);margin-bottom:1.5rem;text-align:center;">${escHtml(message)}</p>
          <div style="display:flex;gap:12px;justify-content:center;">
            <button class="btn btn-ghost" id="confirm-no">Cancel</button>
            <button class="btn btn-danger" id="confirm-yes">Delete</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(div);
    document.body.style.overflow = 'hidden';

    div.querySelector('#confirm-yes').addEventListener('click', () => {
      div.remove();
      document.body.style.overflow = '';
      resolve(true);
    });
    div.querySelector('#confirm-no').addEventListener('click', () => {
      div.remove();
      document.body.style.overflow = '';
      resolve(false);
    });
    div.addEventListener('click', e => {
      if (e.target === div) {
        div.remove();
        document.body.style.overflow = '';
        resolve(false);
      }
    });
  });
}
