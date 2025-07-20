const server = require('./server');

// Add more detailed logging
console.log('Starting Kids Camp Tracker Backend...');
console.log('Press Ctrl+C to stop the server');
console.log('');

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});