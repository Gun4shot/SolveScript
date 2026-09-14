const mongoose = require('mongoose');

const writtenAttemptPageSchema = new mongoose.Schema({
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'WrittenAttempt', required: true, index: true },
  pageNumber: { type: Number, required: true, min: 1 },
  annotation: { type: mongoose.Schema.Types.Mixed, default: {} },
  revision: { type: Number, required: true, default: 0, min: 0 },
}, { timestamps: true });

writtenAttemptPageSchema.index({ attemptId: 1, pageNumber: 1 }, { unique: true });

module.exports = mongoose.model('WrittenAttemptPage', writtenAttemptPageSchema);
