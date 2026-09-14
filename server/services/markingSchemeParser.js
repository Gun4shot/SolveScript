const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * Marking Scheme Parser
 * 
 * Parses Cambridge A-Level MCQ marking scheme PDFs to extract
 * the answer key (40 questions, A-D answers).
 * 
 * Strategy:
 * 1. Primary: pdf-parse for digital/text-based PDFs (95% of cases)
 * 2. Falls back to returning partial results for manual correction
 */

/**
 * Extract answers from a marking scheme PDF
 * @param {string} filePath - Path to the marking scheme PDF
 * @returns {Object} { answers: {1: 'A', 2: 'B', ...}, confidence: 'high'|'medium'|'low', totalFound: number }
 */
async function parseMarkingScheme(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;

    // Try multiple parsing strategies
    let answers = {};
    let strategy = '';

    // Strategy 1: Table-style format "1 A  2 B  3 C" or grid layout
    answers = parseTableFormat(text);
    if (Object.keys(answers).length >= 30) {
      strategy = 'table';
    }

    // Strategy 2: List format "1  A\n2  B\n3  C"
    if (Object.keys(answers).length < 30) {
      const listAnswers = parseListFormat(text);
      if (Object.keys(listAnswers).length > Object.keys(answers).length) {
        answers = listAnswers;
        strategy = 'list';
      }
    }

    // Strategy 3: Key-style "Question 1: A" or "Q1: A"
    if (Object.keys(answers).length < 30) {
      const keyAnswers = parseKeyFormat(text);
      if (Object.keys(keyAnswers).length > Object.keys(answers).length) {
        answers = keyAnswers;
        strategy = 'key';
      }
    }

    // Strategy 4: Dense format - look for sequences of A/B/C/D after question numbers
    if (Object.keys(answers).length < 30) {
      const denseAnswers = parseDenseFormat(text);
      if (Object.keys(denseAnswers).length > Object.keys(answers).length) {
        answers = denseAnswers;
        strategy = 'dense';
      }
    }

    const discountedQuestions = parseDiscountedQuestions(text);
    const totalFound = Object.keys(answers).length;
    let confidence = 'low';
    if (totalFound + discountedQuestions.length >= 38) confidence = 'high';
    else if (totalFound >= 30) confidence = 'medium';

    // Validate answers are within 1-40 range and A-D values
    const validatedAnswers = {};
    for (const [q, a] of Object.entries(answers)) {
      const qNum = parseInt(q);
      if (qNum >= 1 && qNum <= 40 && ['A', 'B', 'C', 'D'].includes(a.toUpperCase())) {
        validatedAnswers[qNum] = a.toUpperCase();
      }
    }

    return {
      answers: validatedAnswers,
      discountedQuestions,
      confidence,
      totalFound: Object.keys(validatedAnswers).length,
      strategy,
      rawText: text.substring(0, 2000) // First 2000 chars for debugging
    };
  } catch (error) {
    console.error('Parsing error:', error.message);
    return {
      answers: {},
      discountedQuestions: [],
      confidence: 'low',
      totalFound: 0,
      strategy: 'failed',
      error: error.message
    };
  }
}

/**
 * Parse table format: "1 A  2 B  3 C  4 D" or tabular with columns
 */
function parseTableFormat(text) {
  const answers = {};
  // Match patterns like "1 A", "12 B", "1  A", etc. across the text
  const regex = /\b(\d{1,2})\s+([A-Da-d])\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const qNum = parseInt(match[1]);
    const answer = match[2].toUpperCase();
    if (qNum >= 1 && qNum <= 40 && ['A', 'B', 'C', 'D'].includes(answer)) {
      // Only set if not already set (first occurrence preferred)
      if (!answers[qNum]) {
        answers[qNum] = answer;
      }
    }
  }
  return answers;
}

/**
 * Parse list format: one question per line
 * "1  A"
 * "2  B"
 */
function parseListFormat(text) {
  const answers = {};
  const lines = text.split('\n');
  for (const line of lines) {
    // Match question number, answer, and optional trailing marks (e.g., "1 D 1")
    const match = line.trim().match(/^(\d{1,2})\s+([A-Da-d])(?:[\s\t]+\d+)?\s*$/);
    if (match) {
      const qNum = parseInt(match[1]);
      const answer = match[2].toUpperCase();
      if (qNum >= 1 && qNum <= 40) {
        answers[qNum] = answer;
      }
    }
  }
  return answers;
}

/**
 * Parse key format: "Question 1: A", "Q.1 A", "Ans 1: A"
 */
function parseKeyFormat(text) {
  const answers = {};
  const regex = /(?:question|q\.?|ans(?:wer)?\.?\s*)\s*(\d{1,2})\s*[:\-\s]\s*([A-Da-d])\b/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const qNum = parseInt(match[1]);
    const answer = match[2].toUpperCase();
    if (qNum >= 1 && qNum <= 40) {
      answers[qNum] = answer;
    }
  }
  return answers;
}

/**
 * Parse dense format: look for structured answer blocks
 * Often Cambridge MS has "Key" section with compact answers
 */
function parseDenseFormat(text) {
  const answers = {};
  
  // Look for answer key section markers
  const keySection = text.match(/(?:key|answer\s*key|correct\s*answer)[s]?\s*[\n:]([\s\S]*?)(?:\n\n|$)/i);
  const searchText = keySection ? keySection[1] : text;
  
  // Match any number followed by a single letter A-D
  const regex = /(\d{1,2})\s*[.:\s-]+\s*([A-Da-d])/g;
  let match;
  while ((match = regex.exec(searchText)) !== null) {
    const qNum = parseInt(match[1]);
    const answer = match[2].toUpperCase();
    if (qNum >= 1 && qNum <= 40) {
      if (!answers[qNum]) {
        answers[qNum] = answer;
      }
    }
  }
  return answers;
}

function parseDiscountedQuestions(text) {
  const discounted = new Set();
  const regex = /\b(\d{1,2})\s+Question\s+discounted\b/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const qNum = parseInt(match[1]);
    if (qNum >= 1 && qNum <= 40) discounted.add(qNum);
  }

  return Array.from(discounted).sort((a, b) => a - b);
}

module.exports = { parseMarkingScheme };
