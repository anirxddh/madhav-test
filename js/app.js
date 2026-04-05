/**
 * ============================================================
 * MADHAV.AI — app.js
 * Pure UI logic. No data. No API calls.
 * All backend communication is in api.js.
 *
 * Sections:
 *   1.  State
 *   2.  DOM helpers
 *   3.  Init (entry point)
 *   4.  Mode switching       (AI ↔ Traditional)
 *   5.  Sub-mode switching   (Normal / Research / Study)
 *   6.  Chat                 (AI mode input + rendering)
 *   7.  Traditional search   (token search + filters + results table)
 *   8.  Token search UI      (pill tokens + suggestion dropdown)
 *   9.  Inline case viewer   (Summary / Facts / Judgement / Citations / PDF)
 *  10.  PDF side panel       (right-side split panel)
 *  11.  Utilities
 * ============================================================
 */


// ─────────────────────────────────────────────────────────────
// 1. STATE
// ─────────────────────────────────────────────────────────────
const State = {
  mode:                'ai',       // 'ai' | 'traditional'
  submode:             'normal',   // 'normal' | 'research' | 'study'
  openViewers:         new Set(),  // case IDs with open inline viewers
  pspCaseId:           null,       // case currently loaded in PDF side panel
  tokens:              [],         // { type, label, value }
  suggestionFocusIdx:  -1,
};


// ─────────────────────────────────────────────────────────────
// 2. DOM HELPERS
// ─────────────────────────────────────────────────────────────
const $   = id  => document.getElementById(id);
const $$  = sel => document.querySelectorAll(sel);
const mk  = (tag, cls = '') => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);


// ─────────────────────────────────────────────────────────────
// 3. INIT  (entry point)
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initModeNav();
  initSubmodeSwitcher();
  initChat();
  initWelcomeSuggestions();
  initTokenSearch();
  initFilterPanel();
  initPDFSidePanel();
  initNewChatButton();
  initHamburger();
  initTextareaResize();
});


// ─────────────────────────────────────────────────────────────
// 4. MODE SWITCHING
// ─────────────────────────────────────────────────────────────
function initModeNav() {
  $('nav-ai').addEventListener('click',          () => switchMode('ai'));
  $('nav-traditional').addEventListener('click', () => switchMode('traditional'));
}

function switchMode(mode) {
  State.mode = mode;
  $('nav-ai').classList.toggle('active',          mode === 'ai');
  $('nav-traditional').classList.toggle('active', mode === 'traditional');
  $('ai-subnav').style.display = mode === 'ai' ? '' : 'none';
  $('ai-interface').classList.toggle('hidden',          mode !== 'ai');
  $('traditional-interface').classList.toggle('hidden', mode !== 'traditional');
  updateModeTag();
  closePDFPanel();
  $('sidebar').classList.remove('open');
}


// ─────────────────────────────────────────────────────────────
// 5. SUB-MODE SWITCHING
// ─────────────────────────────────────────────────────────────
function initSubmodeSwitcher() {
  $$('.sidebar__sub-btn').forEach(btn =>
    btn.addEventListener('click', () => switchSubmode(btn.dataset.submode))
  );
  $$('.submode-tab').forEach(tab =>
    tab.addEventListener('click', () => switchSubmode(tab.dataset.submode))
  );
}

function switchSubmode(submode) {
  State.submode = submode;
  $$('.sidebar__sub-btn').forEach(b => b.classList.toggle('active', b.dataset.submode === submode));
  $$('.submode-tab').forEach(t =>     t.classList.toggle('active', t.dataset.submode === submode));

  const hints = {
    normal:   'Conversational legal research',
    research: 'Deep semantic search — may take longer',
    study:    'Structured educational output',
  };
  const placeholders = {
    normal:   'Ask anything about Indian case law...',
    research: 'Enter a topic for deep research...',
    study:    'Enter a legal topic or doctrine to study...',
  };
  $('submode-hint').textContent = hints[submode]        || '';
  $('chat-input').placeholder   = placeholders[submode] || '';
  updateModeTag();
}

