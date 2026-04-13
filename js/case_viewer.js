/**
 * Case Viewer Module
 * Handles display of case metadata and judgment paragraphs
 * Stub implementation for compatibility
 */

const CaseViewer = (() => {
  "use strict";

  /**
   * Build judgment paragraphs reader UI
   */
  function buildJudgmentParagraphsReader(caseMetadata, paragraphs) {
    if (!paragraphs || paragraphs.length === 0) {
      return '<div style="padding:1rem;color:#9ca3af;">No judgment paragraphs found.</div>';
    }

    let html = `
      <div class="judgment-reader" style="padding:1rem;background:#f9fafb;border-radius:0.5rem;">
        <div style="margin-bottom:1rem;border-bottom:1px solid #e5e7eb;padding-bottom:0.5rem;">
          <h3 style="margin:0;font-size:1.1rem;font-weight:600;">${caseMetadata?.title || 'Judgment'}</h3>
          ${caseMetadata?.year ? `<span style="color:#6b7280;font-size:0.9rem;">${caseMetadata.year}</span>` : ''}
        </div>
    `;

    paragraphs.forEach((para, idx) => {
      html += `
        <div class="judgment-para" style="margin-bottom:1rem;line-height:1.6;">
          <span style="display:block;color:#6b7280;font-size:0.85rem;margin-bottom:0.25rem;">
            Para ${para.para_no || idx + 1}
          </span>
          <p style="margin:0;color:#1f2937;white-space:pre-wrap;word-wrap:break-word;">
            ${(para.text || para.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
          </p>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  /**
   * Format case metadata
   */
  function formatCaseMetadata(caseData) {
    if (!caseData) return '';

    let html = '<div class="case-metadata" style="padding:1rem;background:#f0f9ff;border-left:4px solid #0284c7;border-radius:0.25rem;margin-bottom:1rem;">';
    
    if (caseData.title) html += `<h3 style="margin:0 0 0.5rem 0;font-size:1rem;">${caseData.title}</h3>`;
    
    const details = [];
    if (caseData.year) details.push(`<strong>Year:</strong> ${caseData.year}`);
    if (caseData.court) details.push(`<strong>Court:</strong> ${caseData.court}`);
    if (caseData.judges) details.push(`<strong>Judges:</strong> ${caseData.judges}`);
    
    if (details.length > 0) {
      html += '<div style="font-size:0.9rem;color:#1f2937;">' + details.join(' | ') + '</div>';
    }
    
    html += '</div>';
    return html;
  }

  return {
    buildJudgmentParagraphsReader,
    formatCaseMetadata
  };
})();
