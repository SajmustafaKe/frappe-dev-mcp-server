# Frappe Development MCP Server

This is an MCP (Model Context Protocol) server providing 139 tools for comprehensive Frappe framework development — covering DocTypes, documents, hooks, permissions, workflows, scripts, customization, communication, web/portal, print, dashboard, background jobs, data management, testing, v16 workspace sidebar, desktop icons, and frappe-ui SPA frontend development.

## Setup for Claude Code

### Prerequisites

1. Node.js >= 18
2. A Frappe bench directory with at least one site

### Quick Setup

```bash
# 1. Clone and build
cd frappe-dev-mcp-server
npm install
npm run build

# 2. Set environment variables pointing to your Frappe bench
export FRAPPE_PATH=/path/to/your/frappe-bench
export FRAPPE_DEFAULT_SITE=your-site.localhost

# 3. Add to Claude Code (stdio mode - recommended)
claude mcp add --transport stdio --scope user \
  --env FRAPPE_PATH=/path/to/your/frappe-bench \
  --env FRAPPE_DEFAULT_SITE=your-site.localhost \
  frappe-dev -- node /absolute/path/to/frappe-dev-mcp-server/dist/index.js --stdio
```

### Alternative: SSE Mode

If you prefer running the server as a persistent process:

```bash
# Start the SSE server
FRAPPE_PATH=/path/to/bench FRAPPE_DEFAULT_SITE=site.localhost npm start

# Add to Claude Code
claude mcp add --transport sse frappe-dev http://localhost:3000/sse
```

### Project-Level Configuration

The `.mcp.json` in this repo configures the server for anyone opening this project with Claude Code. Set the environment variables and it auto-connects:

```bash
export FRAPPE_PATH=/path/to/your/frappe-bench
export FRAPPE_DEFAULT_SITE=your-site.localhost
```

### Using in Another Frappe Project

Copy or adapt the `.mcp.json` to your Frappe app repo:

```json
{
  "mcpServers": {
    "frappe-dev": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/frappe-dev-mcp-server/dist/index.js", "--stdio"],
      "env": {
        "FRAPPE_PATH": "${FRAPPE_PATH}",
        "FRAPPE_DEFAULT_SITE": "${FRAPPE_DEFAULT_SITE}"
      }
    }
  }
}
```

## Tool Categories (139 tools)

| Category | Tools | Examples |
|----------|-------|---------|
| DocType Management | 4 | create_doctype, get_doctype_schema, get_field_options |
| Document CRUD | 12 | create/read/update/delete, submit, cancel, amend, rename |
| App Management | 6 | create_app, install_app, list_apps, get_app_structure |
| Bench Operations | 7 | migrate, build_assets, clear_cache, new_site |
| API Endpoints | 2 | create_api_endpoint, call_method |
| Hooks | 12 | doc_events, scheduler, web_include, jinja, boot_session, apps_screen |
| Permissions | 7 | roles, permissions, user_permissions, field-level security |
| Workflows | 4 | create/get workflow, apply/get actions |
| Scripts | 7 | server scripts, client scripts, controller methods, form.js |
| Customization | 6 | custom fields, property setters, customize form |
| Communication | 5 | notifications, email templates, webhooks |
| Web & Portal | 6 | web pages, portal pages, web templates, web forms |
| Print | 4 | print formats, letter heads |
| Dashboard & Workspace | 14 | charts, number cards, workspaces, v16 sidebar, desktop icons |
| Background Jobs | 5 | enqueue, scheduler, job status |
| Data Management | 8 | fixtures, patches, import/export, bulk update |
| Reports | 6 | query reports, script reports, financial statements |
| Advanced | 8 | virtual doctypes, testing, module defs, pages |
| Frontend SPA | 11 | scaffold app, pages, components, resources, stores, forms, lists, detail |
| UI Generation | 7 | frappe-ui components, blocks, templates |

## Development

```bash
npm run dev          # Run with tsx (hot reload)
npm run dev:stdio    # Run stdio mode with tsx
npm run build        # Compile TypeScript
npm run start:stdio  # Run compiled stdio mode
npm start            # Run SSE mode via server.sh
```
