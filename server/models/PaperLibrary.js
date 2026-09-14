const mongoose = require('mongoose');

const paperLibrarySchema = new mongoose.Schema({
  examBoard: {
    type: String,
    required: true,
    default: 'CAIE',
    index: true
  },
  qualification: {
    type: String,
    required: true,
    default: 'AS/A Level'
  },
  syllabusCode: {
    type: String,
    required: true,
    index: true
  },
  subject: {
    type: String,
    required: true,
    index: true
  },
  year: {
    type: Number,
    required: true,
    index: true
  },
  session: {
    type: String,
    enum: ['March', 'May/June', 'October/November'],
    required: true,
    index: true
  },
  sessionCode: {
    type: String,
    enum: ['m', 's', 'w'],
    required: true
  },
  component: {
    type: String,
    required: true,
    index: true
  },
  paperNumber: {
    type: String,
    required: true,
    default: '1'
  },
  paperType: {
    type: String,
    required: true,
    default: 'MCQ'
  },
  title: {
    type: String,
    required: true
  },
  questionPaperPath: {
    type: String,
    required: true
  },
  markingSchemePath: {
    type: String,
    required: true
  },
  questionPaperSourceUrl: {
    type: String,
    required: true
  },
  markingSchemeSourceUrl: {
    type: String,
    required: true
  },
  gradeThresholdPath: {
    type: String,
    default: ''
  },
  gradeThresholdSourceUrl: {
    type: String,
    default: ''
  },
  componentThreshold: {
    maxRaw: Number,
    aMark: Number,
    aPercent: Number,
    difficulty: {
      type: String,
      enum: ['hard', 'balanced', 'accessible', 'unknown'],
      default: 'unknown'
    },
    grades: {
      A: Number,
      B: Number,
      C: Number,
      D: Number,
      E: Number
    }
  },
  difficulty: {
    type: String,
    enum: ['hard', 'balanced', 'accessible', 'unknown'],
    default: 'unknown',
    index: true
  },
  sourceHost: {
    type: String,
    required: true
  },
  answers: {
    type: Map,
    of: String,
    default: {}
  },
  discountedQuestions: {
    type: [Number],
    default: []
  },
  totalQuestions: {
    type: Number,
    default: 40
  },
  parseConfidence: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'low'
  },
  parseStrategy: {
    type: String,
    default: ''
  },
  parseTotalFound: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['ready', 'needs_review'],
    default: 'needs_review',
    index: true
  }
}, {
  timestamps: true
});

paperLibrarySchema.index({
  examBoard: 1,
  syllabusCode: 1,
  year: 1,
  sessionCode: 1,
  component: 1
}, { unique: true });

module.exports = mongoose.model('PaperLibrary', paperLibrarySchema);
