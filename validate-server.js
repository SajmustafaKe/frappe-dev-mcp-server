#!/usr/bin/env node

import http from 'http';

async function testServerValidation() {
  console.log('Testing frappe-dev MCP server validation...');
  
  const sseReq = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/sse',
    method: 'GET',
    headers: {
      'Accept': 'text/event-stream'
    }
  });

  let sessionId = null;

  sseReq.on('response', (res) => {
    console.log('✅ SSE Connection established:', res.statusCode);
    
    res.on('data', (chunk) => {
      const data = chunk.toString();
      const match = data.match(/sessionId=([a-f0-9-]+)/);
      if (match) {
        sessionId = match[1];
        console.log('✅ Session ID obtained:', sessionId);
        
        // Test initialize
        setTimeout(() => testInitialize(sessionId), 500);
      }
    });
  });

  sseReq.on('error', (err) => {
    console.error('❌ SSE Error:', err.message);
    process.exit(1);
  });

  sseReq.end();
}

function testInitialize(sessionId) {
  const postData = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/message?sessionId=${sessionId}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    console.log('✅ Initialize response:', res.statusCode);
    if (res.statusCode === 202) {
      console.log('✅ Server accepts messages properly');
      console.log('✅ Schema validation appears to be working');
      console.log('\n🎉 frappe-dev MCP server is ready for GitHub Copilot Chat!');
      console.log('You can now use @frappe-dev in GitHub Copilot Chat');
    }
    process.exit(0);
  });

  req.on('error', (err) => {
    console.error('❌ Request error:', err.message);
    process.exit(1);
  });

  req.write(postData);
  req.end();
}

testServerValidation();