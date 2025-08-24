#!/usr/bin/env node

const http = require("http");

const options = {
  hostname: "127.0.0.1",
  port: 3000,
  path: "/health",
  method: "GET",
  timeout: 5000
};

const req = http.request(options, (res) => {
  console.log(`Health check response: ${res.statusCode}`);
  
  if (res.statusCode === 200) {
    console.log("✅ Health check passed");
    process.exit(0);
  } else {
    console.error("❌ Health check failed");
    process.exit(1);
  }
});

req.on("error", (error) => {
  console.error("❌ Health check error:", error.message);
  process.exit(1);
});

req.on("timeout", () => {
  console.error("❌ Health check timeout");
  req.destroy();
  process.exit(1);
});

req.end();
