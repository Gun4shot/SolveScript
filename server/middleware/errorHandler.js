const errorHandler = (err, req, res, next) => {
  // Keep Express's four-argument error-handler signature.
  void next;
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

  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid resource identifier' });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File too large. Maximum size is 50MB.' });
  }

  // Multer file type error
  if (err.message === 'Only PDF files are allowed') {
    return res.status(400).json({ message: err.message });
  }

  const status = error.status || error.statusCode || 500;
  // The complete error is logged above; never expose database or file details.
  res.status(status).json({
    message: status >= 500 ? 'Something went wrong. Please try again.' : (error.message || 'Request could not be completed.')
  });
};

module.exports = errorHandler;