function updateModeTag() {
  const map = {
    ai:          { normal: 'AI · Normal', research: 'AI · Research', study: 'AI · Study' },
    traditional: { normal: 'Database Search', research: 'Database Search', study: 'Database Search' },
  };
  $('mode-pill-label').textContent = map[State.mode]?.[State.submode] || 'Madhav.ai';
}


// ─────────────────────────────────────────────────────────────
// 6. CHAT  (AI mode)
// ─────────────────────────────────────────────────────────────
function initChat() {
  $('chat-send-btn').addEventListener('click', sendChatMessage);
  $('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  });
}

async function sendChatMessage() {
  const query = $('chat-input').value.trim();
  if (!query) return;

  $('chat-input').value         = '';
  $('chat-input').style.height  = '';
  $('ai-welcome').style.display = 'none';
  $('chat-container').style.display = 'flex';

  appendChatMessage('user', query);
  const typingId = appendTypingIndicator();

  try {
    // ── API CALL ──────────────────────────────────────────────
    const data = await API.chat(query, State.submode);
    // Returns { text, cases } for normal/research
    // Returns { sections }   for study
    // ─────────────────────────────────────────────────────────
    removeTypingIndicator(typingId);
    renderAIResponse(data);
  } catch (err) {
    removeTypingIndicator(typingId);
    appendChatMessage('ai', '<em>Error contacting server. Check the console.</em>', State.submode);
    console.error('[API] chat failed:', err);
  }
}

function renderAIResponse(data) {
  if (data.sections) {
    appendChatMessage('ai', null, 'study', [], data.sections);
  } else {
    appendChatMessage('ai', data.text, State.submode, data.cases || []);
  }
}

function appendChatMessage(role, text = null, submode = null, cases = [], studySections = null) {
  const container = $('chat-container');

  const row    = mk('div', `msg msg--${role}`);
  const avatar = mk('div', `msg__avatar avatar--${role}`);
  avatar.innerHTML = `<span class="ico ico-avatar-${role}" aria-hidden="true">${role === 'ai' ? 'M' : 'U'}</span>`;

  const bubble = mk('div', 'msg__bubble');

  if (role === 'ai' && submode) {
    const tag = mk('div', 'msg__mode-tag');
    tag.textContent = cap(submode) + ' Mode';
    bubble.appendChild(tag);
  }
  if (text) {
    const p = mk('p'); p.innerHTML = text;
    bubble.appendChild(p);
  }
  if (cases.length)   bubble.appendChild(buildCaseResultsTable(cases));
  if (studySections)  bubble.appendChild(buildStudyOutput(studySections));

  row.appendChild(avatar);
  row.appendChild(bubble);
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
  return row;
}

function appendTypingIndicator() {
  const id  = 'typing_' + Date.now();
  const row = appendChatMessage('ai');
  row.id    = id;
  const dots = mk('div', 'typing-dots');
  dots.innerHTML = '<span></span><span></span><span></span>';
  row.querySelector('.msg__bubble').appendChild(dots);
  return id;
}
function removeTypingIndicator(id) { document.getElementById(id)?.remove(); }

function initWelcomeSuggestions() {
  $$('.suggestion-pill').forEach(chip =>
    chip.addEventListener('click', () => {
      $('chat-input').value = chip.dataset.query;
      sendChatMessage();
    })
  );
}


// ─────────────────────────────────────────────────────────────
// 7. TRADITIONAL SEARCH
// ─────────────────────────────────────────────────────────────
function initFilterPanel() {
  $('filter-apply-btn').addEventListener('click', runSearch);
  $('filter-reset').addEventListener('click',     resetSearch);
  $('trad-search-btn').addEventListener('click',  () => { commitRawInputAsToken(); runSearch(); });
  $('clear-all-filters').addEventListener('click', () => {
    State.tokens = [];
    renderTokenPills();
    syncActiveFilterBar();
    runSearch();
  });
}

async function runSearch() {
  const params = buildSearchParams();
  showSearchLoading();

  try {
    // ── API CALL ──────────────────────────────────────────────
    const data = await API.search(params);
    // Returns { cases: Case[], total: number }
    // ─────────────────────────────────────────────────────────
    renderSearchResults(data.cases);
    renderResultExplanation(data.cases.length);
  } catch (err) {
    $('results-loading').classList.add('hidden');
    $('results-empty').classList.remove('hidden');
    $('empty-title').textContent = 'Search failed';
    $('empty-sub').textContent   = 'Could not reach the server. Please try again.';
    console.error('[API] search failed:', err);
  }
}

/** Collects sidebar dropdowns + token state into a flat params object for API.search() */
function buildSearchParams() {
  const params = {
    q:         '',
    court:     $('filter-court').value,
    year_from: $('filter-year-from').value || 0,
    year_to:   $('filter-year-to').value   || 9999,
    act:       $('filter-act').value,
    judge:     $('filter-judge').value,
    exclude:   '',
  };

  const excludeTerms = [];
  const yearRangeMap = {
    after_2000:  { year_from: 2001 },
    after_2010:  { year_from: 2011 },
    before_2000: { year_to: 1999 },
    '1990s':     { year_from: 1990, year_to: 1999 },
    '1970s':     { year_from: 1970, year_to: 1979 },
  };

  State.tokens.forEach(t => {
    if      (t.type === 'exclude') excludeTerms.push(t.value);
    else if (t.type === 'court')   params.court = t.value;
    else if (t.type === 'keyword') params.q = [params.q, t.value].filter(Boolean).join(' ');
    else if (t.type === 'year')    Object.assign(params, yearRangeMap[t.value] || {});
    else if (t.type === 'judge')   params.judge = t.value;
  });

  params.exclude = excludeTerms.join(',');
  return params;
}

function showSearchLoading() {
  ['results-empty','results-table-wrap','results-header',
   'active-filters-bar','result-explanation'].forEach(id => $(id).classList.add('hidden'));
  $('results-loading').classList.remove('hidden');
  $('trad-inline-viewer').innerHTML = '';
  closePDFPanel();
}

function renderSearchResults(cases) {
  $('results-loading').classList.add('hidden');

  if (!cases.length) {
    $('results-empty').classList.remove('hidden');
    $('empty-title').textContent = 'No cases found';
    $('empty-sub').textContent   = 'Try different keywords, remove a filter, or reset.';
    return;
  }

  const tbody = $('results-tbody');
  tbody.innerHTML = '';

  cases.forEach((c, i) => {
    const score  = c.authority_score || 50;
    const tier   = score >= 85 ? 'high' : score >= 65 ? 'medium' : 'low';
    const arrow  = score >= 85 ? '↑'    : score >= 65 ? '→'      : '↓';
    const label  = score >= 85 ? 'High' : score >= 65 ? 'Medium' : 'Low';

    const tr = mk('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="td-case-name">${c.name}</td>
      <td class="td-court">${c.court}</td>
      <td class="td-year">${c.year}</td>
      <td class="td-citation">${c.citation}</td>
      <td>
        <span class="authority-badge authority-badge--${tier}"
              title="Based on citation frequency and bench strength">
          ${score}
          <span class="authority-arrow">${arrow}</span>
          <span class="authority-level">${label}</span>
        </span>
      </td>
      <td><button class="btn-open" data-id="${c.id}">Open ↓</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-open').forEach(btn =>
    btn.addEventListener('click', () =>
      toggleInlineViewer(btn.dataset.id, $('trad-inline-viewer'), btn, true)
    )
  );

  $('results-count').textContent = `${cases.length} case${cases.length !== 1 ? 's' : ''} found`;
  $('results-header').classList.remove('hidden');
  $('results-table-wrap').classList.remove('hidden');
}

function renderResultExplanation(count) {
  if (!State.tokens.length) { $('result-explanation').classList.add('hidden'); return; }

  const includes = State.tokens.filter(t => t.type !== 'exclude').map(t => t.label);
  const excludes = State.tokens.filter(t => t.type === 'exclude').map(t => t.label);
  let detail = '';
  if (includes.length) detail += `Filtered by: ${includes.map(l => `<span class="re-include">${l}</span>`).join(', ')}`;
  if (excludes.length) detail += ` · Excluding: ${excludes.map(l => `<span class="re-exclude">NOT ${l}</span>`).join(', ')}`;

  $('re-count').textContent = `Showing ${count} case${count !== 1 ? 's' : ''}`;
  $('re-detail').innerHTML  = detail;
  $('result-explanation').classList.remove('hidden');
}

function resetSearch() {
  ['filter-court','filter-year-from','filter-year-to',
   'filter-act','filter-judge','filter-citation','filter-bench'].forEach(id => {
    const el = $(id); if (el) el.value = '';
  });
  State.tokens = [];
  $('token-raw-input').value = '';
  renderTokenPills();
  syncActiveFilterBar();
  closePDFPanel();
  $('trad-inline-viewer').innerHTML = '';
  State.openViewers.clear();
  ['results-table-wrap','results-header','active-filters-bar','result-explanation']
    .forEach(id => $(id).classList.add('hidden'));
  $('results-empty').classList.remove('hidden');
  $('empty-title').textContent = 'Search the legal database';
  $('empty-sub').textContent   = 'Type a keyword, case name, citation, or use the token filters above';
}


// ─────────────────────────────────────────────────────────────
// 8. TOKEN SEARCH UI
// ─────────────────────────────────────────────────────────────
function initTokenSearch() {
  const rawInput = $('token-raw-input');

  rawInput.addEventListener('input', async () => {
    const val = rawInput.value.trim();
    if (!val) { closeDropdown(); return; }

    // ── API CALL ──────────────────────────────────────────────
    const { suggestions } = await API.getSuggestions(val);
    // ─────────────────────────────────────────────────────────
    if (suggestions.length) renderDropdown(suggestions, val);
    else closeDropdown();
  });

  rawInput.addEventListener('keydown', e => {
    if (e.key === ';')        { e.preventDefault(); commitRawInputAsToken(); }
    if (e.key === 'Enter')    {
      const items = $('suggestion-dropdown').querySelectorAll('.suggestion-item');
      if (State.suggestionFocusIdx >= 0) items[State.suggestionFocusIdx]?.click();
      else { commitRawInputAsToken(); runSearch(); }
    }
    if (e.key === 'ArrowDown')  { e.preventDefault(); moveSuggestionFocus(+1); }
    if (e.key === 'ArrowUp')    { e.preventDefault(); moveSuggestionFocus(-1); }
    if (e.key === 'Backspace' && !rawInput.value && State.tokens.length) {
      State.tokens.pop(); renderTokenPills(); syncActiveFilterBar();
    }
    if (e.key === 'Escape') closeDropdown();
  });

  document.addEventListener('click', e => {
    if (!$('token-search-wrap').contains(e.target)) closeDropdown();
  });
  $('token-input-area').addEventListener('click', () => rawInput.focus());
}

function commitRawInputAsToken() {
  const raw = $('token-raw-input').value.trim();
  if (!raw) return;
  addToken({ type: 'keyword', label: raw, value: raw.toLowerCase() });
  $('token-raw-input').value = '';
  closeDropdown();
}

function renderDropdown(suggestions, rawVal) {
  const dropdown   = $('suggestion-dropdown');
  const isExclude  = rawVal.trim().toLowerCase().startsWith('not ');
  dropdown.innerHTML = '';
  State.suggestionFocusIdx = -1;

  const header = mk('div', 'suggestion-dropdown-header');
  header.textContent = 'Suggestions — click or press ; to add as filter token';
  dropdown.appendChild(header);

  suggestions.forEach(s => {
    const type = isExclude ? 'exclude' : s.type;
    const item = mk('div', 'suggestion-item');

    const icon = mk('div', `suggestion-item__icon suggestion-item__icon--${type}`);
    icon.textContent = TOKEN_ICON[type] || 'KW';

    const textWrap = mk('div', 'suggestion-item__text');
    const lbl = mk('div', 'suggestion-item__label'); lbl.textContent = s.label;
    const typ = mk('div', 'suggestion-item__type');  typ.textContent = TOKEN_LABEL[type] || 'Keyword';
    textWrap.appendChild(lbl);
    textWrap.appendChild(typ);

    const hint = mk('span', 'suggestion-item__hint'); hint.textContent = 'press ;';

    item.appendChild(icon);
    item.appendChild(textWrap);
    item.appendChild(hint);
    item.addEventListener('click', () => {
      addToken({ ...s, type });
      $('token-raw-input').value = '';
      closeDropdown();
      $('token-raw-input').focus();
    });
    dropdown.appendChild(item);
  });

  const footer = mk('div', 'suggestion-dropdown-footer');
  footer.innerHTML = '<kbd>↑↓</kbd> navigate · <kbd>Enter</kbd> select · <kbd>;</kbd> add token · type <kbd>NOT</kbd> to exclude';
  dropdown.appendChild(footer);
  dropdown.classList.remove('hidden');
}

function moveSuggestionFocus(dir) {
  const items = $('suggestion-dropdown').querySelectorAll('.suggestion-item');
  if (!items.length) return;
  State.suggestionFocusIdx = Math.max(-1, Math.min(items.length - 1, State.suggestionFocusIdx + dir));
  items.forEach((item, i) => item.classList.toggle('focused', i === State.suggestionFocusIdx));
}

function closeDropdown() {
  $('suggestion-dropdown').classList.add('hidden');
  State.suggestionFocusIdx = -1;
}

function addToken(s) {
  if (State.tokens.some(t => t.value === s.value && t.type === s.type)) return;
  State.tokens.push({ type: s.type, label: s.label, value: s.value });
  renderTokenPills();
  syncActiveFilterBar();
}

function removeToken(i) {
  State.tokens.splice(i, 1);
  renderTokenPills();
  syncActiveFilterBar();
  runSearch();
}

function renderTokenPills() {
  const area = $('token-input-area');
  const raw  = $('token-raw-input');
  area.querySelectorAll('.search-token').forEach(el => el.remove());
  State.tokens.forEach((t, i) => area.insertBefore(makeTokenPill(t, i, false), raw));
}

function syncActiveFilterBar() {
  const bar       = $('active-filters-bar');
  const container = $('active-filter-tokens');
  container.innerHTML = '';
  if (!State.tokens.length) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  State.tokens.forEach((t, i) => container.appendChild(makeTokenPill(t, i, true)));
}

function makeTokenPill(token, index, withSearch) {
  const pill = mk('div', `search-token search-token--${token.type}`);
  const type = mk('span', 'search-token__type'); type.textContent = TOKEN_ICON[token.type] || 'KW';
  const lbl  = mk('span'); lbl.textContent = token.type === 'exclude' ? `NOT ${token.label}` : token.label;
  const rm   = mk('span', 'search-token__remove'); rm.textContent = '×';
  rm.addEventListener('click', e => {
    e.stopPropagation();
    removeToken(index);
    if (withSearch) runSearch();
  });
  pill.appendChild(type);
  pill.appendChild(lbl);
  pill.appendChild(rm);
  return pill;
}


// ─────────────────────────────────────────────────────────────
// 9. INLINE CASE VIEWER
// ─────────────────────────────────────────────────────────────
function toggleInlineViewer(caseId, host, btn, singleMode = false) {
  const existing = host.querySelector(`[data-viewer-id="${caseId}"]`);
  if (existing) {
    existing.remove();
    State.openViewers.delete(caseId);
    resetOpenBtn(btn);
    if (State.pspCaseId === caseId) closePDFPanel();
    return;
  }

  if (singleMode) {
    host.innerHTML = '';
    State.openViewers.clear();
    $$('.btn-open').forEach(b => resetOpenBtn(b));
  }

  // Lookup case data. During development this reads from MOCK_CASES (defined in api.js).
  // To go live: replace this line with → const caseData = await API.getCase(caseId);
  const caseData = MOCK_CASES.find(c => c.id === caseId);
  if (!caseData) return;

  State.openViewers.add(caseId);
  btn.textContent = 'Close ✕';
  btn.classList.add('active');

  const viewer = buildCaseViewer(caseData);
  viewer.dataset.viewerId = caseId;
  host.appendChild(viewer);
  setTimeout(() => viewer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
}

function resetOpenBtn(btn) {
  btn.textContent = btn.closest?.('#trad-results') ? 'Open ↓' : 'Open Case ↓';
  btn.classList.remove('active');
}

function buildCaseViewer(c) {
  const viewer = mk('div', 'inline-viewer');

  // Header
  const header = mk('div', 'iv-header');
  const chips  = mk('div', 'iv-header-chips');
  const cChip  = mk('span', 'iv-chip iv-chip--court'); cChip.textContent = c.court.toUpperCase();
  const yChip  = mk('span', 'iv-chip iv-chip--year');  yChip.textContent = c.year;
  chips.appendChild(cChip); chips.appendChild(yChip);
  const title    = mk('h2', 'iv-title');    title.textContent    = c.name;
  const citation = mk('p',  'iv-citation'); citation.textContent = c.citation;
  const closeBtn = mk('button', 'iv-close');
  closeBtn.setAttribute('aria-label', 'Close case viewer');
  closeBtn.innerHTML = '<span class="ico ico-close" aria-hidden="true">×</span>';
  header.appendChild(chips); header.appendChild(title);
  header.appendChild(citation); header.appendChild(closeBtn);

  // Tab bar
  const tabBar  = mk('div', 'iv-tabs');
  const tabDefs = [
    { id: 'summary',   label: 'Summary' },
    { id: 'facts',     label: 'Key Facts' },
    { id: 'judgement', label: 'Judgement' },
    { id: 'citations', label: `Citations (${c.cited_in?.length || 0})` },
    { id: 'pdf',       label: 'PDF Viewer' },
  ];
  tabDefs.forEach((td, i) => {
    const t = mk('button', `iv-tab${i === 0 ? ' active' : ''}`);
    t.dataset.tab = td.id; t.textContent = td.label;
    tabBar.appendChild(t);
  });

  // Panels
  const body = mk('div', 'iv-body');

  // Summary
  const sp = mk('div', 'iv-panel'); sp.dataset.panel = 'summary';
  const st = mk('p', 'iv-text'); st.innerHTML = c.summary;
  const mg = mk('div', 'iv-meta-grid');
  [['Court', c.court], ['Year', c.year], ['Bench', c.bench || '—'], ['Citation', c.citation]].forEach(([k, v], i) => {
    const card = mk('div', 'iv-meta-card');
    const key  = mk('span', 'iv-meta-key'); key.textContent = k;
    const val  = mk('span', `iv-meta-val${i === 3 ? ' mono' : ''}`); val.textContent = v;
    card.appendChild(key); card.appendChild(val); mg.appendChild(card);
  });
  sp.appendChild(st); sp.appendChild(mg);

  // Facts
  const fp = mk('div', 'iv-panel hidden'); fp.dataset.panel = 'facts';
  const ul = mk('ul', 'iv-facts');
  c.facts.forEach(f => { const li = mk('li'); li.textContent = f; ul.appendChild(li); });
  fp.appendChild(ul);

  // Judgement
  const jp = mk('div', 'iv-panel hidden'); jp.dataset.panel = 'judgement';
  const jt = mk('p', 'iv-text'); jt.innerHTML = c.judgement;
  jp.appendChild(jt);

  // Citations
  const cp = mk('div', 'iv-panel hidden'); cp.dataset.panel = 'citations';
  cp.appendChild(buildCitationsPanel(c));

  // PDF tab (triggers side panel)
  const pp = mk('div', 'iv-panel pdf-trigger-panel hidden'); pp.dataset.panel = 'pdf';
  const tm = mk('div', 'pdf-trigger-msg');
  const ti = mk('span', 'ico ico-doc-lg'); ti.setAttribute('aria-hidden', 'true');
  const tx = mk('span'); tx.textContent = 'Opening PDF in side panel…';
  tm.appendChild(ti); tm.appendChild(tx); pp.appendChild(tm);

  [sp, fp, jp, cp, pp].forEach(p => body.appendChild(p));
  viewer.appendChild(header); viewer.appendChild(tabBar); viewer.appendChild(body);

  // Tab switching
  tabBar.querySelectorAll('.iv-tab').forEach(tab =>
    tab.addEventListener('click', () => {
      tabBar.querySelectorAll('.iv-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tgt = tab.dataset.tab;
      body.querySelectorAll('.iv-panel').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== tgt));
      if (tgt === 'pdf') openPDFPanel(c);
    })
  );

  // Close
  closeBtn.addEventListener('click', () => {
    State.openViewers.delete(c.id);
    $$(`[data-id="${c.id}"]`).forEach(b => resetOpenBtn(b));
    if (State.pspCaseId === c.id) closePDFPanel();
    viewer.remove();
  });

  return viewer;
}

function buildCitationsPanel(c) {
  const wrap = mk('div', 'iv-citations');
  if (!c.cited_in?.length) {
    const e = mk('div', 'iv-citations-empty');
    e.textContent = 'No citation data available for this case.';
    wrap.appendChild(e); return wrap;
  }
  const intro = mk('div', 'iv-citation-intro');
  intro.innerHTML = `<strong>${c.cited_in.length} future case${c.cited_in.length !== 1 ? 's' : ''}</strong> cited <em>${c.name}</em> as authority.`;
  wrap.appendChild(intro);
  c.cited_in.forEach(ref => {
    const card = mk('div', 'iv-citation-card');
    const top  = mk('div', 'iv-cit-card-top');
    const nm   = mk('div', 'iv-cit-case-name');  nm.textContent  = ref.name;
    const yr   = mk('span', 'iv-cit-year-badge'); yr.textContent  = ref.year;
    top.appendChild(nm); top.appendChild(yr);
    const ct   = mk('div', 'iv-cit-court');    ct.textContent   = ref.court;
    const ci   = mk('div', 'iv-cit-citation'); ci.textContent   = ref.citation;
    const ctx  = mk('div', 'iv-cit-context');  ctx.innerHTML    = ref.context || '';
    card.appendChild(top); card.appendChild(ct); card.appendChild(ci);
    if (ref.context) card.appendChild(ctx);
    wrap.appendChild(card);
  });
  return wrap;
}

function buildCaseResultsTable(cases) {
  const wrap  = mk('div', 'case-table-wrap');
  const label = mk('p', 'case-table-label');
  label.textContent = `${cases.length} case${cases.length !== 1 ? 's' : ''} found`;
  wrap.appendChild(label);

  const table = mk('table', 'case-table');
  table.innerHTML = `<thead><tr><th>Case Name</th><th>Court</th><th>Year</th><th></th></tr></thead>`;
  const tbody = mk('tbody');
  cases.forEach(c => {
    const tr = mk('tr');
    tr.innerHTML = `
      <td class="case-name">${c.name}</td>
      <td class="td-court">${c.court}</td>
      <td class="case-year">${c.year}</td>
      <td><button class="btn-open" data-id="${c.id}">Open Case ↓</button></td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);

  const viewerHost = mk('div', 'inline-viewer-host');
  wrap.appendChild(viewerHost);
  wrap.querySelectorAll('.btn-open').forEach(btn =>
    btn.addEventListener('click', () =>
      toggleInlineViewer(btn.dataset.id, viewerHost, btn, false)
    )
  );
  return wrap;
}

function buildStudyOutput(sections) {
  const wrap = mk('div', 'study-output');
  sections.forEach(s => {
    const block = mk('div', 'study-block');
    const lbl   = mk('p',   'study-block__label'); lbl.textContent  = s.label;
    const body  = mk('div', 'study-block__body');  body.innerHTML   = s.body;
    block.appendChild(lbl); block.appendChild(body);
    wrap.appendChild(block);
  });
  return wrap;
}


// ─────────────────────────────────────────────────────────────
// 10. PDF SIDE PANEL
// ─────────────────────────────────────────────────────────────
function initPDFSidePanel() {
  $('psp-close').addEventListener('click',     closePDFPanel);
  $('psp-search-btn').addEventListener('click', runPDFSearch);
  $('psp-search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') runPDFSearch();
  });
  $('psp-prev').addEventListener('click', () => movePDFMatch(-1));
  $('psp-next').addEventListener('click', () => movePDFMatch(+1));
  // Store match state directly on the panel element
  const panel = $('pdf-side-panel');
  panel._matches    = [];
  panel._matchIndex = 0;
}

function openPDFPanel(c) {
  State.pspCaseId = c.id;
  $('psp-case-title').textContent  = c.name;
  $('psp-search-input').value      = '';
  $('psp-match-count').textContent = '0 / 0';
  const panel = $('pdf-side-panel');
  panel._matches    = [];
  panel._matchIndex = 0;
  renderPDFDocument(c);
  panel.classList.add('open');
}

function closePDFPanel() {
  $('pdf-side-panel').classList.remove('open');
  State.pspCaseId = null;
}

function renderPDFDocument(c) {
  const doc = $('psp-doc');
  doc.innerHTML = '';

  const title = mk('p', 'psp-doc-title'); title.textContent = c.name.toUpperCase();
  const sub   = mk('p', 'psp-doc-sub');   sub.textContent   = `${c.court}  ·  ${c.year}  ·  ${c.citation}`;
  doc.appendChild(title);
  doc.appendChild(sub);

  // Case paragraphs from the database
  c.paragraphs.forEach((para, i) => {
    const p = mk('p', 'psp-para'); p.dataset.paraId = para.id;
    p.innerHTML = `<span class="psp-para-num">[${i + 1}]</span> ${para.text}`;
    doc.appendChild(p);
  });

  // Placeholder filler (remove when real PDF rendering is wired up)
  const FILLER = [
    'The Court heard the learned counsel for both parties and carefully examined the records placed before it.',
    'Having considered the submissions made and the precedents cited, this Court is of the view that the matter requires a careful examination of the constitutional framework and the legislative intent behind the relevant provisions.',
    'The respondent argues that the Government acted within its statutory powers and that no constitutional provision has been violated.',
    'The legal position on this question is now well settled by a series of decisions of this Court. The principles enunciated in those decisions are squarely applicable to the facts of the present case.',
    'In view of the foregoing discussion, this Court is of the considered opinion that the petitioner is entitled to the relief claimed in the present petition.',
    'Accordingly, the petition is allowed. The impugned order is set aside. The respondent is directed to act in accordance with the law as declared by this Court within eight weeks.',
    'There shall be no order as to costs. All pending interlocutory applications stand disposed of.',
  ];
  FILLER.forEach((text, i) => {
    const p = mk('p', 'psp-para');
    p.innerHTML = `<span class="psp-para-num">[${c.paragraphs.length + i + 1}]</span> ${text}`;
    doc.appendChild(p);
  });
}

function runPDFSearch() {
  const query = $('psp-search-input').value.trim().toLowerCase();
  const paras = $('psp-doc').querySelectorAll('.psp-para');
  const panel = $('pdf-side-panel');
  paras.forEach(p => p.classList.remove('highlighted'));
  panel._matches    = [];
  panel._matchIndex = 0;
  if (!query) { $('psp-match-count').textContent = '0 / 0'; return; }
  paras.forEach(p => {
    if (p.textContent.toLowerCase().includes(query)) {
      p.classList.add('highlighted'); panel._matches.push(p);
    }
  });
  const total = panel._matches.length;
  $('psp-match-count').textContent = total ? `1 / ${total}` : '0 / 0';
  if (total) panel._matches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function movePDFMatch(dir) {
  const panel = $('pdf-side-panel');
  if (!panel._matches.length) return;
  panel._matchIndex = (panel._matchIndex + dir + panel._matches.length) % panel._matches.length;
  $('psp-match-count').textContent = `${panel._matchIndex + 1} / ${panel._matches.length}`;
  panel._matches[panel._matchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
}


// ─────────────────────────────────────────────────────────────
// 11. UTILITIES
// ─────────────────────────────────────────────────────────────
function initTextareaResize() {
  $('chat-input').addEventListener('input', function () {
    this.style.height = '';
    this.style.height = Math.min(this.scrollHeight, 140) + 'px';
  });
}

function initHamburger() {
  $('btn-hamburger').addEventListener('click', () => $('sidebar').classList.toggle('open'));
}

function initNewChatButton() {
  $('btn-new-chat').addEventListener('click', () => {
    $('chat-container').innerHTML     = '';
    $('chat-container').style.display = 'none';
    $('ai-welcome').style.display     = '';
    State.openViewers.clear();
    closePDFPanel();
    if (State.mode !== 'ai') switchMode('ai');
    switchSubmode('normal');
    $('sidebar').classList.remove('open');
  });
}
