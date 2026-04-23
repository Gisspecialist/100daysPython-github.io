const STORAGE_KEY = 'coding-notebook-sheets-v3';
const SETTINGS_KEY = 'coding-notebook-settings-v3';
const CODE_LINE_COUNT = 18;

const defaultEntry = (day = '1', sheetNumber = 1) => ({
  id: crypto.randomUUID(),
  concept: '',
  day: String(day || '1'),
  sheetNumber,
  filename: '',
  lines: Array.from({ length: CODE_LINE_COUNT }, () => ''),
  comments: '',
  summary: '',
  lecture: '',
  theme: 'green',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

let state = {
  entries: [],
  currentId: null,
  selectedDay: '1',
  autosave: true,
  pyodide: null
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  buildCodeGrid();
  loadState();
  bindEvents();
  ensureEntry();
  renderDaySelect();
  renderList();
  renderCurrent();
  initPyodideRuntime();
});

function cacheElements() {
  [
    'sheetList','searchInput','newEntryBtn','saveEntryBtn','deleteEntryBtn','exportBtn','importInput',
    'downloadCurrentBtn','duplicateBtn','loadLinesBtn','runCodeBtn','clearInputBtn','clearOutputBtn','runtimeStatus',
    'runnerCode','runnerOutput','themeSelect','autosaveToggle','saveStatus','sheet','conceptInput',
    'dayInput','filenameInput','commentsInput','summaryInput','lectureInput','codeGrid','prevSheetBtn',
    'nextSheetBtn','sheetNavigatorStatus','daySelect','addDayBtn','goToDayBtn'
  ].forEach(id => els[id] = document.getElementById(id));
}

function buildCodeGrid() {
  els.codeGrid.innerHTML = '';
  for (let i = 0; i < CODE_LINE_COUNT; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'code-line-wrap';

    const num = document.createElement('span');
    num.className = 'line-number';
    num.textContent = String(i + 1).padStart(2, '0');

    const input = document.createElement('input');
    input.className = 'line-input';
    input.dataset.index = i;
    input.placeholder = 'Enter code...';
    input.setAttribute('aria-label', `Code line ${String(i + 1).padStart(2, '0')}`);

    wrap.appendChild(num);
    wrap.appendChild(input);
    els.codeGrid.appendChild(wrap);
  }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const saved = raw ? JSON.parse(raw) : [];
  state.entries = Array.isArray(saved) ? saved.map(normalizeEntry) : [];
  const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  state.autosave = settings.autosave !== false;
  state.selectedDay = settings.selectedDay || '1';
  els.autosaveToggle.checked = state.autosave;
}

function normalizeEntry(item) {
  const base = defaultEntry(item.day || '1', item.sheetNumber || 1);
  return {
    ...base,
    ...item,
    id: item.id || crypto.randomUUID(),
    day: normalizeDayValue(item.day || '1'),
    sheetNumber: Number.isInteger(item.sheetNumber) ? item.sheetNumber : parseInt(item.sheetNumber, 10) || 1,
    lines: Array.isArray(item.lines) ? item.lines.slice(0, CODE_LINE_COUNT).concat(Array(Math.max(0, CODE_LINE_COUNT - item.lines.length)).fill('')) : base.lines
  };
}

function saveState(message = 'Saved.') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ autosave: state.autosave, selectedDay: state.selectedDay }));
  els.saveStatus.textContent = `${message} ${new Date().toLocaleTimeString()}`;
}

function ensureEntry() {
  if (!state.entries.length) {
    const entry = defaultEntry('1', 1);
    state.entries.push(entry);
    state.currentId = entry.id;
    state.selectedDay = '1';
    saveState('Initialized notebook.');
    return;
  }
  sortStateEntries();
  if (!getDays().includes(state.selectedDay)) {
    state.selectedDay = getDays()[0] || '1';
  }
  if (!state.currentId || !state.entries.find(e => e.id === state.currentId)) {
    state.currentId = getEntriesForSelectedDay()[0]?.id || sortedEntries()[0]?.id || null;
  }
  const current = getCurrent();
  if (current) state.selectedDay = normalizeDayValue(current.day);
}

