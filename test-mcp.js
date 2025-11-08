#!/usr/bin/env node

import http from 'http';

async function testMCPServer() {
  console.log('Testing MCP Server...');
  
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
      console.log('SSE Data:', data);
      
      // Extract sessionId
      const match = data.match(/sessionId=([a-f0-9-]+)/);
      if (match) {
        sessionId = match[1];
        console.log('Got sessionId:', sessionId);
        
        // Now test sending a message
        setTimeout(() => testMessage(sessionId), 1000);
      }
    });
  });

  sseReq.on('error', (err) => {
    console.error('SSE Error:', err);
  });

  sseReq.end();
}

function testMessage(sessionId) {
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
    console.log('Message Response:', res.statusCode);
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response Data:', data);
      process.exit(0);
    });
  });

  req.on('error', (err) => {
    console.error('Message Error:', err);
    process.exit(1);
  });

  req.write(postData);
  req.end();
}

testMCPServer();