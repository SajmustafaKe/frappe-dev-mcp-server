# SSE Transport Fix Documentation

## Problem
The frappe-dev MCP server was encountering errors when used with GitHub Copilot Chat:
- `TypeError: terminated` errors in SSE stream
- `InternalServerError: stream is not readable` 
- Connections would establish but then immediately close

## Root Cause
1. **Incorrect Transport Handling**: Original implementation called `transport.start()` manually, but the MCP SDK's `server.connect()` already handles this
2. **Express.js Body Parsing Conflict**: Using `express.json()` and `express.raw()` middleware was consuming the request stream before the SSE transport could read it
3. **HTTP vs Express**: The original native HTTP server implementation had issues with proper SSE stream management

## Solution
1. **Switched to Express.js**: Used the same pattern as the official MCP CLI example
2. **Removed Body Parsing**: Disabled Express body parsing middleware to let SSE transport handle raw streams
3. **Fixed Connection Flow**: Removed manual `transport.start()` call, let `server.connect()` handle it
4. **Added Proper Error Handling**: Added connection error handlers and logging

## Key Changes

### Before (Broken):
```typescript
// Manual transport start (incorrect)
await transport.start();
await serverInstance.connect(transport);

// Body parsing middleware (conflicts with SSE)
app.use(express.json());
app.use(express.raw({ type: '*/*' }));
```

### After (Working):
```typescript
// Let server.connect() handle transport lifecycle
await serverInstance.connect(transport);

// No body parsing for SSE endpoints
// The SSE transport expects raw streams
```

## Testing Results
- ✅ SSE endpoint establishes connections properly
- ✅ Sessions are created and tracked correctly  
- ✅ Messages are accepted (202 status)
- ✅ No more "stream is not readable" errors
- ✅ No more premature connection termination

## GitHub Copilot Integration
The server is now running at `http://localhost:3000/sse` and should be discoverable by GitHub Copilot Chat through the VS Code MCP gallery system.

To verify it's working:
1. Start the server: `npm start`
2. Check logs show: "Frappe MCP Server running on SSE at http://localhost:3000/sse"
3. GitHub Copilot should discover the server automatically
4. Use `@frappe-dev` in GitHub Copilot Chat to access tools

## Technical Notes
- SSE (Server-Sent Events) transport is required for GitHub Copilot Chat compatibility
- Each SSE connection creates a separate MCP server instance 
- Sessions are tracked by UUID for message routing
- Express.js provides better HTTP handling than native Node.js http module for this use case