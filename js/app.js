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
  allSearchResults:    [],         // All results from search (for pagination)
  currentPage:         1,          // Current pagination page
  itemsPerPage:        15,         // Items per page
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
  $('nav-drafting').addEventListener('click',    () => switchMode('drafting'));
}

function switchMode(mode) {
  State.mode = mode;
  $('nav-ai').classList.toggle('active',          mode === 'ai');
  $('nav-traditional').classList.toggle('active', mode === 'traditional');
  $('nav-drafting').classList.toggle('active',    mode === 'drafting');
  $('ai-subnav').style.display = mode === 'ai' ? '' : 'none';
  $('ai-interface').classList.toggle('hidden',          mode !== 'ai');
  $('traditional-interface').classList.toggle('hidden', mode !== 'traditional');
  $('drafting-interface').classList.toggle('hidden',    mode !== 'drafting');
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
    drafting:    { normal: 'Drafting Engine', research: 'Drafting Engine', study: 'Drafting Engine' },
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
  console.log('[RENDER] === API RESPONSE RECEIVED ===', {
    outputType: data.outputType,
    citationsFlatType: typeof data.citationsFlat,
    citationsFlatIsArray: Array.isArray(data.citationsFlat),
    citationsFlatLength: data.citationsFlat?.length || 'UNDEFINED',
    citationsFlatSample: Array.isArray(data.citationsFlat) && data.citationsFlat.length > 0
      ? data.citationsFlat[0].target_citation
      : 'empty',
  });
  
  console.log('[RENDER] API Response received:', {
    hasSections: !!data.sections,
    sectionsCount: data.sections?.length || 0,
    firstSectionType: data.sections?.[0]?.output_type || 'N/A',
    hasTabularResults: !!data.tabularResults,
    tabularResultsCount: data.tabularResults?.length || 0,
    intent: data.intent,
    isUnique: data.isUnique,
    hasCompleteExplanation: !!data.completeExplanation,
    citationsFlatCount: data.citationsFlat?.length || 0,
  });
  
  // ✨ STUDY MODE: Check for sections FIRST (before normal rendering)
  if (data.sections && data.sections.length > 0) {
    console.log('[RENDER] 🎓 STUDY MODE DETECTED - Rendering study output');
    console.log('[RENDER]    Sections:', data.sections.length);
    console.log('[RENDER]    Type:', data.sections[0].output_type);
    appendChatMessage('ai', null, 'study', [], data.sections);
    return;  // ← IMPORTANT: Exit early to prevent table rendering
  }
  
  console.log('[RENDER] Rendering in normal/research mode');
  
  // Verify what we're passing
  console.log('[RENDER] About to call appendChatMessage with parameters:', {
    tabularResults_exists: !!data.tabularResults,
    tabularResults_isArray: Array.isArray(data.tabularResults),
    tabularResults_count: (data.tabularResults || []).length,
    cases_count: (data.cases || []).length,
    intent: data.intent,
    isUnique: data.isUnique,
    outputType: data.outputType,
    citationsFlat_count: (data.citationsFlat || []).length,
    citationsFlat_type: typeof data.citationsFlat,
    citationsFlat_isArray: Array.isArray(data.citationsFlat),
    completeExplanation_length: data.completeExplanation?.length || 0,
    caseSummary_present: !!data.caseSummary,
    caseSummary_type: typeof data.caseSummary,
    caseSummary_length: data.caseSummary?.length || 0,
  });
  
  // Pass all new fields including judgmentParagraphs, caseMetadata, citationTree, citationsFlat, caseSummary
  console.log('[RENDER-DEBUG] ✅ Passing caseSummary to appendChatMessage:', {
    caseSummary_value: data.caseSummary ? data.caseSummary.substring(0, 50) : 'NULL',
    caseSummary_length: data.caseSummary?.length || 0,
  });
  
  // FIXED: Don't use spread operator - call directly with all parameters in correct order
  appendChatMessage(
    'ai',                                    // 1: role
    data.text,                               // 2: text
    State.submode,                           // 3: submode
    data.cases || [],                        // 4: cases
    null,                                    // 5: studySections
    data.tabularResults || [],               // 6: tabularResults
    data.completeExplanation,                // 7: completeExplanation
    data.intent,                             // 8: intent
    data.isUnique,                           // 9: isUnique
    data.outputType,                         // 10: outputType
    data.judgmentParagraphs || [],           // 11: judgmentParagraphs
    data.caseMetadata || {},                 // 12: caseMetadata
    data.citationTree || null,               // 13: citationTree
    data.citationsFlat || [],                // 14: citationsFlat
    data.caseSummary || null                 // 15: caseSummary
  );
}

