/**
 * Data — schemas, factory functions, helpers, and demo seed data.
 */

/* ── UUID generator ── */
function uuid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* ── Date helpers ── */
const DateUtil = {
  today() {
    return new Date().toISOString().split('T')[0];
  },
  addDays(dateStr, n) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  },
  isToday(dateStr) {
    return dateStr === this.today();
  },
  isOverdue(dateStr) {
    if (!dateStr) return false;
    return dateStr < this.today();
  },
  isPast(dateStr) {
    return dateStr && dateStr <= this.today();
  },
  formatDisplay(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const toDay = d => d.toISOString().split('T')[0];
    if (dateStr === toDay(today))     return 'Today';
    if (dateStr === toDay(tomorrow))  return 'Tomorrow';
    if (dateStr === toDay(yesterday)) return 'Yesterday';

    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  },
  formatFull(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  },
  formatDatetime(isoStr) {
    if (!isoStr) return '';
    return new Date(isoStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  },
  weekStart(offset = 0) {
    const d = new Date();
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day); // Monday-first
    d.setDate(d.getDate() + diff + (offset * 7));
    return d.toISOString().split('T')[0];
  },
  weekDays(offset = 0) {
    const start = this.weekStart(offset);
    return Array.from({ length: 7 }, (_, i) => this.addDays(start, i));
  },
  dayName(dateStr) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' });
  },
  dayNameShort(dateStr) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
  }
};

/* ── Task factory ── */
function createTask(overrides = {}) {
  return {
    id:            uuid(),
    title:         '',
    notes:         '',
    status:        'todo',          // todo | doing | waiting | done
    priority:      'medium',        // high | medium | low
    energy:        'medium',        // low | medium | high
    projectId:     null,
    dueDate:       null,
    dayPlanned:    null,            // ISO date — which day this is on in planner
    tags:          [],
    subtasks:      [],              // [{id, title, done}]
    estimatedMins: null,
    isArchived:    false,
    recurringType: null,        // null | 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'yearly'
    reminderDate:  null,        // ISO date — creates a linked reminder entry
    completedAt:   null,
    createdAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
    ...overrides
  };
}

/* ── Project factory ── */
function createProject(overrides = {}) {
  return {
    id:          uuid(),
    name:        '',
    description: '',
    color:       '#698F80',
    notes:       '',
    deadline:    null,
    parentId:    null,
    quickLinks:  [],
    isArchived:  false,
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
    ...overrides
  };
}

