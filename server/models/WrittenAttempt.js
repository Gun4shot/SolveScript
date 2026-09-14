const mongoose = require('mongoose');

const paperSnapshotSchema = new mongoose.Schema({
  source: { type: String, enum: ['library', 'local'], required: true },
  paperId: { type: String, required: true },
  title: { type: String, required: true },
  subject: { type: String, required: true },
  syllabusCode: { type: String, required: true },
  year: { type: Number, required: true },
  sessionCode: { type: String, required: true },
  component: { type: String, required: true },
  paperNumber: { type: String, required: true },
  durationMinutes: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  componentThreshold: {
    maxRaw: Number,
    grades: { type: Map, of: Number, default: {} },
  },
}, { _id: false });

const writtenAttemptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  paper: { type: paperSnapshotSchema, required: true },
  mode: { type: String, enum: ['casual', 'exam', 'custom'], required: true },
  durationMinutes: { type: Number, min: 1, max: 360, required: true },
  status: { type: String, enum: ['draft', 'submitted', 'self_marked', 'ai_reviewed'], default: 'draft', index: true },
  countsTowardProgress: { type: Boolean, default: false, index: true },
  startedAt: { type: Date, default: Date.now },
  deadlineAt: { type: Date, default: null },
  pausedSeconds: { type: Number, default: 0, min: 0 },
  elapsedSeconds: { type: Number, default: 0, min: 0 },
  currentPage: { type: Number, default: 1, min: 1 },
  flags: { type: [Number], default: [] },
  selfMark: {
    totalAwarded: { type: Number, default: null },
    notes: { type: String, maxlength: 5000, default: '' },
    markedAt: { type: Date, default: null },
  },
  aiReview: {
    provider: { type: String, default: 'gemini' },
    model: { type: String, default: '' },
    totalAwarded: { type: Number, default: null },
    maxMarks: { type: Number, default: null },
    confidence: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    summary: { type: String, maxlength: 4000, default: '' },
    questions: {
      type: [{
        question: { type: String, maxlength: 80 },
        awarded: Number,
        available: Number,
        rationale: { type: String, maxlength: 2000 },
        confidence: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
      }],
      default: [],
    },
    reviewedAt: { type: Date, default: null },
  },
  submittedAt: { type: Date, default: null },
}, { timestamps: true });

writtenAttemptSchema.index({ userId: 1, 'paper.paperId': 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('WrittenAttempt', writtenAttemptSchema);
