#!/bin/bash

# Frappe MCP Server Startup Script

SERVER_DIR="/Users/mac/ERPNext/mkahawa/frappe-mcp-server"
PID_FILE="$SERVER_DIR/server.pid"

start_server() {
    echo "🚀 Starting frappe-dev MCP server..."
    
    # Check if server is already running
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo "⚠️  Server is already running (PID: $(cat $PID_FILE))"
        echo "📍 Server URL: http://localhost:3000/sse"
        return 0
    fi
    
    # Start the server
    cd "$SERVER_DIR"
    nohup node dist/index.js > server.log 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > "$PID_FILE"
    
    # Wait a moment and check if it started successfully
    sleep 2
    if kill -0 $SERVER_PID 2>/dev/null; then
        echo "✅ Server started successfully (PID: $SERVER_PID)"
        echo "📍 Server URL: http://localhost:3000/sse"
        echo "📋 Log file: $SERVER_DIR/server.log"
        echo ""
        echo "💡 You can now use @frappe-dev in GitHub Copilot Chat!"
    else
        echo "❌ Failed to start server"
        rm -f "$PID_FILE"
        exit 1
    fi
}

stop_server() {
    echo "🛑 Stopping frappe-dev MCP server..."
    
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            echo "✅ Server stopped (PID: $PID)"
        else
            echo "⚠️  Server was not running"
        fi
        rm -f "$PID_FILE"
    else
        echo "⚠️  No PID file found - cleaning up any running processes"
        pkill -f "node dist/index.js"
    fi
}

status_server() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        PID=$(cat "$PID_FILE")
        echo "✅ Server is running (PID: $PID)"
        echo "📍 Server URL: http://localhost:3000/sse"
        echo "📋 Log file: $SERVER_DIR/server.log"
        
        # Test connectivity
        if curl -s -m 2 http://localhost:3000/sse > /dev/null; then
            echo "🔗 Server is responding"
        else
            echo "⚠️  Server is not responding"
        fi
    else
        echo "❌ Server is not running"
    fi
}

case "$1" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        stop_server
        sleep 1
        start_server
        ;;
    status)
        status_server
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "  start   - Start the frappe-dev MCP server"
        echo "  stop    - Stop the frappe-dev MCP server"
        echo "  restart - Restart the frappe-dev MCP server"
        echo "  status  - Check server status"
        exit 1
        ;;
esac

exit 0