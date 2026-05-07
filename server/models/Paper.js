const mongoose = require('mongoose');

const paperSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Paper title is required'],
    trim: true
  },
  subject: {
    type: String,
    default: ''
  },
  level: {
    type: String,
    enum: ['AS', 'A2', ''],
    default: ''
  },
  session: {
    type: String,
    default: ''
  },
  year: {
    type: String,
    default: ''
  },
  variant: {
    type: String,
    default: ''
  },
  questionPaperPath: {
    type: String,
    required: true
  },
  markingSchemePath: {
    type: String,
    required: true
  },
  answers: {
    type: Map,
    of: String,
    required: true
  },
  extractedQuestions: [{
    number: Number,
    body: String,
    choices: {
      type: Map,
      of: String
    },
    page: Number,
    hasComplexContent: Boolean
  }],
  extractionConfidence: {
    type: String,
    enum: ['HIGH', 'LOW', 'NONE'],
    default: 'NONE'
  },
  totalQuestions: {
    type: Number,
    default: 40
  }
}, {
  timestamps: true
});

// Index for fast user queries
paperSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Paper', paperSchema);
