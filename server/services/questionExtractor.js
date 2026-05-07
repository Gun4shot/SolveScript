/**
 * Question Extractor Service
 * Handles Step 3: Structured Question Parser
 */

function extractQuestions(text, pageNum = 1) {
  const questions = [];
  
  // Regex for question starts as per prompt:
  // 1. ^\s*(\d{1,2})\s*[\.\)]\s+ — e.g. "1. ", "2) ", "12. "
  // 2. ^\s*Q\.?\s*(\d{1,2})\s+ — e.g. "Q1 ", "Q.2 "
  const qStartPatterns = [
    /^\s*(\d{1,2})\s*[\.\)]\s+/i,
    /^\s*Q\.?\s*(\d{1,2})\s+/i
  ];
  
  // Answer choices: detect lines starting with A, B, C, D followed by . or ) or space
  const choiceRegex = /^\s*([A-D])\s*[\.\)\s]\s*/i;

  const lines = text.split('\n');
  let currentQuestion = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]; // Use original for start anchors
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check for question start
    let qMatch = null;
    for (const pattern of qStartPatterns) {
      const m = line.match(pattern);
      if (m) {
        qMatch = m;
        break;
      }
    }
    
    if (qMatch) {
      if (currentQuestion) questions.push(finalizeQuestion(currentQuestion));

      const qNum = parseInt(qMatch[1]);
      currentQuestion = {
        number: qNum,
        page: pageNum,
        body: line.replace(qMatch[0], '').trim(),
        choices: {},
        hasComplexContent: false
      };
    } else if (currentQuestion) {
      // Check for choices
      const cMatch = line.match(choiceRegex);
      if (cMatch) {
        const letter = cMatch[1].toUpperCase();
        currentQuestion.choices[letter] = line.replace(cMatch[0], '').trim();
      } else {
        // Append to body if no choice found yet
        if (Object.keys(currentQuestion.choices).length === 0) {
          currentQuestion.body += ' ' + trimmedLine;
        }
      }

      // Detect complex content (formulas, arithmetic, chemistry, or OCR artifacts)
      if (/\d+\s*[+\-×÷=]\s*\d+|[→⇌]|[\u00B2\u00B3\u2070-\u2079\u2080-\u2089]|[_|\[\]\\]/.test(line)) {
        currentQuestion.hasComplexContent = true;
      }
    }
  }

  if (currentQuestion) questions.push(finalizeQuestion(currentQuestion));
  return questions;
}

function finalizeQuestion(q) {
  // If complex content or missing choices, flag it
  const choiceCount = Object.keys(q.choices).length;
  if (q.hasComplexContent || choiceCount < 4) {
    q.hasComplexContent = true;
    // For those questions, still save whatever text was extracted but set choices to { A: '', B: '', C: '', D: '' } 
    ['A', 'B', 'C', 'D'].forEach(l => { if (!q.choices[l]) q.choices[l] = ''; });
  }
  return q;
}

/**
 * Perform post-parse confidence check
 */
function calculateConfidence(questions) {
  if (questions.length < 20 || questions.length > 100) return 'LOW';
  
  const highQualityCount = questions.filter(q => 
    Object.keys(q.choices).length === 4 && !q.hasComplexContent
  ).length;

  // 80% threshold as per prompt
  return (highQualityCount / questions.length) >= 0.8 ? 'HIGH' : 'LOW';
}

module.exports = {
  extractQuestions,
  calculateConfidence
};
