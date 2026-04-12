/**
 * ============================================================
 * MADHAV.AI — api.js
 * Backend idhar hai
 *
 * HOW TO GO LIVE (3 steps):
 *   1. Set USE_MOCK = false
 *   2. Set BASE_URL to your FastAPI server (e.g. 'http://localhost:8000')
 *   3. Make sure your endpoints match the shapes documented below
 *
 * Every function is documented with:
 *   - HTTP method + path
 *   - Request body / query params
 *   - Expected response shape
 * ============================================================
 */

// ── Configuration ─────────────────────────────────────────────
const USE_MOCK  = false;                   // ← flip to false when backend is ready ✅ NOW LIVE!
const BASE_URL  = 'http://localhost:8000'; // ← your FastAPI base URL


// ── API Layer ─────────────────────────────────────────────────
//
// Each function returns a Promise that resolves to the response shape.
// When USE_MOCK is true, it returns mock data after a fake delay.
// When USE_MOCK is false, it calls the real backend endpoint.

const API = {

  /**
   * AI Chat
   * Handles Normal, Research, and Study mode queries.
   *
   * POST /chat
   * Body:     { query: string, mode: 'normal' | 'research' | 'study' }
   *
   * Response (normal / research):
   *   { text: string, cases: Case[], tabular_results: TableRow[], complete_explanation: string, intent: string }
   *
   * Response (study):
   *   { sections: StudySection[] }
   */
  async chat(query, mode) {
    if (USE_MOCK) return _mockChat(query, mode);

    const res = await fetch(`${BASE_URL}/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query, mode }),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.detail || 'API error');
    }
    
    // CRITICAL DEBUG: Log citations_flat immediately after parsing
    console.log('[API] === RECEIVED RESPONSE ===', {
      output_type: data.output_type,
      citations_flat_type: typeof data.citations_flat,
      citations_flat_isArray: Array.isArray(data.citations_flat),
      citations_flat_length: data.citations_flat?.length || 'UNDEFINED',
      citations_flat_sample: Array.isArray(data.citations_flat) && data.citations_flat.length > 0 
        ? data.citations_flat[0].target_citation 
        : 'empty',
    });
    
    console.log('[API] Backend response:', {
      hasTabularResults: !!data.tabular_results,
      tabularResultsCount: data.tabular_results?.length,
      intent: data.intent,
      isUnique: data.is_unique,
      hasCompleteExplanation: !!data.complete_explanation,
    });
    
    // Adapt backend response format to frontend expectations
    // Backend returns: { query, mode, total_results, results, answer, tabular_results, complete_explanation, 
    //                    intent, is_unique, is_generic, citation_tree, citations_flat, latency_ms }
    // Frontend expects: { text, cases: [...], tabularResults: [...], completeExplanation: string, intent: string }
    // Also map field names: case_id → id, case_name → name, relevance_score → score
    
    const cases = (data.results || []).map(r => ({
      id:       r.case_id,
      name:     r.case_name,
      court:    r.court || 'Unknown',
      year:     r.year,
      citation: r.citation || r.case_id,
      score:    r.relevance_score,
      type:     r.result_type,
      paragraph_text: r.paragraph_text,
      search_mode: r.search_mode,
      paraType: r.para_type,
      pdfLink:  r.pdf_link || `/case/${r.case_id}`,
      authority_score: r.authority_score || 50,
      precedent_status: r.precedent_status || 'unknown',
      precedent_strength: r.precedent_strength || 0,
    }));
    
    // Build tabular results with enhanced information
    const tabularResults = (data.tabular_results || []).map(row => ({
      index:           row.index,
      caseName:        row.case_name,
      caseId:          row.case_id,
      court:           row.court,
      year:            row.year,
      intent:          row.intent,
      paraType:        row.para_type,
      textSnippet:     row.text_snippet,
      confidenceScore: row.confidence_score,
      pdfLink:         row.pdf_link || `/case/${row.case_id}`,
      paraNo:          row.para_no,
      isPrimary:       row.is_primary,  // Highlight primary match in UI
    }));
    
    console.log('[API] Mapped tabularResults:', {
      count: tabularResults.length,
      sample: tabularResults.length > 0 ? tabularResults[0] : 'empty',
    });
    
    // FIX #3/#4/#5/#6: Smart answerText logic per output type
    let answerText;
    if (['law', 'answer', 'hybrid'].includes(data.output_type)) {
      // For law/answer/hybrid: LLM answer is primary, complete_explanation is secondary
      answerText = data.answer || data.complete_explanation 
        || `Found ${data.total_results || 0} result${data.total_results !== 1 ? 's' : ''} for "${query}"`;
    } else if (data.output_type === 'case_answer') {
      // For case_answer: answer is mandatory, but may be null if LLM failed
      // Frontend will show "Could not generate answer" message if null
      answerText = data.answer || null;
    } else {
      // For table/citation_graph/judgment_only: use count fallback
      answerText = `Found ${data.total_results || 0} result${data.total_results !== 1 ? 's' : ''} for "${query}"`;
    }
    
    // Log latency without including in the rendered text
    if (data.latency_ms) {
      console.log(`[API] Query latency: ${Math.round(data.latency_ms)}ms`);
    }    
    // FIX #5/#6: Show complete_explanation only when different from answer
    let explanation = null;
    if (data.output_type !== 'case_answer') {
      // For non-case_answer: if complete_explanation exists and differs from answer, show it separately
      if (data.complete_explanation && data.complete_explanation !== data.answer) {
        explanation = data.complete_explanation;
      }
    }
    
    // Map judgment_paragraphs from backend
    const judgmentParagraphs = (data.judgment_paragraphs || []).map(para => ({
      paragraphId:  para.paragraph_id,
      caseId:       para.case_id,
      caseName:     para.case_name,
      paraNo:       para.para_no,
      pageNo:       para.page_no,
      paraType:     para.para_type || 'general',
      text:         para.text,
      quality:      para.quality,
    }));

    // CRITICAL: Map citations_flat before creating result object
    console.log('[API] === MAPPING CITATIONS ===', {
      data_citations_flat_type: typeof data.citations_flat,
      data_citations_flat_length: data.citations_flat?.length || 'UNDEFINED',
    });
    
    const citationsFlat = data.citations_flat || [];
    console.log('[API] Mapped citationsFlat:', {
      length: citationsFlat.length,
      type: typeof citationsFlat,
      isArray: Array.isArray(citationsFlat),
      sample: citationsFlat.length > 0 ? citationsFlat[0].target_citation : 'empty',
    });
    
    // ✨ STUDY MODE: Check if backend returned sections (study output format)
    const sections = data.sections || null;
    if (sections) {
      console.log('[API] 🎓 STUDY MODE detected - sections found:', {
        sectionsCount: sections.length,
        firstSectionType: sections[0]?.output_type || 'unknown',
      });
    }
    
    const result = {
      text:                  answerText,
      cases:                 cases,
      tabularResults:        tabularResults,
      judgmentParagraphs:    judgmentParagraphs,
      completeExplanation:   explanation,
      intent:                data.intent || 'mixed',
      isUnique:              data.is_unique || false,
      isGeneric:             data.is_generic || false,
      outputType:            data.output_type || 'hybrid',
      citationTree:          data.citation_tree,
      citationsFlat:         citationsFlat,
      totalResults:          data.total_results,
      caseMetadata:          data.case_metadata,
      caseSummary:           data.case_summary,  // ✨ LLM-generated case summary for full_case
      sections:              sections,            // ✨ STUDY MODE: Pass through sections array
    };
    
    console.log('[API] 📊 Response mapping:');
    console.log('  Mode:', sections ? '🎓 STUDY MODE' : '📊 Research Mode');
    console.log('  outputType:', result.outputType);
    console.log('  caseMetadata.case_name:', result.caseMetadata?.case_name);
    console.log('  caseSummary present:', !!result.caseSummary);
    console.log('  sections present:', !!result.sections);
    if (sections) console.log('  sections count:', sections.length);
    
    console.log('[API] Final return object:', {
      hasText: !!result.text,
      casesCount: result.cases.length,
      tabularResultsCount: result.tabularResults.length,
      hasCompleteExplanation: !!result.completeExplanation,
      intent: result.intent,
      isUnique: result.isUnique,
      citationsFlatCount: result.citationsFlat?.length || 0,
      caseMetadataPresent: !!result.caseMetadata,
      outputType: result.outputType,
    });
    
    return result;
  },


  /**
   * Keyword / Token Search (Traditional Mode)
   *
   * GET /search
   * Params:
   *   q          string   — free-text keyword
   *   court      string   — e.g. 'supreme', 'delhi', 'bombay'
   *   year_from  number
   *   year_to    number
   *   act        string   — statute keyword
   *   judge      string
   *   exclude    string   — comma-separated exclude terms
   *
   * Response:
   *   { cases: Case[], total: number }
   */
  async search(params = {}) {
    if (USE_MOCK) return _mockSearch(params);

    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
    );
    const res = await fetch(`${BASE_URL}/search?${qs}`);
    return res.json();
  },


  /**
   * Fetch a single case (for the inline viewer / PDF panel)
   *
   * GET /case/:id
   *
   * Response: Case (full object — see shape below)
   */
  async getCase(id) {
    if (USE_MOCK) {
      await _delay(200);
      const c = MOCK_CASES.find(x => x.id === id);
      return c || null;
    }

    const res = await fetch(`${BASE_URL}/case/${id}`);
    if (!res.ok) {
      throw new Error(`Case not found: ${res.status}`);
    }
    
    const data = await res.json();
    
    // Map backend response to frontend format
    // Backend now includes LLM-generated summary (llm_summary field)
    // Backend returns: { case_id, case_name, court, year, judgment, llm_summary, paragraphs[], ... }
    // Frontend expects: { id, name, court, year, summary, facts, judgement, cited_in, ... }
    
    // Extract summary - PRIORITIZE LLM-generated summary if available
    let summary = '';
    if (data.llm_summary && data.llm_summary.trim()) {
      summary = data.llm_summary;  // ✅ Use LLM-generated summary first
      console.log('[API] Using LLM-generated summary for case');
    } else if (data.outcome_summary && data.outcome_summary.trim()) {
      summary = data.outcome_summary;
    } else if (data.judgment && data.judgment.trim()) {
      summary = data.judgment.substring(0, 800);
    } else if (data.paragraphs && data.paragraphs.length > 0) {
      // Use first paragraph as summary if judgment unavailable
      const firstPara = data.paragraphs.find(p => p.text && p.text.trim());
      summary = firstPara ? firstPara.text.substring(0, 800) : 'Case details are being processed.';
    } else {
      summary = 'Full case judgment and arguments available through paragraphs.';
    }
    
    // Extract facts from paragraphs or acts
    let facts = [];
    if (data.acts_referred && Array.isArray(data.acts_referred)) {
      facts = data.acts_referred.map(a => `Statute: ${a}`);
    }
    if (facts.length === 0 && data.paragraphs && data.paragraphs.length > 0) {
      // Create facts from first 5 meaningful paragraphs
      facts = data.paragraphs
        .filter(p => p.text && p.text.trim())
        .slice(0, 5)
        .map(p => p.text.substring(0, 200).trim() + (p.text.length > 200 ? '...' : ''));
    }
    if (facts.length === 0) {
      facts = ['Case details compiled from court documents'];
    }
    
    // Extract judgment text - prioritize actual judgment paragraphs
    let judgement = '';
    if (data.judgment && data.judgment.trim()) {
      judgement = data.judgment;
    } else if (data.outcome_summary && data.outcome_summary.trim()) {
      judgement = data.outcome_summary;
    } else if (data.paragraphs && data.paragraphs.length > 0) {
      // Concatenate all paragraphs as judgment text
      judgement = data.paragraphs
        .filter(p => p.text && p.text.trim())
        .map(p => p.text)
        .join('\n\n');
    } else {
      judgement = 'Full judgment text is being compiled from case records.';
    }
    
    // Process citations - use target_citation if cited_case_id is not available
    let cited_in = [];
    if (data.citations && Array.isArray(data.citations)) {
      cited_in = data.citations
        .filter(c => c && (c.cited_case_id || c.target_citation))
        .map(c => ({
          id: c.cited_case_id || c.target_citation,
          name: c.target_citation || c.cited_case_id || 'Unknown Case',
          year: c.cited_case_id ? parseInt(c.cited_case_id.split('_')[1]) : null,
          court: 'Referenced Case',
          citation: c.target_citation || c.cited_case_id,
          context: c.context_sentence || '',
          relationship: c.relationship || 'cited',
          confidence: c.confidence || 0,
        }));
    }
    
    return {
      id:       data.case_id || 'unknown',
      name:     data.case_name || 'Unknown Case',
      court:    data.court || 'Unknown Court',
      year:     data.year || new Date().getFullYear(),
      citation: data.case_id,
      summary:  summary,
      facts:    facts,
      judgement: judgement,
      cited_in: cited_in,
      bench:    data.court_type || 'Single Bench',
      petitioner: data.petitioner || 'Unknown Party',
      respondent: data.respondent || 'Unknown Party',
      paragraphs: data.paragraphs || [],
      citations: data.citations || [],
      llm_generated: !!data.llm_summary,  // Track if LLM was used
    };
  },


  /**
   * Suggestion lookup for token search input
   * Called as user types in Traditional Mode search bar.
   *
   * GET /suggestions?q=<partial>
   *
   * Response: { suggestions: Suggestion[] }
   *
   * Note: Currently uses a static client-side list (SUGGESTIONS below).
   * Replace with the live call when the backend supports it.
   */
  async getSuggestions(partial) {
    // When backend is ready, swap this out:
    //   const res = await fetch(`${BASE_URL}/suggestions?q=${partial}`);
    //   return res.json();

    await _delay(0); // keep async contract
    const q = partial.toLowerCase();
    const matched = SUGGESTIONS.filter(s =>
      s.label.toLowerCase().includes(q) ||
      s.keywords.some(k => k.includes(q))
    ).slice(0, 7);
    return { suggestions: matched };
  },

  /**
   * DAY 2 — PRECEDENT INTELLIGENCE
   * Get precedent status for a single case
   *
   * GET /api/cases/{case_id}/precedent-status
   *
   * Response:
   * {
   *   case_id: string,
   *   case_name: string,
   *   status: "good_law" | "overruled" | "distinguished" | "doubted" | "unknown",
   *   status_label: string,
   *   strength_score: 0-100,
   *   treatment_counts: { followed: num, distinguished: num, ... },
   *   citing_cases_scanned: number,
   *   top_citing_cases: [ { case_name, citation, treatment, year }, ... ]
   * }
   */
  async getPrecedentStatus(caseId) {
    if (USE_MOCK) {
      await _delay(100);
      return {
        case_id: caseId,
        case_name: 'Sample Case',
        status: 'good_law',
        status_label: 'Good law — followed in 15 later cases',
        strength_score: 82,
        treatment_counts: { followed: 15, distinguished: 2, overruled: 0, doubted: 0 },
        citing_cases_scanned: 17,
        top_citing_cases: [
          { case_name: 'Case A', citation: 'AIR 2020 SC 123', treatment: 'followed', year: 2020 },
          { case_name: 'Case B', citation: 'AIR 2021 SC 456', treatment: 'distinguished', year: 2021 },
        ]
      };
    }

    try {
      const res = await fetch(`${BASE_URL}/api/cases/${caseId}/precedent-status`);
      if (!res.ok) {
        throw new Error(`Precedent status not available for ${caseId}`);
      }
      return await res.json();
    } catch (err) {
      console.warn(`[API] Could not fetch precedent status: ${err.message}`);
      return null;
    }
  },

  /**
   * DAY 2 — PRECEDENT INTELLIGENCE
   * Get bulk precedent status for multiple cases (for search results)
   *
   * POST /api/cases/bulk-precedent-status
   * Body: { case_ids: [string, ...] }
   *
   * Response:
   * {
   *   statuses: {
   *     case_id: { status, strength, label, treatment_counts, citing_count }
   *   },
   *   from_cache: boolean
   * }
   */
  async getBulkPrecedentStatus(caseIds) {
    if (USE_MOCK) {
      await _delay(50);
      const statuses = {};
      caseIds.forEach(id => {
        statuses[id] = {
          status: ['good_law', 'overruled', 'distinguished'][Math.floor(Math.random() * 3)],
          strength: Math.floor(Math.random() * 100),
          label: 'See details',
          treatment_counts: { followed: 10, distinguished: 2 },
          citing_count: 12,
        };
      });
      return { statuses, from_cache: true };
    }

    try {
      const res = await fetch(`${BASE_URL}/api/cases/bulk-precedent-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_ids: caseIds }),
      });

      if (!res.ok) {
        throw new Error('Bulk status request failed');
      }
      return await res.json();
    } catch (err) {
      console.warn(`[API] Could not fetch bulk precedent status: ${err.message}`);
      return { statuses: {}, from_cache: false };
    }
  },

  /**
   * DAY 2 — PRECEDENT INTELLIGENCE
   * Get citation context for a case ("why was it cited")
   *
   * GET /api/cases/{case_id}/citation-context?use_ai=false
   *
   * Response:
   * {
   *   case_id: string,
   *   case_name: string,
   *   citations: [
   *     {
   *       cited_case_name: string,
   *       year: number,
   *       paragraph: string,
   *       context_snippet: string,
   *       cited_for: string,
   *       treatment: string
   *     },
   *     ...
   *   ]
   * }
   */
  async getCitationContext(caseId, useAI = false) {
    if (USE_MOCK) {
      await _delay(200);
      return {
        case_id: caseId,
        case_name: 'Sample Case',
        citations: [
          {
            cited_case_name: 'Maneka Gandhi v. UoI',
            year: 1978,
            paragraph: 'Para 34',
            context_snippet: '...Article 21 protects the right to travel...',
            cited_for: 'Right to travel is a fundamental right',
            treatment: 'followed',
          },
        ]
      };
    }

    try {
      const url = `${BASE_URL}/api/cases/${caseId}/citation-context?use_ai=${useAI}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Citation context not available for ${caseId}`);
      }
      return await res.json();
    } catch (err) {
      console.warn(`[API] Could not fetch citation context: ${err.message}`);
      return null;
    }
  },

  /**
   * DAY 3 — ISSUE SPOTTER
   * Analyzes client facts and identifies legal issues
   *
   * POST /api/study/issue-spot
   * Body: { facts: string, context?: string }
   *
   * Response:
   * {
   *   issues: [
   *     {
   *       title: string,
   *       priority: "high" | "medium" | "low",
   *       applicable_acts: [string, ...],
   *       explanation: string,
   *       suggested_search: [string, ...]
   *     }
   *   ]
   * }
   */
  async spotIssues(facts, context = '') {
    if (USE_MOCK) {
      await _delay(800);
      return {
        issues: [
          {
            title: 'Wrongful termination',
            priority: 'high',
            applicable_acts: ['Industrial Disputes Act, 1947', 'Contract Act, 1872'],
            explanation: 'Termination without notice may constitute wrongful termination if the employment contract or statute requires notice period.',
            suggested_search: ['wrongful termination notice period', 'wrongful discharge India', 'termination without cause']
          },
          {
            title: 'Entitlement to severance',
            priority: 'high',
            applicable_acts: ['Payment of Gratuity Act, 1972', 'Industrial Disputes Act, 1947'],
            explanation: 'After 5 years of service, the employee may be entitled to gratuity and severance based on statutory provisions.',
            suggested_search: ['gratuity calculation 5 years', 'severance entitlement India']
          },
          {
            title: 'Unfair labor practice',
            priority: 'medium',
            applicable_acts: ['Industrial Disputes Act, 1947'],
            explanation: 'Termination without proper notice or opportunity to explain may constitute an unfair labor practice.',
            suggested_search: ['unfair labor practices employer', 'industrial dispute termination']
          }
        ]
      };
    }

    try {
      const res = await fetch(`${BASE_URL}/api/study/issue-spot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facts, context }),
      });

      if (!res.ok) {
        throw new Error('Issue spotting failed');
      }
      return await res.json();
    } catch (err) {
      console.error(`[API] Issue spotting error: ${err.message}`);
      return { issues: [] };
    }
  },

  /**
   * DAY 3 — QUICK BRIEF
   * Fast summary of a case (DB only or with LLM enhancement)
   *
   * POST /api/study/quick-brief
   * Body: { case_id: string, use_llm?: boolean }
   *
   * Response:
   * {
   *   one_liner: string,
   *   summary_30s: string,
   *   source: "database" | "llm"
   * }
   */
  async getQuickBrief(caseId, useLLM = false) {
    if (USE_MOCK) {
      await _delay(useLLM ? 300 : 50);
      return {
        one_liner:   'Right to health extends to emergency medical care; State cannot shirk obligation citing lack of resources.',
        summary_30s: 'SC held that Article 21 includes right to emergency medical care. State must provide treatment regardless of resource constraints. Petitioner was denied care at govt hospitals and got treated privately; Court ordered compensation.',
        source:      useLLM ? 'llm' : 'database'
      };
    }

    try {
      const res = await fetch(`${BASE_URL}/api/study/quick-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, use_llm: useLLM }),
      });

      if (!res.ok) {
        throw new Error('Quick brief failed');
      }

      // Handle SSE streaming response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let data = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const json = JSON.parse(line.replace('data: ', ''));
            data = json;
          }
        }
      }

      return data || { one_liner: '', summary_30s: '', source: 'error' };
    } catch (err) {
      console.error(`[API] Quick brief error: ${err.message}`);
      return { one_liner: '', summary_30s: '', source: 'error' };
    }
  },

  /**
   * DAY 3 — LEGAL TEST EXTRACTOR
   * Extracts multi-part legal tests from case (e.g., proportionality test, Lemon test)
   *
   * POST /api/study/legal-test
   * Body: { case_id: string }
   *
   * Response:
   * {
   *   has_legal_test: boolean,
   *   test_name?: string,
   *   steps?: [
   *     {
   *       step_number: number,
   *       label: string,
   *       description: string,
   *       para_reference?: string,
   *       how_applied?: string
   *     }
   *   ]
   * }
   */
  async getLegalTest(caseId) {
    if (USE_MOCK) {
      await _delay(200);
      return {
        has_legal_test: true,
        test_name: 'Proportionality Test',
        steps: [
          {
            step_number: 1,
            label: 'Legitimate Aim',
            description: 'Is there a legitimate aim served by the measure?',
            para_reference: 'Para 45-48',
            how_applied: 'The penalty served disciplinary and deterrent purposes — a legitimate aim.'
          },
          {
            step_number: 2,
            label: 'Rational Connection',
            description: 'Is there rational connection between means and aim?',
            para_reference: 'Para 52-55',
            how_applied: 'The penalty was rationally connected to the misconduct — employee knew consequences.'
          },
          {
            step_number: 3,
            label: 'Necessity',
            description: 'Is the measure necessary (no less restrictive alternative)?',
            para_reference: 'Para 59-62',
            how_applied: 'Given severity of misconduct, a lighter measure would not have achieved deterrence.'
          }
        ]
      };
    }

    try {
      console.log(`[API-LEGAL-TEST] 🔍 Fetching legal test for case: ${caseId}`);
      const url = `${BASE_URL}/api/study/legal-test`;
      console.log(`[API-LEGAL-TEST] 📤 POST to ${url}`);
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId }),
      });

      console.log(`[API-LEGAL-TEST] 📡 Response status: ${res.status}`);
      
      if (!res.ok) {
        throw new Error(`Legal test extraction failed: ${res.status}`);
      }

      // Handle SSE streaming response
      console.log(`[API-LEGAL-TEST] 🔄 Opening stream reader...`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      let accumulatedText = '';  // Accumulate all content
      let data = null;
      let chunkCount = 0;
      let lineCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        chunkCount++;
        
        if (done) {
          console.log(`[API-LEGAL-TEST] ✅ Stream ended (${chunkCount} chunks, ${lineCount} lines)`);
          break;
        }
        
        const chunk = decoder.decode(value);
        console.log(`[API-LEGAL-TEST] 📨 Chunk ${chunkCount} (${chunk.length} bytes): ${chunk.substring(0, 100)}...`);
        
        const lines = chunk.split('\n\n');
        console.log(`[API-LEGAL-TEST]   └─ Split into ${lines.length} lines`);
        
        for (const line of lines) {
          if (line.trim()) {
            lineCount++;
            console.log(`[API-LEGAL-TEST]   └─ Line ${lineCount}: "${line.substring(0, 80)}..."`);
          }
          
          if (line.startsWith('data: ')) {
            const sseContent = line.replace('data: ', '').trim();
            console.log(`[API-LEGAL-TEST]   └─ SSE content: ${sseContent.substring(0, 150)}...`);
            
            try {
              const json = JSON.parse(sseContent);
              console.log(`[API-LEGAL-TEST]   └─ ✅ Parsed JSON:`, JSON.stringify(json).substring(0, 200));
              
              // Check if this is token stream or final JSON
              if (json.token !== undefined) {
                // This is a token message
                accumulatedText += json.token;
                console.log(`[API-LEGAL-TEST]   └─ Token accumulated. Total so far: ${accumulatedText.length} chars`);
              } else if (json.has_legal_test !== undefined) {
                // This is final response with has_legal_test field
                data = json;
                console.log(`[API-LEGAL-TEST]   └─ ✅ Got final response: has_legal_test=${json.has_legal_test}`);
              } else {
                // Unknown JSON format
                console.log(`[API-LEGAL-TEST]   └─ ⚠️  Unknown JSON format. Keys:`, Object.keys(json));
                data = json;
              }
            } catch (parseErr) {
              console.error(`[API-LEGAL-TEST]   └─ ❌ JSON parse error: ${parseErr.message}`);
              console.error(`[API-LEGAL-TEST]   └─ Problematic content: ${sseContent.substring(0, 200)}`);
            }
          }
        }
      }

      console.log(`[API-LEGAL-TEST] 📊 Stream summary:`);
      console.log(`[API-LEGAL-TEST]   - Total chunks: ${chunkCount}`);
      console.log(`[API-LEGAL-TEST]   - Total lines: ${lineCount}`);
      console.log(`[API-LEGAL-TEST]   - Accumulated tokens: ${accumulatedText.length} chars`);
      console.log(`[API-LEGAL-TEST]   - Final data:`, data ? JSON.stringify(data).substring(0, 300) : 'NULL');

      // If we have accumulated text but no data, try parsing the text as JSON
      if (accumulatedText && !data) {
        console.log(`[API-LEGAL-TEST] 🔄 Attempting to parse accumulated text as JSON...`);
        try {
          data = JSON.parse(accumulatedText);
          console.log(`[API-LEGAL-TEST] ✅ Successfully parsed accumulated text`);
        } catch (err) {
          console.error(`[API-LEGAL-TEST] ❌ Failed to parse accumulated text: ${err.message}`);
        }
      }

      const result = data || { has_legal_test: false };
      console.log(`[API-LEGAL-TEST] 🎯 Returning:`, JSON.stringify(result).substring(0, 300));
      return result;
    } catch (err) {
      console.error(`[API-LEGAL-TEST] ❌ Error: ${err.message}`, err);
      return { has_legal_test: false };
    }
  },

  /**
   * DAYS 4-6 — LEGAL REASONING ENGINE
   * Get cached arguments (instant lookup)
   *
   * GET /api/cases/{case_id}/arguments
   *
   * Returns 404 if arguments not yet generated.
   * Frontend should try this first before calling generateArguments.
   *
   * Response (if cached):
   * {
   *   case_id: string,
   *   arguments: {
   *     petitioner_name: string,
   *     respondent_name: string,
   *     petitioner_arguments: [{point, detail, para_ref, strength}],
   *     respondent_arguments: [...],
   *     court_finding: string,
   *     winning_side: "petitioner|respondent|partial",
   *     key_legal_test: string,
   *     test_parts: [string]
   *   },
   *   generated_at: ISO timestamp,
   *   cached: true
   * }
   */
  async getArgumentsCached(caseId) {
    if (USE_MOCK) {
      await _delay(50);
      throw new Error('404: Arguments not yet generated');
    }

    try {
      const res = await fetch(`${BASE_URL}/api/cases/${caseId}/arguments`);
      if (!res.ok) {
        throw new Error('Arguments not cached');
      }
      return await res.json();
    } catch (err) {
      console.warn(`[API] Arguments not cached: ${err.message}`);
      return null;
    }
  },

  /**
   * DAYS 4-6 — LEGAL REASONING ENGINE
   * Generate arguments for a case (with caching)
   *
   * POST /api/cases/{case_id}/arguments?force_regenerate=false
   *
   * First call: ~60-90s (Ollama generates, then caches)
   * Subsequent calls: instant (served from cache)
   *
   * Optional query param: force_regenerate=true to refresh cache
   *
   * Response:
   * {
   *   arguments: {...same as getArgumentsCached...},
   *   cached: false,
   *   done: true
   * }
   */
  async generateArguments(caseId, forceRegenerate = false) {
    if (USE_MOCK) {
      await _delay(1500);
      return {
        arguments: {
          petitioner_name: 'Petitioner Name',
          respondent_name: 'Respondent Name',
          petitioner_arguments: [
            {
              point: 'Violation of fundamental rights',
              detail: 'The action violated Article 21 by denying due process...',
              para_ref: 12,
              strength: 'strong'
            }
          ],
          respondent_arguments: [
            {
              point: 'State necessity and emergency',
              detail: 'The circumstances warranted immediate action...',
              para_ref: 18,
              strength: 'moderate'
            }
          ],
          court_finding: 'The court held that the petitioner\'s right was violated...',
          winning_side: 'petitioner',
          key_legal_test: 'Proportionality test',
          test_parts: ['Legality', 'Necessity', 'Proportionality']
        },
        cached: false,
        done: true
      };
    }

    try {
      const url = `${BASE_URL}/api/cases/${caseId}/arguments${forceRegenerate ? '?force_regenerate=true' : ''}`;
      console.log('[API] Arguments: Fetching from', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Argument generation failed: ${res.status}`);
      }

      // Parse plain JSON response
      const data = await res.json();
      console.log('[API] Arguments: Response received', { hasArguments: !!data.arguments, cached: data.cached });

      return data || { arguments: {}, cached: false, done: true };
    } catch (err) {
      console.error(`[API] Argument generation error: ${err.message}`);
      return { arguments: {}, cached: false, done: false };
    }
  },

  /**
   * DAYS 4-6 — LEGAL REASONING ENGINE
   * Generate quick summary (one-liner + 30-second summary)
   *
   * POST /api/cases/{case_id}/quick-summary
   *
   * Smart fallback: Uses DB ratio/headnotes if available, LLM enhances async.
   *
   * Response:
   * {
   *   one_liner: "Held: [core holding in max 18 words]",
   *   summary_30s: "3 sentences: dispute, holding, principle",
   *   cached: false,
   *   done: true
   * }
   */
  async generateQuickSummary(caseId) {
    if (USE_MOCK) {
      await _delay(300);
      return {
        one_liner: 'Held: Right to privacy is a fundamental right under Article 21.',
        summary_30s: 'The petitioner challenged restrictions on privacy in personal affairs. The SC held that privacy is intrinsic to personal liberty under Article 21. This established privacy as a fundamental constitutional right.',
        cached: false,
        done: true
      };
    }

    try {
      const res = await fetch(`${BASE_URL}/api/cases/${caseId}/quick-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error('Quick summary generation failed');
      }

      // Stream response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let data = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const json = JSON.parse(line.replace('data: ', ''));
            data = json;
          }
        }
      }

      return data || { one_liner: '', summary_30s: '', cached: false, done: true };
    } catch (err) {
      console.error(`[API] Quick summary error: ${err.message}`);
      return { one_liner: '', summary_30s: '', cached: false, done: false };
    }
  },

  /**
   * DAYS 4-6 — LEGAL REASONING ENGINE
   * Issue spotter with DB-backed case search (upgraded from study version)
   *
   * POST /api/legal/issue-spot
   *
   * Input:
   * {
   *   facts: "Client facts...",
   *   context: "Optional context",
   *   max_issues: 5
   * }
   *
   * Output: Returns REAL case_ids from your DB (not LLM-invented names)
   *
   * Response:
   * {
   *   issues: {
   *     issues: [{
   *       issue: string,
   *       explanation: string,
   *       applicable_acts: [string],
   *       priority: "high|medium|low",
   *       relief_available: string,
   *       relevant_cases: [{case_id, case_name, citation, court, year, outcome}]
   *     }],
   *     immediate_reliefs: [string],
   *     limitation_concern: string|null,
   *     matter_type: "criminal|civil|..."
   *   },
   *   done: true
   * }
   */
  async spotIssuesDB(facts, context = '', maxIssues = 5) {
    if (USE_MOCK) {
      await _delay(1000);
      return {
        issues: {
          issues: [
            {
              issue: 'Wrongful termination without notice',
              explanation: 'Termination without proper notice may be unlawful.',
              applicable_acts: ['Industrial Disputes Act, 1947', 'Contract Act, 1872'],
              priority: 'high',
              relief_available: 'Restoration to service + back wages',
              relevant_cases: [
                {
                  case_id: 'case-uuid-1',
                  case_name: 'D.K. Basu v. State of West Bengal',
                  citation: 'AIR 1997 SC 610',
                  court: 'Supreme Court',
                  year: 1997,
                  outcome: 'Allowed'
                }
              ]
            }
          ],
          immediate_reliefs: ['File writ of mandamus', 'Apply for interim relief'],
          limitation_concern: null,
          matter_type: 'service'
        },
        done: true
      };
    }

    try {
      const res = await fetch(`${BASE_URL}/api/legal/issue-spot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facts,
          context,
          max_issues: maxIssues
        }),
      });

      if (!res.ok) {
        throw new Error('Issue spotting failed');
      }

      // Stream response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let data = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const json = JSON.parse(line.replace('data: ', ''));
            data = json;
          }
        }
      }

      return data || { issues: {}, done: true };
    } catch (err) {
      console.error(`[API] Issue spotting error: ${err.message}`);
      return { issues: {}, done: false };
    }
  },

  /**
   * DAYS 4-6 — LEGAL REASONING ENGINE
   * Multi-case structured brief
   *
   * POST /api/brief/multi
   *
   * Input:
   * {
   *   case_ids: ["id1", "id2", "id3"],
   *   topic: "Article 21 — right to privacy",
   *   mode: "brief|evolution|conflict"
   * }
   *
   * Modes:
   * - brief: Side-by-side structured comparison
   * - evolution: How the law changed chronologically
   * - conflict: Where cases agree and disagree
   *
   * Response varies by mode (brief/evolution/conflict structure)
   */
  async getMultiBrief(caseIds, topic, mode = 'brief') {
    if (USE_MOCK) {
      await _delay(1500);
      return {
        topic,
        mode,
        cases: [
          {
            case_name: 'Case 1',
            citation: 'AIR 2017 SC 123',
            year: 2017,
            court: 'Supreme Court',
            key_facts: 'Facts relevant to the topic.',
            holding_on_topic: 'The court held that...',
            ratio: 'Binding principle...',
            precedent_value: 'high'
          }
        ],
        synthesis: 'These cases together establish...',
        key_principle: 'Core principle extracted.',
        conflicts: null,
        cached: false,
        done: true
      };
    }

    try {
      const res = await fetch(`${BASE_URL}/api/brief/multi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_ids: caseIds,
          topic,
          mode
        }),
      });

      if (!res.ok) {
        throw new Error('Multi-brief generation failed');
      }

      // Stream response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let data = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const json = JSON.parse(line.replace('data: ', ''));
            data = json;
          }
        }
      }

      return data || { cases: [], synthesis: '', cached: false, done: true };
    } catch (err) {
      console.error(`[API] Multi-brief error: ${err.message}`);
      return { cases: [], synthesis: '', cached: false, done: false };
    }
  },

  /**
   * Get Reasoning Bundle (Days 1, 2, 4)
   * Call this on case page load to see what's cached.
   *
   * GET /api/cases/{case_id}/reasoning-full
   *
   * Response:
   *   {
   *     arguments: {...} | null,
   *     counter_arguments: {...} | null,
   *     strategy_pet: {...} | null,
   *     strategy_res: {...} | null,
   *     fact_law: {...} | null,
   *     quick_summary: {...} | null,
   *     pending: ["counter_arguments", "strategy_pet"],
   *     all_cached: boolean
   *   }
   */
  async reasoningFull(caseId) {
    if (USE_MOCK) {
      await _delay(300);
      return {
        arguments: null,
        counter_arguments: null,
        strategy_pet: null,
        strategy_res: null,
        fact_law: null,
        quick_summary: null,
        pending: ['counter_arguments', 'strategy_pet', 'fact_law'],
        all_cached: false
      };
    }

    try {
      const res = await fetch(`${BASE_URL}/api/cases/${caseId}/reasoning-full`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) throw new Error('Failed to fetch reasoning bundle');
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`[API] Reasoning bundle error: ${err.message}`);
      return { pending: [], all_cached: false };
    }
  },

  /**
   * Counter-Arguments Analysis (Days 1, 2, 4)
   * Identify weaknesses in each side's arguments.
   *
   * POST /api/cases/{case_id}/counter-arguments
   * Query: ?force_regenerate=true (optional)
   *
   * Response (streaming):
   *   {
   *     petitioner_weaknesses: [
   *       { argument, weakness, counter, severity: "fatal|serious|minor" }
   *     ],
   *     respondent_weaknesses: [...],
   *     overall_assessment: {
   *       stronger_side: "petitioner|respondent|balanced",
   *       decisive_issue: string,
   *       swing_factor: string
   *     },
   *     cached: boolean,
   *     done: boolean
   *   }
   */
  async counterArguments(caseId, forceRegenerate = false) {
    if (USE_MOCK) {
      await _delay(2000);
      return {
        petitioner_weaknesses: [
          {
            argument: 'Arrest was without valid warrant',
            weakness: 'DK Basu guidelines allow arrest without warrant for cognisable offences',
            counter: 'Respondent should cite Section 41(1)(ba) CrPC',
            severity: 'serious'
          }
        ],
        respondent_weaknesses: [
          {
            argument: 'Detention was within permissible limit',
            weakness: 'Detention exceeded 24 hours without magistrate production',
            counter: 'Article 22(2) is absolute — the constitutional mandate applies',
            severity: 'fatal'
          }
        ],
        overall_assessment: {
          stronger_side: 'petitioner',
          decisive_issue: 'Whether the 24-hour rule under Article 22(2) was breached',
          swing_factor: 'If the FIR shows a cognisable offence, respondent position strengthens'
        },
        cached: false,
        done: true
      };
    }

    try {
      const url = `${BASE_URL}/api/cases/${caseId}/counter-arguments${forceRegenerate ? '?force_regenerate=true' : ''}`;
      console.log('[API] Counter-arguments: Fetching from', url);
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });

      if (!res.ok) throw new Error(`Counter-arguments generation failed: ${res.status}`);

      // Parse plain JSON response
      const data = await res.json();
      console.log('[API] Counter-arguments: Response received', { hasWeaknesses: !!(data.petitioner_weaknesses || data.respondent_weaknesses), cached: data.cached });

      return data || { petitioner_weaknesses: [], respondent_weaknesses: [], cached: false, done: true };
    } catch (err) {
      console.error(`[API] Counter-arguments error: ${err.message}`);
      return { petitioner_weaknesses: [], respondent_weaknesses: [], cached: false, done: false };
    }
  },

  /**
   * Litigation Strategy (Days 1, 2, 4)
   * Generate strategy for petitioner or respondent.
   *
   * POST /api/cases/{case_id}/strategy
   * Body: { side: "petitioner" | "respondent" }
   * Query: ?force_regenerate=true (optional)
   *
   * Response (streaming):
   *   {
   *     side: "petitioner" | "respondent",
   *     win_probability: "high|medium|low",
   *     win_probability_reason: string,
   *     primary_strategy: string,
   *     strongest_arguments: [{ argument, why_strong, how_to_present, supporting_law }],
   *     arguments_to_avoid: [{ argument, reason }],
   *     how_to_counter_opposition: [{ their_point, your_response }],
   *     evidence_to_establish: [string],
   *     reliefs_to_claim: [string],
   *     risk_factors: [{ risk, mitigation }],
   *     alternative_routes: [string],
   *     cached: boolean,
   *     done: boolean
   *   }
   */
  async caseStrategy(caseId, side = 'petitioner', forceRegenerate = false) {
    if (USE_MOCK) {
      await _delay(2000);
      return {
        side,
        win_probability: 'medium',
        win_probability_reason: 'Strong constitutional violation but procedural gaps may hurt',
        primary_strategy: 'Lead with Article 22(2) violation. Frame as non-derogable fundamental right.',
        strongest_arguments: [
          {
            argument: 'Article 22(2) violation — absolute right, no derogation',
            why_strong: 'Court in DK Basu held this is non-negotiable',
            how_to_present: 'Open with constitutional text, then cite DK Basu para 34',
            supporting_law: 'Article 22(2) Constitution + DK Basu v. State of WB (1997)'
          }
        ],
        arguments_to_avoid: [
          { argument: 'Malicious prosecution claim', reason: 'No evidence — weakens credibility' }
        ],
        how_to_counter_opposition: [
          {
            their_point: 'Arrest was for cognisable offence under Section 41 CrPC',
            your_response: 'Section 41 permits arrest but does not suspend Article 22(2)'
          }
        ],
        evidence_to_establish: ['Timestamp of arrest from FIR', 'Timestamp of magistrate production'],
        reliefs_to_claim: ['Declaration of constitutional violation', 'Compensation under Nilabati Behera'],
        risk_factors: [
          {
            risk: 'Court may treat as infructuous if petitioner already released',
            mitigation: 'Press for compensation remedy — mootness does not extinguish tort claim'
          }
        ],
        alternative_routes: [
          'If habeas corpus fails — file Section 482 CrPC application',
          'File complaint before NHRC under Protection of Human Rights Act'
        ],
        cached: false,
        done: true
      };
    }

    try {
      const url = `${BASE_URL}/api/cases/${caseId}/strategy${forceRegenerate ? '?force_regenerate=true' : ''}`;
      console.log('[API] Strategy: Fetching from', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side }),
      });

      if (!res.ok) throw new Error(`Strategy generation failed: ${res.status}`);

      // Parse plain JSON response
      const data = await res.json();
      console.log('[API] Strategy: Response received', { side: data.side, cached: data.cached });

      return data || { side, win_probability: 'medium', cached: false, done: true };
    } catch (err) {
      console.error(`[API] Strategy error: ${err.message}`);
      return { side, win_probability: 'medium', cached: false, done: false };
    }
  },

  /**
   * Fact vs Law Separation (Days 1, 2, 4)
   * Tag each paragraph as fact, law, mixed, ratio, procedural, or order.
   *
   * POST /api/cases/{case_id}/fact-law-separation
   * Query: ?force_regenerate=true (optional)
   *
   * Response (streaming):
   *   {
   *     classifications: [
   *       {
   *         para_number: 1,
   *         type: "fact|law|mixed|procedural|ratio|order",
   *         sub_type: "finding_of_fact|question_of_law|ratio_decidendi|...",
   *         summary: string,
   *         burden_of_proof: { present: bool, party: string, on_issue: string }
   *       }
   *     ],
   *     fact_law_summary: {
   *       key_facts_established: [string],
   *       key_legal_questions: [string],
   *       burden_summary: string,
   *       contested_facts: [string]
   *     },
   *     cached: boolean,
   *     done: boolean
   *   }
   */
  async factLawSeparation(caseId, forceRegenerate = false) {
    if (USE_MOCK) {
      await _delay(2000);
      return {
        classifications: [
          {
            para_number: 3,
            type: 'fact',
            sub_type: 'finding_of_fact',
            summary: 'Petitioner arrested on 14 March without warrant',
            burden_of_proof: { present: false, party: null, on_issue: null }
          },
          {
            para_number: 12,
            type: 'law',
            sub_type: 'question_of_law',
            summary: 'Whether Article 22(2) admits any exception',
            burden_of_proof: {
              present: true,
              party: 'respondent',
              on_issue: 'Respondent must justify deviation from 24-hour rule'
            }
          }
        ],
        fact_law_summary: {
          key_facts_established: [
            'Arrest on 14 March without warrant — Para 3',
            'Detention for 38 hours without magistrate production — Para 7'
          ],
          key_legal_questions: [
            'Whether Article 22(2) admits exception for cognisable offences — Para 12'
          ],
          burden_summary: 'Respondent bears burden to justify detention',
          contested_facts: ['Whether the FIR was registered before or after arrest']
        },
        cached: false,
        done: true
      };
    }

    try {
      const url = `${BASE_URL}/api/cases/${caseId}/fact-law-separation${forceRegenerate ? '?force_regenerate=true' : ''}`;
      console.log('[API] Fact-law: Fetching from', url);
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });

      if (!res.ok) throw new Error(`Fact-law separation failed: ${res.status}`);

      // Parse plain JSON response
      const data = await res.json();
      console.log('[API] Fact-law: Response received', { classifications: data.classifications?.length || 0, cached: data.cached });

      return data || { classifications: [], fact_law_summary: {}, cached: false, done: true };
    } catch (err) {
      console.error(`[API] Fact-law separation error: ${err.message}`);
      return { classifications: [], fact_law_summary: {}, cached: false, done: false };
    }
  },

};