function appendChatMessage(role, text = null, submode = null, cases = [], studySections = null, 
                           tabularResults = [], completeExplanation = null, intent = 'mixed', isUnique = false, outputType = 'hybrid', 
                           judgmentParagraphs = [], caseMetadata = {}, citationTree = null, citationsFlat = [], caseSummary = null) {
  
  // Log what we received (simplified now that spread operator bug is fixed)
  if (role === 'ai' && outputType === 'full_case') {
    console.log('[APPEND-RECEIVED] ✅ FULL_CASE data received:');
    console.log('  - citationsFlat.length:', citationsFlat?.length || 0);
    console.log('  - caseSummary.length:', caseSummary?.length || 0);
  }
  
  // Log input parameters
  if (role === 'ai') {
    console.log('[APPEND-MSG] AIMessage parameters:', {
      outputType: outputType,
      citationsFlatCount: citationsFlat?.length || 0,
      caseMetadataPresent: !!caseMetadata?.case_name,
      judgmentParagraphsCount: judgmentParagraphs?.length || 0,
    });
  }
  
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
  
  // Add intent label if present
  if (role === 'ai' && intent && intent !== 'mixed') {
    const intentTag = mk('div', 'msg__intent-tag');
    intentTag.textContent = `🔍 Searching for: ${cap(intent)}`;
    intentTag.style.fontSize = '0.85em';
    intentTag.style.color = '#0066cc';
    bubble.appendChild(intentTag);
  }
  
  // Only add raw text for output types that don't manage it themselves
  // (law, answer, case_answer, full_case, hybrid, and table handle text rendering internally)
  const textManagedTypes = ['law', 'answer', 'case_answer', 'full_case', 'hybrid', 'table'];
  if (text && !textManagedTypes.includes(outputType)) {
    const p = mk('p'); p.innerHTML = text;
    bubble.appendChild(p);
  }
  
  // Use tabular results if available, otherwise fallback to cases
  console.log('[TABLE-CHECK] tabularResults:', {
    type: typeof tabularResults,
    isArray: Array.isArray(tabularResults),
    length: tabularResults?.length,
    outputType: outputType,
  });
  
  // Render content based on output_type
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  // judgment_only: Show clean judgment paragraphs only, no answer/table
  if (outputType === 'judgment_only' && judgmentParagraphs.length > 0) {
    console.log('[RENDER-TYPE] judgment_only → showing judgment reader only');
    bubble.appendChild(buildJudgmentParagraphsReader(judgmentParagraphs, caseMetadata));
  }
  // citation_graph: Show case metadata + citations
  else if (outputType === 'citation_graph') {
    // CRITICAL DEBUG: Log the actual parameter values at entry
    console.log('[CITATION_GRAPH-ENTRY] === ENTERING citation_graph RENDERER ===', {
      paramOutputType: outputType,
      paramCitationsFlat: citationsFlat,
      paramCitationsFlatType: typeof citationsFlat,
      paramCitationsFlatIsArray: Array.isArray(citationsFlat),
      paramCitationsFlatLength: citationsFlat?.length || 'UNDEFINED',
      paramCaseMetadata: caseMetadata,
      paramCompleteExplanation: completeExplanation ? 'present' : 'null',
    });
    
    console.log('[RENDER-TYPE] citation_graph → showing case + citations', {
      citationTree: !!citationTree,
      citationsFlat: citationsFlat?.length,
      caseMetadata: !!caseMetadata,
    });
    
    // Case metadata header
    if (caseMetadata && caseMetadata.case_name) {
      const caseHeader = mk('div', 'case-header');
      caseHeader.style.cssText = 'margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #0066cc';
      const caseName = mk('h3');
      caseName.textContent = caseMetadata.case_name;
      caseName.style.margin = '0 0 8px 0';
      caseHeader.appendChild(caseName);
      const infoText = [];
      if (caseMetadata.court) infoText.push(`📍 ${caseMetadata.court}`);
      if (caseMetadata.year) infoText.push(`📅 ${caseMetadata.year}`);
      const info = mk('div');
      info.innerHTML = infoText.join(' | ');
      info.style.cssText = 'font-size:0.85em;color:#999';
      caseHeader.appendChild(info);
      bubble.appendChild(caseHeader);
    }
    
    // Show citations list
    if (citationsFlat && citationsFlat.length > 0) {
      console.log('[CITATION-RENDER] === START RENDERING CITATIONS ===', {
        citationsFlatLength: citationsFlat.length,
        citationsFlatType: typeof citationsFlat,
        isArray: Array.isArray(citationsFlat),
      });
      console.log('[CITATION-RENDER] Rendering citations table with', citationsFlat.length, 'citations');
      const citLabel = mk('p');
      citLabel.textContent = `🔗 Citations (${citationsFlat.length})`;
      citLabel.style.fontSize = '0.95em';
      citLabel.style.color = '#0066cc';
      citLabel.style.marginTop = '15px';
      citLabel.style.marginBottom = '12px';
      citLabel.style.fontWeight = 'bold';
      bubble.appendChild(citLabel);
      bubble.appendChild(buildCitationsList(citationsFlat));
    } else {
      console.log('[CITATION-RENDER] === CITATIONS EMPTY/MISSING ===', {
        citationsFlat_raw: citationsFlat,
        citationsFlat_type: typeof citationsFlat,
        citationsFlat_isArray: Array.isArray(citationsFlat),
        citationsFlat_length: citationsFlat?.length || 'UNDEFINED',
        condition_passed: citationsFlat && citationsFlat.length > 0,
      });
      console.log('[CITATION-RENDER] No citations found. citationsFlat:', citationsFlat, 'Type:', typeof citationsFlat);
      if (!citationsFlat || citationsFlat.length === 0) {
        const noCit = mk('div');
        noCit.textContent = '📌 No citations available for this case.';
        noCit.style.padding = '15px';
        noCit.style.color = '#999';
        noCit.style.fontStyle = 'italic';
        noCit.style.marginTop = '15px';
        bubble.appendChild(noCit);
      }
    }
  }
  // full_case: Show full case viewer with tabs (Summary, Key Facts, Judgement, Citations, PDF)
  else if (outputType === 'full_case') {
    console.log('[RENDER-TYPE] full_case → showing research mode full case viewer with tabs');
    console.log('[FULL-CASE] 📊 Received data:');
    console.log('  - caseMetadata:', caseMetadata);
    console.log('  - judgmentParagraphs:', judgmentParagraphs?.length);
    console.log('  - citationsFlat:', citationsFlat?.length);
    console.log('  - caseSummary present:', !!caseSummary);
    console.log('  - caseSummary length:', caseSummary?.length || 0);
    console.log('  - caseSummary content:', caseSummary?.substring(0, 100) || 'NONE');
    
    if (caseMetadata && caseMetadata.case_name) {
      bubble.appendChild(buildFullCaseViewer(caseMetadata, judgmentParagraphs || [], citationsFlat || [], caseSummary || null));
      console.log('[FULL-CASE] ✅ Full case viewer added to bubble');
    } else {
      const fallback = mk('div');
      fallback.textContent = 'No case data available.';
      fallback.style.color = '#999';
      bubble.appendChild(fallback);
    }
  }
  // case_answer: Show case-scoped LLM answer + judgment context
  else if (outputType === 'case_answer') {
    console.log('[RENDER-TYPE] case_answer → showing case-scoped answer with judgment context');
    
    // Case metadata header
    if (caseMetadata && caseMetadata.case_name) {
      const caseHeader = mk('div', 'case-header');
      caseHeader.style.cssText = 'margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #0066cc';
      const caseName = mk('h3');
      caseName.textContent = caseMetadata.case_name;
      caseName.style.margin = '0 0 8px 0';
      caseHeader.appendChild(caseName);
      const infoText = [];
      if (caseMetadata.court) infoText.push(`📍 ${caseMetadata.court}`);
      if (caseMetadata.year) infoText.push(`📅 ${caseMetadata.year}`);
      const info = mk('div');
      info.innerHTML = infoText.join(' | ');
      info.style.cssText = 'font-size:0.85em;color:#999';
      caseHeader.appendChild(info);
      bubble.appendChild(caseHeader);
    }
    
    // LLM answer — this IS the main content for case_answer
    if (text) {
      const answerBlock = mk('div', 'ai-answer');
      answerBlock.innerHTML = text;
      answerBlock.style.cssText = 'background:#0f0f0f;padding:15px;border-radius:8px;margin-bottom:20px;border-left:4px solid #8855ff';
      bubble.appendChild(answerBlock);
    } else {
      // FIX #3/#4: Show helpful message when LLM fails or no paragraphs available
      const errorBlock = mk('div', 'ai-answer');
      errorBlock.innerHTML = '<em>⚠️ Could not generate answer — the case may not have sufficient quality paragraphs available. Try searching for a different case or using Research mode.</em>';
      errorBlock.style.cssText = 'background:#3a2a2a;padding:15px;border-radius:8px;margin-bottom:20px;border-left:4px solid #ff6b6b;color:#ff9999';
      bubble.appendChild(errorBlock);
    }
    
    // Paragraph references (supporting evidence)
    if (judgmentParagraphs.length > 0) {
      const judgeLabel = mk('p');
      judgeLabel.textContent = '📄 Case paragraphs (source material)';
      judgeLabel.style.cssText = 'font-size:0.9em;color:#0066cc;margin-top:20px;font-weight:bold';
      bubble.appendChild(judgeLabel);
      bubble.appendChild(buildJudgmentParagraphsReader(judgmentParagraphs, caseMetadata));
    }
  }
  // table: Show table only, minimal/no answer text
  else if (outputType === 'table') {
    console.log('[RENDER-TYPE] table → showing result count + table');
    
    // Show result count/text
    if (text) {
      const textDiv = mk('div');
      textDiv.textContent = text;
      textDiv.style.color = '#ccc';
      textDiv.style.marginBottom = '15px';
      textDiv.style.fontSize = '0.95em';
      bubble.appendChild(textDiv);
    }
    
    // Show table
    if (tabularResults.length > 0) {
      bubble.appendChild(buildEnhancedCaseResultsTable(tabularResults, true));  // Skip label - already in text
    } else if (cases.length > 0) {
      bubble.appendChild(buildCaseResultsTable(cases, true));  // Skip label - already in text
    }
  }
  // law: Show LLM answer + case table
  else if (outputType === 'law') {
    console.log('[RENDER-TYPE] law → showing law explanation + related cases');
    
    // Show LLM answer (statute explanation) - use completeExplanation or text
    if (completeExplanation || text) {
      const answer = mk('div', 'ai-answer');
      answer.innerHTML = completeExplanation || text;
      answer.style.backgroundColor = '#0f0f0f';
      answer.style.padding = '15px';
      answer.style.borderRadius = '8px';
      answer.style.marginBottom = '20px';
      answer.style.borderLeft = '4px solid #ffaa00';  // Gold for law/statute
      bubble.appendChild(answer);
    }
    
    // Show related cases table
    if (tabularResults.length > 0) {
      const label = mk('p');
      label.textContent = '📚 Related Cases:';
      label.style.fontSize = '0.9em';
      label.style.color = '#0066cc';
      label.style.marginTop = '20px';
      label.style.fontWeight = 'bold';
      bubble.appendChild(label);
      bubble.appendChild(buildEnhancedCaseResultsTable(tabularResults, true));  // Skip label - already shown above
    }
  }
  // answer: Show LLM answer + cases
  else if (outputType === 'answer') {
    console.log('[RENDER-TYPE] answer → showing RAG answer + citations');
    
    // Show LLM answer - use completeExplanation or text
    if (completeExplanation || text) {
      const answer = mk('div', 'ai-answer');
      answer.innerHTML = completeExplanation || text;
      answer.style.backgroundColor = '#0f0f0f';
      answer.style.padding = '15px';
      answer.style.borderRadius = '8px';
      answer.style.marginBottom = '20px';
      answer.style.borderLeft = '4px solid #00cc00';  // Green for answers
      bubble.appendChild(answer);
    }
    
    // Show supporting cases
    if (tabularResults.length > 0) {
      const label = mk('p');
      label.textContent = '📚 Supporting Cases:';
      label.style.fontSize = '0.9em';
      label.style.color = '#0066cc';
      label.style.marginTop = '20px';
      label.style.fontWeight = 'bold';
      bubble.appendChild(label);
      bubble.appendChild(buildEnhancedCaseResultsTable(tabularResults, true));  // Skip label - already shown above
    } else if (cases.length > 0) {
      bubble.appendChild(buildCaseResultsTable(cases, true));  // Skip label - text already shows count
    }
  }
  // hybrid (default): Show text + answer + table (in order, all of them)
  else {
    console.log('[RENDER-TYPE] hybrid/default → showing text + answer + table');
    
    // 1. RESULT COUNT / TEXT
    if (text) {
      const textDiv = mk('div');
      textDiv.textContent = text;
      textDiv.style.color = '#ccc';
      textDiv.style.marginBottom = '15px';
      textDiv.style.fontSize = '0.95em';
      console.log('[HYBRID] Showing text/result count');
      bubble.appendChild(textDiv);
    }
    
    // 2. LLM ANSWER / EXPLANATION
    if (completeExplanation) {
      const answer = mk('div', 'ai-answer');
      answer.innerHTML = completeExplanation;
      answer.style.backgroundColor = '#0f0f0f';
      answer.style.padding = '15px';
      answer.style.borderRadius = '8px';
      answer.style.marginBottom = '20px';
      answer.style.borderLeft = '4px solid #0066cc';  // Blue for hybrid
      console.log('[HYBRID] Showing LLM answer/explanation');
      bubble.appendChild(answer);
    }
    
    // 3. TABLE
    if (tabularResults && Array.isArray(tabularResults) && tabularResults.length > 0) {
      console.log('[HYBRID] ✅ Showing table with', tabularResults.length, 'rows');
      const label = mk('p');
      label.textContent = '📊 Related Results:';
      label.style.fontSize = '0.9em';
      label.style.color = '#0066cc';
      label.style.marginTop = '20px';
      label.style.fontWeight = 'bold';
      bubble.appendChild(label);
      bubble.appendChild(buildEnhancedCaseResultsTable(tabularResults, true));  // Skip label - already shown above
    } else if (cases && Array.isArray(cases) && cases.length > 0) {
      console.log('[HYBRID] Using fallback cases table');
      bubble.appendChild(buildCaseResultsTable(cases, true));  // Skip label - text already shows count
    }
  }
  
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

  // Store all results and reset to page 1
  State.allSearchResults = cases;
  State.currentPage = 1;

  // Render the current page
  renderCurrentPage();

  // Show pagination if there's more than one page
  const totalPages = Math.ceil(cases.length / State.itemsPerPage);
  if (totalPages > 1) {
    renderPaginationControls(totalPages);
    $('pagination-controls').classList.remove('hidden');
  } else {
    $('pagination-controls').classList.add('hidden');
  }

  $('results-count').textContent = `${cases.length} case${cases.length !== 1 ? 's' : ''} found`;
  $('results-header').classList.remove('hidden');
  $('results-table-wrap').classList.remove('hidden');
}