function compareDay(a, b) {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  const aNum = !Number.isNaN(na);
  const bNum = !Number.isNaN(nb);
  if (aNum && bNum) return na - nb;
  return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
}

function sortedEntries() {
  return [...state.entries].sort((a, b) => compareDay(a.day, b.day) || (a.sheetNumber || 1) - (b.sheetNumber || 1) || new Date(a.createdAt) - new Date(b.createdAt));
}

function sortStateEntries() {
  state.entries = sortedEntries();
}

function getCurrent() {
  return state.entries.find(e => e.id === state.currentId);
}

function getDays() {
  return [...new Set(sortedEntries().map(e => normalizeDayValue(e.day)))];
}

function normalizeDayValue(value) {
  const str = String(value ?? '').trim();
  return str || '1';
}

function getEntriesForSelectedDay() {
  return sortedEntries().filter(e => normalizeDayValue(e.day) === normalizeDayValue(state.selectedDay));
}

function getCurrentIndexWithinDay() {
  return getEntriesForSelectedDay().findIndex(e => e.id === state.currentId);
}

function renderDaySelect() {
  const days = getDays();
  els.daySelect.innerHTML = '';
  days.forEach(day => {
    const option = document.createElement('option');
    option.value = day;
    option.textContent = `Day ${day}`;
    if (day === normalizeDayValue(state.selectedDay)) option.selected = true;
    els.daySelect.appendChild(option);
  });
}

function renderList() {
  const q = els.searchInput.value.trim().toLowerCase();
  const filtered = getEntriesForSelectedDay().filter(e => {
    const text = `${e.concept} ${e.filename} ${e.day} ${e.summary} ${e.sheetNumber}`.toLowerCase();
    return text.includes(q);
  });
  els.sheetList.innerHTML = '';
  if (!filtered.length) {
    els.sheetList.innerHTML = '<div class="hint">No sheets for this day.</div>';
    return;
  }
  filtered.forEach(entry => {
    const card = document.createElement('button');
    card.className = `sheet-card ${entry.id === state.currentId ? 'active' : ''}`;
    card.innerHTML = `<strong>${escapeHtml(entry.concept || 'Untitled Sheet')}</strong>
      <span>Day ${escapeHtml(entry.day)} · Sheet ${entry.sheetNumber} · ${escapeHtml(entry.filename || 'no filename')}</span>`;
    card.addEventListener('click', () => {
      persistFormToState();
      state.currentId = entry.id;
      renderList();
      renderCurrent();
    });
    els.sheetList.appendChild(card);
  });
}

function renderCurrent() {
  const entry = getCurrent();
  if (!entry) return;
  els.conceptInput.value = entry.concept || '';
  els.dayInput.value = entry.day || '';
  els.filenameInput.value = entry.filename || '';
  els.commentsInput.value = entry.comments || '';
  els.summaryInput.value = entry.summary || '';
  els.lectureInput.value = entry.lecture || '';
  document.querySelectorAll('.line-input').forEach(input => {
    input.value = entry.lines?.[Number(input.dataset.index)] || '';
  });
  els.themeSelect.value = entry.theme || 'green';
  applyTheme(entry.theme || 'green');
  state.selectedDay = normalizeDayValue(entry.day);
  renderDaySelect();
  updateNavigatorStatus();
}

function updateNavigatorStatus() {
  const current = getCurrent();
  const entriesForDay = getEntriesForSelectedDay();
  const idx = getCurrentIndexWithinDay();
  if (!current) {
    els.sheetNavigatorStatus.textContent = 'No sheet selected';
    return;
  }
  els.sheetNavigatorStatus.textContent = `Day ${current.day} · Sheet ${current.sheetNumber} (${idx + 1} of ${entriesForDay.length})`;
}