/**
 * STUDY MODE — SMART SEARCH
 * Natural language query → Multi-tab study output
 *
 * POST /api/study/search
 * Body: { query: string, case_context?: string }
 *
 * Response:
 *   {
 *     query: string,
 *     category: string,
 *     study_output_type: string,
 *     available_tabs: string[],
 *     tab_order: string[],
 *     outputs: { [tab: string]: object },
 *     case_id?: string,
 *     case_name?: string
 *   }
 */
async function studySearch(query, caseContext = null) {
  if (USE_MOCK) {
    console.log('[API-STUDY] 🔄 Using MOCK data (USE_MOCK=true)');
    await _delay(1000);
    const mockData = {
      query: query,
      category: '1.1_case_simple',
      study_output_type: 'case_explanation',
      available_tabs: ['case_explanation', 'case_brief', 'arguments', 'flashcards', 'ratio_obiter'],
      tab_order: ['case_explanation', 'case_brief', 'arguments', 'flashcards', 'ratio_obiter'],
      outputs: {
        case_explanation: {
          case_name: 'Sample Case',
          facts: 'Sample facts about the case...',
          issues: 'The main legal issue...',
          judgment: 'The court\'s decision...',
          significance: 'This case is important because...'
        },
        case_brief: {
          case_name: 'Sample Case',
          citation: 'Sample Citation',
          facts: 'Sample facts...',
          held: 'The court held...',
          ratio: 'The binding principle...'
        }
      },
      case_id: 'SC_2022_xxxxx',
      case_name: 'Sample Case'
    };
    console.log('[API-STUDY] Returning MOCK response:', mockData);
    return mockData;
  }

  try {
    const url = `${BASE_URL}/api/study/search`;
    console.log('[API-STUDY] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[API-STUDY] 🔍 STUDY SEARCH REQUEST');
    console.log('[API-STUDY] URL:', url);
    console.log('[API-STUDY] Query:', query);
    console.log('[API-STUDY] Case Context:', caseContext || 'NONE');
    console.log('[API-STUDY] Sending fetch...');
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, case_context: caseContext }),
    });

    console.log('[API-STUDY] Response status:', res.status, res.statusText);
    
    if (!res.ok) {
      console.error('[API-STUDY] ❌ HTTP Error:', res.status, res.statusText);
      throw new Error(`Study search failed: ${res.status}`);
    }

    const data = await res.json();
    
    console.log('[API-STUDY] ✅ Response JSON received:', {
      hasData: !!data,
      query: data?.query,
      category: data?.category,
      study_output_type: data?.study_output_type, 
      available_tabs: data?.available_tabs,
      tab_order: data?.tab_order,
      outputs_keys: data?.outputs ? Object.keys(data.outputs) : [],
      case_id: data?.case_id,
      case_name: data?.case_name,
    });
    
    // Detailed tab info
    if (data?.available_tabs && Array.isArray(data.available_tabs)) {
      console.log('[API-STUDY] Tabs found:', data.available_tabs.length);
      data.available_tabs.forEach((tab, idx) => {
        const content = data.outputs?.[tab];
        console.log(`[API-STUDY]   Tab[${idx}]: "${tab}"`, {
          hasOutput: !!content,
          outputType: typeof content,
          outputLength: content?.length || 0,
        });
      });
    }

    console.log('[API-STUDY] Returning data object');
    return data;
  } catch (err) {
    console.error(`[API-STUDY] ❌ STUDY SEARCH ERROR:`, err.message);
    console.error('[API-STUDY] Stack:', err.stack);
    return {
      query: query,
      available_tabs: [],
      outputs: {},
      error: err.message
    };
  }
}

