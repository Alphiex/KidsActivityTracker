const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.MONITORING_PORT || 3001;

// Serve the dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`📊 Monitoring dashboard running on http://localhost:${PORT}`);
});