function persistFormToState() {
  const entry = getCurrent();
  if (!entry) return;
  const oldDay = normalizeDayValue(entry.day);
  entry.concept = els.conceptInput.value.trim();
  entry.day = normalizeDayValue(els.dayInput.value);
  entry.filename = els.filenameInput.value.trim();
  entry.comments = els.commentsInput.value;
  entry.summary = els.summaryInput.value;
  entry.lecture = els.lectureInput.value;
  entry.theme = els.themeSelect.value;
  entry.lines = Array.from(document.querySelectorAll('.line-input')).map(i => i.value);
  entry.updatedAt = new Date().toISOString();
  ensureSheetNumbers(entry, oldDay);
  state.selectedDay = normalizeDayValue(entry.day);
}

function ensureSheetNumbers(changedEntry, oldDay = null) {
  renumberSheetsForDay(oldDay || changedEntry.day);
  renumberSheetsForDay(changedEntry.day);
}

function renumberSheetsForDay(day) {
  if (!day) return;
  const entries = sortedEntries().filter(e => normalizeDayValue(e.day) === normalizeDayValue(day));
  entries.forEach((entry, index) => { entry.sheetNumber = index + 1; });
}

function bindEvents() {
  els.searchInput.addEventListener('input', renderList);

  els.daySelect.addEventListener('change', () => {
    persistFormToState();
    state.selectedDay = normalizeDayValue(els.daySelect.value);
    const first = getEntriesForSelectedDay()[0];
    if (first) state.currentId = first.id;
    renderList();
    renderCurrent();
    saveState(`Selected Day ${state.selectedDay}.`);
  });

  els.addDayBtn.addEventListener('click', () => {
    persistFormToState();
    const day = prompt('Enter the day number or name to add:', getNextAvailableDay());
    if (!day) return;
    const normalized = normalizeDayValue(day);
    if (getDays().includes(normalized)) {
      state.selectedDay = normalized;
      state.currentId = getEntriesForSelectedDay()[0]?.id || state.currentId;
      renderDaySelect();
      renderList();
      renderCurrent();
      saveState(`Moved to existing Day ${normalized}.`);
      return;
    }
    const entry = defaultEntry(normalized, 1);
    entry.theme = els.themeSelect.value || 'green';
    state.entries.push(entry);
    state.selectedDay = normalized;
    state.currentId = entry.id;
    sortStateEntries();
    renderDaySelect();
    renderList();
    renderCurrent();
    saveState(`Added Day ${normalized}.`);
  });

  els.goToDayBtn.addEventListener('click', () => {
    persistFormToState();
    const day = prompt('Go to which day?', state.selectedDay || '1');
    if (!day) return;
    const normalized = normalizeDayValue(day);
    const existing = sortedEntries().find(e => normalizeDayValue(e.day) === normalized);
    if (existing) {
      state.selectedDay = normalized;
      state.currentId = existing.id;
      renderDaySelect();
      renderList();
      renderCurrent();
      saveState(`Moved to Day ${normalized}.`);
    } else {
      alert(`Day ${normalized} does not exist yet. Use Add Day to create it.`);
    }
  });

  els.prevSheetBtn.addEventListener('click', () => navigateSheet(-1));
  els.nextSheetBtn.addEventListener('click', () => navigateOrCreateNextSheet());

  els.newEntryBtn.addEventListener('click', () => {
    persistFormToState();
    const selectedDay = normalizeDayValue(state.selectedDay || els.dayInput.value || '1');
    const entry = defaultEntry(selectedDay, getEntriesForDay(selectedDay).length + 1);
    entry.theme = els.themeSelect.value || 'green';
    state.entries.push(entry);
    renumberSheetsForDay(selectedDay);
    state.currentId = entry.id;
    state.selectedDay = selectedDay;
    sortStateEntries();
    renderDaySelect();
    renderList();
    renderCurrent();
    saveState(`Created new sheet for Day ${selectedDay}.`);
  });

  els.saveEntryBtn.addEventListener('click', () => {
    persistFormToState();
    sortStateEntries();
    renderDaySelect();
    renderList();
    renderCurrent();
    saveState('Sheet saved.');
  });

  els.deleteEntryBtn.addEventListener('click', () => {
    const current = getCurrent();
    if (!current) return;
    if (!confirm(`Delete Day ${current.day} · Sheet ${current.sheetNumber}?`)) return;
    const deletedDay = current.day;
    state.entries = state.entries.filter(e => e.id !== current.id);
    if (!state.entries.length) {
      const entry = defaultEntry('1', 1);
      state.entries = [entry];
      state.currentId = entry.id;
      state.selectedDay = '1';
    } else {
      renumberSheetsForDay(deletedDay);
      const dayEntries = getEntriesForDay(deletedDay);
      if (dayEntries.length) {
        state.selectedDay = deletedDay;
        state.currentId = dayEntries[0].id;
      } else {
        state.selectedDay = getDays()[0] || '1';
        state.currentId = getEntriesForSelectedDay()[0]?.id || sortedEntries()[0]?.id || null;
      }
    }
    sortStateEntries();
    renderDaySelect();
    renderList();
    renderCurrent();
    saveState('Sheet deleted.');
  });

  els.duplicateBtn.addEventListener('click', () => {
    persistFormToState();
    const current = getCurrent();
    if (!current) return;
    const duplicate = normalizeEntry({ ...current, id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    duplicate.sheetNumber = getEntriesForDay(current.day).length + 1;
    state.entries.push(duplicate);
    renumberSheetsForDay(current.day);
    state.currentId = duplicate.id;
    state.selectedDay = current.day;
    sortStateEntries();
    renderDaySelect();
    renderList();
    renderCurrent();
    saveState('Sheet duplicated.');
  });

  els.exportBtn.addEventListener('click', exportAllToJson);
  els.downloadCurrentBtn.addEventListener('click', exportCurrentToJson);
  els.importInput.addEventListener('change', importJsonFile);
  els.loadLinesBtn.addEventListener('click', loadLinesIntoRunner);
  els.runCodeBtn.addEventListener('click', runPythonCode);
  els.clearInputBtn.addEventListener('click', () => { els.runnerCode.value = ''; });
  els.clearOutputBtn.addEventListener('click', () => { els.runnerOutput.textContent = 'Output cleared.'; });
  els.themeSelect.addEventListener('change', () => {
    applyTheme(els.themeSelect.value);
    if (state.autosave) triggerAutosave('Theme updated.');
  });
  els.autosaveToggle.addEventListener('change', () => {
    state.autosave = els.autosaveToggle.checked;
    saveState('Autosave preference updated.');
  });

  [els.conceptInput, els.dayInput, els.filenameInput, els.commentsInput, els.summaryInput, els.lectureInput,
    ...document.querySelectorAll('.line-input')].forEach(el => {
    el.addEventListener('input', () => {
      if (state.autosave) triggerAutosave('Autosaved.');
    });
  });

  document.querySelectorAll('.line-input').forEach((input, index, inputs) => {
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const nextInput = inputs[index + 1];
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
      }
    });
  });

  [els.commentsInput, els.summaryInput, els.lectureInput].forEach(textarea => {
    textarea.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      requestAnimationFrame(() => {
        const position = textarea.selectionStart;
        textarea.setSelectionRange(position, position);
      });
    });
  });
}

