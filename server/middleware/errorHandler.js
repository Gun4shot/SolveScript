const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error('Error:', err.message);

  // Mongoose duplicate key
  if (err.code === 11000) {
    return res.status(400).json({ message: 'An account with this email already exists' });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ message: messages.join(', ') });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large. Maximum size is 50MB.' });
  }

  // Multer file type error
  if (err.message === 'Only PDF files are allowed') {
    return res.status(400).json({ message: err.message });
  }

  res.status(error.status || error.statusCode || 500).json({
    message: error.message || 'Server Error'
  });
};

module.exports = errorHandler;