/* ── Note factory ── */
function createNote(overrides = {}) {
  return {
    id:        uuid(),
    title:     '',
    content:   '',
    projectId: null,
    isPinned:  false,
    tags:      [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

/* ── Brain dump factory ── */
function createBrainDump(content) {
  return {
    id:          uuid(),
    content:     content.trim(),
    isConverted: false,
    createdAt:   new Date().toISOString()
  };
}

/* ── Subtask factory ── */
function createSubtask(title) {
  return { id: uuid(), title: title.trim(), done: false };
}


/* ══════════════════════════════════════════════
   DEMO DATA — Loads only on first run
══════════════════════════════════════════════ */
function seedDemoData() {
  const today = DateUtil.today();
  const d = DateUtil.addDays;

  /* Projects */
  const projects = [
    createProject({ id: 'p-string',  name: 'String Art Business', description: 'Running and growing the string art side business', color: '#D4895F' }),
    createProject({ id: 'p-web',     name: 'Website / Development', description: 'Building and maintaining the website', color: '#7BA8C8' }),
    createProject({ id: 'p-legal',   name: 'Legal / Research',     description: 'Research tasks, legal documents, admin', color: '#8B8FA8' }),
    createProject({ id: 'p-health',  name: 'Health / Admin',        description: 'Health appointments, self-care, admin tasks', color: '#71A882' }),
    createProject({ id: 'p-home',    name: 'Home Tasks',            description: 'House maintenance, errands, household jobs', color: '#D4895F' }),
    createProject({ id: 'p-ideas',   name: 'Ideas & Inspiration',   description: 'Things to explore, future plans, brainstorms', color: '#F2C05A' }),
    createProject({ id: 'p-orders',  name: 'Orders / Customers',    description: 'Customer orders, messages, fulfilment', color: '#698F80' }),
  ];

  /* Tasks */
  const tasks = [
    // String Art
    createTask({ id: 't1', title: 'Photograph new commission pieces', projectId: 'p-string', priority: 'high', energy: 'medium', dueDate: today, status: 'todo', tags: ['photography'] }),
    createTask({ id: 't2', title: 'Update Etsy shop listings', projectId: 'p-string', priority: 'medium', energy: 'medium', dueDate: d(today, 2), status: 'todo', notes: 'Add the two new custom pieces, update pricing' }),
    createTask({ id: 't3', title: 'Reply to Instagram DM about custom order', projectId: 'p-orders', priority: 'high', energy: 'low', dueDate: today, status: 'doing', notes: 'Message from @crafts_uk' }),
    createTask({ id: 't4', title: 'Buy more nails and string (cream + gold)', projectId: 'p-string', priority: 'low', energy: 'low', status: 'todo', tags: ['shopping'] }),
    createTask({ id: 't5', title: 'Design new geometric pattern for autumn range', projectId: 'p-string', priority: 'medium', energy: 'high', status: 'todo', dueDate: d(today, 7) }),

    // Website
    createTask({ id: 't6', title: 'Fix mobile navigation spacing issue', projectId: 'p-web', priority: 'high', energy: 'high', status: 'doing', dueDate: today }),
    createTask({ id: 't7', title: 'Write About Me page copy', projectId: 'p-web', priority: 'medium', energy: 'medium', status: 'todo', dueDate: d(today, 5) }),
    createTask({ id: 't8', title: 'Add gallery section to homepage', projectId: 'p-web', priority: 'low', energy: 'high', status: 'todo' }),

    // Legal / Research
    createTask({ id: 't9',  title: 'Research sole trader tax obligations', projectId: 'p-legal', priority: 'high', energy: 'high', dueDate: d(today, -2), status: 'todo', notes: 'Check HMRC self-assessment deadlines' }),
    createTask({ id: 't10', title: 'Email accountant about expenses', projectId: 'p-legal', priority: 'medium', energy: 'low', status: 'waiting', notes: 'Waiting to hear back' }),

    // Health / Admin
    createTask({ id: 't11', title: 'GP appointment — medication review', projectId: 'p-health', priority: 'high', energy: 'low', dueDate: d(today, 3), status: 'todo' }),
    createTask({ id: 't12', title: 'Order repeat prescription', projectId: 'p-health', priority: 'high', energy: 'low', dueDate: today, status: 'todo' }),
    createTask({ id: 't13', title: '10 min gentle stretch (rest day)', projectId: 'p-health', priority: 'low', energy: 'low', status: 'todo', tags: ['self-care'] }),

    // Home
    createTask({ id: 't14', title: 'Book boiler service', projectId: 'p-home', priority: 'medium', energy: 'low', status: 'todo', dueDate: d(today, 10) }),
    createTask({ id: 't15', title: 'Tidy craft workspace', projectId: 'p-home', priority: 'low', energy: 'medium', status: 'todo' }),

    // Orders
    createTask({ id: 't16', title: 'Pack and post Order #1042', projectId: 'p-orders', priority: 'high', energy: 'medium', dueDate: today, status: 'todo',
      subtasks: [createSubtask('Wrap in tissue paper'), createSubtask('Add thank you card'), createSubtask('Print postage label')] }),
    createTask({ id: 't17', title: 'Check PayPal payment cleared for Order #1041', projectId: 'p-orders', priority: 'medium', energy: 'low', status: 'waiting' }),

    // Done examples
    createTask({ id: 't18', title: 'Set up business Instagram account', projectId: 'p-string', priority: 'medium', energy: 'medium', status: 'done', completedAt: new Date().toISOString() }),
    createTask({ id: 't19', title: 'Create price list spreadsheet', projectId: 'p-string', priority: 'low', energy: 'medium', status: 'done', completedAt: new Date().toISOString() }),
  ];

  /* Notes */
  const notes = [
    createNote({ id: 'n1', title: 'Business pricing notes', content: 'Small (30×30cm): £45\nMedium (50×50cm): £75\nLarge (70×70cm): £120\nCustom commissions: quote individually\n\nRemember to factor in materials cost (approx £8–15 per piece) and at least 3 hours labour.', projectId: 'p-string', isPinned: true }),
    createNote({ id: 'n2', title: 'Website pages to build', content: '- Home (hero, gallery, about snippet, contact CTA)\n- Gallery / Shop\n- About Me\n- Contact\n- FAQ\n- Custom Orders flow\n\nKeep it simple and visual. Less text, more pictures.', projectId: 'p-web' }),
    createNote({ id: 'n3', title: 'Low energy day ideas', content: 'Things I can do when feeling rough:\n• Reply to emails\n• Browse for inspiration on Pinterest\n• Do admin (invoices, receipts)\n• Write down ideas in Brain Dump\n• Watch a craft tutorial\n• Post something simple on Instagram\n• Package an order\n• Order supplies online', isPinned: true }),
    createNote({ id: 'n4', title: 'Ideas for new patterns', content: '- Floral mandalas (popular for gifts)\n- Map outlines (city shapes look great)\n- Zodiac signs\n- Custom name art in string\n- Minimalist geometric shapes\n- Animal silhouettes (particularly dogs/cats)', projectId: 'p-ideas' }),
    createNote({ id: 'n5', title: 'Useful supplier links', content: 'Nails: Hobbycraft, Amazon (5000 pack)\nString: DMC embroidery thread — good colour range\nBoards: B&Q MDF sheets cut to size\nFrames: IKEA RIBBA range fits well\n\nBulk discount tip: buy 10+ boards at a time from local timber yard.', projectId: 'p-string' }),
  ];

  /* Brain dumps */
  const braindumps = [
    createBrainDump('Need to look into selling at local craft fairs — could be good for visibility'),
    createBrainDump('Would be amazing to do a video timelapse of a commission being made start to finish'),
    createBrainDump('Consider doing a "process" reel for Instagram — behind the scenes content always does well'),
  ];

  /* Save everything */
  projects.forEach(p => Storage.saveProject(p));
  tasks.forEach(t => Storage.saveTask(t));
  notes.forEach(n => Storage.saveNote(n));
  braindumps.forEach(b => Storage.saveBrainDump(b));
}

function seedProjects() {
  [
    createProject({ id: 'p-string',  name: 'String Art Business',  description: 'Running and growing the string art side business', color: '#D4895F' }),
    createProject({ id: 'p-web',     name: 'Website / Development', description: 'Building and maintaining the website',             color: '#7BA8C8' }),
    createProject({ id: 'p-legal',   name: 'Legal / Research',      description: 'Research tasks, legal documents, admin',           color: '#8B8FA8' }),
    createProject({ id: 'p-health',  name: 'Health / Admin',         description: 'Health appointments, self-care, admin tasks',     color: '#71A882' }),
    createProject({ id: 'p-home',    name: 'Home Tasks',             description: 'House maintenance, errands, household jobs',      color: '#D4895F' }),
    createProject({ id: 'p-ideas',   name: 'Ideas & Inspiration',    description: 'Things to explore, future plans, brainstorms',   color: '#F2C05A' }),
    createProject({ id: 'p-orders',  name: 'Orders / Customers',     description: 'Customer orders, messages, fulfilment',          color: '#698F80' }),
  ].forEach(p => Storage.saveProject(p));
}
