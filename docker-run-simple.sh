#!/bin/bash

# Simple one-liner Docker deployment
# No GitHub, no complexity - just works!

docker run -d \
  --name glide-api-gateway \
  --restart unless-stopped \
  -p 7777:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e GLIDE_API_KEY=bcc7a00b-6919-47e1-8724-30999251a866 \
  -e GLIDE_APP_ID=KyQIgjT4O1JsARXgkzsv \
  -e API_1_NAME=glide-api-v1 \
  -e API_1_BASE_URL=https://api.glideapp.io/api/function \
  -e API_1_HEADER_AUTHORIZATION="Bearer bcc7a00b-6919-47e1-8724-30999251a866" \
  -e CORS_ORIGIN="*" \
  -e RATE_LIMIT_WINDOW=15 \
  -e RATE_LIMIT_MAX=100 \
  node:18-alpine \
  sh -c 'cd /app && \
    echo "{\"name\":\"api\",\"version\":\"1.0.0\",\"dependencies\":{\"express\":\"^4.18.2\",\"cors\":\"^2.8.5\",\"express-rate-limit\":\"^6.7.0\",\"axios\":\"^1.4.0\"}}" > package.json && \
    npm install && \
    cat > server.js << "EOF"
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const app = express();
const port = process.env.PORT || 3000;
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 100
});
app.use(limiter);
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString(), version: "1.0.0" });
});
app.post("/api/execute", async (req, res) => {
  try {
    const { api_name, method, path, data } = req.body;
    if (api_name !== "glide-api-v1") {
      return res.status(400).json({ error: "Invalid API name" });
    }
    const response = await axios({
      method: method || "POST",
      url: process.env.API_1_BASE_URL + path,
      headers: {
        "Authorization": process.env.API_1_HEADER_AUTHORIZATION,
        "Content-Type": "application/json"
      },
      data: data
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message, details: error.response?.data });
  }
});
app.listen(port, "0.0.0.0", () => {
  console.log("Glide API Gateway running on port " + port);
});
EOF
    node server.js'