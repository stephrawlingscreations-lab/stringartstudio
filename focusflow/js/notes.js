/**
 * Notes — CRUD, rendering, search, pin management.
 */

const Notes = (() => {

  let currentNoteId = null;
  let searchQuery   = '';
  let filterProject = '';

  /* ══════════════════════════════════════════════
     FILTER
  ══════════════════════════════════════════════ */
  function filterNotes(notes) {
    return notes.filter(n => {
      if (filterProject && n.projectId !== filterProject) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (n.title || '').toLowerCase().includes(q) ||
          (n.content || '').toLowerCase().includes(q)
        );
      }
      return true;
    }).sort((a, b) => {
      // Pinned first, then newest first
      if (a.isPinned && !b.isPinned) return -1;
      if (b.isPinned && !a.isPinned) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }


  /* ══════════════════════════════════════════════
     RENDER — notes view
  ══════════════════════════════════════════════ */
  function renderNotesView() {
    const allNotes = filterNotes(Storage.getNotes());
    const pinned   = allNotes.filter(n => n.isPinned);
    const unpinned = allNotes.filter(n => !n.isPinned);

    // Pinned section
    const pinnedSection = document.getElementById('pinned-notes-section');
    const pinnedGrid    = document.getElementById('pinned-notes-grid');

    if (pinned.length) {
      pinnedSection.style.display = '';
      pinnedGrid.innerHTML = pinned.map(renderNoteCard).join('');
    } else {
      pinnedSection.style.display = 'none';
    }

    // All notes
    const notesGrid = document.getElementById('notes-grid');
    if (!unpinned.length && !pinned.length) {
      notesGrid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">📝</div>
          <div class="empty-state-title">No notes yet</div>
          <div class="empty-state-text">Capture anything — ideas, research, links, thoughts. Notes are for you.</div>
          <button class="btn btn-primary" onclick="Notes.openForm()">Write first note</button>
        </div>`;
    } else {
      notesGrid.innerHTML = unpinned.length
        ? unpinned.map(renderNoteCard).join('')
        : '<div class="empty-mini">No more notes</div>';
    }
  }

  function renderNoteCard(note) {
    const project = note.projectId ? Storage.getProject(note.projectId) : null;

    return `
      <div class="note-card" data-note-id="${note.id}">
        <div class="note-card-header">
          <div class="note-card-title">${note.title ? escHtml(note.title) : '<em style="color:var(--text-muted)">Untitled</em>'}</div>
          ${note.isPinned ? '<span class="note-card-pin">📌</span>' : ''}
        </div>
        ${note.content ? `<div class="note-card-content">${escHtml(note.content)}</div>` : ''}
        <div class="note-card-footer">
          <span class="note-card-date">${DateUtil.formatDisplay((note.updatedAt || note.createdAt)?.split('T')[0]) || ''}</span>
          ${project ? `<span class="project-badge" style="background:${project.color}22;color:${project.color};font-size:0.7rem;padding:1px 6px;">
            <span class="project-dot" style="background:${project.color}"></span>
            ${escHtml(project.name)}
          </span>` : ''}
        </div>
      </div>`;
  }


  /* ══════════════════════════════════════════════
     NOTE FORM (create / edit)
  ══════════════════════════════════════════════ */
  function openForm(noteId = null) {
    currentNoteId = noteId;
    document.getElementById('note-form-title').textContent = noteId ? 'Edit Note' : 'New Note';
    document.getElementById('btn-delete-note').style.display = noteId ? '' : 'none';

    populateProjectSelects();

    if (noteId) {
      const note = Storage.getNote(noteId);
      if (!note) return;
      document.getElementById('nf-id').value       = note.id;
      document.getElementById('nf-title').value    = note.title || '';
      document.getElementById('nf-content').value  = note.content || '';
      document.getElementById('nf-project').value  = note.projectId || '';
      document.getElementById('nf-pinned').checked = note.isPinned || false;
    } else {
      document.getElementById('nf-id').value       = '';
      document.getElementById('nf-title').value    = '';
      document.getElementById('nf-content').value  = '';
      document.getElementById('nf-project').value  = '';
      document.getElementById('nf-pinned').checked = false;
    }

    Modal.open('modal-note-form');
  }

  function saveNoteForm() {
    const existingId = document.getElementById('nf-id').value;
    const title   = document.getElementById('nf-title').value.trim();
    const content = document.getElementById('nf-content').value.trim();

    if (!title && !content) {
      Toast.warning('Please add a title or content');
      return;
    }

    const note = createNote({
      id:        existingId || undefined,
      title,
      content,
      projectId: document.getElementById('nf-project').value || null,
      isPinned:  document.getElementById('nf-pinned').checked,
    });

    if (existingId) {
      const existing = Storage.getNote(existingId);
      note.id = existingId;
      note.createdAt = existing?.createdAt || note.createdAt;
    }

    Storage.saveNote(note);
    Modal.close('modal-note-form');
    renderNotesView();
    Toast.success(existingId ? 'Note updated' : 'Note saved!');
  }

  async function deleteNote(noteId) {
    const ok = await confirmAction('Delete this note? This cannot be undone.');
    if (!ok) return;
    Storage.deleteNote(noteId);
    Modal.close('modal-note-form');
    renderNotesView();
    Toast.success('Note deleted');
  }


  /* ══════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════ */
  function init() {
    // New note
    document.getElementById('btn-new-note').addEventListener('click', () => openForm());

    // Save note
    document.getElementById('btn-save-note').addEventListener('click', saveNoteForm);

    // Delete note
    document.getElementById('btn-delete-note').addEventListener('click', () => {
      if (currentNoteId) deleteNote(currentNoteId);
    });

    // Search
    document.getElementById('notes-search').addEventListener('input', e => {
      searchQuery = e.target.value;
      renderNotesView();
    });

    // Filter by project
    document.getElementById('filter-notes-project').addEventListener('change', e => {
      filterProject = e.target.value;
      renderNotesView();
    });

    // Click on note card to edit
    document.addEventListener('click', e => {
      const card = e.target.closest('.note-card');
      if (card && card.dataset.noteId) {
        openForm(card.dataset.noteId);
      }
    });
  }

  return {
    init,
    render: renderNotesView,
    openForm,
  };

})();
