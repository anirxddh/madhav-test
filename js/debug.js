/**
 * Frontend Debug - Add this to js/app.js temporarily to debug
 */

// Override the renderAIResponse function to add logging
const originalRenderAIResponse = renderAIResponse;
window.renderAIResponse = function(data) {
  console.log('[DEBUG] renderAIResponse called with:', data);
  console.log('[DEBUG] data.text:', data.text);
  console.log('[DEBUG] data.cases:', data.cases);
  console.log('[DEBUG] Number of cases:', data.cases?.length);
  
  try {
    return originalRenderAIResponse.call(this, data);
  } catch (err) {
    console.error('[DEBUG] Error in renderAIResponse:', err);
    throw err;
  }
};

// Also override appendChatMessage to log
const originalAppendChatMessage = window.appendChatMessage;
window.appendChatMessage = function(role, text = null, submode = null, cases = [], studySections = null, 
                                    tabularResults = [], completeExplanation = null, intent = 'mixed', isUnique = false, outputType = 'hybrid', 
                                    judgmentParagraphs = [], caseMetadata = {}, citationTree = null, citationsFlat = [], caseSummary = null) {
  console.log('[DEBUG] appendChatMessage called:', {
    role, 
    text: text?.substring?.(0, 50), 
    submode, 
    casesLen: cases?.length,
    tabularResultsLen: tabularResults?.length,
    hasCompleteExplanation: !!completeExplanation,
    intent,
    isUnique,
    outputType,
    judgmentParasLen: judgmentParagraphs?.length,
    hasCaseMetadata: !!caseMetadata?.case_name,
    citationsCount: citationsFlat?.length || 0,
    hasCaseSummary: !!caseSummary,
  });
  // Forward ALL parameters now! (including the last 3: citationTree, citationsFlat, caseSummary)
  const result = originalAppendChatMessage.call(this, role, text, submode, cases, studySections, 
                                                tabularResults, completeExplanation, intent, isUnique, outputType, 
                                                judgmentParagraphs, caseMetadata, citationTree, citationsFlat, caseSummary);
  console.log('[DEBUG] appendChatMessage result:', result);
  return result;
};

// Override sendChatMessage to log flow
const originalSendChatMessage = window.sendChatMessage;
window.sendChatMessage = async function() {
  console.log('[DEBUG] sendChatMessage called');
  const query = document.getElementById('chat-input').value.trim();
  console.log('[DEBUG] Query:', query);
  console.log('[DEBUG] Submode:', State.submode);
  
  try {
    return await originalSendChatMessage.call(this);
  } catch (err) {
    console.error('[DEBUG] Error in sendChatMessage:', err);
    throw err;
  }
};

console.log('[DEBUG] Frontend debug module loaded. Check console for detailed logs.');
