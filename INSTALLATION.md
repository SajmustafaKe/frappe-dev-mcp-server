# Installation Guide

## Prerequisites

- Node.js 18+ 
- A running Frappe/ERPNext bench environment
- Git

## Quick Install

### 1. Clone the Repository

```bash
git clone https://github.com/SajmustafaKe/frappe-dev-mcp-server.git
cd frappe-dev-mcp-server
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Server

```bash
npm run build
```

### 4. Configure Environment

Set the `FRAPPE_PATH` environment variable to point to your Frappe bench directory:

```bash
export FRAPPE_PATH="/path/to/your/frappe/bench"
```

Or create a `.env` file in the project root:

```bash
echo "FRAPPE_PATH=/path/to/your/frappe/bench" > .env
```

## Usage Options

### Option 1: GitHub Copilot Chat (Recommended)

1. Start the SSE server:
   ```bash
   npm run build
   npm run sse
   ```

2. The server will be automatically discovered by GitHub Copilot Chat at `http://localhost:3000/sse`

### Option 2: Claude Desktop

1. Add configuration to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "frappe-dev": {
      "command": "node",
      "args": ["/path/to/frappe-dev-mcp-server/dist/index.js"],
      "env": {
        "FRAPPE_PATH": "/path/to/your/frappe/bench"
      }
    }
  }
}
```

2. Restart Claude Desktop

### Option 3: Direct Usage

```bash
node dist/index.js
```

## Verification

Test the installation by running:

```bash
npm run validate
```

## Troubleshooting

### Common Issues

1. **Node.js version**: Ensure you're using Node.js 18 or higher
2. **FRAPPE_PATH**: Make sure the path points to your bench directory
3. **Permissions**: Ensure the server has access to run bench commands
4. **Port conflicts**: Default SSE port is 3000, change if needed

### Getting Help

- Check the [GitHub Issues](https://github.com/SajmustafaKe/frappe-dev-mcp-server/issues)
- Review the main [README.md](README.md) for detailed documentation
- Make sure your Frappe bench is working correctly first

## Development Setup

If you want to contribute or modify the server:

```bash
# Clone the repo
git clone https://github.com/SajmustafaKe/frappe-dev-mcp-server.git
cd frappe-dev-mcp-server

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## License

MIT License - see LICENSE file for details.