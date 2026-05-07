const pdf = require('pdf-parse');

/**
 * Robust Marking Scheme Parser
 * 
 * Handles the standard CIE/Cambridge marking scheme format:
 *   1 A 1
 *   2 B 1
 *   ...
 * Where: column 1 = question number, column 2 = answer (A-D), column 3 = marks
 * 
 * Also handles variations like:
 *   1. A    1
 *   1  A
 *   Q1 A 1
 */
async function parseMarkingScheme(buffer, questionCount = 40) {
  try {
    const data = await pdf(buffer);
    const text = data.text;
    const pageCount = data.numpages;

    // Determine PDF Type
    const isDigital = text.length > (100 * pageCount);
    
    let answers = {};
    let confidence = 'LOW';
    let strategy = isDigital ? 'digital-extraction' : 'ocr-extraction';

    // Always attempt text extraction (works for both digital and fallback OCR)
    answers = extractAnswersFromText(text);

    // Confidence Check
    const totalFound = Object.keys(answers).length;
    if (totalFound >= 30 && totalFound <= 50) {
      confidence = 'HIGH';
    } else if (totalFound >= 20) {
      confidence = 'HIGH';
    } else if (totalFound >= 10) {
      confidence = 'LOW';
    }

    return {
      answers,
      totalFound,
      confidence,
      strategy,
      isDigital
    };
  } catch (error) {
    console.error('Marking Scheme Parse Error:', error);
    throw error;
  }
}

function extractAnswersFromText(text) {
  const answers = {};
  const lines = text.split('\n');
  
  // Primary patterns for marking scheme format, ordered by specificity
  const linePatterns = [
    // Format: "1 A 1" or "1  A  1" (number, answer, marks) — most common CIE format
    /^\s*(\d{1,2})\s+([A-D])\s+\d+\s*$/i,
    // Format: "1 A" (number, answer, no marks column)
    /^\s*(\d{1,2})\s+([A-D])\s*$/i,
    // Format: "1. A 1" or "1) A 1" (with period/paren separator)
    /^\s*(\d{1,2})\s*[.)]\s*([A-D])(?:\s+\d+)?\s*$/i,
    // Format: "Q1 A 1" or "Q.1 A 1"
    /^\s*Q\.?\s*(\d{1,2})\s+([A-D])(?:\s+\d+)?\s*$/i,
    // Format: "1-A" or "1–A" (dash separated)
    /^\s*(\d{1,2})\s*[-–]\s*([A-D])(?:\s+\d+)?\s*$/i,
  ];

  // Pass 1: Line-by-line strict matching (highest accuracy)
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const pattern of linePatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const qNum = parseInt(match[1]);
        const answer = match[2].toUpperCase();
        if (qNum >= 1 && qNum <= 100) {
          answers[qNum] = answer;
        }
        break; // Only match one pattern per line
      }
    }
  }

  // Pass 2: If Pass 1 found fewer than 10 answers, try a more relaxed multi-match approach
  // This handles multi-column layouts where a single line may contain multiple Q-A pairs
  if (Object.keys(answers).length < 10) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Match all "N A" or "N A M" pairs on one line (multi-column)
      const multiMatch = /(\d{1,2})\s+([A-D])(?:\s+\d+)?/gi;
      let m;
      while ((m = multiMatch.exec(trimmed)) !== null) {
        const qNum = parseInt(m[1]);
        const answer = m[2].toUpperCase();
        if (qNum >= 1 && qNum <= 100) {
          // Only set if not already found by strict pass
          if (!answers[qNum]) {
            answers[qNum] = answer;
          }
        }
      }
    }
  }

  // Pass 3: Validate and filter — remove any entries that are clearly noise
  // (e.g., question numbers way out of expected sequential range)
  const sortedKeys = Object.keys(answers).map(Number).sort((a, b) => a - b);
  if (sortedKeys.length > 5) {
    // Check if we have a reasonable sequential block (e.g., 1-40)
    const minQ = sortedKeys[0];
    const maxQ = sortedKeys[sortedKeys.length - 1];
    
    // If the range is way too wide relative to count, filter outliers
    if (maxQ - minQ > sortedKeys.length * 2) {
      // Find the densest cluster
      const filtered = {};
      for (const key of sortedKeys) {
        // Keep questions in a reasonable range
        if (key >= 1 && key <= 50) {
          filtered[key] = answers[key];
        }
      }
      return filtered;
    }
  }

  return answers;
}

module.exports = {
  parseMarkingScheme
};
