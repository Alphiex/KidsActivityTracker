const http = require('http');
const https = require('https');
const url = require('url');

const TARGET_HOST = 'kids-activity-api-205843686007.us-central1.run.app';
const PROXY_PORT = 3001;

const server = http.createServer((req, res) => {
  console.log(`Proxy request: ${req.method} ${req.url}`);
  
  const parsedUrl = url.parse(req.url);
  const options = {
    hostname: TARGET_HOST,
    port: 443,
    path: parsedUrl.path,
    method: req.method,
    headers: {
      ...req.headers,
      host: TARGET_HOST
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    console.log(`Proxy response: ${proxyRes.statusCode}`);
    
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.writeHead(500);
    res.end('Proxy Error');
  });

  req.pipe(proxyReq);
});

server.listen(PROXY_PORT, () => {
  console.log(`Simple proxy server running on http://localhost:${PROXY_PORT}`);
  console.log(`Forwarding all requests to https://${TARGET_HOST}`);
});