function getEntriesForDay(day) {
  return sortedEntries().filter(e => normalizeDayValue(e.day) === normalizeDayValue(day));
}

function navigateSheet(step) {
  persistFormToState();
  sortStateEntries();
  const entriesForDay = getEntriesForSelectedDay();
  const idx = getCurrentIndexWithinDay();
  const target = entriesForDay[idx + step];
  if (!target) return;
  state.currentId = target.id;
  renderList();
  renderCurrent();
  saveState(step > 0 ? 'Moved to next sheet.' : 'Moved to previous sheet.');
}

function navigateOrCreateNextSheet() {
  persistFormToState();
  sortStateEntries();
  const entriesForDay = getEntriesForSelectedDay();
  const idx = getCurrentIndexWithinDay();
  if (entriesForDay[idx + 1]) {
    state.currentId = entriesForDay[idx + 1].id;
    renderList();
    renderCurrent();
    saveState('Moved to next sheet.');
    return;
  }
  const selectedDay = normalizeDayValue(state.selectedDay || '1');
  const entry = defaultEntry(selectedDay, entriesForDay.length + 1);
  entry.theme = els.themeSelect.value || 'green';
  state.entries.push(entry);
  state.currentId = entry.id;
  sortStateEntries();
  renderDaySelect();
  renderList();
  renderCurrent();
  saveState(`Created Sheet ${entry.sheetNumber} for Day ${selectedDay}.`);
}

