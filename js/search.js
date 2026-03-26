/**
 * madhav.ai — Enhanced Search UI
 * Adds to your existing search: autocomplete, "Did you mean?",
 * advanced filters panel, search-within-results.
 *
 * Usage: call MadhavSearch.init() after DOM load.
 * Requires: a search input with id="search-input" (or pass your own id).
 */

const MadhavSearch = (() => {

  // ── Config ─────────────────────────────────────────────
  const API = {
    search:      "/api/search/",
    autocomplete:"/api/search/autocomplete",
    filters:     "/api/search/filters",
    refine:      "/api/search/refine",
  };

  let filterOptions  = {};     // loaded once from /api/search/filters
  let activeFilters  = {};     // current applied filters
  let lastResultIds  = [];     // for search-within-results
  let autocompleteTimeout = null;
  let currentPage    = 1;
  let currentQuery   = "";

  // ── Inject CSS ─────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById("md-search-css")) return;
    const style = document.createElement("style");
    style.id = "md-search-css";
    style.textContent = `
      #md-search-wrap { position: relative; }

      /* Autocomplete dropdown */
      #md-autocomplete {
        display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 1000;
        background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.1); max-height: 340px; overflow-y: auto; margin-top: 4px;
      }
      #md-autocomplete.open { display: block; }
      .md-ac-item {
        padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f3f4f6;
        display: flex; align-items: flex-start; gap: 10px;
      }
      .md-ac-item:last-child { border-bottom: none; }
      .md-ac-item:hover { background: #f0f4ff; }
      .md-ac-name { font-size: 0.83rem; font-weight: 500; color: #1a1a1a; }
      .md-ac-name mark { background: #dbeafe; color: #1d4ed8; border-radius: 2px; padding: 0 1px; }
      .md-ac-meta { font-size: 0.72rem; color: #6b7280; margin-top: 2px; }
      .md-ac-icon { font-size: 1rem; margin-top: 1px; flex-shrink: 0; }

      /* Did you mean */
      #md-did-you-mean {
        display: none; padding: 8px 12px; background: #fef9c3; border-radius: 8px;
        font-size: 0.82rem; color: #713f12; margin-bottom: 0.75rem; border: 1px solid #fde68a;
      }
      #md-did-you-mean a { color: #1d4ed8; cursor: pointer; font-weight: 600; text-decoration: underline; }

      /* Filters panel */
      #md-filters-panel {
        background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px;
        padding: 1rem; margin-bottom: 1rem; display: none;
      }
      #md-filters-panel.open { display: block; }
      .md-filter-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; align-items: flex-end; }
      .md-filter-group { display: flex; flex-direction: column; gap: 3px; min-width: 140px; flex: 1; }
      .md-filter-group label { font-size: 0.7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
      .md-filter-group select,
      .md-filter-group input {
        padding: 6px 8px; border: 1px solid #e5e7eb; border-radius: 6px;
        font-size: 0.8rem; background: #fff; color: #1a1a1a; outline: none;
      }
      .md-filter-group select:focus,
      .md-filter-group input:focus { border-color: #1d4ed8; }

      /* Active filter chips */
      #md-active-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 0.75rem; }
      .md-chip {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 500;
        background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe;
      }
      .md-chip-remove { cursor: pointer; font-size: 0.9rem; line-height: 1; margin-left: 2px; }
      .md-chip-remove:hover { color: #dc2626; }

      /* Search within results */
      #md-refine-bar {
        display: none; padding: 8px 12px; background: #f0fdf4; border: 1px solid #bbf7d0;
        border-radius: 8px; margin-bottom: 0.75rem; font-size: 0.82rem; align-items: center; gap: 8px;
      }
      #md-refine-bar.show { display: flex; }
      #md-refine-input-bar {
        flex: 1; padding: 5px 10px; border: 1px solid #d1d5db; border-radius: 6px;
        font-size: 0.8rem; outline: none;
      }
      #md-refine-submit {
        padding: 5px 12px; background: #059669; color: #fff; border: none;
        border-radius: 6px; font-size: 0.8rem; cursor: pointer; font-weight: 600;
      }

      /* Toolbar */
      #md-search-toolbar {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 0.75rem; flex-wrap: wrap; gap: 8px;
      }
      .md-toolbar-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .md-tool-btn {
        padding: 5px 12px; border: 1px solid #e5e7eb; border-radius: 20px;
        background: #fff; font-size: 0.78rem; cursor: pointer; color: #374151; transition: all 0.15s;
      }
      .md-tool-btn:hover { border-color: #1d4ed8; color: #1d4ed8; }
      .md-tool-btn.active { background: #eff6ff; border-color: #1d4ed8; color: #1d4ed8; font-weight: 600; }
      .md-result-count { font-size: 0.78rem; color: #6b7280; }

      /* Pagination */
      #md-pagination { display: flex; justify-content: center; gap: 6px; margin-top: 1.25rem; flex-wrap: wrap; }
      .md-page-btn {
        padding: 5px 11px; border: 1px solid #e5e7eb; border-radius: 6px;
        background: #fff; font-size: 0.8rem; cursor: pointer; color: #374151;
      }
      .md-page-btn:hover { border-color: #1d4ed8; }
      .md-page-btn.active { background: #1d4ed8; color: #fff; border-color: #1d4ed8; }
      .md-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    `;
    document.head.appendChild(style);
  }

  // ── Build filter panel HTML ────────────────────────────
  function buildFiltersPanel() {
    const courts    = filterOptions.courts    || [];
    const caseTypes = filterOptions.case_types|| [];
    const outcomes  = filterOptions.outcomes  || [];
    const statuses  = filterOptions.statuses  || [];
    const yearMin   = filterOptions.year_min  || 1950;
    const yearMax   = filterOptions.year_max  || 2025;

    function select(id, label, options, placeholder) {
      return `<div class="md-filter-group">
        <label>${label}</label>
        <select id="${id}">
          <option value="">${placeholder}</option>
          ${options.map(o => `<option value="${o}">${o}</option>`).join("")}
        </select>
      </div>`;
    }

    return `<div id="md-filters-panel">
      <div class="md-filter-row">
        ${select("md-f-court",     "Court",        courts,    "All courts")}
        ${select("md-f-case-type", "Case type",    caseTypes, "All types")}
        ${select("md-f-outcome",   "Outcome",      outcomes,  "Any outcome")}
        ${select("md-f-status",    "Precedent status", statuses, "Any status")}
      </div>
      <div class="md-filter-row">
        <div class="md-filter-group" style="max-width:120px;">
          <label>Year from</label>
          <input type="number" id="md-f-year-from" min="${yearMin}" max="${yearMax}" placeholder="${yearMin}">
        </div>
        <div class="md-filter-group" style="max-width:120px;">
          <label>Year to</label>
          <input type="number" id="md-f-year-to" min="${yearMin}" max="${yearMax}" placeholder="${yearMax}">
        </div>
        <div class="md-filter-group" style="max-width:120px;">
          <label>Bench size</label>
          <select id="md-f-bench">
            <option value="">Any</option>
            <option value="1">1 judge</option>
            <option value="2">2 judges</option>
            <option value="3">3 judges</option>
            <option value="5">5 judges (const. bench)</option>
          </select>
        </div>
        <div class="md-filter-group">
          <label>Party name</label>
          <input type="text" id="md-f-party" placeholder="e.g. State of Maharashtra">
        </div>
        <div class="md-filter-group">
          <label>Act / Section</label>
          <input type="text" id="md-f-act" placeholder="e.g. IPC 302">
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
        <button id="md-clear-filters" class="md-tool-btn">Clear all</button>
        <button id="md-apply-filters" style="padding:6px 16px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.82rem;font-weight:600;cursor:pointer;">Apply filters</button>
      </div>
    </div>`;
  }

  // ── Inject toolbar + filter UI ─────────────────────────
  function injectSearchUI(searchContainerId) {
    const container = document.getElementById(searchContainerId);
    if (!container) return;

    // Wrap existing search input
    const existingInput = document.getElementById("search-input") || container.querySelector("input[type=text]");
    if (existingInput && !document.getElementById("md-search-wrap")) {
      const wrap = document.createElement("div");
      wrap.id = "md-search-wrap";
      existingInput.parentNode.insertBefore(wrap, existingInput);
      wrap.appendChild(existingInput);

      // Autocomplete dropdown
      const ac = document.createElement("div");
      ac.id = "md-autocomplete";
      wrap.appendChild(ac);
    }

    // Toolbar (insert before results)
    if (!document.getElementById("md-search-toolbar")) {
      const toolbar = document.createElement("div");
      toolbar.id = "md-search-toolbar";
      toolbar.innerHTML = `
        <div class="md-toolbar-left">
          <button class="md-tool-btn active" id="md-mode-normal" data-mode="normal">Normal search</button>
          <button class="md-tool-btn" id="md-mode-research" data-mode="research">Research mode</button>
          <button class="md-tool-btn" id="md-toggle-filters">⚙ Filters</button>
          <span id="md-result-count" class="md-result-count"></span>
        </div>
        <div>
          <button class="md-tool-btn" id="md-search-within-btn" style="display:none;">Search within results</button>
        </div>`;
      container.prepend(toolbar);
    }

    // Did you mean
    if (!document.getElementById("md-did-you-mean")) {
      const dym = document.createElement("div");
      dym.id = "md-did-you-mean";
      container.insertBefore(dym, container.children[1]);
    }

    // Active filter chips
    if (!document.getElementById("md-active-chips")) {
      const chips = document.createElement("div");
      chips.id = "md-active-chips";
      container.insertBefore(chips, container.children[2]);
    }

    // Filters panel
    if (!document.getElementById("md-filters-panel")) {
      const panel = document.createElement("div");
      panel.innerHTML = buildFiltersPanel();
      container.insertBefore(panel.firstElementChild, container.children[3]);
    }

    // Search-within-results bar
    if (!document.getElementById("md-refine-bar")) {
      const refBar = document.createElement("div");
      refBar.id = "md-refine-bar";
      refBar.innerHTML = `
        <span style="color:#065f46;font-weight:500;white-space:nowrap;">Search within:</span>
        <input id="md-refine-input-bar" type="text" placeholder="Narrow these results...">
        <button id="md-refine-submit">Go</button>
        <button id="md-refine-clear" class="md-tool-btn" style="margin-left:4px;">✕ Clear</button>`;
      container.insertBefore(refBar, container.children[4]);
    }
  }

  // ── Autocomplete ───────────────────────────────────────
  function setupAutocomplete(inputEl) {
    const dropdown = document.getElementById("md-autocomplete");
    if (!dropdown) return;

    inputEl.addEventListener("input", () => {
      clearTimeout(autocompleteTimeout);
      const q = inputEl.value.trim();
      if (q.length < 2) { dropdown.classList.remove("open"); return; }

      autocompleteTimeout = setTimeout(async () => {
        try {
          const res  = await fetch(`${API.autocomplete}?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          renderAutocomplete(data.suggestions || [], inputEl, dropdown);
        } catch {}
      }, 300);
    });

    document.addEventListener("click", e => {
      if (!dropdown.contains(e.target) && e.target !== inputEl) {
        dropdown.classList.remove("open");
      }
    });
  }

  function renderAutocomplete(suggestions, inputEl, dropdown) {
    if (!suggestions.length) { dropdown.classList.remove("open"); return; }

    dropdown.innerHTML = suggestions.map(s => {
      const hl   = s.highlight?.case_name?.[0] || s.case_name || "";
      const meta = [s.court, s.year, s.citation].filter(Boolean).join(" · ");
      return `<div class="md-ac-item" data-name="${s.case_name}" data-id="${s.case_id}">
        <span class="md-ac-icon">⚖️</span>
        <div>
          <div class="md-ac-name">${hl}</div>
          <div class="md-ac-meta">${meta}</div>
        </div>
      </div>`;
    }).join("");

    dropdown.querySelectorAll(".md-ac-item").forEach(item => {
      item.addEventListener("click", () => {
        inputEl.value = item.dataset.name;
        dropdown.classList.remove("open");
        runSearch(item.dataset.name);
      });
    });

    dropdown.classList.add("open");
  }

  // ── Did you mean ───────────────────────────────────────
  function showDidYouMean(suggestion) {
    const el = document.getElementById("md-did-you-mean");
    if (!el) return;
    if (suggestion) {
      el.innerHTML = `Did you mean: <a id="md-dym-link">${suggestion}</a>?`;
      el.style.display = "block";
      document.getElementById("md-dym-link")?.addEventListener("click", () => {
        const inp = document.getElementById("search-input");
        if (inp) inp.value = suggestion;
        el.style.display = "none";
        runSearch(suggestion);
      });
    } else {
      el.style.display = "none";
    }
  }

  // ── Active filter chips ────────────────────────────────
  function renderChips() {
    const container = document.getElementById("md-active-chips");
    if (!container) return;

    const LABELS = {
      court: "Court", judge: "Judge", year_from: "From", year_to: "To",
      bench_strength: "Bench", act_section: "Act", party_name: "Party",
      case_type: "Type", outcome: "Outcome", precedent_status: "Status",
    };

    container.innerHTML = Object.entries(activeFilters).map(([k, v]) =>
      `<span class="md-chip">${LABELS[k]||k}: <strong>${v}</strong>
        <span class="md-chip-remove" data-key="${k}">×</span>
      </span>`
    ).join("");

    container.querySelectorAll(".md-chip-remove").forEach(btn => {
      btn.addEventListener("click", () => {
        delete activeFilters[btn.dataset.key];
        renderChips();
        runSearch(currentQuery);
      });
    });
  }

  // ── Read filters from panel ────────────────────────────
  function readFilters() {
    const get = id => document.getElementById(id)?.value?.trim() || null;
    const filters = {};
    const court    = get("md-f-court");      if (court)    filters.court            = court;
    const ctype    = get("md-f-case-type");  if (ctype)    filters.case_type        = ctype;
    const outcome  = get("md-f-outcome");    if (outcome)  filters.outcome          = outcome;
    const status   = get("md-f-status");     if (status)   filters.precedent_status = status;
    const yFrom    = get("md-f-year-from");  if (yFrom)    filters.year_from        = parseInt(yFrom);
    const yTo      = get("md-f-year-to");    if (yTo)      filters.year_to          = parseInt(yTo);
    const bench    = get("md-f-bench");      if (bench)    filters.bench_strength   = parseInt(bench);
    const party    = get("md-f-party");      if (party)    filters.party_name       = party;
    const act      = get("md-f-act");        if (act)      filters.act_section      = act;
    return filters;
  }

  // ── Main search runner ─────────────────────────────────
  async function runSearch(query, page = 1) {
    if (!query?.trim()) return;
    currentQuery = query;
    currentPage  = page;

    const mode = document.querySelector(".md-tool-btn[data-mode].active")?.dataset.mode || "normal";

    const body = {
      query,
      mode,
      page,
      page_size: 20,
      ...activeFilters,
    };

    try {
      const res  = await fetch(API.search, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      // Did you mean?
      showDidYouMean(data.suggestion || null);

      // Result count
      const countEl = document.getElementById("md-result-count");
      if (countEl) countEl.textContent = `${data.total?.toLocaleString() || 0} results`;

      // Show "search within" button if results exist
      const withinBtn = document.getElementById("md-search-within-btn");
      if (withinBtn) {
        if (data.cases?.length > 0) {
          withinBtn.style.display = "inline-block";
          lastResultIds = data.cases.map(c => c.case_id);
        } else {
          withinBtn.style.display = "none";
        }
      }

      // Render pagination
      renderPagination(data.pages, page);

      // Fire event so your existing result renderer picks it up
      document.dispatchEvent(new CustomEvent("madhav:search-results", { detail: data }));

    } catch (err) {
      console.error("[MadhavSearch] Search error:", err);
    }
  }

  // ── Pagination ─────────────────────────────────────────
  function renderPagination(totalPages, currentPg) {
    let el = document.getElementById("md-pagination");
    if (!el) {
      el = document.createElement("div");
      el.id = "md-pagination";
      document.getElementById("md-search-toolbar")?.after(el);
    }
    if (totalPages <= 1) { el.innerHTML = ""; return; }

    const pages = [];
    for (let i = 1; i <= Math.min(totalPages, 10); i++) pages.push(i);

    el.innerHTML = [
      `<button class="md-page-btn" ${currentPg===1?"disabled":""} data-page="${currentPg-1}">← Prev</button>`,
      ...pages.map(p => `<button class="md-page-btn ${p===currentPg?"active":""}" data-page="${p}">${p}</button>`),
      `<button class="md-page-btn" ${currentPg===totalPages?"disabled":""} data-page="${currentPg+1}">Next →</button>`,
    ].join("");

    el.querySelectorAll(".md-page-btn:not([disabled])").forEach(btn => {
      btn.addEventListener("click", () => runSearch(currentQuery, parseInt(btn.dataset.page)));
    });
  }

  // ── Event wiring ───────────────────────────────────────
  function wireEvents(inputEl) {
    // Enter key on search input
    inputEl.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        document.getElementById("md-autocomplete")?.classList.remove("open");
        runSearch(inputEl.value.trim());
      }
    });

    // Mode toggle
    document.querySelectorAll(".md-tool-btn[data-mode]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".md-tool-btn[data-mode]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        if (currentQuery) runSearch(currentQuery);
      });
    });

    // Toggle filters panel
    document.getElementById("md-toggle-filters")?.addEventListener("click", () => {
      const panel = document.getElementById("md-filters-panel");
      panel?.classList.toggle("open");
    });

    // Apply filters
    document.getElementById("md-apply-filters")?.addEventListener("click", () => {
      activeFilters = readFilters();
      renderChips();
      document.getElementById("md-filters-panel")?.classList.remove("open");
      runSearch(currentQuery);
    });

    // Clear filters
    document.getElementById("md-clear-filters")?.addEventListener("click", () => {
      activeFilters = {};
      ["md-f-court","md-f-case-type","md-f-outcome","md-f-status",
       "md-f-year-from","md-f-year-to","md-f-bench","md-f-party","md-f-act"]
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
      renderChips();
      runSearch(currentQuery);
    });

    // Search within results
    document.getElementById("md-search-within-btn")?.addEventListener("click", () => {
      document.getElementById("md-refine-bar")?.classList.add("show");
    });

    document.getElementById("md-refine-submit")?.addEventListener("click", async () => {
      const q = document.getElementById("md-refine-input-bar")?.value.trim();
      if (!q || !lastResultIds.length) return;
      const res  = await fetch(API.refine, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_ids: lastResultIds, refine_query: q }),
      });
      const data = await res.json();
      document.dispatchEvent(new CustomEvent("madhav:search-results", { detail: data }));
    });

    document.getElementById("md-refine-clear")?.addEventListener("click", () => {
      document.getElementById("md-refine-bar")?.classList.remove("show");
      document.getElementById("md-refine-input-bar").value = "";
      runSearch(currentQuery);
    });
  }

  // ── Init ───────────────────────────────────────────────
  async function init(searchContainerId = "search-container", inputId = "search-input") {
    injectCSS();

    // Load filter options from backend
    try {
      const res = await fetch(API.filters);
      filterOptions = await res.json();
    } catch {
      filterOptions = {};
    }

    injectSearchUI(searchContainerId);

    const inputEl = document.getElementById(inputId);
    if (!inputEl) {
      console.error(`[MadhavSearch] No input found with id="${inputId}"`);
      return;
    }

    setupAutocomplete(inputEl);
    wireEvents(inputEl);
  }

  // Public
  return { init, runSearch };
})();