// Add to API object
API.studySearch = studySearch;


// ============================================================
// MOCK DATA
// Mirrors what your real backend will return.
// These shapes ARE the contract between frontend and backend.
// ============================================================

/**
 * Case shape syntax(backend must return this structure):
 *
 * {
 *   id:              string,
 *   name:            string,
 *   court:           string,
 *   year:            number,
 *   citation:        string,
 *   bench:           string,    // e.g. "3 Judges"
 *   authority_score: number,    // 0–100, based on citation frequency + bench size
 *   tags:            string[],
 *   summary:         string,
 *   facts:           string[],
 *   judgement:       string,
 *   paragraphs:      { id: string, text: string }[],
 *   cited_in:        { name, court, year, citation, context }[],
 * }
 */
const MOCK_CASES = [
  {
    id: 'case_001',
    name: 'Samatha v. State of Andhra Pradesh',
    court: 'Supreme Court of India',
    year: 1997,
    citation: 'AIR 1997 SC 3297',
    bench: '3 Judges',
    authority_score: 92,
    tags: ['tribal land', 'fifth schedule', 'mining leases', 'constitutional law'],
    summary: 'A landmark constitutional judgment delivered by a three-judge bench of the Supreme Court. The Court held that the State cannot grant mining leases in Scheduled Areas to non-tribal entities — including government companies — as this violates the Fifth Schedule of the Constitution. It directed that 20% of net profits from ongoing mining operations must be placed in a permanent fund for tribal development.',
    facts: [
      'Samatha, an NGO, challenged mining leases granted to non-tribal companies in tribal areas of Andhra Pradesh.',
      'The leases were granted under the Mines and Minerals (Regulation and Development) Act, 1957.',
      'The affected areas were Scheduled Areas under the Fifth Schedule of the Constitution.',
      'The State Government argued it had statutory power to grant such leases regardless of tribal protections.',
      'A key question was whether government corporations qualified as "non-tribals" under Fifth Schedule restrictions.',
    ],
    judgement: 'The Supreme Court held that the State cannot transfer tribal land in Scheduled Areas to non-tribals — including government companies — by way of mining leases. The Fifth Schedule imposes an absolute prohibition. The Court directed that 20% of net profits from ongoing mining operations be placed in a permanent fund for tribal welfare and ecological restoration.',
    paragraphs: [
      { id: 'p1', text: 'The Fifth Schedule of the Constitution was designed to protect the tribal communities in their lands, culture and autonomy from exploitation by outsiders.' },
      { id: 'p2', text: 'The Governor of a State with Scheduled Areas has special responsibilities under the Constitution for the welfare and protection of tribal communities residing there.' },
      { id: 'p3', text: 'Leases of tribal land to non-tribals, including by the Government or its corporations, are constitutionally impermissible in Scheduled Areas under the Fifth Schedule.' },
      { id: 'p4', text: 'Land is the most important natural resource of the tribal communities. It is the source of their livelihood and the foundation of their culture and social organisation.' },
      { id: 'p5', text: 'Twenty per cent of net profits from any ongoing mining operations in Scheduled Areas shall be set aside in a permanent fund for tribal welfare and ecological restoration.' },
    ],
    cited_in: [
      { name: 'Orissa Mining Corporation v. Ministry of Environment & Forests', court: 'Supreme Court of India', year: 2013, citation: '(2013) 6 SCC 476', context: 'Court applied <em>Samatha</em> to hold that gram sabha consent is mandatory before mining in Scheduled Areas under the Forest Rights Act.' },
      { name: 'Nandini Sundar v. State of Chhattisgarh', court: 'Supreme Court of India', year: 2011, citation: '(2011) 7 SCC 547', context: 'The Samatha principles on tribal autonomy and Fifth Schedule protections were extensively cited in the context of the Salwa Judum operations.' },
      { name: 'Kailas v. State of Maharashtra', court: 'Bombay High Court', year: 2011, citation: 'AIR 2011 Bom 182', context: 'The court relied on Samatha to affirm the prohibition on transfer of tribal land to non-tribal entities through government intermediaries.' },
      { name: 'Vedanta Resources v. Union of India', court: 'Supreme Court of India', year: 2014, citation: 'WP(C) 180/2011', context: "Samatha's welfare fund directive (20% net profits) was referenced as precedent for environmental and tribal compensation requirements." },
    ],
  },
  {
    id: 'case_002',
    name: 'Paschim Banga Khet Mazdoor Samity v. State of West Bengal',
    court: 'Supreme Court of India',
    year: 1996,
    citation: '(1996) 4 SCC 37',
    bench: '2 Judges',
    authority_score: 76,
    tags: ['right to health', 'article 21', 'emergency medical care', 'state obligation'],
    summary: 'A significant Supreme Court judgment expanding the right to life under Article 21 to include the right to emergency medical care. The case arose after a labourer was denied treatment at multiple government hospitals due to lack of facilities.',
    facts: [
      'Hakim Seikh, a farm labourer, suffered severe head injuries after falling from a train.',
      'He was turned away from several government hospitals citing lack of beds and facilities.',
      'He was eventually treated at a private hospital at enormous personal cost.',
      'The petitioner argued that denial of emergency medical care violated Article 21.',
      'The State argued that limited resources justified the inability to provide immediate care.',
    ],
    judgement: 'The Supreme Court held that the right to life under Article 21 includes the right to emergency medical care. The State has a constitutional obligation to provide healthcare. The Court directed the State to pay compensation and to establish a proper scheme for emergency treatment across government hospitals.',
    paragraphs: [
      { id: 'p1', text: 'The right to life enshrined in Article 21 imposes an obligation on the State to safeguard the life of every person within its territory.' },
      { id: 'p2', text: 'Failure to provide timely medical treatment to a person in need of emergency care is a violation of the fundamental right to life under Article 21.' },
      { id: 'p3', text: 'The State cannot avoid its constitutional obligation to provide emergency medical care by pleading financial constraints or inadequacy of resources.' },
    ],
    cited_in: [
      { name: 'State of Punjab v. Mohinder Singh Chawla', court: 'Supreme Court of India', year: 1997, citation: 'AIR 1997 SC 1225', context: 'The court affirmed the right to medical treatment as a fundamental right, citing Paschim Banga as primary precedent.' },
      { name: 'Consumer Education & Research Centre v. Union of India', court: 'Supreme Court of India', year: 1995, citation: '(1995) 3 SCC 42', context: 'Referenced for the expanded interpretation of the right to life including health and medical care as part of Article 21.' },
      { name: 'Laxmi Kant Pandey v. Union of India', court: 'Supreme Court of India', year: 2002, citation: 'AIR 2002 SC 1509', context: 'Financial constraints cannot excuse denial of emergency medical care — applied in the context of government hospital facilities.' },
    ],
  },
  {
    id: 'case_003',
    name: 'Om Kumar v. Union of India',
    court: 'Supreme Court of India',
    year: 2001,
    citation: '(2001) 2 SCC 386',
    bench: '3 Judges',
    authority_score: 71,
    tags: ['doctrine of proportionality', 'administrative law', 'judicial review', 'article 14'],
    summary: 'The Supreme Court applied the doctrine of proportionality in Indian administrative law, holding that courts can examine whether administrative actions are proportionate to the objective sought.',
    facts: [
      'The case involved a civil servant who challenged a punishment order in departmental proceedings.',
      'The appellant argued the penalty imposed was disproportionate to the misconduct found.',
      'The central question was the scope of judicial review of administrative punishments.',
      'The Court examined proportionality as developed in European human rights jurisprudence.',
      'The respondent argued courts should not interfere with disciplinary authority decisions.',
    ],
    judgement: 'The Supreme Court held that the doctrine of proportionality is part of Indian constitutional law. Courts can examine whether the penalty imposed is proportionate to the gravity of misconduct. Where fundamental rights are at stake, stricter proportionality review applies.',
    paragraphs: [
      { id: 'p1', text: 'The doctrine of proportionality ensures that measures taken by administrative authorities are not excessive in relation to the legitimate aim pursued.' },
      { id: 'p2', text: 'Where an administrative action impacts fundamental rights, a stricter standard of proportionality review applies and the courts examine it more rigorously.' },
      { id: 'p3', text: 'Courts are not required to substitute their own view but must examine whether the decision falls within a reasonable range of responses.' },
    ],
    cited_in: [
      { name: 'Union of India v. G. Ganayutham', court: 'Supreme Court of India', year: 1997, citation: '(1997) 7 SCC 463', context: 'The proportionality standard was applied to review the severity of punishment in disciplinary proceedings.' },
      { name: 'Coimbatore District Central Cooperative Bank v. Employees Association', court: 'Supreme Court of India', year: 2007, citation: '(2007) 4 SCC 669', context: "Om Kumar's proportionality doctrine was extended to industrial disputes and collective bargaining." },
    ],
  },
  {
    id: 'case_004',
    name: 'Kesavananda Bharati v. State of Kerala',
    court: 'Supreme Court of India',
    year: 1973,
    citation: 'AIR 1973 SC 1461',
    bench: '13 Judges',
    authority_score: 98,
    tags: ['basic structure doctrine', 'constitutional amendment', 'parliament powers', 'fundamental rights'],
    summary: 'The most significant constitutional judgment in Indian legal history. A 13-judge bench evolved the "basic structure doctrine", holding that while Parliament has wide powers to amend the Constitution, it cannot alter its essential basic structure.',
    facts: [
      'Kesavananda Bharati challenged Kerala land reform laws that restricted his religious institution\'s property.',
      'The case raised the fundamental question of Parliament\'s power to amend the Constitution.',
      'The previous Golaknath judgment held Parliament could not amend fundamental rights at all.',
      'The 24th Constitutional Amendment was enacted specifically to override Golaknath.',
      'A 13-judge bench was constituted to definitively determine the ambit of Parliament\'s amending power.',
    ],
    judgement: 'By a 7:6 majority, the Court held Parliament has wide power to amend the Constitution including fundamental rights, but cannot destroy its "basic structure". Basic structure includes: supremacy of the Constitution, republican and democratic government, secular character, separation of powers, federal character, and the rule of law.',
    paragraphs: [
      { id: 'p1', text: 'The Constitution is not a document for fastening its provisions for all time, but is an organism capable of growth and development through interpretation.' },
      { id: 'p2', text: 'Parliament has wide powers of amendment under Article 368 but cannot use them to destroy or abrogate the basic structure of the Constitution.' },
      { id: 'p3', text: 'The basic features of the Constitution include the supremacy of the Constitution, republican democratic government, secular character of the State, separation of powers, and federal character.' },
    ],
    cited_in: [
      { name: 'Indira Nehru Gandhi v. Raj Narain', court: 'Supreme Court of India', year: 1975, citation: 'AIR 1975 SC 2299', context: 'The basic structure doctrine was invoked to strike down the 39th Constitutional Amendment.' },
      { name: 'Minerva Mills Ltd. v. Union of India', court: 'Supreme Court of India', year: 1980, citation: 'AIR 1980 SC 1789', context: 'Kesavananda was affirmed — judicial review and harmony between Part III and Part IV were declared basic structure features.' },
      { name: 'S.R. Bommai v. Union of India', court: 'Supreme Court of India', year: 1994, citation: 'AIR 1994 SC 1918', context: 'Federalism, democracy, and secularism held to be part of the inviolable basic structure.' },
      { name: 'I.R. Coelho v. State of Tamil Nadu', court: 'Supreme Court of India', year: 2007, citation: '(2007) 2 SCC 1', context: 'Nine-judge bench reaffirmed Kesavananda — Ninth Schedule laws can be challenged if they violate basic structure.' },
    ],
  },
  {
    id: 'case_005',
    name: 'Vishaka v. State of Rajasthan',
    court: 'Supreme Court of India',
    year: 1997,
    citation: 'AIR 1997 SC 3011',
    bench: '3 Judges',
    authority_score: 88,
    tags: ['sexual harassment', 'workplace rights', 'gender equality', 'article 14', 'article 21'],
    summary: 'The Supreme Court laid down the Vishaka Guidelines for prevention of sexual harassment at the workplace in the absence of specific legislation, recognising it as a violation of fundamental rights.',
    facts: [
      'A social worker was gang-raped while performing government duties in Rajasthan.',
      'No specific domestic law existed to address sexual harassment at the workplace.',
      'NGOs filed a PIL seeking judicial intervention and enforceable guidelines.',
      'The Court had to formulate binding guidelines in the complete absence of legislation.',
      "India's obligations under CEDAW formed part of the Court's reasoning.",
    ],
    judgement: 'The Supreme Court laid down the Vishaka Guidelines making it mandatory for employers to prevent and address workplace sexual harassment. These guidelines had the force of law until the Sexual Harassment of Women at Workplace Act, 2013 was enacted.',
    paragraphs: [
      { id: 'p1', text: 'Sexual harassment at the workplace constitutes a violation of fundamental rights of gender equality and the right to life and liberty under Articles 14 and 21.' },
      { id: 'p2', text: 'Every employer must prevent sexual harassment and provide procedures for resolution of complaints.' },
      { id: 'p3', text: 'Each complaint shall be addressed by a Complaints Committee at the employer\'s level, with a woman in the majority.' },
    ],
    cited_in: [
      { name: 'Apparel Export Promotion Council v. A.K. Chopra', court: 'Supreme Court of India', year: 1999, citation: '(1999) 1 SCC 759', context: 'Vishaka guidelines applied — sexual harassment need not involve physical contact to attract liability.' },
      { name: 'Medha Kotwal Lele v. Union of India', court: 'Supreme Court of India', year: 2013, citation: '(2013) 1 SCC 297', context: 'Court monitored compliance with Vishaka and directed comprehensive state-level implementation.' },
    ],
  },
];


