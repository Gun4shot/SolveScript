const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  avatar: {
    type: String,
    default: ''
  },
  settings: {
    defaultExamDuration: { type: Number, default: 60 },
    preferredSubject: { type: String, default: '' }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