function renderCurrentPage() {
  const cases = State.allSearchResults;
  const start = (State.currentPage - 1) * State.itemsPerPage;
  const end = start + State.itemsPerPage;
  const pageCases = cases.slice(start, end);

  const tbody = $('results-tbody');
  tbody.innerHTML = '';

  pageCases.forEach((c, i) => {
    const actualIndex = start + i + 1;  // For display as row number
    const score  = c.authority_score || 50;
    const tier   = score >= 85 ? 'high' : score >= 65 ? 'medium' : 'low';
    const arrow  = score >= 85 ? '↑'    : score >= 65 ? '→'      : '↓';
    const label  = score >= 85 ? 'High' : score >= 65 ? 'Medium' : 'Low';

    const tr = mk('tr');
    tr.innerHTML = `
      <td>${actualIndex}</td>
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
}

function renderPaginationControls(totalPages) {
  const pagesDiv = $('pagination-pages');
  pagesDiv.innerHTML = '';

  // Show nearby page numbers (current ± 2)
  const start = Math.max(1, State.currentPage - 2);
  const end = Math.min(totalPages, State.currentPage + 2);

  for (let p = start; p <= end; p++) {
    const btn = mk('button', 'pagination-page-btn');
    btn.textContent = p;
    if (p === State.currentPage) {
      btn.classList.add('active');
      btn.textContent = `{${p}}`;  // Show current page with braces
    }
    btn.addEventListener('click', () => goToPage(p));
    pagesDiv.appendChild(btn);
  }

  // Update navigation button states
  $('btn-first-page').disabled = State.currentPage === 1;
  $('btn-prev-page').disabled = State.currentPage === 1;
  $('btn-next-page').disabled = State.currentPage === totalPages;
  $('btn-last-page').disabled = State.currentPage === totalPages;

  // Attach navigation event listeners (only once)
  if (!pagesDiv.dataset.eventsBound) {
    $('btn-first-page').addEventListener('click', () => goToPage(1));
    $('btn-prev-page').addEventListener('click', () => goToPage(State.currentPage - 1));
    $('btn-next-page').addEventListener('click', () => goToPage(State.currentPage + 1));
    $('btn-last-page').addEventListener('click', () => goToPage(totalPages));
    pagesDiv.dataset.eventsBound = 'true';
  }
}

function goToPage(pageNum) {
  const totalPages = Math.ceil(State.allSearchResults.length / State.itemsPerPage);
  if (pageNum < 1 || pageNum > totalPages) return;

  State.currentPage = pageNum;
  renderCurrentPage();
  renderPaginationControls(totalPages);

  // Scroll to table top
  const tableWrap = $('results-table-wrap');
  if (tableWrap) {
    tableWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
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
  State.allSearchResults = [];
  State.currentPage = 1;
  $('token-raw-input').value = '';
  renderTokenPills();
  syncActiveFilterBar();
  closePDFPanel();
  $('trad-inline-viewer').innerHTML = '';
  State.openViewers.clear();
  ['results-table-wrap','results-header','active-filters-bar','result-explanation','pagination-controls']
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

  // Deduplicate suggestions by label (FIX: prevent duplicates)
  const seen = new Set();
  const unique = suggestions.filter(s => {
    const key = s.label + s.type;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.forEach(s => {
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
  console.log(`[VIEWER] toggleInlineViewer called for case: ${caseId}`);
  
  const existing = host.querySelector(`[data-viewer-id="${caseId}"]`);
  if (existing) {
    console.log(`[VIEWER] Case already open, closing it`);
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

  // Show loading indicator
  btn.textContent = 'Loading...';
  btn.disabled = true;
  console.log(`[VIEWER] Button set to "Loading...", fetching case data`);

  // Fetch case data from API
  API.getCase(caseId)
    .then(caseData => {
      console.log(`[VIEWER] Case data received:`, caseData);
      
      if (!caseData) {
        console.error(`[VIEWER] Case data is null/undefined`);
        btn.textContent = 'Error ✗';
        btn.disabled = false;
        return;
      }

      console.log(`[VIEWER] Building case viewer for: ${caseData.name}`);
      State.openViewers.add(caseId);
      btn.textContent = 'Close ✕';
      btn.classList.add('active');
      btn.disabled = false;

      const viewer = buildCaseViewer(caseData);
      viewer.dataset.viewerId = caseId;
      host.appendChild(viewer);
      console.log(`[VIEWER] Case viewer added to DOM`);
      
      setTimeout(() => {
        viewer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        console.log(`[VIEWER] Scrolled to viewer`);
      }, 60);
    })
    .catch(err => {
      console.error('[VIEWER] Failed to load case:', err);
      btn.textContent = 'Error ✗';
      btn.disabled = false;
    });
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
  
  // Header actions (right side)
  const headerActions = mk('div', 'iv-header-actions');
  const draftBtn = mk('button', 'iv-action-btn iv-draft-btn');
  draftBtn.innerHTML = '✍️ Draft';
  draftBtn.title = 'Generate a legal document from this case';
  draftBtn.addEventListener('click', () => draftFromThisCase(c));
  
  const closeBtn = mk('button', 'iv-close');
  closeBtn.setAttribute('aria-label', 'Close case viewer');
  closeBtn.innerHTML = '<span class="ico ico-close" aria-hidden="true">×</span>';
  
  headerActions.appendChild(draftBtn); headerActions.appendChild(closeBtn);
  header.appendChild(chips); header.appendChild(title);
  header.appendChild(citation); header.appendChild(headerActions);

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

function buildFullCaseViewer(caseMetadata, judgmentParagraphs, citationsFlat, caseSummary = null) {
  /**
   * Research Mode Full Case Viewer
   * ✨ Tabs: Summary | Key Facts | Judgement | Citations | PDF
   * 📊 Displays complete case with tabbed interface (no close button)
   * 🤖 Summary tab shows LLM-generated case summary
   */
  const viewer = mk('div', 'research-case-viewer');
  
  // Build case object for openPDFPanel compatibility
  const caseData = {
    id: caseMetadata.case_id || caseMetadata.id || 'unknown',
    name: caseMetadata.case_name || caseMetadata.name || 'Unknown Case',
    court: caseMetadata.court || 'Unknown Court',
    year: caseMetadata.year || new Date().getFullYear(),
    citation: caseMetadata.case_id || caseMetadata.citation || '',
    pdfLink: caseMetadata.pdf_link || `/case/${caseMetadata.case_id || caseMetadata.id || 'unknown'}/${caseMetadata.case_id || caseMetadata.id || 'unknown'}.pdf`,
    petitioner: caseMetadata.petitioner || '—',
    respondent: caseMetadata.respondent || '—',
    paragraphs: judgmentParagraphs.map(p => ({
      id: p.paraId || p.paragraph_id || `para_${p.paraNo}`,
      text: p.text,
      number: p.paraNo,
      page: p.pageNo,
      type: p.paraType,
    })),
  };
  
  // ========================================================================
  // HEADER
  // ========================================================================
  const header = mk('div', 'rv-header');
  const title = mk('h2', 'rv-title');
  title.textContent = caseData.name;
  const chips = mk('div', 'rv-chips');
  [
    { text: (caseData.court || '').toUpperCase(), type: 'court' },
    { text: caseData.year, type: 'year' },
  ].forEach(c => {
    if (!c.text) return;
    const chip = mk('span', `rv-chip rv-chip-${c.type}`);
    chip.textContent = c.text;
    chips.appendChild(chip);
  });
  header.appendChild(title);
  header.appendChild(chips);
  
  // ========================================================================
  // TABS
  // ========================================================================
  const tabBar = mk('div', 'rv-tabs');
  const tabs = [
    { id: 'summary',   label: 'Summary' },
    { id: 'facts',     label: 'Key Facts' },
    { id: 'judgement', label: 'Judgement' },
    { id: 'citations', label: `Citations (${citationsFlat?.length || 0})` },
    { id: 'pdf',       label: 'PDF Viewer' },
  ];
  tabs.forEach((t, i) => {
    const btn = mk('button', `rv-tab${i === 0 ? ' active' : ''}`);
    btn.dataset.tab = t.id;
    btn.textContent = t.label;
    tabBar.appendChild(btn);
  });
  
  // ========================================================================
  // PANELS
  // ========================================================================
  const body = mk('div', 'rv-body');
  
  // --- SUMMARY ---
  const summaryPanel = mk('div', 'rv-panel', 'summary');
  summaryPanel.dataset.panel = 'summary';
  const summaryText = mk('p', 'rv-text');
  summaryText.innerHTML = buildCaseSummary(caseData, judgmentParagraphs, caseSummary);
  const metaGrid = mk('div', 'rv-meta-grid');
  [
    ['Court', caseData.court || '—'],
    ['Year', caseData.year || '—'],
    ['Petitioner', caseData.petitioner || '—'],
    ['Respondent', caseData.respondent || '—'],
  ].forEach(([k, v]) => {
    const card = mk('div', 'rv-meta-card');
    const key = mk('span', 'rv-meta-key'); key.textContent = k;
    const val = mk('span', 'rv-meta-val'); val.textContent = v;
    card.appendChild(key);
    card.appendChild(val);
    metaGrid.appendChild(card);
  });
  summaryPanel.appendChild(summaryText);
  summaryPanel.appendChild(metaGrid);
  
  // --- KEY FACTS ---
  const factsPanel = mk('div', 'rv-panel hidden', 'facts');
  factsPanel.dataset.panel = 'facts';
  const ul = mk('ul', 'rv-facts-list');
  const facts = extractKeyFacts(judgmentParagraphs);
  if (facts.length === 0) {
    const li = mk('li');
    li.textContent = 'Facts compiled from case judgment.';
    ul.appendChild(li);
  } else {
    facts.forEach(f => {
      const li = mk('li');
      li.textContent = f;
      ul.appendChild(li);
    });
  }
  factsPanel.appendChild(ul);
  
  // --- JUDGEMENT ---
  const judgementPanel = mk('div', 'rv-panel hidden', 'judgement');
  judgementPanel.dataset.panel = 'judgement';
  if (judgmentParagraphs.length === 0) {
    const empty = mk('p');
    empty.textContent = 'No judgment paragraphs available.';
    empty.style.color = '#999';
    judgementPanel.appendChild(empty);
  } else {
    judgementPanel.appendChild(buildJudgmentParagraphsReader(judgmentParagraphs, caseMetadata));
  }
  
  // --- CITATIONS ---
  const citationsPanel = mk('div', 'rv-panel hidden', 'citations');
  citationsPanel.dataset.panel = 'citations';
  console.log('[RCV] Citations panel - citationsFlat:', {
    type: typeof citationsFlat,
    length: citationsFlat?.length || 0,
    isArray: Array.isArray(citationsFlat),
    sample: citationsFlat?.length > 0 ? citationsFlat[0] : 'empty',
  });
  if (!citationsFlat || citationsFlat.length === 0) {
    const empty = mk('div', 'rv-empty');
    empty.textContent = 'No citations available for this case.';
    citationsPanel.appendChild(empty);
  } else {
    citationsPanel.appendChild(buildResearchCitationsTable(citationsFlat));
  }
  
  // --- PDF ---
  const pdfPanel = mk('div', 'rv-panel hidden pdf-trigger', 'pdf');
  pdfPanel.dataset.panel = 'pdf';
  pdfPanel.dataset.caseId = caseData.id;
  const pdfMsg = mk('div', 'rv-pdf-msg');
  const pdfIcon = mk('span', 'ico ico-doc-lg');
  pdfIcon.setAttribute('aria-hidden', 'true');
  const pdfTxt = mk('span');
  pdfTxt.textContent = 'PDF Viewer will open here…';
  pdfMsg.appendChild(pdfIcon);
  pdfMsg.appendChild(pdfTxt);
  pdfPanel.appendChild(pdfMsg);
  
  // ========================================================================
  // ASSEMBLY
  // ========================================================================
  [summaryPanel, factsPanel, judgementPanel, citationsPanel, pdfPanel].forEach(p => body.appendChild(p));
  viewer.appendChild(header);
  viewer.appendChild(tabBar);
  viewer.appendChild(body);
  
  // ========================================================================
  // TAB SWITCHING
  // ========================================================================
  tabBar.querySelectorAll('.rv-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tabBar.querySelectorAll('.rv-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tid = tab.dataset.tab;
      body.querySelectorAll('.rv-panel').forEach(p => {
        p.classList.toggle('hidden', p.dataset.panel !== tid);
      });
      if (tid === 'pdf') {
        console.log('[RCV] PDF tab clicked, opening PDF panel for case:', caseData.id);
        // FIX #10: Use openPDFPanel like Normal mode does, instead of inline rendering
        openPDFPanel(caseData);
      }
    });
  });
  
  // ========================================================================
  // PARA REFERENCE INTERACTIVITY (NEW)
  // ========================================================================
  // Wire up para ref clicks to jump to Judgement tab
  setTimeout(() => {
    viewer.querySelectorAll('.brief-para-ref').forEach(ref => {
      ref.title = `Click to view ${ref.textContent} in Judgement tab`;
      ref.addEventListener('click', (e) => {
        e.stopPropagation();
        // Switch to Judgement tab
        tabBar.querySelectorAll('.rv-tab').forEach(t => t.classList.remove('active'));
        const judgTab = [...tabBar.querySelectorAll('.rv-tab')]
          .find(t => t.dataset.tab === 'judgement');
        if (judgTab) {
          judgTab.classList.add('active');
          body.querySelectorAll('.rv-panel').forEach(p => 
            p.classList.toggle('hidden', p.dataset.panel !== 'judgement'));
          // Try to scroll to the specific para
          const paraNum = ref.textContent.replace(/Para\s+/, '').trim();
          setTimeout(() => {
            const paragraphEls = viewer.querySelectorAll('[data-para-no]');
            for (let el of paragraphEls) {
              if (el.dataset.paraNo === paraNum) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.background = 'rgba(0, 102, 204, 0.2)';
                setTimeout(() => { el.style.background = ''; }, 2000);
                break;
              }
            }
          }, 100);
        }
      });
    });
  }, 100);
  
  return viewer;
}

function renderPDFInPanel(panel, caseData) {
  /**Render PDF content directly in the research mode panel*/
  const doc = mk('div', 'rv-pdf-document');
  
  const title = mk('p', 'rv-pdf-title');
  title.textContent = caseData.name.toUpperCase();
  
  const sub = mk('p', 'rv-pdf-subtitle');
  sub.textContent = `${caseData.court}  ·  ${caseData.year}  ·  ${caseData.citation}`;
  
  doc.appendChild(title);
  doc.appendChild(sub);
  
  // Case paragraphs
  if (caseData.paragraphs && caseData.paragraphs.length > 0) {
    caseData.paragraphs.forEach((para, i) => {
      const p = mk('p', 'rv-pdf-para');
      p.dataset.paraId = para.id;
      p.innerHTML = `<span class="rv-pdf-para-num">[${para.number || i + 1}]</span> <strong>[${para.type || 'para'}]</strong> ${para.text}`;
      doc.appendChild(p);
    });
  } else {
    const empty = mk('p');
    empty.textContent = 'No paragraphs to display.';
    empty.style.color = '#999';
    doc.appendChild(empty);
  }
  
  panel.appendChild(doc);
}

function buildCaseSummary(metadata, paragraphs, llmSummary = null) {
  /**Build a summary from LLM-generated comprehensive brief, metadata fallback, or first paragraph*/
  
  console.log('[SUMMARY] 📝 Building case summary:');
  console.log('  - llmSummary present:', !!llmSummary);
  console.log('  - llmSummary type:', typeof llmSummary);
  console.log('  - llmSummary length:', llmSummary?.length || 0);
  
  // Priority 1: Use LLM-generated comprehensive brief if available (NEW)
  if (llmSummary && typeof llmSummary === 'string' && llmSummary.trim().length > 50) {
    console.log('[SUMMARY] ✅ Using LLM-generated comprehensive brief');
    return renderMarkdownBrief(llmSummary);
  }
  
  // Priority 2: Metadata fallback with acts and outcome
  if (metadata && metadata.case_name) {
    console.log('[SUMMARY] ⚠️ Using metadata fallback brief');
    return renderMetadataFallback(metadata, paragraphs);
  }
  
  // Priority 3: First paragraph text fallback
  if (paragraphs && paragraphs.length > 0) {
    const text = (paragraphs[0].text || '').substring(0, 500);
    return `<p style="color:#aaa;font-style:italic">⚠️ Full brief unavailable. First paragraph:</p><p>${text}</p>`;
  }
  
  // Fallback: Generic summary
  console.log('[SUMMARY] 🔄 Using generic fallback summary');
  return '<p style="color:#666">Summary not available.</p>';
}


function renderMarkdownBrief(text) {
  /**Render markdown-formatted brief with proper styling and interactive para refs*/
  
  let html = text
    // Section headers: **HEADING** → styled uppercase headers
    .replace(/^\*\*([A-Z][A-Z\s\/&—–-]+)\*\*\s*$/gm, 
      '<div class="brief-section-header">$1</div>')
    // Inline bold: **text** → <strong>
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    // Para references like "Para 5", "Para 12" → highlighted clickable chips
    .replace(/\b(Para\s+\d+)\b/g, 
      '<span class="brief-para-ref" data-para="$1">$1</span>')
    // Bullet lines: starts with - → list items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*?<\/li>\n?)+/g, m => `<ul class="brief-list">${m}</ul>`)
    // Numbered lists (if any)
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p class="brief-para">')
    .replace(/\n/g, '<br>');
  
  // Wrap final text in paragraph
  if (!html.startsWith('<p')) {
    html = `<p class="brief-para">${html}</p>`;
  }
  if (!html.endsWith('</p>')) {
    html += '</p>';
  }
  
  return html;
}


function renderMetadataFallback(metadata, paragraphs) {
  /**Render a structured brief from DB metadata only (no LLM)*/
  
  const lines = [];
  const name = metadata.case_name || 'Unknown';
  const court = metadata.court || '';
  const year = metadata.year || '';
  const petitioner = metadata.petitioner || '';
  const respondent = metadata.respondent || '';
  const outcome = metadata.outcome_summary || '';
  const acts = metadata.acts_referred || [];
  
  lines.push(`<strong>${name}</strong>`);
  if (court || year) {
    lines.push(`<strong>Court:</strong> ${court}  |  <strong>Year:</strong> ${year}`);
  }
  if (petitioner) {
    lines.push(`<strong>Petitioner:</strong> ${petitioner}`);
  }
  if (respondent) {
    lines.push(`<strong>Respondent:</strong> ${respondent}`);
  }
  if (acts && acts.length > 0) {
    const actsStr = Array.isArray(acts) ? acts.slice(0, 5).join(', ') : acts;
    lines.push(`<strong>Acts:</strong> ${actsStr}`);
  }
  if (outcome) {
    lines.push(`<strong>Outcome:</strong> ${outcome}`);
  }
  
  return `<div class="brief-metadata">${lines.map(l => `<p>${l}</p>`).join('')}</div>`;
}

function extractKeyFacts(paragraphs) {
  /**Extract key facts from judgment paragraphs (limit to 5 key points)*/
  if (!paragraphs || paragraphs.length === 0) return [];
  
  const facts = [];
  paragraphs.slice(0, 5).forEach(p => {
    const text = p.text || '';
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    if (sentences.length > 0) {
      const firstSentence = sentences[0].trim();
      if (firstSentence.length > 20 && firstSentence.length < 300) {
        facts.push(firstSentence);
      }
    }
  });
  
  return facts.length > 0 ? facts : ['Case details compiled from judgment.'];
}

function buildResearchCitationsTable(citations) {
  /**Build citations table for research mode case viewer*/
  const wrap = mk('div', 'rv-citations-table-wrap');
  
  if (!citations || citations.length === 0) {
    const empty = mk('div', 'rv-empty');
    empty.textContent = 'No citations found.';
    wrap.appendChild(empty);
    return wrap;
  }
  
  const table = mk('table', 'rv-citations-table');
  const thead = mk('thead');
  const headerRow = mk('tr');
  ['Citation', 'Type', 'Details'].forEach(col => {
    const th = mk('th');
    th.textContent = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  const tbody = mk('tbody');
  citations.forEach(cit => {
    const row = mk('tr');
    
    const citCell = mk('td');
    citCell.textContent = cit.target_citation || cit.citation || 'Unknown';
    citCell.style.fontWeight = '500';
    citCell.style.color = '#0066cc';
    
    const typeCell = mk('td');
    typeCell.textContent = cit.relationship?.charAt(0).toUpperCase() + (cit.relationship?.slice(1) || '');
    
    const confCell = mk('td');
    confCell.style.fontSize = '0.85em';
    confCell.style.color = '#999';
    confCell.textContent = cit.confidence != null ? `${(cit.confidence * 100).toFixed(0)}%` : 'N/A';
    
    row.appendChild(citCell);
    row.appendChild(typeCell);
    row.appendChild(confCell);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  
  return wrap;
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
    top.appendChild(nm);
    // Only show year if available
    if (ref.year) {
      const yr = mk('span', 'iv-cit-year-badge'); yr.textContent = ref.year;
      top.appendChild(yr);
    }
    const ct   = mk('div', 'iv-cit-court');    ct.textContent   = ref.court;
    const ci   = mk('div', 'iv-cit-citation'); ci.textContent   = ref.citation;
    const ctx  = mk('div', 'iv-cit-context');  ctx.innerHTML    = ref.context || '';
    card.appendChild(top); card.appendChild(ct); card.appendChild(ci);
    if (ref.context) card.appendChild(ctx);
    wrap.appendChild(card);
  });
  return wrap;
}

function buildCitationsList(citations) {
  const wrap = mk('div', 'citations-list');
  
  if (!citations || citations.length === 0) {
    const empty = mk('div');
    empty.textContent = 'No citations found for this case.';
    empty.style.padding = '15px';
    empty.style.color = '#999';
    empty.style.fontStyle = 'italic';
    wrap.appendChild(empty);
    return wrap;
  }
  
  const table = mk('table', 'citations-table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.marginBottom = '20px';
  
  // Header
  const thead = mk('thead');
  const headerRow = mk('tr');
  headerRow.style.borderBottom = '2px solid #0066cc';
  ['Citation', 'Relationship', 'Confidence', 'Context'].forEach(col => {
    const th = mk('th');
    th.textContent = col;
    th.style.textAlign = 'left';
    th.style.padding = '10px';
    th.style.paddingLeft = '0';
    th.style.color = '#0066cc';
    th.style.fontSize = '0.9em';
    th.style.fontWeight = 'bold';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Body
  const tbody = mk('tbody');
  citations.forEach((cit, idx) => {
    const row = mk('tr');
    row.style.borderBottom = '1px solid #ddd';
    row.style.fontSize = '0.85em';
    row.style.verticalAlign = 'top';
    
    // Citation (use target_citation or fallback)
    const citCell = mk('td');
    citCell.style.padding = '12px 10px';
    citCell.style.paddingLeft = '0';
    citCell.style.fontWeight = '500';
    citCell.style.color = '#0066cc';
    citCell.textContent = cit.target_citation || cit.citation || cit.case_name || 'Unknown';
    row.appendChild(citCell);
    
    // Relationship
    const relCell = mk('td');
    relCell.style.padding = '12px 10px';
    relCell.style.color = '#666';
    const rel = cit.relationship || 'cited';
    relCell.textContent = rel.charAt(0).toUpperCase() + rel.slice(1);
    row.appendChild(relCell);
    
    // Confidence
    const confCell = mk('td');
    confCell.style.padding = '12px 10px';
    confCell.style.color = '#999';
    confCell.style.fontSize = '0.8em';
    const conf = cit.confidence != null ? (cit.confidence * 100).toFixed(0) + '%' : 'N/A';
    confCell.textContent = conf;
    row.appendChild(confCell);
    
    // Context (brief snippet)
    const ctxCell = mk('td');
    ctxCell.style.padding = '12px 10px';
    ctxCell.style.color = '#888';
    ctxCell.style.fontSize = '0.8em';
    ctxCell.style.maxWidth = '300px';
    ctxCell.style.whiteSpace = 'nowrap';
    ctxCell.style.overflow = 'hidden';
    ctxCell.style.textOverflow = 'ellipsis';
    const ctx = cit.context_sentence || '';
    const shortCtx = ctx.substring(0, 60).replace(/\n/g, ' ');
    ctxCell.textContent = shortCtx.length < ctx.length ? shortCtx + '...' : shortCtx;
    ctxCell.title = ctx; // Show full context on hover
    row.appendChild(ctxCell);
    
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  
  return wrap;
}

function buildCaseResultsTable(cases, skipLabel = false) {
  const ITEMS_PER_PAGE = 15;
  const wrap = mk('div', 'case-table-wrap');
  
  // Skip label if this table is being used in a context that already shows result count
  if (!skipLabel) {
    const label = mk('p', 'case-table-label');
    label.textContent = `${cases.length} case${cases.length !== 1 ? 's' : ''} found`;
    wrap.appendChild(label);
  }

  // ===== PAGINATION STATE FOR THIS BUBBLE =====
  const bubbleState = {
    allCases: cases,
    currentPage: 1,
    itemsPerPage: ITEMS_PER_PAGE,
    totalPages: Math.ceil(cases.length / ITEMS_PER_PAGE)
  };

  const table = mk('table', 'case-table');
  const thead = mk('thead');
  const theadTr = mk('tr');
  ['Case Name', 'Court', 'Year', ''].forEach(col => {
    const th = mk('th');
    th.textContent = col;
    theadTr.appendChild(th);
  });
  thead.appendChild(theadTr);
  table.appendChild(thead);
  
  const tbody = mk('tbody');
  const viewerHost = mk('div', 'inline-viewer-host');

  // ===== FUNCTION: Render current page of results =====
  function renderBubblePage() {
    tbody.innerHTML = '';
    const start = (bubbleState.currentPage - 1) * bubbleState.itemsPerPage;
    const end = start + bubbleState.itemsPerPage;
    const pageCases = bubbleState.allCases.slice(start, end);

    pageCases.forEach((c, i) => {
      const tr = mk('tr');
      
      // Case name cell
      const nameCell = mk('td');
      nameCell.className = 'case-name';
      nameCell.textContent = c.name;
      tr.appendChild(nameCell);
      
      // Court cell
      const courtCell = mk('td');
      courtCell.className = 'td-court';
      courtCell.textContent = c.court;
      tr.appendChild(courtCell);
      
      // Year cell
      const yearCell = mk('td');
      yearCell.className = 'case-year';
      yearCell.textContent = c.year;
      tr.appendChild(yearCell);
      
      // Button cell
      const btnCell = mk('td');
      const btn = mk('button');
      btn.className = 'btn-open';
      btn.dataset.id = c.id;
      btn.textContent = 'Open Case ↓';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`[BTN-CLICK] Button clicked for case: ${c.id}`);
        toggleInlineViewer(c.id, viewerHost, btn, false);
      });
      btnCell.appendChild(btn);
      tr.appendChild(btnCell);
      
      tbody.appendChild(tr);
    });
  }

  // ===== FUNCTION: Render pagination controls for this bubble =====
  function renderBubblePagination() {
    const paginDiv = paginationContainer;
    paginDiv.innerHTML = '';

    if (bubbleState.totalPages <= 1) {
      paginDiv.style.display = 'none';
      return;
    }

    paginDiv.style.display = 'flex';
    paginDiv.style.justifyContent = 'center';
    paginDiv.style.alignItems = 'center';
    paginDiv.style.gap = '8px';
    paginDiv.style.marginTop = '15px';
    paginDiv.style.flexWrap = 'wrap';

    // First button
    const btnFirst = mk('button', 'pagination-btn');
    btnFirst.textContent = '«';
    btnFirst.disabled = bubbleState.currentPage === 1;
    btnFirst.addEventListener('click', () => {
      bubbleState.currentPage = 1;
      renderBubblePage();
      renderBubblePagination();
    });
    paginDiv.appendChild(btnFirst);

    // Previous button
    const btnPrev = mk('button', 'pagination-btn');
    btnPrev.textContent = '<';
    btnPrev.disabled = bubbleState.currentPage === 1;
    btnPrev.addEventListener('click', () => {
      bubbleState.currentPage--;
      renderBubblePage();
      renderBubblePagination();
    });
    paginDiv.appendChild(btnPrev);

    // Page numbers (show 5 consecutive: current ± 2)
    const start = Math.max(1, bubbleState.currentPage - 2);
    const end = Math.min(bubbleState.totalPages, bubbleState.currentPage + 2);
    for (let p = start; p <= end; p++) {
      const btn = mk('button', 'pagination-page-btn');
      btn.textContent = p;
      if (p === bubbleState.currentPage) {
        btn.classList.add('active');
        btn.textContent = `{${p}}`;
      }
      btn.addEventListener('click', () => {
        bubbleState.currentPage = p;
        renderBubblePage();
        renderBubblePagination();
      });
      paginDiv.appendChild(btn);
    }

    // Next button
    const btnNext = mk('button', 'pagination-btn');
    btnNext.textContent = '>';
    btnNext.disabled = bubbleState.currentPage === bubbleState.totalPages;
    btnNext.addEventListener('click', () => {
      bubbleState.currentPage++;
      renderBubblePage();
      renderBubblePagination();
    });
    paginDiv.appendChild(btnNext);

    // Last button
    const btnLast = mk('button', 'pagination-btn');
    btnLast.textContent = '»';
    btnLast.disabled = bubbleState.currentPage === bubbleState.totalPages;
    btnLast.addEventListener('click', () => {
      bubbleState.currentPage = bubbleState.totalPages;
      renderBubblePage();
      renderBubblePagination();
    });
    paginDiv.appendChild(btnLast);
  }

  table.appendChild(tbody);
  wrap.appendChild(table);

  // ===== Create pagination container =====
  const paginationContainer = mk('div', 'bubble-pagination-controls');
  wrap.appendChild(paginationContainer);

  wrap.appendChild(viewerHost);
  
  // Initial render
  renderBubblePage();
  renderBubblePagination();
  
  console.log(`[CASE TABLE] Created paginated table with ${cases.length} total rows, showing ${ITEMS_PER_PAGE} per page`);
  
  return wrap;
}

function buildEnhancedCaseResultsTable(tabularResults, skipLabel = false) {
  console.log('[ENHANCED-TABLE] Building enhanced table with', tabularResults.length, 'results');
  
  const wrap  = mk('div', 'case-table-wrap enhanced-table-wrap');
  if (!skipLabel) {
    const label = mk('p', 'case-table-label');
    label.textContent = `${tabularResults.length} result${tabularResults.length !== 1 ? 's' : ''} found`;
    wrap.appendChild(label);
  }

  const table = mk('table', 'case-table enhanced-case-table');
  const thead = mk('thead');
  const theadTr = mk('tr');
  
  // Enhanced columns: Index, Case Name, Court, Year, Type, Confidence Score, Actions
  ['#', 'Case Name', 'Court', 'Year', 'Type', 'Confidence', 'Details'].forEach(col => {
    const th = mk('th');
    th.textContent = col;
    theadTr.appendChild(th);
  });
  thead.appendChild(theadTr);
  table.appendChild(thead);
  
  const tbody = mk('tbody');
  tabularResults.forEach((row, idx) => {
    const tr = mk('tr');
    if (row.isPrimary) {
      tr.className = 'tr-primary-match';  // Highlight primary match
      tr.style.backgroundColor = '#fffacd';  // Light yellow
      tr.style.fontWeight = 'bold';
    }
    
    // Index
    const indexCell = mk('td');
    indexCell.textContent = row.index;
    indexCell.style.textAlign = 'center';
    tr.appendChild(indexCell);
    
    // Case Name
    const nameCell = mk('td');
    nameCell.className = 'case-name';
    nameCell.textContent = row.caseName;
    tr.appendChild(nameCell);
    
    // Court
    const courtCell = mk('td');
    courtCell.className = 'td-court';
    courtCell.textContent = row.court || '—';
    tr.appendChild(courtCell);
    
    // Year
    const yearCell = mk('td');
    yearCell.className = 'case-year';
    yearCell.textContent = row.year || '—';
    tr.appendChild(yearCell);
    
    // Type (judgment, citation, facts, etc.)
    const typeCell = mk('td');
    typeCell.textContent = row.paraType || 'General';
    typeCell.style.fontSize = '0.9em';
    typeCell.style.color = '#666';
    tr.appendChild(typeCell);
    
    // Confidence Score
    const scoreCell = mk('td');
    scoreCell.textContent = `${(row.confidenceScore * 100).toFixed(1)}%`;
    scoreCell.style.textAlign = 'center';
    tr.appendChild(scoreCell);
    
    // Details button
    const detailsCell = mk('td');
    const detailsBtn = mk('button');
    detailsBtn.className = 'btn-open';
    detailsBtn.textContent = 'View ↓';
    detailsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (row.caseId) {
        console.log('[DETAILS] Opening inline viewer for case:', row.caseId);
        toggleInlineViewer(row.caseId, viewerHost, detailsBtn, false);
      }
    });
    detailsCell.appendChild(detailsBtn);
    tr.appendChild(detailsCell);
    
    tbody.appendChild(tr);
  });
  
  table.appendChild(tbody);
  wrap.appendChild(table);

  const viewerHost = mk('div', 'inline-viewer-host');
  wrap.appendChild(viewerHost);
  
  console.log('[ENHANCED-TABLE] ✅ Created enhanced table with', tabularResults.length, 'rows, PDF links, and type column');
  
  return wrap;
}

function buildJudgmentParagraphsReader(paragraphs, caseMetadata = {}) {
  console.log('[JUDGMENT-READER] Building judgment reader with', paragraphs.length, 'paragraphs');
  
  // Main wrapper
  const wrap = mk('div', 'judgment-reader-wrapper');
  
  // Paragraphs reader
  const reader = mk('div', 'judgment-paragraphs-container');
  reader.style.backgroundColor = '#0a0a0a';
  reader.style.border = '1px solid #222';
  reader.style.borderRadius = '8px';
  reader.style.padding = '20px';
  reader.style.marginTop = '15px';
  reader.style.lineHeight = '1.8';
  reader.style.fontSize = '0.95em';
  
  if (paragraphs.length === 0) {
    const empty = mk('p');
    empty.textContent = 'No judgment paragraphs available';
    empty.style.color = '#666';
    reader.appendChild(empty);
  } else {
    paragraphs.forEach((para, idx) => {
      const paraBlock = mk('div', 'judgment-para-block');
      paraBlock.style.marginBottom = '20px';
      paraBlock.style.paddingBottom = '15px';
      paraBlock.style.borderBottom = 'none';
      
      // Add data attribute for para ref jumps (brief interactivity)
      paraBlock.dataset.paraNo = String(para.paraNo || idx + 1);
      
      // Paragraph header (number + page + type)
      const paraHeader = mk('div', 'judgment-para-header');
      paraHeader.style.display = 'flex';
      paraHeader.style.justifyContent = 'space-between';
      paraHeader.style.alignItems = 'center';
      paraHeader.style.marginBottom = '8px';
      paraHeader.style.fontSize = '0.8em';
      paraHeader.style.color = '#0066cc';
      
      const paraNum = mk('span');
      paraNum.textContent = `Para ${para.paraNo || idx + 1}`;
      paraHeader.appendChild(paraNum);
      
      const paraInfo = mk('span');
      paraInfo.style.display = 'flex';
      paraInfo.style.gap = '10px';
      paraInfo.style.color = '#666';
      
      if (para.pageNo) {
        const page = mk('span');
        page.textContent = `Page ${para.pageNo}`;
        paraInfo.appendChild(page);
      }
      if (para.paraType) {
        const type = mk('span');
        type.textContent = `[${para.paraType}]`;
        type.style.color = '#0066cc';
        paraInfo.appendChild(type);
      }
      if (para.quality) {
        const quality = mk('span');
        const qualityPercent = Math.round((para.quality || 0) * 100);
        quality.textContent = `${qualityPercent}% quality`;
        const qualityColor = qualityPercent > 70 ? '#00cc00' : qualityPercent > 40 ? '#ffaa00' : '#cc0000';
        quality.style.color = qualityColor;
        quality.style.fontWeight = 'bold';
        paraInfo.appendChild(quality);
      }
      
      paraHeader.appendChild(paraInfo);
      paraBlock.appendChild(paraHeader);
      
      // Paragraph text
      const paraText = mk('p', 'judgment-para-text');
      paraText.textContent = para.text;
      paraText.style.color = '#ddd';
      paraText.style.margin = '0';
      paraText.style.whiteSpace = 'pre-wrap';
      paraText.style.wordWrap = 'break-word';
      paraBlock.appendChild(paraText);
      
      reader.appendChild(paraBlock);
    });
  }
  
  wrap.appendChild(reader);
  return wrap;
}

function buildStudyOutput(sections) {
  const wrap = mk('div', 'study-output');
  wrap.style.cssText = 'margin-top:14px;padding:12px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;';
  
  sections.forEach(s => {
    const type = s.output_type || 'unknown';
    const block = mk('div', 'study-block');
    block.style.cssText = 'margin-bottom:16px;padding:12px;background:#fff;border-radius:8px;border-left:3px solid #3b82f6;';
    
    const lbl = mk('p', 'study-block__label');
    lbl.style.cssText = 'margin:0 0 8px 0;font-size:13px;font-weight:600;color:#1f2937;text-transform:uppercase;letter-spacing:0.5px;';
    
    switch(type) {
      case 'concept_explanation':
      case 'case_explanation':
      case 'bare_act_simplified':
      case 'deep_dive':
        lbl.textContent = `📚 ${type.replace(/_/g, ' ').toUpperCase()}`;
        const textBody = mk('div', 'study-block__body');
        textBody.style.cssText = 'font-size:14px;line-height:1.7;color:#374151;';
        textBody.innerHTML = s.body || (s.text || 'Loading...');
        block.appendChild(lbl);
        block.appendChild(textBody);
        break;
        
      case 'case_brief':
      case 'notes':
        lbl.textContent = `📝 ${type === 'case_brief' ? 'CASE BRIEF (FIHR)' : 'STUDY NOTES'}`;
        const briefBody = mk('div', 'study-block__body');
        briefBody.style.cssText = 'font-size:13px;line-height:1.6;color:#374151;';
        briefBody.innerHTML = s.body || s.text || 'No content';
        block.appendChild(lbl);
        block.appendChild(briefBody);
        break;
        
      case 'flashcards':
        lbl.textContent = '🃏 FLASHCARDS';
        block.appendChild(lbl);
        if (s.cards && Array.isArray(s.cards)) {
          const deckWrap = mk('div');
          deckWrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;';
          s.cards.forEach((card, i) => {
            const cardEl = mk('div');
            cardEl.style.cssText = 'padding:12px;background:#fff;border:1px solid #d1d5db;border-radius:8px;cursor:pointer;min-height:100px;display:flex;flex-direction:column;justify-content:center;transition:all 0.3s;';
            cardEl.title = 'Click to flip';
            let flipped = false;
            const updateCard = () => {
              cardEl.innerHTML = `<div style="font-size:11px;color:#9ca3af;margin-bottom:6px;">${flipped ? 'ANSWER' : 'QUESTION'}</div><div style="font-size:13px;font-weight:${flipped ? '400' : '600'};color:#111;">${flipped ? (card.answer || card.A || '') : (card.question || card.Q || '')}</div><div style="font-size:10px;color:#d1d5db;margin-top:8px;">${card.difficulty || 'medium'} • ${card.type || 'fact'}</div>`;
            };
            updateCard();
            cardEl.addEventListener('click', () => {
              flipped = !flipped;
              updateCard();
            });
            cardEl.onmouseover = () => cardEl.style.borderColor = '#3b82f6';
            cardEl.onmouseout = () => cardEl.style.borderColor = '#d1d5db';
            deckWrap.appendChild(cardEl);
          });
          block.appendChild(deckWrap);
        } else {
          const empty = mk('p');
          empty.textContent = 'No flashcards generated';
          empty.style.color = '#9ca3af';
          block.appendChild(empty);
        }
        break;
        
      case 'arguments':
        lbl.textContent = '⚔️ ARGUMENTS';
        block.appendChild(lbl);
        const argBody = mk('div');
        argBody.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;';
        
        ['petitioner_arguments', 'respondent_arguments'].forEach((side, idx) => {
          const sideDiv = mk('div');
          sideDiv.style.cssText = `padding:12px;background:${idx === 0 ? '#eff6ff' : '#fef2f2'};border-left:3px solid ${idx === 0 ? '#3b82f6' : '#ef4444'};border-radius:6px;`;
          const sideTitle = mk('div', 'study-side-title');
          sideTitle.style.cssText = `font-size:12px;font-weight:700;color:${idx === 0 ? '#1d4ed8' : '#991b1b'};margin-bottom:8px;text-transform:uppercase;`;
          sideTitle.textContent = idx === 0 ? '👤 Petitioner' : '👤 Respondent';
          sideDiv.appendChild(sideTitle);
          
          const args = s[side] || [];
          const argsList = mk('ul');
          argsList.style.cssText = 'list-style:none;padding:0;margin:0;';
          (Array.isArray(args) ? args : [args]).forEach(arg => {
            const li = mk('li');
            li.style.cssText = 'margin-bottom:8px;font-size:12px;line-height:1.5;color:#374151;';
            li.innerHTML = `<strong>${arg.point || arg.heading || 'Argument'}</strong><br/>${arg.detail || arg.text || ''}`;
            argsList.appendChild(li);
          });
          sideDiv.appendChild(argsList);
          argBody.appendChild(sideDiv);
        });
        
        if (s.court_finding) {
          const courtDiv = mk('div');
          courtDiv.style.cssText = 'grid-column:1/-1;padding:12px;background:#f0fdf4;border-left:3px solid #22c55e;border-radius:6px;margin-top:8px;';
          const courtTitle = mk('div');
          courtTitle.style.cssText = 'font-size:12px;font-weight:700;color:#166534;margin-bottom:6px;text-transform:uppercase;';
          courtTitle.textContent = '⚖️ Court Finding';
          const courtText = mk('div');
          courtText.style.cssText = 'font-size:13px;color:#374151;line-height:1.6;';
          courtText.textContent = s.court_finding;
          courtDiv.appendChild(courtTitle);
          courtDiv.appendChild(courtText);
          argBody.appendChild(courtDiv);
        }
        block.appendChild(argBody);
        break;
        
      case 'qa_mode':
        lbl.textContent = '❓ EXAM QUESTIONS';
        block.appendChild(lbl);
        const qaBody = mk('div');
        const qaItems = s.qa_pairs || s.questions || [];
        (Array.isArray(qaItems) ? qaItems : [qaItems]).forEach(item => {
          const item_div = mk('div');
          item_div.style.cssText = 'margin-bottom:8px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;';
          const q = mk('div');
          q.style.cssText = 'padding:10px;background:#f3f4f6;cursor:pointer;font-weight:500;font-size:12px;user-select:none;';
          q.textContent = item.question || item.q || 'Question';
          let shown = false;
          const a = mk('div');
          a.style.cssText = 'padding:10px;background:#fff;font-size:12px;color:#374151;line-height:1.5;display:none;border-top:1px solid #e5e7eb;';
          a.textContent = item.answer || item.a || 'Answer';
          q.addEventListener('click', () => {
            shown = !shown;
            a.style.display = shown ? '' : 'none';
            q.style.background = shown ? '#dbeafe' : '#f3f4f6';
          });
          item_div.appendChild(q);
          item_div.appendChild(a);
          qaBody.appendChild(item_div);
        });
        block.appendChild(qaBody);
        break;
        
      case 'ratio':
      case 'ratio-obiter':
        lbl.textContent = '🔍 RATIO & OBITER';
        block.appendChild(lbl);
        const ratioBody = mk('div');
        
        if (s.ratio_summary) {
          const ratioDiv = mk('div');
          ratioDiv.style.cssText = 'padding:10px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:6px;margin-bottom:12px;font-size:12px;line-height:1.6;';
          ratioDiv.innerHTML = `<strong>📌 Ratio:</strong> ${s.ratio_summary}`;
          ratioBody.appendChild(ratioDiv);
        }
        
        if (s.classifications && Array.isArray(s.classifications)) {
          const classTable = mk('table');
          classTable.style.cssText = 'width:100%;font-size:11px;border-collapse:collapse;';
          classTable.innerHTML = `<thead><tr style="background:#f3f4f6;border-bottom:1px solid #e5e7eb;"><th style="padding:6px;text-align:left;font-weight:600;">Para</th><th style="padding:6px;text-align:left;font-weight:600;">Type</th><th style="padding:6px;text-align:left;font-weight:600;">Conf</th></tr></thead><tbody>${(s.classifications || []).map(c => `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:6px;color:#666;">${c.para_number || c.para}</td><td style="padding:6px;"><span style="background:#e0e7ff;color:#3730a3;padding:2px 6px;border-radius:3px;font-weight:600;font-size:10px;">${c.type || 'unknown'}</span></td><td style="padding:6px;color:#666;font-size:10px;">${c.confidence || 'med'}</td></tr>`).join('')}</tbody>`;
          ratioBody.appendChild(classTable);
        }
        
        if (s.key_obiter) {
          const obiterDiv = mk('div');
          obiterDiv.style.cssText = 'padding:10px;background:#f3f4f6;border-left:3px solid #8b5cf6;border-radius:6px;margin-top:12px;font-size:12px;line-height:1.6;';
          obiterDiv.innerHTML = `<strong>💭 Key Obiter:</strong> ${s.key_obiter}`;
          ratioBody.appendChild(obiterDiv);
        }
        
        block.appendChild(ratioBody);
        break;
        
      case 'synthesis':
      case 'synthesize':
        lbl.textContent = '🔗 MULTI-CASE SYNTHESIS';
        block.appendChild(lbl);
        const synthBody = mk('div');
        synthBody.style.cssText = 'font-size:13px;line-height:1.7;color:#374151;';
        synthBody.innerHTML = s.body || s.text || s.synthesis || 'Synthesizing cases...';
        block.appendChild(synthBody);
        break;
        
      default:
        lbl.textContent = type.replace(/_/g, ' ').toUpperCase();
        const genericBody = mk('div');
        genericBody.innerHTML = s.body || s.text || JSON.stringify(s).substring(0, 100);
        block.appendChild(lbl);
        block.appendChild(genericBody);
    }
    
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

// ─────────────────────────────────────────────────────────────
// Draft from Case Integration
// ─────────────────────────────────────────────────────────────

/**
 * Fetch case data and auto-fill the drafting form
 * Called when user clicks "✍️ Draft" button on case viewer
 */
async function draftFromThisCase(caseData) {
  try {
    const caseId = caseData.id;
    console.log('[DRAFT] Fetching case data for drafting:', caseId);
    
    // Fetch pre-filled data from backend
    const res = await fetch(`http://localhost:8000/api/draft/prefill/${caseId}`);
    if (!res.ok) {
      alert(`Failed to load case data: ${res.status}`);
      return;
    }
    
    const prefillData = await res.json();
    console.log('[DRAFT] Case data received from backend:', prefillData);
    
    // Switch to Drafting Engine tab
    switchMode('drafting');
    console.log('[DRAFT] Switched to drafting mode');
    
    // Auto-fill the form
    setTimeout(() => {
      if (typeof MadhavDrafting !== 'undefined' && MadhavDrafting.prefillFromCase) {
        MadhavDrafting.prefillFromCase(prefillData);
        console.log('[DRAFT] Form pre-filled successfully');
      } else {
        console.error('[DRAFT] MadhavDrafting not available');
      }
    }, 100);
    
  } catch (err) {
    console.error('[DRAFT] Error drafting from case:', err);
    alert('Error: ' + err.message);
  }
}
