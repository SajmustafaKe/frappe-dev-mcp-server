#!/usr/bin/env node

import http from 'http';

async function testMCPTools() {
  console.log('Testing MCP Tools Schema Validation...');
  
  // Start by making SSE connection
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
    console.log('SSE Response:', res.statusCode);
    
    res.on('data', (chunk) => {
      const data = chunk.toString();
      
      // Extract sessionId
      const match = data.match(/sessionId=([a-f0-9-]+)/);
      if (match) {
        sessionId = match[1];
        console.log('Got sessionId:', sessionId);
        
        // Test tools/list to verify schema validation is working
        setTimeout(() => testToolsList(sessionId), 1000);
      }
    });
  });

  sseReq.on('error', (err) => {
    console.error('SSE Error:', err);
  });

  sseReq.end();
}

function testToolsList(sessionId) {
  const postData = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
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
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    console.log('Tools List Response:', res.statusCode);
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (data.includes('frappe_call_method')) {
        console.log('✅ frappe_call_method tool found - schema validation passed!');
      } else {
        console.log('❌ Tools not found or validation failed');
      }
      
      if (data.includes('Error') || data.includes('items')) {
        console.log('❌ Schema validation error detected:', data);
      } else {
        console.log('✅ No schema validation errors detected');
      }
      
      process.exit(0);
    });
  });

  req.on('error', (err) => {
    console.error('Tools List Error:', err);
    process.exit(1);
  });

  req.write(postData);
  req.end();
}

testMCPTools();