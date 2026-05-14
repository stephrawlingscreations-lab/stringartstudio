/**
 * Storage — localStorage cache + Firebase Realtime Database sync.
 * Every write goes to localStorage first (instant), then syncs to
 * Firebase in the background so data is the same on all devices.
 *
 * Call Storage.setFirebase(db, uid) after sign-in, then
 * Storage.pullFromFirebase() to hydrate from the cloud before rendering.
 */

const Storage = (() => {

  const NS = 'focusflow_';
  const COLS = ['tasks', 'projects', 'notes', 'braindumps', 'reminders'];

  let _db  = null;   // firebase.database() instance
  let _uid = null;   // signed-in user's UID

  /* ── Low-level localStorage helpers ── */
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
      fbPush(key, value);
      return true;
    } catch (e) {
      console.error('Storage write failed:', e);
      return false;
    }
  }

  function raw_del(key) {
    localStorage.removeItem(NS + key);
  }

  /* ── Firebase push (background, never blocks UI) ── */
  function fbPush(key, value) {
    if (_db && _uid) {
      _db.ref(`focusflow/${_uid}/${key}`).set(value)
        .catch(e => console.warn('Firebase sync failed:', e));
    }
  }

  /* ── Per-item Firebase writes (prevents race conditions on collections) ── */
  function fbPushItem(col, id, value) {
    if (_db && _uid) {
      _db.ref(`focusflow/${_uid}/${col}/${id}`).set(value)
        .catch(e => console.warn('Firebase sync failed:', e));
    }
  }

  function fbDeleteItem(col, id) {
    if (_db && _uid) {
      _db.ref(`focusflow/${_uid}/${col}/${id}`).remove()
        .catch(e => console.warn('Firebase sync failed:', e));
    }
  }

  function saveItem(colName, id, item) {
    const col = getCollection(colName);
    col[id] = item;
    try {
      localStorage.setItem(NS + colName, JSON.stringify(col));
      fbPushItem(colName, id, item);
      return true;
    } catch (e) {
      console.error('Storage write failed:', e);
      return false;
    }
  }

  function deleteItem(colName, id) {
    const col = getCollection(colName);
    delete col[id];
    try {
      localStorage.setItem(NS + colName, JSON.stringify(col));
      fbDeleteItem(colName, id);
      return true;
    } catch (e) {
      console.error('Storage delete failed:', e);
      return false;
    }
  }

  /* ── Collection helpers ── */
  function getCollection(name) {
    return raw_get(name) || {};
  }

  function setCollection(name, data) {
    return raw_set(name, data);
  }

  /* ── Public API ── */
  return {

    /* ── Firebase sync ── */
    setFirebase(db, uid) {
      _db  = db;
      _uid = uid;
    },

    pullFromFirebase() {
      if (!_db || !_uid) return Promise.resolve();
      return _db.ref(`focusflow/${_uid}`).once('value').then(snapshot => {
        const data = snapshot.val();
        if (!data) return;
        COLS.forEach(key => {
          if (data[key]) localStorage.setItem(NS + key, JSON.stringify(data[key]));
        });
        if (data.settings) localStorage.setItem(NS + 'settings', JSON.stringify(data.settings));
      });
    },

    /* ── Tasks ── */
    getTasks() {
      return Object.values(getCollection('tasks'));
    },
    getTask(id) {
      return getCollection('tasks')[id] || null;
    },
    saveTask(task) {
      const item = { ...task, updatedAt: new Date().toISOString() };
      return saveItem('tasks', task.id, item);
    },
    deleteTask(id) {
      return deleteItem('tasks', id);
    },

    /* ── Projects ── */
    getProjects() {
      return Object.values(getCollection('projects'));
    },
    getProject(id) {
      return getCollection('projects')[id] || null;
    },
    saveProject(project) {
      const item = { ...project, updatedAt: new Date().toISOString() };
      return saveItem('projects', project.id, item);
    },
    deleteProject(id) {
      return deleteItem('projects', id);
    },

    /* ── Notes ── */
    getNotes() {
      return Object.values(getCollection('notes'));
    },
    getNote(id) {
      return getCollection('notes')[id] || null;
    },
    saveNote(note) {
      const item = { ...note, updatedAt: new Date().toISOString() };
      return saveItem('notes', note.id, item);
    },
    deleteNote(id) {
      return deleteItem('notes', id);
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
      return saveItem('reminders', reminder.id, reminder);
    },
    deleteReminder(id) {
      return deleteItem('reminders', id);
    },

    /* ── Brain Dump ── */
    getBrainDumps() {
      return Object.values(getCollection('braindumps'))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },
    saveBrainDump(item) {
      return saveItem('braindumps', item.id, item);
    },
    deleteBrainDump(id) {
      return deleteItem('braindumps', id);
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
      [...COLS, 'settings'].forEach(k => raw_del(k));
      if (_db && _uid) {
        return _db.ref(`focusflow/${_uid}`).remove()
          .catch(e => console.warn('Firebase clear failed:', e));
      }
      return Promise.resolve();
    },
    isFirstRun() {
      return !raw_get('settings');
    }
  };

})();
