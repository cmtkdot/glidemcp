# Hostinger Portainer Deployment Guide

## 🚀 Quick Deploy to Hostinger Portainer

### 1. Build and Push Docker Image

```bash
# Build the Docker image
docker build -t glide-api-gateway:latest .

# Tag for your registry (if using private registry)
docker tag glide-api-gateway:latest your-registry/glide-api-gateway:latest

# Push to registry
docker push your-registry/glide-api-gateway:latest
```

### 2. Deploy via Portainer Stack

1. **Log into Portainer** on your Hostinger VPS
2. **Go to Stacks** → **Add Stack**
3. **Name**: `glide-api-gateway`
4. **Copy the contents** of `portainer-stack.yml` into the editor
5. **Update environment variables** as needed
6. **Deploy the stack**

### 3. Access Your API Gateway

- **Health Check**: `http://your-domain:3000/health`
- **API Info**: `http://your-domain:3000/api/info`
- **Glide Query**: `POST http://your-domain:3000/api/execute`

## 📡 API Endpoints

### Core Endpoints
- `GET /health` - Health check
- `GET /api/info` - API information
- `POST /api/execute` - Generic API execution

### Glide-Specific Endpoints
- `POST /api/glide/queryTables` - Query Glide tables
- `POST /api/glide/mutateTables` - Mutate Glide tables

## 🔧 Environment Variables

```env
NODE_ENV=production
PORT=3000
GLIDE_API_KEY=your-api-key
GLIDE_APP_ID=your-app-id
API_1_NAME=glide-api-v1
API_1_SWAGGER_URL=file:///app/glide-api-v1-openapi.json
API_1_BASE_URL=https://api.glideapp.io/api/function
API_1_HEADER_AUTHORIZATION=Bearer your-api-key
API_1_HEADER_CONTENT_TYPE=application/json
CORS_ORIGIN=*
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

## 🔗 n8n Integration

### HTTP Request Node Configuration
```json
{
  "method": "POST",
  "url": "http://your-domain:3000/api/execute",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "api_name": "glide-api-v1",
    "method": "POST",
    "path": "/queryTables",
    "data": {
      "appID": "KyQIgjT4O1JsARXgkzsv",
      "queries": [
        {
          "tableName": "native-table-sgCH7hxbStWPIel1YC1Q",
          "utc": true
        }
      ]
    }
  }
}
```

## 🗄️ Supabase Integration

### Example: Sync Glide → Supabase
```javascript
// n8n Function Node
const glideData = $input.all()[0].json;
const supabaseRows = glideData.rows.map(row => ({
  glide_row_id: row.$rowID,
  name: row.Name,
  date: row.Y8Sjq,
  amount: row.totalAmount,
  synced_at: new Date().toISOString()
}));

return { supabaseRows };
```

## 🔒 Security Considerations

1. **API Key Protection**: Store in environment variables
2. **CORS Configuration**: Restrict origins in production
3. **Rate Limiting**: Adjust limits based on usage
4. **HTTPS**: Use SSL termination with nginx/Traefik
5. **Network Security**: Use internal Docker networks

## 📊 Monitoring & Logging

- **Health Checks**: Built-in Docker health checks
- **Metrics**: Access `/health` endpoint for status
- **Logs**: Use `docker logs glide-api-gateway`

## 🚨 Troubleshooting

### Common Issues
1. **Port conflicts**: Ensure port 3000 is available
2. **API key issues**: Verify Bearer token format
3. **CORS errors**: Check origin configuration
4. **Rate limiting**: Monitor request limits

### Debug Mode
```bash
# Run in debug mode
docker run --rm -it -p 3000:3000 --env NODE_ENV=development glide-api-gateway
```