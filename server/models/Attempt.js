const mongoose = require('mongoose');

const answerDetailSchema = new mongoose.Schema({
  selected: { type: String, default: null },
  correct: { type: String, required: true },
  isCorrect: { type: Boolean, default: false },
  timeSpent: { type: Number, default: 0 }
}, { _id: false });

const attemptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  paperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Paper',
    required: function uploadedPaperIsRequired() {
      return !this.libraryPaperId;
    }
  },
  libraryPaperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaperLibrary',
    required: function libraryPaperIsRequired() {
      return !this.paperId;
    }
  },
  mode: {
    type: String,
    enum: ['exam', 'casual'],
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'completed'],
    default: 'completed'
  },
  draft: { type: Object, default: null },
  answers: {
    type: Map,
    of: answerDetailSchema,
    required: true
  },
  totalCorrect: { type: Number, default: 0 },
  totalWrong: { type: Number, default: 0 },
  totalSkipped: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  totalTimeTaken: { type: Number, default: 0 },
  examDuration: { type: Number, default: 0 },
  annotations: { type: Object, default: {} },
  roughPageData: { type: Object, default: {} },
  completedAt: { type: Date, default: null }
}, {
  timestamps: true
});

attemptSchema.index({ userId: 1, createdAt: -1 });
attemptSchema.index({ paperId: 1 });
attemptSchema.index({ libraryPaperId: 1 });
attemptSchema.index({ userId: 1, status: 1, libraryPaperId: 1, updatedAt: -1 });

module.exports = mongoose.model('Attempt', attemptSchema);
