const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  role: { type: String, enum: ['question', 'mark_scheme', 'insert', 'formula_booklet'], required: true },
  path: { type: String, required: true },
  remotePath: { type: String, default: '' },
  remoteUrl: { type: String, default: '' },
  sourceUrl: { type: String, default: '' },
  sha256: { type: String, default: '' },
}, { _id: false });

const gradeSchema = new mongoose.Schema({
  maxRaw: Number,
  aMark: Number,
  aPercent: Number,
  difficulty: { type: String, enum: ['hard', 'balanced', 'accessible', 'unknown'], default: 'unknown' },
  grades: { type: Map, of: Number, default: {} },
}, { _id: false });

const writtenPaperLibrarySchema = new mongoose.Schema({
  examBoard: { type: String, required: true, default: 'CAIE', index: true },
  qualification: { type: String, required: true, default: 'AS/A Level' },
  syllabusCode: { type: String, required: true, index: true },
  subject: { type: String, required: true, index: true },
  syllabusVersion: { type: String, default: '' },
  year: { type: Number, required: true, index: true },
  session: { type: String, enum: ['March', 'May/June', 'October/November'], required: true },
  sessionCode: { type: String, enum: ['m', 's', 'w'], required: true, index: true },
  component: { type: String, required: true, index: true },
  paperNumber: { type: String, required: true },
  paperType: {
    type: String,
    enum: ['structured', 'planning-analysis', 'data-response-essay', 'mathematics', 'further-mathematics'],
    required: true,
  },
  title: { type: String, required: true },
  durationMinutes: { type: Number, required: true, min: 1, max: 360 },
  totalMarks: { type: Number, required: true, min: 1 },
  questionCount: { type: Number, default: null },
  pageCount: { type: Number, default: null, min: 1 },
  calculatorPolicy: { type: String, enum: ['allowed', 'not_allowed', 'varies'], default: 'varies' },
  assets: { type: [assetSchema], default: [] },
  componentThreshold: { type: gradeSchema, default: null },
  difficulty: { type: String, enum: ['hard', 'balanced', 'accessible', 'unknown'], default: 'unknown', index: true },
  sourceHost: { type: String, default: '' },
  status: { type: String, enum: ['ready', 'needs_review'], default: 'needs_review', index: true },
}, { timestamps: true });

writtenPaperLibrarySchema.index(
  { examBoard: 1, syllabusCode: 1, year: 1, sessionCode: 1, component: 1 },
  { unique: true },
);
writtenPaperLibrarySchema.index({ status: 1, syllabusCode: 1, year: -1, sessionCode: 1, component: 1 });

module.exports = mongoose.model('WrittenPaperLibrary', writtenPaperLibrarySchema);
