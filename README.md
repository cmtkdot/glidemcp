# Glide API Gateway

🚀 **Universal MCP Server for Glide API Integration**

A production-ready API Gateway that bridges Glide Apps with the Model Context Protocol (MCP), enabling seamless integration with Claude Desktop, n8n, Supabase, and other automation tools.

## ✨ Features

- **🔌 Universal API Gateway**: Convert any OpenAPI spec to MCP tools
- **🎯 Glide API V1 Support**: Full support for Glide's function-based API
- **🐳 Docker Ready**: Production-ready containerization
- **🔄 n8n Integration**: Direct HTTP endpoints for workflow automation
- **🗄️ Supabase Compatible**: Real-time data synchronization
- **🔒 Security First**: Rate limiting, CORS, and environment-based config
- **📊 Monitoring**: Built-in health checks and logging
- **🔧 Flexible**: Support for multiple APIs simultaneously

## 🚀 Quick Start

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/glide-api-gateway.git
cd glide-api-gateway

# Install dependencies
npm install

# Configure environment
cp .env.production .env
# Edit .env with your API keys

# Start MCP server (for Claude Desktop)
npm start

# Start HTTP server (for n8n/Supabase)
npm run start:http
```

### Docker Deployment

```bash
# Build and run with Docker
docker build -t glide-api-gateway .
docker run -p 3000:3000 --env-file .env.production glide-api-gateway

# Or use Docker Compose
docker-compose up -d
```

### Hostinger Portainer Deployment

1. Copy contents of `portainer-stack.yml`
2. Create new stack in Portainer
3. Update environment variables
4. Deploy stack

## 📋 Configuration

### Environment Variables

```env
# Glide API Configuration
GLIDE_API_KEY=your-api-key
GLIDE_APP_ID=your-app-id

# API Gateway Configuration
API_1_NAME=glide-api-v1
API_1_SWAGGER_URL=file:///app/glide-api-v1-openapi.json
API_1_BASE_URL=https://api.glideapp.io/api/function
API_1_HEADER_AUTHORIZATION=Bearer your-api-key

# Security
CORS_ORIGIN=*
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

### Claude Desktop Integration

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "glide-api-gateway": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "--env-file", "/path/to/.env",
        "glide-api-gateway"
      ]
    }
  }
}
```

## 🔧 API Endpoints

### MCP Protocol (Claude Desktop)
- **stdio**: Direct MCP communication via Docker

### HTTP API (n8n, Supabase, etc.)
- `GET /health` - Health check
- `GET /tools` - List available tools
- `POST /tools/:toolName` - Execute specific tool
- `POST /api/execute` - Generic API execution
- `POST /mcp` - MCP protocol over HTTP

### Glide-Specific Endpoints
- `POST /api/glide/queryTables` - Query Glide tables
- `POST /api/glide/mutateTables` - Mutate Glide tables

## 🎯 Usage Examples

### Query Glide Tables

```bash
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "api_name": "glide-api-v1",
    "method": "POST",
    "path": "/queryTables",
    "data": {
      "appID": "your-app-id",
      "queries": [
        {
          "tableName": "your-table-name",
          "utc": true
        }
      ]
    }
  }'
```

### Add Row to Glide Table

```bash
curl -X POST http://localhost:3000/api/execute \
  -H "Content-Type: application/json" \
  -d '{
    "api_name": "glide-api-v1",
    "method": "POST",
    "path": "/mutateTables",
    "data": {
      "appID": "your-app-id",
      "mutations": [
        {
          "kind": "add-row-to-table",
          "tableName": "your-table-name",
          "columnValues": {
            "Name": "New Order",
            "Date": "2024-01-15T00:00:00.000Z"
          }
        }
      ]
    }
  }'
```

## 🔗 Integration Guides

- **[n8n Integration](docs/N8N_INTEGRATION.md)** - Complete guide for n8n workflows
- **[Supabase Integration](docs/SUPABASE_INTEGRATION.md)** - Database sync and real-time updates
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment instructions

## 🛠️ Development

### Project Structure

```
glide-api-gateway/
├── index.js                 # MCP server (Claude Desktop)
├── http-server.js           # HTTP server (n8n, Supabase)
├── glide-api-v1-openapi.json # OpenAPI specification
├── docker-compose.yml       # Docker Compose config
├── portainer-stack.yml      # Portainer stack config
├── docs/                    # Documentation
│   ├── N8N_INTEGRATION.md
│   └── SUPABASE_INTEGRATION.md
└── README.md
```

### Adding New APIs

1. Create OpenAPI specification file
2. Add environment variables:
   ```env
   API_2_NAME=new-api
   API_2_SWAGGER_URL=file:///app/new-api-spec.json
   API_2_BASE_URL=https://api.example.com
   API_2_HEADER_AUTHORIZATION=Bearer your-token
   ```
3. Restart the server

### Testing

```bash
# Test MCP protocol
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | \
  docker run --rm -i --env-file .env glide-api-gateway

# Test HTTP server
curl http://localhost:3000/health
```

## 🔒 Security

- **Environment Variables**: All sensitive data in environment variables
- **Rate Limiting**: Configurable rate limits per IP
- **CORS**: Configurable cross-origin resource sharing
- **Docker Security**: Non-root user, minimal attack surface
- **Input Validation**: Request validation and sanitization

## 📊 Monitoring

### Health Checks

```bash
# Docker health check
docker exec glide-api-gateway curl -f http://localhost:3000/health

# Manual health check
curl http://your-domain:3000/health
```

### Logging

```bash
# View logs
docker logs glide-api-gateway

# Follow logs
docker logs -f glide-api-gateway
```

## 🚨 Troubleshooting

### Common Issues

1. **API not found**: Check environment variables are set correctly
2. **Rate limiting**: Adjust `RATE_LIMIT_MAX` in environment
3. **CORS errors**: Configure `CORS_ORIGIN` for your domain
4. **Connection timeouts**: Check network connectivity to Glide API

### Debug Mode

```bash
# Run in debug mode
docker run --rm -it -p 3000:3000 \
  --env NODE_ENV=development \
  --env-file .env \
  glide-api-gateway
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/glide-api-gateway/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/glide-api-gateway/discussions)
- **Documentation**: [Wiki](https://github.com/yourusername/glide-api-gateway/wiki)

## 🏷️ Tags

`mcp` `claude` `glide` `api-gateway` `n8n` `supabase` `docker` `automation` `integration` `openapi`