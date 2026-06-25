const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

// Proxy /ncm/* requests to NeteaseCloudMusicApi on port 3000
app.use(
  '/ncm',
  createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true,
  })
);

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Forwarding /ncm/* -> http://localhost:3000`);
});
