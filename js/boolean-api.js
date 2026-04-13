/**
 * Boolean Search API Module
 * Separate from main api.js to avoid conflicts
 * Handles all boolean search endpoint calls
 */

const BooleanSearchAPI = (() => {
  const BASE_URL = 'http://localhost:8000/boolean';

  // ─────────────────────────────────────────────────────────────────────────
  // Main Search Endpoint
  // ─────────────────────────────────────────────────────────────────────────

  const search = async (query, filters = {}, sortBy = 'relevance', page = 1, pageSize = 25) => {
    try {
      const payload = {
        query,
        filters,
        sort_by: sortBy,
        page,
        page_size: pageSize,
        include_snippets: true
      };

      const response = await fetch(`${BASE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail?.message || `Search failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Boolean search API error:', error);
      throw error;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Validation Endpoint
  // ─────────────────────────────────────────────────────────────────────────

  const validate = async (query) => {
    try {
      const response = await fetch(`${BASE_URL}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Validation API error:', error);
      return { valid: false, error: error.message };
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Parse Endpoint (AST Debug)
  // ─────────────────────────────────────────────────────────────────────────

  const parse = async (query) => {
    try {
      const response = await fetch(`${BASE_URL}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`Parse failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Parse API error:', error);
      throw error;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Get Single Case
  // ─────────────────────────────────────────────────────────────────────────

  const getCase = async (caseId) => {
    try {
      const response = await fetch(`${BASE_URL}/case/${caseId}`);

      if (!response.ok) {
        throw new Error(`Case not found: ${caseId}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get case API error:', error);
      throw error;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Health Check
  // ─────────────────────────────────────────────────────────────────────────

  const health = async () => {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (!response.ok) throw new Error('Health check failed');
      return await response.json();
    } catch (error) {
      console.error('Health check error:', error);
      return { status: 'error', message: error.message };
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Build filter object from UI
  // ─────────────────────────────────────────────────────────────────────────

  const buildFilters = (filterObj) => {
    const filters = {};
    
    if (filterObj.court) filters.court = filterObj.court;
    if (filterObj.yearFrom) filters.year_from = parseInt(filterObj.yearFrom);
    if (filterObj.yearTo) filters.year_to = parseInt(filterObj.yearTo);
    if (filterObj.act) filters.act = filterObj.act;
    if (filterObj.section) filters.section = filterObj.section;
    if (filterObj.judge) filters.judge = filterObj.judge;
    if (filterObj.docType) filters.doc_type = filterObj.docType;

    return filters;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  return {
    search,
    validate,
    parse,
    getCase,
    health,
    buildFilters,
    BASE_URL
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BooleanSearchAPI;
}