/**
 * Suggestion shape (for token search dropdown):
 * { label: string, type: 'court'|'keyword'|'year'|'judge'|'exclude', value: string, keywords: string[] }
 */
const SUGGESTIONS = [
  // Courts
  { label: 'Supreme Court of India', type: 'court',   value: 'supreme',   keywords: ['sc', 'supreme', 'apex'] },
  { label: 'Delhi High Court',       type: 'court',   value: 'delhi',     keywords: ['delhi', 'dhc'] },
  { label: 'Bombay High Court',      type: 'court',   value: 'bombay',    keywords: ['bombay', 'bom', 'mumbai'] },
  { label: 'Madras High Court',      type: 'court',   value: 'madras',    keywords: ['madras', 'mad', 'chennai'] },
  { label: 'Calcutta High Court',    type: 'court',   value: 'calcutta',  keywords: ['calcutta', 'cal'] },
  { label: 'Allahabad High Court',   type: 'court',   value: 'allahabad', keywords: ['allahabad', 'alh'] },

  // Keywords
  { label: 'Tribal Land',            type: 'keyword', value: 'tribal land',       keywords: ['tribal', 'schedule', 'fifth'] },
  { label: 'Article 21',             type: 'keyword', value: 'article 21',        keywords: ['art21', 'article21', '21'] },
  { label: 'Proportionality',        type: 'keyword', value: 'proportionality',   keywords: ['prop', 'proportional'] },
  { label: 'Basic Structure',        type: 'keyword', value: 'basic structure',   keywords: ['basic', 'struct', 'kesavananda'] },
  { label: 'Sexual Harassment',      type: 'keyword', value: 'sexual harassment', keywords: ['vishaka', 'harassment', 'posh'] },
  { label: 'Mining Leases',          type: 'keyword', value: 'mining leases',     keywords: ['mining', 'lease', 'mineral'] },
  { label: 'Fundamental Rights',     type: 'keyword', value: 'fundamental rights',keywords: ['fundamental', 'rights', 'fr'] },
  { label: 'Administrative Law',     type: 'keyword', value: 'administrative law',keywords: ['admin', 'admn'] },
  { label: 'Gender Equality',        type: 'keyword', value: 'gender equality',   keywords: ['gender', 'equality', 'women'] },

  // Years
  { label: 'After 2000',  type: 'year', value: 'after_2000',  keywords: ['2000', 'after'] },
  { label: 'After 2010',  type: 'year', value: 'after_2010',  keywords: ['2010'] },
  { label: 'Before 2000', type: 'year', value: 'before_2000', keywords: ['before'] },
  { label: '1990s',       type: 'year', value: '1990s',        keywords: ['90s', '1990'] },
  { label: '1970s',       type: 'year', value: '1970s',        keywords: ['70s', '1970'] },

  // Judges
  { label: 'Justice P.B. Sawant',    type: 'judge', value: 'sawant',    keywords: ['sawant'] },
  { label: 'Justice Y.K. Sabharwal', type: 'judge', value: 'sabharwal', keywords: ['sabharwal'] },
  { label: 'Chief Justice Khanna',   type: 'judge', value: 'khanna',    keywords: ['khanna'] },
];

