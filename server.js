const app = require('./src/app');
const { port } = require('./src/config/environment');

app.listen(port, () => {
  console.log(`🚀 YouPlace Backend Server running on port ${port}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API Base URL: http://localhost:${port}/api/v1`);
});