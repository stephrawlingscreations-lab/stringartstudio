/**
 * Storage — abstraction layer over localStorage.
 * Structured so every method can be swapped for a Firebase/API call
 * without changing any calling code. Each collection maps to a key.
 *
 * Future Firebase swap: replace get/set methods with Firestore reads/writes.
 */

const Storage = (() => {

  /* ── Namespace prefix to avoid clashes ── */
  const NS = 'focusflow_';

  /* ── Low-level helpers ── */
  function raw_get(key) {
    try {
      const val = localStorage.getItem(NS + key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  }

  function raw_set(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage write failed:', e);
      return false;
    }
  }

  function raw_del(key) {
    localStorage.removeItem(NS + key);
  }

  /* ── Collection helpers ── */
  // Each "collection" is stored as a plain object keyed by id.

  function getCollection(name) {
    return raw_get(name) || {};
  }

  function setCollection(name, data) {
    return raw_set(name, data);
  }

  /* ── Public API ── */

  return {

    /* ── Tasks ── */
    getTasks() {
      return Object.values(getCollection('tasks'));
    },
    getTask(id) {
      return getCollection('tasks')[id] || null;
    },
    saveTask(task) {
      const col = getCollection('tasks');
      col[task.id] = { ...task, updatedAt: new Date().toISOString() };
      return setCollection('tasks', col);
    },
    deleteTask(id) {
      const col = getCollection('tasks');
      delete col[id];
      return setCollection('tasks', col);
    },

    /* ── Projects ── */
    getProjects() {
      return Object.values(getCollection('projects'));
    },
    getProject(id) {
      return getCollection('projects')[id] || null;
    },
    saveProject(project) {
      const col = getCollection('projects');
      col[project.id] = { ...project, updatedAt: new Date().toISOString() };
      return setCollection('projects', col);
    },
    deleteProject(id) {
      const col = getCollection('projects');
      delete col[id];
      return setCollection('projects', col);
    },

    /* ── Notes ── */
    getNotes() {
      return Object.values(getCollection('notes'));
    },
    getNote(id) {
      return getCollection('notes')[id] || null;
    },
    saveNote(note) {
      const col = getCollection('notes');
      col[note.id] = { ...note, updatedAt: new Date().toISOString() };
      return setCollection('notes', col);
    },
    deleteNote(id) {
      const col = getCollection('notes');
      delete col[id];
      return setCollection('notes', col);
    },

    /* ── Reminders ── */
    getReminders() {
      return Object.values(getCollection('reminders'))
        .sort((a, b) => {
          if (!a.date && !b.date) return new Date(a.createdAt) - new Date(b.createdAt);
          if (!a.date) return 1;
          if (!b.date) return -1;
          return a.date.localeCompare(b.date);
        });
    },
    getReminder(id) {
      return getCollection('reminders')[id] || null;
    },
    saveReminder(reminder) {
      const col = getCollection('reminders');
      col[reminder.id] = reminder;
      return setCollection('reminders', col);
    },
    deleteReminder(id) {
      const col = getCollection('reminders');
      delete col[id];
      return setCollection('reminders', col);
    },

    /* ── Brain Dump ── */
    getBrainDumps() {
      return Object.values(getCollection('braindumps'))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    saveBrainDump(item) {
      const col = getCollection('braindumps');
      col[item.id] = item;
      return setCollection('braindumps', col);
    },
    deleteBrainDump(id) {
      const col = getCollection('braindumps');
      delete col[id];
      return setCollection('braindumps', col);
    },

    /* ── App Settings ── */
    getSettings() {
      return raw_get('settings') || {
        theme: 'light',
        energyLevel: 'medium',
        userName: '',
        onboardingComplete: false,
        weekOffset: 0,
        completedStreak: 0,
        lastActiveDate: null
      };
    },
    saveSettings(settings) {
      return raw_set('settings', settings);
    },
    updateSetting(key, value) {
      const s = this.getSettings();
      s[key] = value;
      return this.saveSettings(s);
    },

    /* ── Data management ── */
    exportAll() {
      return {
        tasks:      getCollection('tasks'),
        projects:   getCollection('projects'),
        notes:      getCollection('notes'),
        braindumps: getCollection('braindumps'),
        reminders:  getCollection('reminders'),
        settings:   raw_get('settings') || {},
        exportedAt: new Date().toISOString(),
        version:    '1.1'
      };
    },
    importAll(data) {
      if (!data || !data.version) throw new Error('Invalid backup file');
      if (data.tasks)      setCollection('tasks', data.tasks);
      if (data.projects)   setCollection('projects', data.projects);
      if (data.notes)      setCollection('notes', data.notes);
      if (data.braindumps) setCollection('braindumps', data.braindumps);
      if (data.reminders)  setCollection('reminders', data.reminders);
      if (data.settings)   raw_set('settings', data.settings);
    },
    clearAll() {
      ['tasks', 'projects', 'notes', 'braindumps', 'reminders', 'settings'].forEach(k => raw_del(k));
    },
    isFirstRun() {
      return !raw_get('settings');
    }
  };

})();
