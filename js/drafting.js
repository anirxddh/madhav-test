/**
 * madhav.ai — Drafting Engine
 * Drop this file next to your app.js and import it in index.html:
 *   <script src="drafting.js"></script>
 * Then call: MadhavDrafting.init() after DOM load.
 */

const MadhavDrafting = (() => {

  // ── State ──────────────────────────────────────────────
  let currentDraft = "";
  let isGenerating = false;

  const TEMPLATES = {
    legal_notice:    { label: "Legal Notice",     icon: "📋" },
    petition:        { label: "Writ Petition",     icon: "⚖️" },
    bail_application:{ label: "Bail Application",  icon: "🔓" },
    affidavit:       { label: "Affidavit",         icon: "📜" },
  };

  // ── HTML Template ──────────────────────────────────────
  function getHTML() {
    const templatesHTML = Object.entries(TEMPLATES).map(([key, t]) => `
      <button class="md-tmpl-btn" data-key="${key}"
        style="padding:8px 6px;border:1.5px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;font-size:0.78rem;color:#374151;text-align:center;transition:all 0.15s;">
        <div style="font-size:1.1rem;margin-bottom:2px;">${t.icon}</div>
        ${t.label}
      </button>`).join("");

    const tonesHTML = ["formal","aggressive","concise"].map(t => `
      <button class="md-tone-btn" data-tone="${t}"
        style="flex:1;padding:6px 4px;border:1.5px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer;font-size:0.75rem;color:#374151;transition:all 0.15s;">
        ${t.charAt(0).toUpperCase()+t.slice(1)}
      </button>`).join("");

    const fieldsHTML = `
      ${field("md-party-name",    "Your Client / Petitioner Name",  "text",     "e.g. Ram Prasad Sharma")}
      ${field("md-opp-party",     "Opposite Party / Respondent",    "text",     "e.g. State of Maharashtra")}
      ${field("md-court",         "Court (optional)",               "text",     "e.g. High Court of Bombay")}
      ${field("md-jurisdiction",  "Jurisdiction (optional)",        "text",     "e.g. Maharashtra")}
      ${field("md-acts",          "Acts & Sections (optional)",     "text",     "e.g. IPC 420, CPC Order 39")}
      ${field("md-citations",     "Case Citations (optional)",      "text",     "e.g. AIR 2021 SC 1234")}
      ${field("md-facts",         "Facts of the Case",              "textarea", "Describe what happened in plain language...", 4)}
      ${field("md-relief",        "Relief / Demand Sought",         "textarea", "What outcome do you want?", 2)}
    `;

    return `
<div id="md-draft-root" style="font-family:system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:1rem;">

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;">
    <div>
      <h2 style="margin:0;font-size:1.2rem;font-weight:600;color:#1a1a1a;">Drafting Engine</h2>
      <p style="margin:4px 0 0;font-size:0.8rem;color:#6b7280;">Generate court-ready legal documents in seconds</p>
    </div>
    <div id="md-status-badge" style="display:none;font-size:0.75rem;padding:4px 12px;border-radius:20px;background:#fef3c7;color:#92400e;font-weight:500;">
      Generating...
    </div>
  </div>

  <div style="display:grid;grid-template-columns:380px 1fr;gap:1.25rem;align-items:start;height:calc(100vh - 200px);max-height:calc(100vh - 200px);">

    <!-- LEFT: Form Panel (SCROLLABLE) -->
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:1.25rem;height:100%;overflow-y:auto;">

      <!-- Template selector -->
      <div style="margin-bottom:1rem;">
        <label style="display:block;font-size:0.75rem;font-weight:600;color:#374151;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:0.05em;">Document Type</label>
        <div id="md-template-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          ${templatesHTML}
        </div>
      </div>

      <!-- Tone selector -->
      <div style="margin-bottom:1rem;">
        <label style="display:block;font-size:0.75rem;font-weight:600;color:#374151;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:0.05em;">Tone</label>
        <div style="display:flex;gap:6px;">
          ${tonesHTML}
        </div>
      </div>

      <hr style="border:none;border-top:1px solid #f3f4f6;margin:1rem 0;">

      <!-- Form fields -->
      ${fieldsHTML}

      <button id="md-generate-btn"
        style="width:100%;margin-top:0.75rem;padding:10px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:0.9rem;font-weight:600;cursor:pointer;transition:background 0.15s;">
        Generate Draft ⚡
      </button>
    </div>

    <!-- RIGHT: Output Panel (SCROLLABLE) -->
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;height:100%;display:flex;flex-direction:column;">

      <!-- Output toolbar -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;border-bottom:1px solid #f3f4f6;background:#f9fafb;flex-shrink:0;">
        <span style="font-size:0.8rem;font-weight:600;color:#374151;" id="md-doc-title">Draft will appear here</span>
        <div style="display:flex;gap:6px;">
          <button id="md-copy-btn" class="md-toolbar-btn" title="Copy to clipboard">📋 Copy</button>
          <button id="md-pdf-btn"  class="md-toolbar-btn" title="Export as PDF">📄 PDF</button>
          <button id="md-clear-btn" class="md-toolbar-btn" title="Clear">✕ Clear</button>
        </div>
      </div>

      <!-- Draft output (SCROLLABLE) -->
      <div id="md-output"
        style="flex:1;min-height:300px;padding:1.25rem;font-size:0.85rem;line-height:1.8;color:#111;white-space:pre-wrap;font-family:'Georgia',serif;overflow-y:auto;">
        <div id="md-placeholder" style="color:#9ca3af;font-size:0.875rem;font-family:system-ui;text-align:center;margin-top:4rem;">
          <div style="font-size:2rem;margin-bottom:0.75rem;">⚖️</div>
          Fill in the form and click <strong>Generate Draft</strong><br>to create your legal document.
        </div>
      </div>

      <!-- Refine bar (shown after first draft) -->
      <div id="md-refine-bar" style="display:none;padding:0.75rem 1rem;border-top:1px solid #f3f4f6;background:#f9fafb;flex-shrink:0;border-top:1px solid #f3f4f6;">
        <div style="display:flex;gap:6px;">
          <input id="md-refine-input" type="text" placeholder='Refine: e.g. "make more aggressive" or "add Section 138 NI Act"'
            style="flex:1;padding:8px 12px;border:1px solid #e5e7eb;border-radius:6px;font-size:0.82rem;outline:none;">
          <button id="md-refine-btn"
            style="padding:8px 14px;background:#059669;color:#fff;border:none;border-radius:6px;font-size:0.82rem;font-weight:600;cursor:pointer;white-space:nowrap;">
            Refine ✨
          </button>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
          ${["Make more aggressive","Add verification clause","Simplify language","Add more case law","Make concise"].map(s =>
            `<button class="md-quick-refine" style="font-size:0.72rem;padding:3px 10px;border:1px solid #d1d5db;border-radius:20px;background:#fff;cursor:pointer;color:#374151;">${s}</button>`
          ).join("")}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
.md-toolbar-btn{padding:5px 10px;border:1px solid #e5e7eb;border-radius:6px;background:#fff;cursor:pointer;font-size:0.75rem;color:#374151;}
.md-toolbar-btn:hover{background:#f3f4f6;}
.md-tmpl-btn:hover,.md-tone-btn:hover{border-color:#1d4ed8;color:#1d4ed8;}
.md-tmpl-btn.active{border-color:#1d4ed8;background:#eff6ff;color:#1d4ed8;font-weight:600;}
.md-tone-btn.active{border-color:#1d4ed8;background:#eff6ff;color:#1d4ed8;font-weight:600;}
.md-quick-refine:hover{background:#f3f4f6;}
#md-generate-btn:hover{background:#1e40af;}
#md-generate-btn:disabled{background:#9ca3af;cursor:not-allowed;}
#md-refine-btn:hover{background:#047857;}
</style>`;
  }

  function field(id, label, type, placeholder, rows = 1) {
    const style = `width:100%;padding:7px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:0.82rem;outline:none;box-sizing:border-box;font-family:system-ui;`;
    const input = type === "textarea"
      ? `<textarea id="${id}" rows="${rows}" placeholder="${placeholder}" style="${style}resize:vertical;"></textarea>`
      : `<input id="${id}" type="${type}" placeholder="${placeholder}" style="${style}">`;
    return `
    <div style="margin-bottom:0.7rem;">
      <label for="${id}" style="display:block;font-size:0.72rem;font-weight:600;color:#6b7280;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.04em;">${label}</label>
      ${input}
    </div>`;
  }

  // ── Helpers ────────────────────────────────────────────
  function val(id) { return (document.getElementById(id)?.value || "").trim(); }

  function setActive(group, activeEl) {
    document.querySelectorAll(group).forEach(b => b.classList.remove("active"));
    activeEl.classList.add("active");
  }

  function showStatus(visible) {
    const b = document.getElementById("md-status-badge");
    if (b) b.style.display = visible ? "block" : "none";
  }

  function setGenerating(state) {
    isGenerating = state;
    const btn = document.getElementById("md-generate-btn");
    if (btn) {
      btn.disabled = state;
      btn.textContent = state ? "Generating... ⏳" : "Generate Draft ⚡";
    }
    showStatus(state);
  }

  // ── PDF Export ─────────────────────────────────────────
  function exportPDF() {
    if (!currentDraft) return alert("Generate a draft first.");
    const title = document.getElementById("md-doc-title")?.textContent || "Legal Draft";
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${title}</title>
      <style>
        body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.8;margin:2.5cm;color:#000;}
        h1{font-size:14pt;text-align:center;margin-bottom:1.5rem;}
        pre{white-space:pre-wrap;font-family:'Times New Roman',serif;font-size:12pt;}
        @media print{body{margin:2cm;}}
      </style></head><body>
      <h1>${title}</h1>
      <pre>${currentDraft.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>
      <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`);
    win.document.close();
  }

  // ── Stream draft from API ──────────────────────────────
  async function streamDraft(endpoint, body) {
    const output   = document.getElementById("md-output");
    const placeholder = document.getElementById("md-placeholder");
    if (placeholder) placeholder.style.display = "none";

    currentDraft = "";
    output.innerHTML = `<span id="md-stream-cursor" style="display:inline-block;width:2px;height:1em;background:#1d4ed8;margin-left:1px;animation:blink 1s step-end infinite;vertical-align:text-bottom;"></span>
<style>@keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}</style>`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const chunk = JSON.parse(line.slice(5));
            if (chunk.token) {
              currentDraft += chunk.token;
              const cursor = document.getElementById("md-stream-cursor");
              const style = cursor?.outerHTML || "";
              output.innerHTML = currentDraft.replace(/</g,"&lt;").replace(/>/g,"&gt;") + style;
              output.scrollTop = output.scrollHeight;
            }
            if (chunk.done) break;
          } catch {}
        }
      }

      // Remove cursor when done
      const cursor = document.getElementById("md-stream-cursor");
      if (cursor) cursor.remove();
      output.innerHTML = currentDraft.replace(/</g,"&lt;").replace(/>/g,"&gt;");

      // Show refine bar
      document.getElementById("md-refine-bar").style.display = "block";

    } catch (err) {
      output.innerHTML = `<span style="color:#dc2626;">Error: ${err.message}<br>Make sure your FastAPI server and Ollama are running.</span>`;
    } finally {
      setGenerating(false);
    }
  }

  // ── Main generate ──────────────────────────────────────
  function generate() {
    if (isGenerating) return;

    const templateType = document.querySelector(".md-tmpl-btn.active")?.dataset.key;
    const tone         = document.querySelector(".md-tone-btn.active")?.dataset.tone || "formal";

    if (!templateType)          return alert("Please select a document type.");
    if (!val("md-party-name"))  return alert("Please enter your client's name.");
    if (!val("md-opp-party"))   return alert("Please enter the opposite party.");
    if (!val("md-facts"))       return alert("Please describe the facts.");
    if (!val("md-relief"))      return alert("Please state the relief sought.");

    // Update doc title
    const titleEl = document.getElementById("md-doc-title");
    if (titleEl) titleEl.textContent = `${TEMPLATES[templateType].label} — ${val("md-party-name")} vs ${val("md-opp-party")}`;

    setGenerating(true);

    streamDraft("http://localhost:8000/api/draft", {
      template_type:  templateType,
      tone,
      party_name:     val("md-party-name"),
      opposite_party: val("md-opp-party"),
      court:          val("md-court"),
      jurisdiction:   val("md-jurisdiction"),
      act_sections:   val("md-acts"),
      case_citations: val("md-citations"),
      facts:          val("md-facts"),
      relief_sought:  val("md-relief"),
    });
  }

  // ── Refine ─────────────────────────────────────────────
  function refine(instruction) {
    if (isGenerating || !currentDraft) return;
    if (!instruction) {
      instruction = document.getElementById("md-refine-input")?.value.trim();
    }
    if (!instruction) return alert("Enter a refinement instruction.");
    setGenerating(true);
    streamDraft("http://localhost:8000/api/draft/refine", { draft: currentDraft, instruction });
  }

  // ── Init ───────────────────────────────────────────────
  function init(containerId = "madhav-drafting") {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`[MadhavDrafting] No element with id="${containerId}" found.`);
      return;
    }
    container.innerHTML = getHTML();

    // Template buttons
    document.querySelectorAll(".md-tmpl-btn").forEach(btn => {
      btn.addEventListener("click", () => setActive(".md-tmpl-btn", btn));
    });
    // Select first by default
    const firstTmpl = document.querySelector(".md-tmpl-btn");
    if (firstTmpl) firstTmpl.classList.add("active");

    // Tone buttons
    document.querySelectorAll(".md-tone-btn").forEach(btn => {
      btn.addEventListener("click", () => setActive(".md-tone-btn", btn));
    });
    const formalBtn = document.querySelector('.md-tone-btn[data-tone="formal"]');
    if (formalBtn) formalBtn.classList.add("active");

    // Generate
    document.getElementById("md-generate-btn")?.addEventListener("click", generate);

    // Copy
    document.getElementById("md-copy-btn")?.addEventListener("click", () => {
      if (!currentDraft) return;
      navigator.clipboard.writeText(currentDraft).then(() => {
        const btn = document.getElementById("md-copy-btn");
        if (btn) { btn.textContent = "✅ Copied!"; setTimeout(() => btn.textContent = "📋 Copy", 2000); }
      });
    });

    // PDF
    document.getElementById("md-pdf-btn")?.addEventListener("click", exportPDF);

    // Clear
    document.getElementById("md-clear-btn")?.addEventListener("click", () => {
      currentDraft = "";
      const output = document.getElementById("md-output");
      if (output) output.innerHTML = `<div id="md-placeholder" style="color:#9ca3af;font-size:0.875rem;font-family:system-ui;text-align:center;margin-top:4rem;">
        <div style="font-size:2rem;margin-bottom:0.75rem;">⚖️</div>
        Fill in the form and click <strong>Generate Draft</strong><br>to create your legal document.</div>`;
      document.getElementById("md-refine-bar").style.display = "none";
      document.getElementById("md-doc-title").textContent = "Draft will appear here";
    });

    // Refine
    document.getElementById("md-refine-btn")?.addEventListener("click", () => refine());
    document.getElementById("md-refine-input")?.addEventListener("keydown", e => {
      if (e.key === "Enter") refine();
    });

    // Quick refine chips
    document.querySelectorAll(".md-quick-refine").forEach(btn => {
      btn.addEventListener("click", () => refine(btn.textContent));
    });
  }

  return { init };
})();