// Token display helpers (used by app.js — do not remove)
const TOKEN_ICON  = { court: 'CT', keyword: 'KW', exclude: 'NO', year: 'YR', judge: 'JG' };
const TOKEN_LABEL = { court: 'Court', keyword: 'Keyword', exclude: 'Exclude', year: 'Year', judge: 'Judge' };


// ============================================================
// MOCK IMPLEMENTATIONS
// These replicate what the real backend returns.
// Keep the response shapes identical when building the backend.
// ============================================================

async function _mockChat(query, mode) {
  const delay = mode === 'research' ? 2200 : 1200;
  await _delay(delay);

  const q = query.toLowerCase();

  if (mode === 'study') {
    return _mockStudy(q);
  }

  // Normal + Research: return { text, cases }
  let text = '', cases = [];

  if (q.includes('samatha') || q.includes('tribal') || q.includes('scheduled area')) {
    text = mode === 'research'
      ? `<strong>Deep Research — Tribal Land Rights & Fifth Schedule</strong><br><br>The Fifth Schedule creates a constitutional framework for tribal area administration. Key findings:<br><br><strong>1. Absolute Prohibition:</strong> Transfer of tribal land to non-tribals — private or government — is constitutionally prohibited.<br><strong>2. 20% Welfare Fund:</strong> Net profits from mining must flow into a permanent tribal welfare fund.<br><strong>3. Governor's Special Duty:</strong> The Fifth Schedule vests special administrative responsibility in the Governor for Scheduled Areas.`
      : 'The <strong>Samatha judgment (1997)</strong> is a landmark decision protecting tribal land rights. The Supreme Court held that mining leases in Scheduled Areas cannot be granted to non-tribal entities — including government companies — as this violates the Fifth Schedule of the Constitution.';
    cases = [MOCK_CASES[0]];

  } else if (q.includes('health') || q.includes('article 21') || q.includes('medical')) {
    text = mode === 'research'
      ? `<strong>Deep Research — Right to Health under Article 21</strong><br><br>Key milestones:<br><strong>1. Vincent Panikurlangara (1987):</strong> Health maintenance is part of Article 21.<br><strong>2. Paschim Banga (1996):</strong> Emergency care is a fundamental right; financial constraints are no defence.<br><strong>3. State of Punjab v. Mohinder Singh Chawla (1997):</strong> State must provide treatment at government expense.`
      : 'The right to health flows from <strong>Article 21 (Right to Life)</strong>. In <em>Paschim Banga (1996)</em>, the Supreme Court held that denial of emergency medical care violates Article 21. The State cannot plead financial constraints.';
    cases = [MOCK_CASES[1]];

  } else if (q.includes('proportional') || q.includes('administrative')) {
    text = 'The <strong>Doctrine of Proportionality</strong> — recognised in <em>Om Kumar v. Union of India (2001)</em> — requires that administrative actions be proportionate to the objective sought. A stricter standard applies when fundamental rights are affected.';
    cases = [MOCK_CASES[2]];

  } else if (q.includes('basic structure') || q.includes('kesavananda')) {
    text = 'The <strong>Basic Structure Doctrine</strong> emerged from <em>Kesavananda Bharati (1973)</em> decided by a 13-judge bench. Parliament cannot amend the Constitution in a way that destroys its basic structure — which includes democracy, secularism, separation of powers, and judicial review.';
    cases = [MOCK_CASES[3]];

  } else if (q.includes('vishaka') || q.includes('harassment') || q.includes('workplace')) {
    text = 'The <strong>Vishaka Guidelines (1997)</strong> were laid down by the Supreme Court in the absence of legislation on workplace sexual harassment, recognising it as a violation of Articles 14, 15, 19 and 21.';
    cases = [MOCK_CASES[4]];

  } else {
    text = 'I found cases relevant to your query. Click <strong>Open Case ↓</strong> to read the full judgment, summary, citations, and PDF.';
    cases = MOCK_CASES.slice(0, 3);
  }

  return { text, cases };
}

