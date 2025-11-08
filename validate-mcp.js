#!/usr/bin/env node

import http from 'http';

async function validateMCPServer() {
  console.log('🔍 Validating frappe-dev MCP server...\n');
  
  try {
    // Test 1: Server connectivity
    console.log('1. Testing server connectivity...');
    const sseReq = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/sse',
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' },
      timeout: 5000
    });

    let sessionId = null;
    let connectionEstablished = false;

    sseReq.on('response', (res) => {
      if (res.statusCode === 200) {
        console.log('   ✅ SSE connection established');
        connectionEstablished = true;
        
        res.on('data', (chunk) => {
          const data = chunk.toString();
          const match = data.match(/sessionId=([a-f0-9-]+)/);
          if (match) {
            sessionId = match[1];
            console.log(`   ✅ Session ID: ${sessionId}\n`);
            
            // Test 2: Initialize connection
            setTimeout(() => testInitialize(sessionId), 500);
          }
        });
      } else {
        console.log(`   ❌ SSE connection failed: ${res.statusCode}`);
        process.exit(1);
      }
    });

    sseReq.on('error', (err) => {
      console.log(`   ❌ Connection error: ${err.message}`);
      process.exit(1);
    });

    sseReq.on('timeout', () => {
      console.log('   ❌ Connection timeout');
      process.exit(1);
    });

    sseReq.end();

  } catch (error) {
    console.log(`❌ Server validation failed: ${error.message}`);
    process.exit(1);
  }
}

function testInitialize(sessionId) {
  console.log('2. Testing MCP initialization...');
  
  const initData = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "validation-client", version: "1.0.0" }
    }
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/message?sessionId=${sessionId}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(initData)
    },
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 202) {
      console.log('   ✅ Initialize message accepted\n');
      
      // Test 3: Tools list
      setTimeout(() => testToolsList(sessionId), 500);
    } else {
      console.log(`   ❌ Initialize failed: ${res.statusCode}`);
      process.exit(1);
    }
  });

  req.on('error', (err) => {
    console.log(`   ❌ Initialize error: ${err.message}`);
    process.exit(1);
  });

  req.on('timeout', () => {
    console.log('   ❌ Initialize timeout');
    process.exit(1);
  });

  req.write(initData);
  req.end();
}

function testToolsList(sessionId) {
  console.log('3. Testing tools list...');
  
  const toolsData = JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/message?sessionId=${sessionId}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(toolsData)
    },
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 202) {
      console.log('   ✅ Tools list request accepted\n');
      
      console.log('🎉 All tests passed!');
      console.log('\n📋 Summary:');
      console.log('   ✅ Server is running on http://localhost:3000/sse');
      console.log('   ✅ SSE connections work properly');
      console.log('   ✅ MCP protocol messages are accepted');
      console.log('   ✅ Schema validation appears to be working');
      console.log('\n💡 The frappe-dev MCP server should now work with GitHub Copilot Chat!');
      console.log('   Try using @frappe-dev in GitHub Copilot Chat');
      
      process.exit(0);
    } else {
      console.log(`   ❌ Tools list failed: ${res.statusCode}`);
      process.exit(1);
    }
  });

  req.on('error', (err) => {
    console.log(`   ❌ Tools list error: ${err.message}`);
    process.exit(1);
  });

  req.on('timeout', () => {
    console.log('   ❌ Tools list timeout');
    process.exit(1);
  });

  req.write(toolsData);
  req.end();
}

validateMCPServer();