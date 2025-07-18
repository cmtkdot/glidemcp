import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import SwaggerParser from '@apidevtools/swagger-parser';
import axios from 'axios';

class APIGatewayMCPServer {
    constructor() {
        this.apis = new Map();
    }

    async loadAPIs() {
        try {
            const apiConfigs = this.parseEnvironmentConfig();
            
            if (apiConfigs.length === 0) {
                console.error('No APIs configured. Please check environment variables.');
                return;
            }
            
            for (const apiConfig of apiConfigs) {
                await this.registerAPI(apiConfig);
            }
            
            console.log(`Loaded ${this.apis.size} APIs successfully`);
        } catch (error) {
            console.error('Error loading APIs:', error);
        }
    }

    parseEnvironmentConfig() {
        const configs = [];
        
        // Look for API configurations in environment
        let index = 1;
        
        while (process.env[`API_${index}_NAME`]) {
            const config = {
                name: process.env[`API_${index}_NAME`],
                swaggerUrl: process.env[`API_${index}_SWAGGER_URL`],
                baseUrl: process.env[`API_${index}_BASE_URL`] || '',
                headers: {}
            };
            
            const headersEnv = process.env[`API_${index}_HEADERS`];
            if (headersEnv) {
                try {
                    config.headers = JSON.parse(headersEnv);
                } catch (e) {
                    console.error(`Failed to parse headers for API_${index}:`, e);
                }
            }
            
            // Check for individual header env vars
            const envKeys = Object.keys(process.env);
            const headerPrefix = `API_${index}_HEADER_`;
            
            envKeys.forEach(key => {
                if (key.startsWith(headerPrefix)) {
                    const headerName = key.substring(headerPrefix.length).replace(/_/g, '-');
                    config.headers[headerName] = process.env[key];
                }
            });
            
            configs.push(config);
            index++;
        }
        
        return configs;
    }

    async registerAPI(config) {
        try {
            const { name, swaggerUrl, baseUrl, headers = {} } = config;
            
            const api = await SwaggerParser.parse(swaggerUrl);
            
            this.apis.set(name, {
                spec: api,
                baseUrl: baseUrl || api.servers?.[0]?.url || '',
                headers,
                paths: api.paths
            });
            
            console.log(`API '${name}' registered successfully`);
        } catch (error) {
            console.error(`Failed to register API '${config.name}':`, error);
        }
    }

    async getAPIInfo(args) {
        const { api_name } = args;
        let info = '';
        
        if (api_name) {
            const api = this.apis.get(api_name);
            if (!api) {
                return { error: `API '${api_name}' not found` };
            }
            
            info = this.formatAPIInfo(api_name, api);
        } else {
            for (const [name, api] of this.apis) {
                info += this.formatAPIInfo(name, api) + '\n\n---\n\n';
            }
        }
        
        return { content: [{ type: 'text', text: info }] };
    }

    formatAPIInfo(name, api) {
        let info = `# API: ${name}\n`;
        info += `Base URL: ${api.baseUrl}\n`;
        info += `Version: ${api.spec.info?.version || 'N/A'}\n\n`;
        
        info += '## Endpoints:\n';
        for (const [path, pathData] of Object.entries(api.paths)) {
            for (const [method, operation] of Object.entries(pathData)) {
                if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
                    info += `\n### ${method.toUpperCase()} ${path}\n`;
                    info += `${operation.summary || 'No description'}\n`;
                    
                    if (operation.parameters?.length > 0) {
                        info += 'Parameters:\n';
                        for (const param of operation.parameters) {
                            info += `- ${param.name} (${param.in}): ${param.description || 'No description'}\n`;
                        }
                    }
                }
            }
        }
        
        return info;
    }

    async executeAPI(args) {
        const { api_name, method, path, params, data, headers } = args;
        
        const api = this.apis.get(api_name);
        if (!api) {
            throw new Error(`API '${api_name}' not found`);
        }
        
        const url = `${api.baseUrl}${path}`;
        const config = {
            method: method.toLowerCase(),
            url,
            headers: { ...api.headers, ...headers },
            params,
            data
        };
        
        try {
            const response = await axios(config);
            return response.data;
        } catch (error) {
            throw new Error(`API call failed: ${error.response?.data?.message || error.message}`);
        }
    }
}

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});

app.use('/api/', limiter);

// Initialize MCP Gateway
const mcpGateway = new APIGatewayMCPServer();
await mcpGateway.loadAPIs();

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// API Info endpoint
app.get('/api/info', async (req, res) => {
    try {
        const result = await mcpGateway.getAPIInfo({ api_name: req.query.api_name });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generic API execution endpoint
app.post('/api/execute', async (req, res) => {
    try {
        const result = await mcpGateway.executeAPI(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Glide API specific endpoints
app.get('/api/glide/app', async (req, res) => {
    try {
        const result = await mcpGateway.executeAPI({
            api_name: 'glide-api-v1',
            method: 'GET',
            path: `/apps/${process.env.GLIDE_APP_ID}`,
            params: req.query
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/glide/tables', async (req, res) => {
    try {
        const result = await mcpGateway.executeAPI({
            api_name: 'glide-api-v1',
            method: 'GET',
            path: `/apps/${process.env.GLIDE_APP_ID}/tables`,
            params: req.query
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/glide/tables/:tableId/rows', async (req, res) => {
    try {
        const { tableId } = req.params;
        const result = await mcpGateway.executeAPI({
            api_name: 'glide-api-v1',
            method: 'GET',
            path: `/apps/${process.env.GLIDE_APP_ID}/tables/${tableId}/rows`,
            params: req.query
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/glide/tables/:tableId/rows', async (req, res) => {
    try {
        const { tableId } = req.params;
        const result = await mcpGateway.executeAPI({
            api_name: 'glide-api-v1',
            method: 'POST',
            path: `/apps/${process.env.GLIDE_APP_ID}/tables/${tableId}/rows`,
            data: req.body
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/glide/tables/:tableId/rows/:rowId', async (req, res) => {
    try {
        const { tableId, rowId } = req.params;
        const result = await mcpGateway.executeAPI({
            api_name: 'glide-api-v1',
            method: 'POST',
            path: `/apps/${process.env.GLIDE_APP_ID}/tables/${tableId}/rows/${rowId}`,
            data: req.body
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

app.listen(port, () => {
    console.log(`🚀 Glide API Gateway HTTP server running on port ${port}`);
    console.log(`🏥 Health check: http://localhost:${port}/health`);
    console.log(`📊 API info: http://localhost:${port}/api/info`);
});

export default app;