import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import SwaggerParser from '@apidevtools/swagger-parser';
import axios from 'axios';

class APIGatewayMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'mcp-api-gateway',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.apis = new Map();
    this.setupHandlers();
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
      
      console.error(`Loaded ${this.apis.size} APIs successfully`);
    } catch (error) {
      console.error('Error loading APIs:', error);
    }
  }

  parseEnvironmentConfig() {
    const configs = [];
    
    // Look for API configurations in environment
    // Format: API_1_NAME, API_1_SWAGGER_URL, API_1_BASE_URL, API_1_HEADERS
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
      
      // Also check for individual header env vars
      // Format: API_1_HEADER_AUTHORIZATION, API_1_HEADER_X_API_KEY
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
      const { name, swaggerUrl, swaggerFile, baseUrl, headers = {} } = config;
      
      const api = await SwaggerParser.parse(swaggerUrl || swaggerFile);
      
      this.apis.set(name, {
        spec: api,
        baseUrl: baseUrl || api.servers?.[0]?.url || '',
        headers,
        paths: api.paths
      });
      
      console.error(`API '${name}' registered successfully`);
    } catch (error) {
      console.error(`Failed to register API '${config.name}':`, error);
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [];
      
      tools.push({
        name: 'get_api_info',
        description: 'Get information about available APIs and their endpoints',
        inputSchema: {
          type: 'object',
          properties: {
            api_name: { 
              type: 'string', 
              description: 'Name of the API (optional, shows all if not provided)' 
            }
          }
        }
      });
      
      // Add dynamic tools for each API endpoint
      for (const [apiName, apiData] of this.apis) {
        for (const [path, pathData] of Object.entries(apiData.paths)) {
          for (const [method, operation] of Object.entries(pathData)) {
            if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
              const toolName = `${apiName}_${method}_${path.replace(/[{}\/]/g, '_')}`;
              
              tools.push({
                name: toolName,
                description: operation.summary || `${method.toUpperCase()} ${path}`,
                inputSchema: this.buildInputSchema(operation, method)
              });
            }
          }
        }
      }
      
      // Add execute_api tool for flexible API calls
      tools.push({
        name: 'execute_api',
        description: 'Execute any API endpoint with custom parameters',
        inputSchema: {
          type: 'object',
          properties: {
            api_name: { type: 'string', description: 'Name of the API' },
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
            path: { type: 'string', description: 'API endpoint path' },
            params: { type: 'object', description: 'Query parameters' },
            data: { type: 'object', description: 'Request body data' },
            headers: { type: 'object', description: 'Additional headers' }
          },
          required: ['api_name', 'method', 'path']
        }
      });
      
      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        if (name === 'get_api_info') {
          return await this.getAPIInfo(args);
        } else if (name === 'execute_api') {
          return await this.executeAPI(args);
        } else if (name.includes('_')) {
          return await this.executeDynamicTool(name, args);
        }
        
        throw new Error(`Unknown tool: ${name}`);
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ]
        };
      }
    });
  }

  buildInputSchema(operation, method) {
    const schema = {
      type: 'object',
      properties: {},
      required: []
    };
    
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (param.in === 'query' || param.in === 'path') {
          schema.properties[param.name] = {
            type: param.schema?.type || 'string',
            description: param.description
          };
          
          if (param.required) {
            schema.required.push(param.name);
          }
        }
      }
    }
    
    if (['post', 'put', 'patch'].includes(method) && operation.requestBody) {
      const content = operation.requestBody.content?.['application/json'];
      if (content?.schema) {
        schema.properties.body = {
          type: 'object',
          description: 'Request body data',
          properties: content.schema.properties || {}
        };
        
        if (operation.requestBody.required) {
          schema.required.push('body');
        }
      }
    }
    
    return schema;
  }

  async getAPIInfo(args) {
    const { api_name } = args;
    let info = '';
    
    if (api_name) {
      const api = this.apis.get(api_name);
      if (!api) {
        return {
          content: [{
            type: 'text',
            text: `API '${api_name}' not found`
          }]
        };
      }
      
      info = this.formatAPIInfo(api_name, api);
    } else {
      for (const [name, api] of this.apis) {
        info += this.formatAPIInfo(name, api) + '\n\n---\n\n';
      }
    }
    
    return {
      content: [{
        type: 'text',
        text: info
      }]
    };
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
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2)
        }]
      };
    } catch (error) {
      throw new Error(`API call failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async executeDynamicTool(toolName, args) {
    const parts = toolName.split('_');
    const apiName = parts[0];
    const method = parts[1];
    let path = parts.slice(2).join('/').replace(/_/g, '/');
    
    for (const [key, value] of Object.entries(args)) {
      path = path.replace(`{${key}}`, value);
    }
    
    const apiArgs = {
      api_name: apiName,
      method: method.toUpperCase(),
      path: path.startsWith('/') ? path : `/${path}`,
      params: {},
      data: args.body
    };
    
    for (const [key, value] of Object.entries(args)) {
      if (key !== 'body' && !path.includes(`{${key}}`)) {
        apiArgs.params[key] = value;
      }
    }
    
    return await this.executeAPI(apiArgs);
  }

  async run() {
    await this.loadAPIs();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP API Gateway Server running...');
  }
}

const server = new APIGatewayMCPServer();
server.run().catch(console.error);