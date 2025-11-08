# Frappe/ERPNext MCP Server

A Model Context Protocol (MCP) server that provides AI assistance for Frappe/ERPNext development. This server offers tools to help with creating DocTypes, running bench commands, managing apps, and other Frappe development tasks.

## Features

- **DocType Creation**: Automatically generate DocType JSON definitions and Python controllers
- **Bench Commands**: Execute bench commands for development workflows
- **App Management**: Create, install, and manage Frappe apps
- **API Endpoints**: Generate custom API endpoints
- **Database Operations**: Run migrations and database management
- **App Structure Analysis**: Get detailed app directory structures

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the server:
   ```bash
   npm run build
   ```

## Configuration

Set the `FRAPPE_PATH` environment variable to point to your Frappe bench directory:

```bash
export FRAPPE_PATH="/path/to/your/frappe/bench"
```

If not set, it defaults to `/Users/mac/ERPNext/mkahawa`.

## Usage

### With GitHub Copilot Chat (SSE Transport)

The server now supports SSE transport for use with GitHub Copilot Chat:

1. Build and run the SSE server:
   ```bash
   npm run build
   npm run sse
   ```

2. The server will be automatically discovered by GitHub Copilot Chat at `http://localhost:3000/sse`

### With Claude Desktop (Stdio Transport)

Add the following configuration to your Claude Desktop config file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "frappe-dev": {
      "command": "node",
      "args": ["/Users/mac/ERPNext/mkahawa/frappe-mcp-server/dist/index.js"],
      "env": {
        "FRAPPE_PATH": "/Users/mac/ERPNext/mkahawa"
      }
    }
  }
}
```

### With other MCP clients

Run the server directly:

```bash
node dist/index.js
```

## Available Tools

### frappe_create_doctype
Creates a new Frappe DocType with JSON definition and Python controller.

**Parameters:**
- `app_name`: Name of the Frappe app
- `doctype_name`: Name of the DocType
- `module`: Module where DocType belongs
- `fields`: Array of field definitions
- `is_submittable`: Whether the DocType is submittable (default: false)
- `is_child`: Whether this is a child DocType (default: false)

### frappe_run_bench_command
Executes bench commands for Frappe development.

**Parameters:**
- `command`: Bench command to execute
- `site`: Site name (optional)
- `cwd`: Working directory (optional)

### frappe_get_app_structure
Gets the directory structure of a Frappe app.

**Parameters:**
- `app_name`: Name of the Frappe app

### frappe_create_api_endpoint
Creates a custom API endpoint for a Frappe app.

**Parameters:**
- `app_name`: Name of the Frappe app
- `endpoint_name`: Name of the API endpoint
- `method`: HTTP method (get, post, put, delete) (default: get)
- `code`: Python code for the API endpoint

### frappe_migrate_database
Runs database migration for a Frappe site.

**Parameters:**
- `site`: Site name to migrate

### frappe_install_app
Installs a Frappe app on a site.

**Parameters:**
- `app_name`: Name of the app to install
- `site`: Site name

### frappe_create_app
Creates a new Frappe app.

**Parameters:**
- `app_name`: Name of the new app
- `title`: Title of the app
- `publisher`: Publisher name
- `description`: App description (optional)

## Example Usage

### Creating a DocType

```javascript
{
  "app_name": "my_app",
  "doctype_name": "Customer Order",
  "module": "Orders",
  "fields": [
    {
      "fieldname": "customer",
      "label": "Customer",
      "fieldtype": "Link",
      "options": "Customer",
      "reqd": true
    },
    {
      "fieldname": "order_date",
      "label": "Order Date",
      "fieldtype": "Date",
      "reqd": true
    },
    {
      "fieldname": "total_amount",
      "label": "Total Amount",
      "fieldtype": "Currency",
      "reqd": true
    }
  ]
}
```

### Running Bench Commands

```javascript
{
  "command": "migrate",
  "site": "my_site.local"
}
```

## Development

To modify the server:

1. Edit files in the `src/` directory
2. Run `npm run build` to compile TypeScript
3. Test with `npm run dev` for development mode

## Requirements

- Node.js 18+
- Frappe/ERPNext bench environment
- Access to Frappe bench commands

## License

MIT License - see LICENSE file for details