function _mockStudy(q) {
  if (q.includes('proportional')) {
    return { sections: [
      { label: 'Topic Summary',   body: 'The Doctrine of Proportionality requires that government measures be proportionate to the objective pursued. It is a cornerstone of judicial review in Indian administrative law.' },
      { label: 'Legal Principle', body: 'Administrative actions must not be excessive or arbitrary. Courts examine: (1) Is the measure suitable? (2) Is it the least restrictive? (3) Does it strike a fair balance between individual rights and public interest?' },
      { label: 'Key Cases',       body: '<ul><li><strong>Om Kumar v. Union of India (2001)</strong> — Primary Indian authority on proportionality review.</li><li><strong>State of MP v. Baldeo Prasad (1960)</strong> — Early recognition of disproportionate administrative action as invalid.</li></ul>' },
      { label: 'Important Points',body: '<ul><li>Stricter standard than Wednesbury unreasonableness.</li><li>Fundamental rights cases attract closer scrutiny.</li><li>Courts check if the decision is within a reasonable range — they do not substitute their own view.</li></ul>' },
      { label: 'Exam Notes',      body: 'Proportionality = was the measure too severe? Cite <em>Om Kumar (2001)</em> as primary authority. Distinguish primary review (courts) vs secondary review (appellate bodies).' },
    ]};
  }
  if (q.includes('basic structure') || q.includes('constitutional')) {
    return { sections: [
      { label: 'Topic Summary',   body: "The Basic Structure Doctrine limits Parliament's power to amend the Constitution under Article 368. Emerged from Kesavananda Bharati (1973)." },
      { label: 'Legal Principle', body: 'Parliament cannot use its amending power to destroy the essential features that form the basic structure of the Constitution.' },
      { label: 'Key Cases',       body: '<ul><li><strong>Kesavananda Bharati (1973)</strong> — 13-judge bench, 7:6 majority — origin of the doctrine.</li><li><strong>Indira Gandhi v. Raj Narain (1975)</strong> — Free and fair elections = basic structure.</li><li><strong>Minerva Mills (1980)</strong> — Judicial review = basic structure.</li></ul>' },
      { label: 'Important Points',body: '<ul><li>No exhaustive list — an evolving, judge-made concept.</li><li>Includes: supremacy of Constitution, democracy, secularism, separation of powers, federalism, judicial review, free elections.</li><li>Test: Does the amendment damage or destroy the constitutional identity?</li></ul>' },
      { label: 'Exam Notes',      body: 'Timeline to know: Golaknath (1967) → 24th Amendment → Kesavananda middle path. Always mention the 7:6 majority. Apply the "identity test" in answers.' },
    ]};
  }
  // Default
  return { sections: [
    { label: 'Topic Summary',   body: 'This topic covers foundational principles of Indian constitutional law, especially the expansive interpretation of Articles 14, 19 and 21.' },
    { label: 'Legal Principle', body: 'The Indian Constitution is a living document. Fundamental rights are not isolated — they are read harmoniously with Directive Principles of State Policy.' },
    { label: 'Key Cases',       body: '<ul><li><strong>Maneka Gandhi v. Union of India (1978)</strong> — Procedure must be just, fair, and reasonable.</li><li><strong>Olga Tellis v. BMCM (1985)</strong> — Right to livelihood under Article 21.</li></ul>' },
    { label: 'Important Points',body: '<ul><li>Article 21 is the most expansively interpreted fundamental right in India.</li><li>Fundamental rights are justiciable; DPSPs are not, but they guide interpretation.</li></ul>' },
    { label: 'Exam Notes',      body: 'Standard Article 21 answer: (1) Identify the right claimed. (2) Is there a State action? (3) Is it protected by Art 21? (4) Is the restriction permissible? Apply the Maneka Gandhi test.' },
  ]};
}

