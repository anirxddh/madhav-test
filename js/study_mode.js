/**
 * madhav.ai — Study Mode + Legal Reasoning
 * All 6 Week 3 features in one module:
 *   - ELI5 / Simplified / Story explanation
 *   - Flashcards
 *   - Argument extraction
 *   - Ratio vs obiter tagging
 *   - Multi-case synthesis
 *
 * Usage:
 *   <script src="study_mode.js"></script>
 *   MadhavStudy.openCase(caseId, caseName, citation);   // single-case panel
 *   MadhavStudy.openSynthesis([caseIds], question);      // multi-case
 */

const MadhavStudy = (() => {

  const API = {
    explain:    "/api/study/explain",
    flashcards: "/api/study/flashcards",
    arguments:  "/api/study/arguments",
    ratio:      "/api/study/ratio-obiter",
    synthesize: "/api/study/synthesize",
  };

  let currentCase = null;   // { case_id, case_name, citation }
  let flashState  = { cards: [], current: 0, flipped: false };

  // ── CSS ──────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById("mds-css")) return;
    const s = document.createElement("style");
    s.id = "mds-css";
    s.textContent = `
      /* overlay */
      #mds-overlay {
        display:none;position:fixed;inset:0;z-index:9100;
        background:rgba(0,0,0,0.5);align-items:flex-start;justify-content:center;padding:1.5rem;
      }
      #mds-overlay.open { display:flex; }

      /* panel */
      #mds-panel {
        width:100%;max-width:980px;max-height:92vh;background:#fff;
        border-radius:14px;display:flex;flex-direction:column;overflow:hidden;
        box-shadow:0 20px 60px rgba(0,0,0,0.2);
      }

      /* header */
      #mds-header {
        padding:1rem 1.25rem 0.6rem;border-bottom:1px solid #f0f0f0;flex-shrink:0;
      }
      .mds-title { font-size:0.95rem;font-weight:600;color:#111;margin-bottom:3px; }
      .mds-sub   { font-size:0.73rem;color:#6b7280; }

      /* tabs */
      #mds-tabs {
        display:flex;gap:0;border-bottom:1px solid #e5e7eb;flex-shrink:0;
        overflow-x:auto;background:#f9fafb;
      }
      .mds-tab {
        padding:10px 18px;font-size:0.8rem;cursor:pointer;color:#6b7280;
        border-bottom:2px solid transparent;white-space:nowrap;background:none;border-top:none;
        border-left:none;border-right:none;font-family:inherit;transition:all 0.15s;
      }
      .mds-tab:hover  { color:#1d4ed8; }
      .mds-tab.active { color:#1d4ed8;border-bottom-color:#1d4ed8;font-weight:600;background:#fff; }

      /* body */
      #mds-body { flex:1;overflow-y:auto;padding:1.5rem; }

      /* close */
      #mds-close {
        position:absolute;top:14px;right:16px;background:none;border:none;
        font-size:1.3rem;cursor:pointer;color:#9ca3af;z-index:10;
      }
      #mds-close:hover { color:#111; }

      /* ── EXPLAIN tab ── */
      .mds-mode-btns { display:flex;gap:8px;margin-bottom:1.25rem;flex-wrap:wrap; }
      .mds-mode-btn {
        padding:8px 18px;border:1.5px solid #e5e7eb;border-radius:8px;
        background:#fff;cursor:pointer;font-size:0.82rem;color:#374151;transition:all 0.15s;
      }
      .mds-mode-btn:hover  { border-color:#1d4ed8;color:#1d4ed8; }
      .mds-mode-btn.active { border-color:#1d4ed8;background:#eff6ff;color:#1d4ed8;font-weight:600; }
      .mds-stream-box {
        font-size:0.88rem;line-height:1.85;color:#111;min-height:200px;
        font-family:'Georgia',serif;white-space:pre-wrap;
      }
      .mds-stream-box strong { font-weight:600;color:#1d4ed8; }

      /* ── FLASHCARDS tab ── */
      .mds-fc-controls { display:flex;align-items:center;gap:10px;margin-bottom:1.25rem;flex-wrap:wrap; }
      .mds-fc-count { font-size:0.8rem;color:#6b7280; }
      .mds-generate-btn {
        padding:8px 18px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;
        font-size:0.82rem;font-weight:600;cursor:pointer;
      }
      .mds-generate-btn:disabled { background:#9ca3af;cursor:not-allowed; }

      /* card flip */
      .mds-fc-area { perspective:1000px;margin-bottom:1.25rem; }
      .mds-fc-card {
        width:100%;min-height:180px;cursor:pointer;
        transform-style:preserve-3d;transition:transform 0.5s;position:relative;
      }
      .mds-fc-card.flipped { transform:rotateY(180deg); }
      .mds-fc-front, .mds-fc-back {
        position:absolute;inset:0;backface-visibility:hidden;
        border-radius:12px;padding:1.5rem;display:flex;flex-direction:column;
        justify-content:center;align-items:center;text-align:center;
        border:1.5px solid #e5e7eb;
      }
      .mds-fc-front { background:#f8faff; }
      .mds-fc-back  { background:#f0fdf4;transform:rotateY(180deg); }
      .mds-fc-label { font-size:0.68rem;font-weight:600;text-transform:uppercase;
        letter-spacing:0.06em;margin-bottom:0.6rem; }
      .mds-fc-front .mds-fc-label { color:#1d4ed8; }
      .mds-fc-back  .mds-fc-label { color:#065f46; }
      .mds-fc-text  { font-size:0.9rem;line-height:1.7;color:#111;font-family:'Georgia',serif; }
      .mds-fc-hint  { font-size:0.72rem;color:#9ca3af;margin-top:0.75rem; }

      .mds-fc-nav { display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem; }
      .mds-fc-nav-btn {
        padding:7px 16px;border:1px solid #e5e7eb;border-radius:6px;
        background:#fff;cursor:pointer;font-size:0.8rem;color:#374151;
      }
      .mds-fc-nav-btn:disabled { opacity:0.3;cursor:not-allowed; }
      .mds-fc-progress { font-size:0.78rem;color:#6b7280; }

      .mds-fc-diff-row { display:flex;gap:8px;justify-content:center; }
      .mds-fc-diff {
        padding:5px 14px;border-radius:20px;font-size:0.72rem;font-weight:600;cursor:pointer;
      }
      .mds-diff-easy   { background:#dcfce7;color:#166534; }
      .mds-diff-medium { background:#fef9c3;color:#854d0e; }
      .mds-diff-hard   { background:#fee2e2;color:#991b1b; }

      /* deck grid */
      .mds-fc-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px; }
      .mds-fc-mini {
        background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;
        cursor:pointer;transition:border-color 0.12s;
      }
      .mds-fc-mini:hover { border-color:#1d4ed8; }
      .mds-fc-mini-q { font-size:0.78rem;font-weight:500;color:#111;margin-bottom:4px; }
      .mds-fc-mini-tag { font-size:0.65rem;padding:2px 7px;border-radius:10px;font-weight:600; }
      .tag-easy   { background:#dcfce7;color:#166534; }
      .tag-medium { background:#fef9c3;color:#854d0e; }
      .tag-hard   { background:#fee2e2;color:#991b1b; }

      /* ── ARGUMENTS tab ── */
      .mds-args-grid { display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem; }
      .mds-args-col { border-radius:10px;padding:1rem; }
      .mds-args-col.petitioner { background:#eff6ff;border:1px solid #bfdbfe; }
      .mds-args-col.respondent { background:#fef2f2;border:1px solid #fecaca; }
      .mds-args-col-title { font-size:0.8rem;font-weight:600;margin-bottom:0.75rem; }
      .mds-args-col.petitioner .mds-args-col-title { color:#1e40af; }
      .mds-args-col.respondent .mds-args-col-title { color:#991b1b; }

      .mds-arg-item { background:#fff;border-radius:6px;padding:8px 10px;margin-bottom:6px; }
      .mds-arg-point { font-size:0.78rem;font-weight:600;color:#111;margin-bottom:3px; }
      .mds-arg-detail { font-size:0.74rem;color:#6b7280;line-height:1.55; }
      .mds-arg-para { font-size:0.68rem;color:#9ca3af;margin-top:3px; }
      .mds-arg-strength {
        float:right;font-size:0.65rem;padding:1px 6px;border-radius:10px;font-weight:600;
      }
      .str-strong { background:#dcfce7;color:#166534; }
      .str-moderate { background:#fef9c3;color:#854d0e; }
      .str-weak { background:#f3f4f6;color:#6b7280; }

      .mds-finding-box {
        background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:0.75rem 1rem;
        font-size:0.8rem;line-height:1.65;color:#065f46;margin-top:0.5rem;
      }

      /* ── RATIO/OBITER tab ── */
      .mds-ro-legend { display:flex;gap:8px;flex-wrap:wrap;margin-bottom:1rem; }
      .mds-ro-legend-item { display:flex;align-items:center;gap:4px;font-size:0.72rem;color:#6b7280; }
      .mds-ro-dot { width:10px;height:10px;border-radius:2px;flex-shrink:0; }

      .mds-ro-list { display:flex;flex-direction:column;gap:4px; }
      .mds-ro-item {
        display:grid;grid-template-columns:48px 80px 1fr;gap:8px;
        align-items:start;padding:6px 8px;border-radius:6px;font-size:0.78rem;
        border-left:3px solid transparent;
      }
      .mds-ro-item.ratio       { border-color:#f59e0b;background:#fffbeb; }
      .mds-ro-item.obiter      { border-color:#d1d5db;background:#f9fafb; }
      .mds-ro-item.facts       { border-color:#60a5fa;background:#eff6ff; }
      .mds-ro-item.issues      { border-color:#f472b6;background:#fdf2f8; }
      .mds-ro-item.order       { border-color:#a78bfa;background:#f5f3ff; }
      .mds-ro-item.procedural  { border-color:#d1d5db;background:#f9fafb; }

      .mds-ro-num  { font-weight:600;color:#6b7280; }
      .mds-ro-type { font-weight:600;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.04em; }
      .mds-ro-text { color:#374151;line-height:1.55; }
      .mds-ro-reason { font-size:0.68rem;color:#9ca3af;margin-top:2px; }

      .mds-ratio-summary {
        background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
        padding:0.75rem 1rem;font-size:0.82rem;font-weight:500;color:#92400e;
        margin-bottom:1rem;
      }

      /* ── SYNTHESIS tab ── */
      .mds-synth-cases { display:flex;flex-wrap:wrap;gap:6px;margin-bottom:0.75rem; }
      .mds-synth-case-chip {
        padding:4px 12px;border-radius:20px;font-size:0.72rem;font-weight:500;
        background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;display:flex;
        align-items:center;gap:4px;
      }
      .mds-synth-remove { cursor:pointer;color:#6b7280; }
      .mds-synth-remove:hover { color:#dc2626; }
      .mds-synth-question {
        width:100%;padding:9px 12px;border:1px solid #e5e7eb;border-radius:8px;
        font-size:0.85rem;margin-bottom:0.75rem;outline:none;font-family:inherit;
      }
      .mds-synth-question:focus { border-color:#1d4ed8; }
      .mds-synth-modes { display:flex;gap:8px;margin-bottom:0.75rem;flex-wrap:wrap; }
      .mds-synth-mode-btn {
        padding:6px 14px;border:1.5px solid #e5e7eb;border-radius:20px;
        background:#fff;cursor:pointer;font-size:0.78rem;color:#374151;transition:all 0.12s;
      }
      .mds-synth-mode-btn.active { border-color:#1d4ed8;background:#eff6ff;color:#1d4ed8;font-weight:600; }

      /* Loading spinner */
      .mds-loading {
        display:flex;align-items:center;gap:8px;color:#6b7280;
        font-size:0.82rem;padding:1.5rem 0;
      }
      .mds-spinner {
        width:16px;height:16px;border:2px solid #e5e7eb;
        border-top-color:#1d4ed8;border-radius:50%;animation:mds-spin 0.7s linear infinite;
      }
      @keyframes mds-spin { to { transform:rotate(360deg); } }

      /* toast */
      #mds-toast {
        position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);
        background:#111;color:#fff;padding:8px 18px;border-radius:8px;
        font-size:0.8rem;opacity:0;transition:opacity 0.3s;pointer-events:none;z-index:99999;
      }
      #mds-toast.show { opacity:1; }

      @media(max-width:640px){
        .mds-args-grid { grid-template-columns:1fr; }
      }
    `;
    document.head.appendChild(s);
  }

  // ── Toast ────────────────────────────────────────────
  function toast(msg) {
    let el = document.getElementById("mds-toast");
    if (!el) { el = document.createElement("div"); el.id="mds-toast"; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2200);
  }

  // ── Build shell ──────────────────────────────────────
  function buildShell() {
    if (document.getElementById("mds-overlay")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div id="mds-overlay">
        <div id="mds-panel">
          <button id="mds-close">✕</button>
          <div id="mds-header">
            <div class="mds-title" id="mds-title">Study Mode</div>
            <div class="mds-sub"  id="mds-sub"></div>
          </div>
          <div id="mds-tabs">
            <button class="mds-tab active" data-tab="explain">💡 Explain</button>
            <button class="mds-tab" data-tab="flashcards">🃏 Flashcards</button>
            <button class="mds-tab" data-tab="arguments">⚔️ Arguments</button>
            <button class="mds-tab" data-tab="ratio">🔍 Ratio / Obiter</button>
            <button class="mds-tab" data-tab="synthesis">🔗 Multi-case Synthesis</button>
          </div>
          <div id="mds-body"></div>
        </div>
      </div>
    `);

    document.getElementById("mds-close")?.addEventListener("click", close);
    document.getElementById("mds-overlay")?.addEventListener("click", e => {
      if (e.target.id === "mds-overlay") close();
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });

    document.querySelectorAll(".mds-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".mds-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        renderTab(tab.dataset.tab);
      });
    });
  }

  // ── Loading indicator ────────────────────────────────
  function loading(msg = "Generating...") {
    return `<div class="mds-loading"><div class="mds-spinner"></div>${msg}</div>`;
  }

  // ── Stream reader helper ─────────────────────────────
  async function streamInto(endpoint, body, onToken, onDone) {
    const res     = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split("\n");
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const chunk = JSON.parse(line.slice(5));
          if (chunk.token) onToken(chunk.token);
          if (chunk.done)  { onDone(chunk); break; }
        } catch {}
      }
    }
  }

  // ─────────────────────────────────────────────────────
  // TAB: EXPLAIN
  // ─────────────────────────────────────────────────────
  function renderExplain() {
    const body = document.getElementById("mds-body");
    body.innerHTML = `
      <div class="mds-mode-btns">
        <button class="mds-mode-btn active" data-mode="simplified">📘 Simplified</button>
        <button class="mds-mode-btn" data-mode="eli5">🧒 ELI5</button>
        <button class="mds-mode-btn" data-mode="story">📖 Storytelling</button>
      </div>
      <div class="mds-stream-box" id="mds-explain-output">
        Click a mode above to generate explanation.
      </div>`;

    let activeMode = "simplified";

    body.querySelectorAll(".mds-mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        body.querySelectorAll(".mds-mode-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeMode = btn.dataset.mode;
        runExplain(activeMode);
      });
    });

    // Auto-run simplified on open
    runExplain("simplified");
  }

  async function runExplain(mode) {
    const out = document.getElementById("mds-explain-output");
    if (!out || !currentCase) return;
    out.innerHTML = loading(mode === "eli5" ? "Simplifying..." : mode === "story" ? "Crafting story..." : "Explaining...");

    let text = "";
    try {
      await streamInto(
        API.explain,
        { case_id: currentCase.case_id, mode },
        token => {
          text += token;
          // Bold **text** rendering
          out.innerHTML = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
        },
        () => {}
      );
    } catch {
      out.innerHTML = `<span style="color:#ef4444;">Could not load explanation. Is Ollama running?</span>`;
    }
  }

  // ─────────────────────────────────────────────────────
  // TAB: FLASHCARDS
  // ─────────────────────────────────────────────────────
  function renderFlashcards() {
    const body = document.getElementById("mds-body");
    body.innerHTML = `
      <div class="mds-fc-controls">
        <span class="mds-fc-count">Generate flashcards from this case:</span>
        <select id="mds-fc-count-sel" style="padding:5px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:0.8rem;">
          <option value="6">6 cards</option>
          <option value="8" selected>8 cards</option>
          <option value="12">12 cards</option>
        </select>
        <button class="mds-generate-btn" id="mds-fc-gen">Generate ⚡</button>
      </div>
      <div id="mds-fc-content">
        <div style="color:#9ca3af;font-size:0.82rem;text-align:center;padding:3rem;">
          Click Generate to create flashcards from this case.
        </div>
      </div>`;

    document.getElementById("mds-fc-gen")?.addEventListener("click", runFlashcards);
  }

  async function runFlashcards() {
    const btn     = document.getElementById("mds-fc-gen");
    const content = document.getElementById("mds-fc-content");
    const count   = parseInt(document.getElementById("mds-fc-count-sel")?.value || "8");
    if (!btn || !content || !currentCase) return;

    btn.disabled    = true;
    btn.textContent = "Generating...";
    content.innerHTML = loading("Building flashcards...");

    try {
      await streamInto(
        API.flashcards,
        { case_id: currentCase.case_id, count },
        () => {},
        chunk => {
          const cards = chunk.cards || [];
          flashState  = { cards, current: 0, flipped: false };
          renderFlashcardDeck(cards, content, btn);
        }
      );
    } catch {
      content.innerHTML = `<span style="color:#ef4444;">Error generating flashcards.</span>`;
      btn.disabled = false; btn.textContent = "Generate ⚡";
    }
  }

  function renderFlashcardDeck(cards, container, btn) {
    if (!cards.length) { container.innerHTML = `<p style="color:#9ca3af;">No cards generated.</p>`; return; }
    btn.disabled    = false;
    btn.textContent = "Regenerate ⚡";
    flashState      = { cards, current: 0, flipped: false };
    showCard(container);
  }

  function showCard(container) {
    const { cards, current, flipped } = flashState;
    const card = cards[current];
    if (!card) return;

    const diffClass = { easy: "tag-easy", medium: "tag-medium", hard: "tag-hard" };
    const strClass  = { easy: "mds-diff-easy", medium: "mds-diff-medium", hard: "mds-diff-hard" };

    container.innerHTML = `
      <div class="mds-fc-nav">
        <button class="mds-fc-nav-btn" id="mds-fc-prev" ${current===0?"disabled":""}>← Prev</button>
        <span class="mds-fc-progress">Card ${current+1} of ${cards.length}
          <span class="mds-fc-mini-tag ${diffClass[card.difficulty]||"tag-medium"}">${card.difficulty||"medium"}</span>
          <span class="mds-fc-mini-tag" style="background:#e0e7ff;color:#3730a3;">${card.type||""}</span>
        </span>
        <button class="mds-fc-nav-btn" id="mds-fc-next" ${current===cards.length-1?"disabled":""}>Next →</button>
      </div>

      <div class="mds-fc-area">
        <div class="mds-fc-card ${flipped?"flipped":""}" id="mds-fc-card">
          <div class="mds-fc-front">
            <div class="mds-fc-label">Question</div>
            <div class="mds-fc-text">${card.question}</div>
            <div class="mds-fc-hint">Click to reveal answer</div>
          </div>
          <div class="mds-fc-back">
            <div class="mds-fc-label">Answer</div>
            <div class="mds-fc-text">${card.answer}</div>
          </div>
        </div>
      </div>

      <div class="mds-fc-diff-row">
        <button class="mds-fc-diff mds-diff-easy"   data-rate="easy">Got it ✓</button>
        <button class="mds-fc-diff mds-diff-medium"  data-rate="medium">Almost</button>
        <button class="mds-fc-diff mds-diff-hard"    data-rate="hard">Missed it</button>
      </div>

      <div style="margin-top:1.25rem;">
        <div style="font-size:0.75rem;font-weight:600;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;">All cards</div>
        <div class="mds-fc-grid">
          ${cards.map((c,i) => `
          <div class="mds-fc-mini" data-idx="${i}" style="${i===current?"border-color:#1d4ed8;":""}">
            <div class="mds-fc-mini-q">${c.question}</div>
            <span class="mds-fc-mini-tag ${diffClass[c.difficulty]||"tag-medium"}">${c.difficulty||""}</span>
          </div>`).join("")}
        </div>
      </div>`;

    document.getElementById("mds-fc-card")?.addEventListener("click", () => {
      flashState.flipped = !flashState.flipped;
      document.getElementById("mds-fc-card")?.classList.toggle("flipped", flashState.flipped);
    });
    document.getElementById("mds-fc-prev")?.addEventListener("click", () => {
      flashState.current--; flashState.flipped = false; showCard(container);
    });
    document.getElementById("mds-fc-next")?.addEventListener("click", () => {
      flashState.current++; flashState.flipped = false; showCard(container);
    });
    container.querySelectorAll(".mds-fc-mini").forEach(item => {
      item.addEventListener("click", () => {
        flashState.current = parseInt(item.dataset.idx);
        flashState.flipped = false; showCard(container);
      });
    });
    container.querySelectorAll(".mds-fc-diff").forEach(btn => {
      btn.addEventListener("click", () => {
        if (flashState.current < cards.length - 1) {
          flashState.current++; flashState.flipped = false; showCard(container);
        } else {
          toast("All cards reviewed! 🎉");
        }
      });
    });
  }

  // ─────────────────────────────────────────────────────
  // TAB: ARGUMENTS
  // ─────────────────────────────────────────────────────
  function renderArguments() {
    const body = document.getElementById("mds-body");
    body.innerHTML = loading("Extracting arguments...");

    streamInto(
      API.arguments,
      { case_id: currentCase.case_id },
      () => {},
      chunk => {
        const data = chunk.arguments || {};
        renderArgumentsData(data);
      }
    ).catch(() => {
      body.innerHTML = `<span style="color:#ef4444;">Error extracting arguments.</span>`;
    });
  }

  function renderArgumentsData(data) {
    const body = document.getElementById("mds-body");
    if (!body) return;

    const strClass = { strong: "str-strong", moderate: "str-moderate", weak: "str-weak" };
    const winLabel = data.winning_side === "petitioner"
      ? `<span style="color:#1e40af;font-weight:600;">Petitioner won ✓</span>`
      : data.winning_side === "respondent"
      ? `<span style="color:#991b1b;font-weight:600;">Respondent won ✓</span>`
      : `<span style="color:#854d0e;font-weight:600;">Partially decided</span>`;

    const renderArgs = (args = []) => args.map(a => `
      <div class="mds-arg-item">
        <span class="mds-arg-strength ${strClass[a.strength]||"str-moderate"}">${a.strength||""}</span>
        <div class="mds-arg-point">${a.point}</div>
        <div class="mds-arg-detail">${a.detail}</div>
        ${a.para_ref ? `<div class="mds-arg-para">↳ Para ${a.para_ref}</div>` : ""}
      </div>`).join("");

    body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:8px;">
        <div style="font-size:0.82rem;color:#6b7280;">Court finding: ${winLabel}</div>
        <button id="mds-args-copy" style="padding:5px 12px;border:1px solid #e5e7eb;border-radius:6px;font-size:0.75rem;background:#fff;cursor:pointer;">📋 Copy summary</button>
      </div>

      <div class="mds-args-grid">
        <div class="mds-args-col petitioner">
          <div class="mds-args-col-title">🟦 ${data.petitioner_name||"Petitioner / Appellant"}</div>
          ${renderArgs(data.petitioner_arguments)}
        </div>
        <div class="mds-args-col respondent">
          <div class="mds-args-col-title">🟥 ${data.respondent_name||"Respondent"}</div>
          ${renderArgs(data.respondent_arguments)}
        </div>
      </div>

      ${data.court_finding ? `<div class="mds-finding-box"><strong>Court's finding:</strong> ${data.court_finding}</div>` : ""}`;

    document.getElementById("mds-args-copy")?.addEventListener("click", () => {
      const text = [
        `Arguments — ${currentCase?.case_name} (${currentCase?.citation})`,
        `\nPETITIONER (${data.petitioner_name}):`,
        ...(data.petitioner_arguments||[]).map(a => `• ${a.point}: ${a.detail}`),
        `\nRESPONDENT (${data.respondent_name}):`,
        ...(data.respondent_arguments||[]).map(a => `• ${a.point}: ${a.detail}`),
        `\nCourt: ${data.court_finding}`,
      ].join("\n");
      navigator.clipboard.writeText(text);
      toast("Arguments copied ✓");
    });
  }

  // ─────────────────────────────────────────────────────
  // TAB: RATIO / OBITER
  // ─────────────────────────────────────────────────────
  function renderRatioObiter() {
    const body = document.getElementById("mds-body");
    body.innerHTML = loading("Classifying paragraphs...");

    streamInto(
      API.ratio,
      { case_id: currentCase.case_id },
      () => {},
      chunk => renderRatioData(chunk.classifications || {})
    ).catch(() => {
      body.innerHTML = `<span style="color:#ef4444;">Error classifying paragraphs.</span>`;
    });
  }

  function renderRatioData(data) {
    const body = document.getElementById("mds-body");
    if (!body) return;

    const classes  = data.classifications || [];
    const colors   = { ratio:"#f59e0b", obiter:"#d1d5db", facts:"#60a5fa", issues:"#f472b6", order:"#a78bfa", procedural:"#d1d5db" };

    body.innerHTML = `
      ${data.ratio_summary ? `<div class="mds-ratio-summary"><strong>Ratio:</strong> ${data.ratio_summary}</div>` : ""}
      ${data.key_obiter ? `<div style="background:#f3f4f6;border-radius:8px;padding:0.75rem 1rem;font-size:0.78rem;color:#6b7280;margin-bottom:1rem;"><strong>Key obiter:</strong> ${data.key_obiter}</div>` : ""}

      <div class="mds-ro-legend">
        ${Object.entries(colors).map(([t,c]) => `
        <div class="mds-ro-legend-item">
          <div class="mds-ro-dot" style="background:${c};"></div>
          <span style="text-transform:capitalize;">${t}</span>
        </div>`).join("")}
      </div>

      <div class="mds-ro-list">
        ${classes.map(c => `
        <div class="mds-ro-item ${c.type||"procedural"}">
          <span class="mds-ro-num">Para ${c.para_number}</span>
          <span class="mds-ro-type" style="color:${colors[c.type]||"#6b7280"};">${c.type}</span>
          <div>
            <div class="mds-ro-reason">${c.reason||""}</div>
          </div>
        </div>`).join("")}
      </div>`;
  }

  // ─────────────────────────────────────────────────────
  // TAB: MULTI-CASE SYNTHESIS
  // ─────────────────────────────────────────────────────
  let synthCases = [];  // { case_id, case_name, citation }

  function renderSynthesis() {
    const body = document.getElementById("mds-body");

    // Pre-add current case if in single-case mode
    if (currentCase && !synthCases.find(c => c.case_id === currentCase.case_id)) {
      synthCases = [{ ...currentCase }];
    }

    body.innerHTML = `
      <div style="margin-bottom:0.75rem;">
        <div style="font-size:0.75rem;font-weight:600;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;">Cases (2–5 required)</div>
        <div class="mds-synth-cases" id="mds-synth-chips"></div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="mds-synth-add-id" type="text" placeholder="Paste case_id to add another case..."
            style="flex:1;padding:7px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:0.8rem;outline:none;">
          <button id="mds-synth-add-btn" style="padding:7px 14px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:0.8rem;font-weight:600;cursor:pointer;">Add</button>
        </div>
      </div>

      <input class="mds-synth-question" id="mds-synth-q"
        placeholder="Enter your legal question (e.g. What is the test for anticipatory bail under Section 438?)">

      <div class="mds-synth-modes" id="mds-synth-modes">
        <button class="mds-synth-mode-btn active" data-mode="synthesis">Synthesise</button>
        <button class="mds-synth-mode-btn" data-mode="compare">Compare</button>
        <button class="mds-synth-mode-btn" data-mode="evolution">Trace evolution</button>
      </div>

      <button id="mds-synth-run" style="padding:9px 20px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:600;cursor:pointer;">
        Synthesise ⚡
      </button>

      <div class="mds-stream-box" id="mds-synth-output" style="margin-top:1.25rem;"></div>`;

    renderSynthChips();

    document.querySelectorAll(".mds-synth-mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".mds-synth-mode-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    document.getElementById("mds-synth-add-btn")?.addEventListener("click", () => {
      const id = document.getElementById("mds-synth-add-id")?.value.trim();
      if (!id) return;
      if (synthCases.length >= 5) return toast("Max 5 cases");
      if (synthCases.find(c => c.case_id === id)) return toast("Already added");
      synthCases.push({ case_id: id, case_name: id, citation: "" });
      document.getElementById("mds-synth-add-id").value = "";
      renderSynthChips();
    });

    document.getElementById("mds-synth-run")?.addEventListener("click", runSynthesis);
  }

  function renderSynthChips() {
    const el = document.getElementById("mds-synth-chips");
    if (!el) return;
    el.innerHTML = synthCases.map(c => `
      <div class="mds-synth-case-chip">
        ${c.case_name || c.case_id}
        <span class="mds-synth-remove" data-id="${c.case_id}">×</span>
      </div>`).join("");

    el.querySelectorAll(".mds-synth-remove").forEach(btn => {
      btn.addEventListener("click", () => {
        synthCases = synthCases.filter(c => c.case_id !== btn.dataset.id);
        renderSynthChips();
      });
    });
  }

  async function runSynthesis() {
    const question = document.getElementById("mds-synth-q")?.value.trim();
    const mode     = document.querySelector(".mds-synth-mode-btn.active")?.dataset.mode || "synthesis";
    const out      = document.getElementById("mds-synth-output");
    if (!out) return;

    if (synthCases.length < 2) return toast("Add at least 2 cases");
    if (!question)              return toast("Enter a legal question");

    out.innerHTML = loading("Synthesising across cases...");

    let text = "";
    try {
      await streamInto(
        API.synthesize,
        { case_ids: synthCases.map(c => c.case_id), question, mode },
        token => {
          text += token;
          out.innerHTML = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
        },
        () => {}
      );
    } catch {
      out.innerHTML = `<span style="color:#ef4444;">Synthesis failed. Check that all case IDs are valid.</span>`;
    }
  }

  // ─────────────────────────────────────────────────────
  // Tab router
  // ─────────────────────────────────────────────────────
  function renderTab(tab) {
    const renders = {
      explain:   renderExplain,
      flashcards:renderFlashcards,
      arguments: renderArguments,
      ratio:     renderRatioObiter,
      synthesis: renderSynthesis,
    };
    renders[tab]?.();
  }

  // ─────────────────────────────────────────────────────
  // Public: openCase(caseId, caseName, citation)
  // ─────────────────────────────────────────────────────
  function openCase(caseId, caseName, citation = "") {
    injectCSS();
    buildShell();

    currentCase = { case_id: caseId, case_name: caseName, citation };
    synthCases  = [{ ...currentCase }];

    document.getElementById("mds-title").textContent = caseName || "Study Mode";
    document.getElementById("mds-sub").textContent   = citation || "";

    // Reset to first tab
    document.querySelectorAll(".mds-tab").forEach(t => t.classList.remove("active"));
    document.querySelector('.mds-tab[data-tab="explain"]')?.classList.add("active");

    document.getElementById("mds-overlay")?.classList.add("open");
    renderExplain();
  }

  // ─────────────────────────────────────────────────────
  // Public: openSynthesis(cases, question)
  // cases = [{ case_id, case_name, citation }]
  // ─────────────────────────────────────────────────────
  function openSynthesis(cases, question = "") {
    injectCSS();
    buildShell();

    currentCase = cases[0] || null;
    synthCases  = [...cases];

    document.getElementById("mds-title").textContent = "Multi-case Synthesis";
    document.getElementById("mds-sub").textContent   = `${cases.length} cases`;

    document.querySelectorAll(".mds-tab").forEach(t => t.classList.remove("active"));
    document.querySelector('.mds-tab[data-tab="synthesis"]')?.classList.add("active");

    document.getElementById("mds-overlay")?.classList.add("open");
    renderSynthesis();

    // Pre-fill question
    setTimeout(() => {
      const q = document.getElementById("mds-synth-q");
      if (q && question) q.value = question;
    }, 50);
  }

  function close() {
    document.getElementById("mds-overlay")?.classList.remove("open");
  }

  return { openCase, openSynthesis, close };
})();
