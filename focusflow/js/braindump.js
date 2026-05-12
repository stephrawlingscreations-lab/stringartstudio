/**
 * BrainDump — frictionless thought capture, convert to task.
 */

const BrainDump = (() => {

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
  function render() {
    const list  = document.getElementById('braindump-list');
    const items = Storage.getBrainDumps();

    if (!items.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💭</div>
          <div class="empty-state-title">Your mind is clear</div>
          <div class="empty-state-text">Use the box above to get any thought out of your head — no judgement, no structure needed.</div>
        </div>`;
      return;
    }

    list.innerHTML = items.map(item => `
      <div class="braindump-item ${item.isConverted ? 'is-converted' : ''}" data-dump-id="${item.id}">
        <div class="braindump-item-content">${escHtml(item.content)}</div>
        <div class="braindump-item-footer">
          <span class="braindump-item-date">
            ${DateUtil.formatDatetime(item.createdAt)}
            ${item.isConverted ? ' · <em>converted to task</em>' : ''}
          </span>
          <div class="braindump-item-actions">
            ${!item.isConverted ? `
              <button class="btn btn-ghost btn-sm" data-convert-dump="${item.id}" title="Convert to task">
                → Task
              </button>` : ''}
            <button class="btn-icon btn-danger-icon" data-delete-dump="${item.id}" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>`).join('');
  }


  /* ══════════════════════════════════════════════
     SAVE
  ══════════════════════════════════════════════ */
  function save() {
    const input = document.getElementById('braindump-input');
    const text  = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }

    Storage.saveBrainDump(createBrainDump(text));
    input.value = '';
    input.focus();
    render();
    Toast.success('Thought captured!');
  }


  /* ══════════════════════════════════════════════
     CONVERT TO TASK
  ══════════════════════════════════════════════ */
  function convertToTask(dumpId) {
    const item = Storage.getBrainDumps().find(d => d.id === dumpId);
    if (!item) return;

    // Pre-fill quick add with the brain dump content
    populateProjectSelects();
    const titleInput = document.getElementById('qa-title');
    const notesInput = document.getElementById('qa-notes');

    // Use first line as title, rest as notes
    const lines = item.content.split('\n').filter(Boolean);
    titleInput.value = lines[0] || item.content;
    notesInput.value = lines.slice(1).join('\n').trim();

    Modal.open('modal-quick-add');

    // After the modal saves, mark brain dump as converted
    const origSave = document.getElementById('btn-qa-save');
    const handleSave = () => {
      item.isConverted = true;
      Storage.saveBrainDump(item);
      render();
      origSave.removeEventListener('click', handleSave);
    };
    origSave.addEventListener('click', handleSave, { once: true });
  }


  /* ══════════════════════════════════════════════
     CLEAR CONVERTED
  ══════════════════════════════════════════════ */
  function clearConverted() {
    const items = Storage.getBrainDumps().filter(d => d.isConverted);
    items.forEach(d => Storage.deleteBrainDump(d.id));
    render();
    if (items.length) Toast.info(`Cleared ${items.length} converted thought${items.length > 1 ? 's' : ''}`);
  }


  /* ══════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════ */
  function init() {
    const input   = document.getElementById('braindump-input');
    const saveBtn = document.getElementById('btn-braindump-save');
    const clearBtn = document.getElementById('btn-clear-converted');

    saveBtn.addEventListener('click', save);
    clearBtn.addEventListener('click', clearConverted);

    // Double-enter to save
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // Allow single enter for new line, double-enter saves
        // We check if last char was already a newline
        const val = input.value;
        if (val.endsWith('\n') || e.ctrlKey || e.metaKey) {
          e.preventDefault();
          save();
        }
      }
    });

    // Event delegation for convert + delete
    document.addEventListener('click', e => {
      const convertBtn = e.target.closest('[data-convert-dump]');
      const deleteBtn  = e.target.closest('[data-delete-dump]');

      if (convertBtn) {
        convertToTask(convertBtn.dataset.convertDump);
        return;
      }

      if (deleteBtn) {
        Storage.deleteBrainDump(deleteBtn.dataset.deleteDump);
        render();
        Toast.info('Thought removed');
      }
    });
  }

  return { init, render };

})();