async function _mockSearch(params = {}) {
  await _delay(800);

  const { q = '', court = '', year_from = 0, year_to = 9999, act = '', exclude = '' } = params;
  const qLow     = q.toLowerCase();
  const excludeTerms = exclude ? exclude.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
  const courtMap = { supreme: 'supreme court', delhi: 'delhi', bombay: 'bombay', madras: 'madras', calcutta: 'calcutta', allahabad: 'allahabad' };

  const cases = MOCK_CASES.filter(c => {
    // Text match
    if (qLow && !(c.name.toLowerCase().includes(qLow) || c.citation.toLowerCase().includes(qLow) || c.tags.some(t => t.includes(qLow)) || c.summary.toLowerCase().includes(qLow))) return false;
    // Court
    if (court && !c.court.toLowerCase().includes(courtMap[court] || court)) return false;
    // Year
    if (year_from && c.year < Number(year_from)) return false;
    if (year_to < 9999 && c.year > Number(year_to)) return false;
    // Act/statute keyword
    if (act && !c.tags.some(t => t.includes(act.toLowerCase()))) return false;
    // Exclude terms
    if (excludeTerms.some(ex => c.name.toLowerCase().includes(ex) || c.tags.some(t => t.includes(ex)))) return false;
    return true;
  });

  return { cases, total: cases.length };
}

// Tiny promise-based delay helper
function _delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
