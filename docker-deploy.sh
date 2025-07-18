#!/bin/bash

# Glide API Gateway Docker Deployment Script
# This creates the entire application without needing GitHub

echo "🚀 Deploying Glide API Gateway..."

# Stop and remove existing container if it exists
docker stop glide-api-gateway 2>/dev/null
docker rm glide-api-gateway 2>/dev/null

# Create a temporary directory for the build
TEMP_DIR=$(mktemp -d)
cd $TEMP_DIR

# Create package.json
cat > package.json << 'EOF'
{
  "name": "glide-api-gateway",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "start:http": "node http-server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "express-rate-limit": "^6.7.0",
    "axios": "^1.4.0"
  }
}
EOF

# Create the HTTP server
cat > http-server.js << 'EOF'
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 100
});
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// List available tools
app.get('/tools', (req, res) => {
  res.json({
    tools: [
      {
        name: 'execute_api',
        description: 'Execute Glide API calls',
        parameters: {
          api_name: 'string (required)',
          method: 'string',
          path: 'string',
          data: 'object'
        }
      }
    ]
  });
});

// API execution endpoint
app.post('/api/execute', async (req, res) => {
  try {
    const { api_name, method, path, data } = req.body;
    
    if (api_name !== 'glide-api-v1') {
      return res.status(400).json({ error: 'Invalid API name' });
    }
    
    const url = process.env.API_1_BASE_URL + path;
    console.log(`Executing ${method} request to: ${url}`);
    
    const response = await axios({
      method: method || 'POST',
      url: url,
      headers: {
        'Authorization': process.env.API_1_HEADER_AUTHORIZATION,
        'Content-Type': 'application/json'
      },
      data: data
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('API Error:', error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.message,
      details: error.response?.data 
    });
  }
});

// Glide-specific endpoints
app.post('/api/glide/queryTables', async (req, res) => {
  try {
    const response = await axios({
      method: 'POST',
      url: process.env.API_1_BASE_URL + '/queryTables',
      headers: {
        'Authorization': process.env.API_1_HEADER_AUTHORIZATION,
        'Content-Type': 'application/json'
      },
      data: req.body
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/glide/mutateTables', async (req, res) => {
  try {
    const response = await axios({
      method: 'POST',
      url: process.env.API_1_BASE_URL + '/mutateTables',
      headers: {
        'Authorization': process.env.API_1_HEADER_AUTHORIZATION,
        'Content-Type': 'application/json'
      },
      data: req.body
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Glide API Gateway running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});
EOF

# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy application files
COPY package.json .
COPY http-server.js .

# Install dependencies
RUN npm install --production

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "http-server.js"]
EOF

# Build Docker image
echo "🔨 Building Docker image..."
docker build -t glide-api-gateway:latest .

# Run the container
echo "🚀 Starting container..."
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
  glide-api-gateway:latest

# Clean up temp directory
cd -
rm -rf $TEMP_DIR

echo "✅ Deployment complete!"
echo ""
echo "🧪 Test your deployment:"
echo "curl http://localhost:7777/health"
echo ""
echo "📊 View logs:"
echo "docker logs -f glide-api-gateway"
echo ""
echo "🛑 Stop the container:"
echo "docker stop glide-api-gateway"