function getNextAvailableDay() {
  const dayNumbers = getDays().map(d => parseInt(d, 10)).filter(n => !Number.isNaN(n));
  if (!dayNumbers.length) return '1';
  return String(Math.max(...dayNumbers) + 1);
}

function triggerAutosave(message) {
  persistFormToState();
  sortStateEntries();
  renderDaySelect();
  renderList();
  renderCurrent();
  saveState(message);
}

function applyTheme(theme) {
  els.sheet.classList.remove('theme-purple', 'theme-green');
  els.sheet.classList.add(theme === 'purple' ? 'theme-purple' : 'theme-green');
}

function exportAllToJson() {
  persistFormToState();
  sortStateEntries();
  downloadJson({ exportedAt: new Date().toISOString(), entries: state.entries }, 'coding_notebook_all_days.json');
}

function exportCurrentToJson() {
  persistFormToState();
  const current = getCurrent();
  const safeName = (current.filename || current.concept || `day_${current.day}_sheet_${current.sheetNumber}`).replace(/[^a-z0-9_-]+/gi, '_');
  downloadJson(current, `${safeName}.json`);
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function importJsonFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const entries = Array.isArray(data) ? data : Array.isArray(data.entries) ? data.entries : [data];
    state.entries = entries.map(normalizeEntry);
    sortStateEntries();
    ensureEntry();
    renderDaySelect();
    renderList();
    renderCurrent();
    saveState('JSON imported.');
  } catch (err) {
    alert(`Import failed: ${err.message}`);
  } finally {
    event.target.value = '';
  }
}

function loadLinesIntoRunner() {
  const code = Array.from(document.querySelectorAll('.line-input')).map(i => i.value).join('\n');
  els.runnerCode.value = code;
  els.runnerOutput.textContent = 'Code loaded from sheet lines 01–18.';
}

async function initPyodideRuntime() {
  if (!window.loadPyodide) {
    els.runtimeStatus.textContent = 'Pyodide could not load. Use internet access, then refresh.';
    return;
  }
  els.runtimeStatus.textContent = 'Loading Pyodide runtime...';
  try {
    state.pyodide = await window.loadPyodide();
    state.pyodide.setStdout({ batched: text => appendOutput(text) });
    state.pyodide.setStderr({ batched: text => appendOutput(text) });
    els.runtimeStatus.textContent = 'Pyodide ready. You can run Python from the sheet.';
  } catch (err) {
    els.runtimeStatus.textContent = `Pyodide failed to load: ${err.message}`;
  }
}

function appendOutput(text) {
  const current = els.runnerOutput.textContent;
  els.runnerOutput.textContent = current === 'Output will appear here.' ? text : `${current}\n${text}`;
}

async function runPythonCode() {
  const code = els.runnerCode.value.trim();
  if (!code) {
    els.runnerOutput.textContent = 'Nothing to run.';
    return;
  }
  if (!state.pyodide) {
    els.runnerOutput.textContent = 'Python runtime is not ready yet.';
    return;
  }
  els.runnerOutput.textContent = 'Running...';
  try {
    const result = await state.pyodide.runPythonAsync(code);
    if (result !== undefined) {
      appendOutput(String(result));
    } else if (els.runnerOutput.textContent === 'Running...') {
      els.runnerOutput.textContent = 'Code completed with no returned value.';
    }
  } catch (err) {
    els.runnerOutput.textContent = `Error:\n${err}`;
  }
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
