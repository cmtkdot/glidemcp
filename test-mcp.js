import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

async function testMCP() {
    console.log('🚀 Testing MCP Server...');
    
    // Start the MCP server
    const mcpServer = spawn('node', ['index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
    });
    
    let response = '';
    
    // Handle server output
    mcpServer.stdout.on('data', (data) => {
        response += data.toString();
        console.log('📤 Server output:', data.toString());
    });
    
    mcpServer.stderr.on('data', (data) => {
        console.log('🔍 Server info:', data.toString());
    });
    
    // Wait for server to start
    await setTimeout(3000);
    
    // Test 1: Initialize MCP
    console.log('\n📋 Test 1: Initialize MCP');
    const initMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: {}
            },
            clientInfo: {
                name: 'test-client',
                version: '1.0.0'
            }
        }
    };
    
    mcpServer.stdin.write(JSON.stringify(initMessage) + '\n');
    
    // Wait for response
    await setTimeout(2000);
    
    // Test 2: List tools
    console.log('\n🔧 Test 2: List tools');
    const listToolsMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
    };
    
    mcpServer.stdin.write(JSON.stringify(listToolsMessage) + '\n');
    
    // Wait for response
    await setTimeout(2000);
    
    // Test 3: Get API info
    console.log('\n📊 Test 3: Get API info');
    const getApiInfoMessage = {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
            name: 'get_api_info',
            arguments: {
                api_name: 'glide-api-v1'
            }
        }
    };
    
    mcpServer.stdin.write(JSON.stringify(getApiInfoMessage) + '\n');
    
    // Wait for response
    await setTimeout(3000);
    
    // Test 4: Test actual Glide API call
    console.log('\n🔍 Test 4: Test Glide API call');
    const glideApiCall = {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
            name: 'execute_api',
            arguments: {
                api_name: 'glide-api-v1',
                method: 'GET',
                path: '/apps/m7J7RYbfNJ5KpNHLLdFZ'
            }
        }
    };
    
    mcpServer.stdin.write(JSON.stringify(glideApiCall) + '\n');
    
    // Wait for response
    await setTimeout(3000);
    
    console.log('\n✅ Test completed');
    
    // Clean up
    mcpServer.kill();
}

testMCP().catch(console.error);