import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as fs from "fs-extra";
import * as path from "path";
import { glob } from "glob";
import { execSync, spawn } from "child_process";
import express from "express";

// Frappe-specific tool definitions
const frappeTools = [
  {
    name: "frappe_create_doctype",
    description: "Create a new Frappe DocType with JSON definition and Python controller",
    inputSchema: {
      type: "object",
      properties: {
        app_name: { type: "string", description: "Name of the Frappe app" },
        doctype_name: { type: "string", description: "Name of the DocType" },
        module: { type: "string", description: "Module where DocType belongs" },
        fields: {
          type: "array",
          description: "Array of field definitions",
          items: {
            type: "object",
            properties: {
              fieldname: { type: "string" },
              label: { type: "string" },
              fieldtype: { type: "string", enum: ["Data", "Int", "Float", "Currency", "Date", "Datetime", "Text", "Long Text", "Check", "Select", "Link", "Table", "Attach", "Image"] },
              reqd: { type: "boolean", default: false },
              unique: { type: "boolean", default: false },
              options: { type: "string", description: "Options for Select/Link fields" }
            },
            required: ["fieldname", "label", "fieldtype"]
          }
        },
        is_submittable: { type: "boolean", default: false },
        is_child: { type: "boolean", default: false }
      },
      required: ["app_name", "doctype_name", "module", "fields"]
    }
  },
  {
    name: "frappe_run_bench_command",
    description: "Execute bench commands for Frappe development",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Bench command to execute" },
        site: { type: "string", description: "Site name (optional)" },
        cwd: { type: "string", description: "Working directory (optional)" }
      },
      required: ["command"]
    }
  },
  {
    name: "frappe_get_app_structure",
    description: "Get the structure of a Frappe app",
    inputSchema: {
      type: "object",
      properties: {
        app_name: { type: "string", description: "Name of the Frappe app" }
      },
      required: ["app_name"]
    }
  },
  {
    name: "frappe_create_api_endpoint",
    description: "Create a custom API endpoint for a Frappe app",
    inputSchema: {
      type: "object",
      properties: {
        app_name: { type: "string", description: "Name of the Frappe app" },
        endpoint_name: { type: "string", description: "Name of the API endpoint" },
        method: { type: "string", enum: ["get", "post", "put", "delete"], default: "get" },
        code: { type: "string", description: "Python code for the API endpoint" }
      },
      required: ["app_name", "endpoint_name", "code"]
    }
  },
  {
    name: "frappe_migrate_database",
    description: "Run database migration for Frappe apps",
    inputSchema: {
      type: "object",
      properties: {
        site: { type: "string", description: "Site name to migrate" }
      },
      required: ["site"]
    }
  },
  {
    name: "frappe_install_app",
    description: "Install a Frappe app on a site",
    inputSchema: {
      type: "object",
      properties: {
        app_name: { type: "string", description: "Name of the app to install" },
        site: { type: "string", description: "Site name" }
      },
      required: ["app_name", "site"]
    }
  },
  {
    name: "frappe_create_app",
    description: "Create a new Frappe app",
    inputSchema: {
      type: "object",
      properties: {
        app_name: { type: "string", description: "Name of the new app" },
        title: { type: "string", description: "Title of the app" },
        publisher: { type: "string", description: "Publisher name" },
        description: { type: "string", description: "App description" }
      },
      required: ["app_name", "title", "publisher"]
    }
  },
  {
    name: "frappe_create_document",
    description: "Create a new Frappe document",
    inputSchema: {
      type: "object",
      properties: {
        doctype: { type: "string", description: "DocType of the document" },
        data: { type: "object", description: "Document data as key-value pairs" },
        site: { type: "string", description: "Site name" }
      },
      required: ["doctype", "data", "site"]
    }
  },
  {
    name: "frappe_get_document",
    description: "Retrieve a Frappe document by DocType and name",
    inputSchema: {
      type: "object",
      properties: {
        doctype: { type: "string", description: "DocType of the document" },
        name: { type: "string", description: "Name of the document" },
        site: { type: "string", description: "Site name" }
      },
      required: ["doctype", "name", "site"]
    }
  },
  {
    name: "frappe_update_document",
    description: "Update an existing Frappe document",
    inputSchema: {
      type: "object",
      properties: {
        doctype: { type: "string", description: "DocType of the document" },
        name: { type: "string", description: "Name of the document" },
        data: { type: "object", description: "Updated document data" },
        site: { type: "string", description: "Site name" }
      },
      required: ["doctype", "name", "data", "site"]
    }
  },
  {
    name: "frappe_delete_document",
    description: "Delete a Frappe document",
    inputSchema: {
      type: "object",
      properties: {
        doctype: { type: "string", description: "DocType of the document" },
        name: { type: "string", description: "Name of the document" },
        site: { type: "string", description: "Site name" }
      },
      required: ["doctype", "name", "site"]
    }
  },
  {
    name: "frappe_list_documents",
    description: "List Frappe documents with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        doctype: { type: "string", description: "DocType to list" },
        filters: { type: "object", description: "Filters as key-value pairs" },
        limit: { type: "number", description: "Maximum number of results", default: 20 },
        site: { type: "string", description: "Site name" }
      },
      required: ["doctype", "site"]
    }
  },
  {
    name: "frappe_call_method",
    description: "Execute a whitelisted Frappe method",
    inputSchema: {
      type: "object",
      properties: {
        method: { 
          type: "string", 
          description: "Method path (e.g., 'frappe.client.get')" 
        },
        args: { 
          type: "array", 
          description: "Arguments for the method",
          items: {
            anyOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              { type: "object" },
              { type: "array" },
              { type: "null" }
            ]
          },
          default: []
        },
        site: { 
          type: "string", 
          description: "Site name",
          default: "mkahawa.localhost"
        }
      },
      required: ["method"]
    }
  },
  {
    name: "frappe_get_doctype_schema",
    description: "Get the complete schema/structure of a Frappe DocType",
    inputSchema: {
      type: "object",
      properties: {
        doctype: { type: "string", description: "Name of the DocType" },
        site: { type: "string", description: "Site name" }
      },
      required: ["doctype", "site"]
    }
  },
  {
    name: "frappe_get_field_options",
    description: "Get options for Link/Select fields in a DocType",
    inputSchema: {
      type: "object",
      properties: {
        doctype: { type: "string", description: "DocType name" },
        fieldname: { type: "string", description: "Field name" },
        site: { type: "string", description: "Site name" }
      },
      required: ["doctype", "fieldname", "site"]
    }
  },
  {
    name: "frappe_get_doctype_list",
    description: "List all available DocTypes in the system",
    inputSchema: {
      type: "object",
      properties: {
        site: { type: "string", description: "Site name" }
      },
      required: ["site"]
    }
  },
  {
    name: "frappe_get_frappe_usage_info",
    description: "Get combined schema and usage information for Frappe development",
    inputSchema: {
      type: "object",
      properties: {
        site: { type: "string", description: "Site name" }
      },
      required: ["site"]
    }
  },
  {
    name: "frappe_run_query_report",
    description: "Execute a Frappe query report",
    inputSchema: {
      type: "object",
      properties: {
        report_name: { type: "string", description: "Name of the query report" },
        filters: { type: "object", description: "Report filters" },
        site: { type: "string", description: "Site name" }
      },
      required: ["report_name", "site"]
    }
  },
  {
    name: "frappe_get_report_meta",
    description: "Get metadata for a Frappe report",
    inputSchema: {
      type: "object",
      properties: {
        report_name: { type: "string", description: "Name of the report" },
        site: { type: "string", description: "Site name" }
      },
      required: ["report_name", "site"]
    }
  },
  {
    name: "frappe_list_reports",
    description: "List available Frappe reports",
    inputSchema: {
      type: "object",
      properties: {
        site: { type: "string", description: "Site name" }
      },
      required: ["site"]
    }
  },
  {
    name: "frappe_run_doctype_report",
    description: "Generate a report based on a DocType",
    inputSchema: {
      type: "object",
      properties: {
        doctype: { type: "string", description: "DocType for the report" },
        filters: { type: "object", description: "Filters for the report" },
        site: { type: "string", description: "Site name" }
      },
      required: ["doctype", "site"]
    }
  },
  {
    name: "frappe_get_financial_statements",
    description: "Get financial statements (P&L, Balance Sheet, Cash Flow)",
    inputSchema: {
      type: "object",
      properties: {
        statement_type: { type: "string", enum: ["Profit and Loss", "Balance Sheet", "Cash Flow"], description: "Type of financial statement" },
        company: { type: "string", description: "Company name" },
        fiscal_year: { type: "string", description: "Fiscal year" },
        site: { type: "string", description: "Site name" }
      },
      required: ["statement_type", "company", "site"]
    }
  },
  {
    name: "frappe_generate_frappe_ui_component",
    description: "Generate a Vue component using frappe-ui components",
    inputSchema: {
      type: "object",
      properties: {
        component_name: { type: "string", description: "Name of the component" },
        component_type: { type: "string", enum: ["Button", "Dialog", "Form", "List", "DetailDrawer"], description: "Type of frappe-ui component" },
        props: { type: "object", description: "Component props" },
        content: { type: "string", description: "Component content/template" }
      },
      required: ["component_name", "component_type"]
    }
  },
  {
    name: "frappe_generate_vue_page",
    description: "Generate a Vue page with frappe-ui layout",
    inputSchema: {
      type: "object",
      properties: {
        page_name: { type: "string", description: "Name of the page" },
        route: { type: "string", description: "Route path" },
        components: { 
          type: "array", 
          description: "List of components to include",
          items: {
            type: "string"
          }
        }
      },
      required: ["page_name", "route"]
    }
  },
  {
    name: "frappe_get_vue_component_tree",
    description: "Get the Vue component tree structure (simulated)",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page name" }
      },
      required: ["page"]
    }
  },
  {
    name: "frappe_create_ui_block",
    description: "Create UI blocks using frappe-ui and Tailwind CSS patterns",
    inputSchema: {
      type: "object",
      properties: {
        block_type: { type: "string", enum: ["hero", "features", "pricing", "contact", "footer", "navbar", "sidebar", "card", "form"], description: "Type of UI block to create" },
        theme: { type: "string", enum: ["light", "dark", "auto"], default: "light", description: "Theme for the block" },
        customization: { type: "string", description: "Specific customization requirements" }
      },
      required: ["block_type"]
    }
  },
  {
    name: "frappe_inspire_ui_block",
    description: "Generate creative UI blocks inspired by modern design patterns",
    inputSchema: {
      type: "object",
      properties: {
        inspiration: { type: "string", description: "Description of the inspiration or use case" },
        framework: { type: "string", enum: ["vue", "react", "svelte"], default: "vue", description: "Target framework" }
      },
      required: ["inspiration"]
    }
  },
  {
    name: "frappe_refine_ui_block",
    description: "Refine and improve existing UI blocks",
    inputSchema: {
      type: "object",
      properties: {
        existing_code: { type: "string", description: "Existing UI block code to refine" },
        improvements: { type: "string", description: "What improvements to make" }
      },
      required: ["existing_code", "improvements"]
    }
  },
  {
    name: "frappe_get_ui_templates",
    description: "Get available UI templates and patterns",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["layout", "component", "page", "all"], default: "all", description: "Template category" }
      }
    }
  }
];

class FrappeMCPServer {
  private frappePath: string;
  private servers: Server[] = [];

  constructor() {
    this.frappePath = process.env.FRAPPE_PATH || "/Users/mac/ERPNext/mkahawa";
  }

  private createServer(): Server {
    const server = new Server(
      {
        name: "frappe-mcp-server",
        version: "1.0.0",
      }
    );

    // Set up tool handlers for this server instance
    this.setupToolHandlers(server);

    return server;
  }

  private setupToolHandlers(server: Server) {
    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: frappeTools };
    });

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "frappe_create_doctype":
            return await this.createDocType(args);
          case "frappe_run_bench_command":
            return await this.runBenchCommand(args);
          case "frappe_get_app_structure":
            return await this.getAppStructure(args);
          case "frappe_create_api_endpoint":
            return await this.createAPIEndpoint(args);
          case "frappe_migrate_database":
            return await this.migrateDatabase(args);
          case "frappe_install_app":
            return await this.installApp(args);
          case "frappe_create_app":
            return await this.createApp(args);
          case "frappe_create_document":
            return await this.createDocument(args);
          case "frappe_get_document":
            return await this.getDocument(args);
          case "frappe_update_document":
            return await this.updateDocument(args);
          case "frappe_delete_document":
            return await this.deleteDocument(args);
          case "frappe_list_documents":
            return await this.listDocuments(args);
          case "frappe_call_method":
            return await this.callMethod(args);
          case "frappe_get_doctype_schema":
            return await this.getDocTypeSchema(args);
          case "frappe_get_field_options":
            return await this.getFieldOptions(args);
          case "frappe_get_doctype_list":
            return await this.getDocTypeList(args);
          case "frappe_get_frappe_usage_info":
            return await this.getFrappeUsageInfo(args);
          case "frappe_run_query_report":
            return await this.runQueryReport(args);
          case "frappe_get_report_meta":
            return await this.getReportMeta(args);
          case "frappe_list_reports":
            return await this.listReports(args);
          case "frappe_run_doctype_report":
            return await this.runDocTypeReport(args);
          case "frappe_get_financial_statements":
            return await this.getFinancialStatements(args);
          case "frappe_generate_frappe_ui_component":
            return await this.generateFrappeUIComponent(args);
          case "frappe_generate_vue_page":
            return await this.generateVuePage(args);
          case "frappe_get_vue_component_tree":
            return await this.getVueComponentTree(args);
          case "frappe_create_ui_block":
            return await this.createUIBlock(args);
          case "frappe_inspire_ui_block":
            return await this.inspireUIBlock(args);
          case "frappe_refine_ui_block":
            return await this.refineUIBlock(args);
          case "frappe_get_ui_templates":
            return await this.getUITemplates(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${errorMessage}`
        );
      }
    });
  }

  private async createDocType(args: any) {
    const { app_name, doctype_name, module, fields, is_submittable = false, is_child = false } = args;

    const appPath = path.join(this.frappePath, "apps", app_name);
    const doctypePath = path.join(appPath, app_name, "doctype", doctype_name.toLowerCase().replace(/\s+/g, '_'));

    // Create DocType JSON
    const doctypeJson = {
      name: doctype_name,
      doctype: "DocType",
      module: module,
      custom: 0,
      is_submittable: is_submittable,
      is_child: is_child,
      fields: fields.map((field: any, index: number) => ({
        fieldname: field.fieldname,
        label: field.label,
        fieldtype: field.fieldtype,
        reqd: field.reqd || 0,
        unique: field.unique || 0,
        options: field.options || "",
        idx: index + 1
      }))
    };

    // Create directories
    await fs.ensureDir(doctypePath);

    // Write JSON file
    await fs.writeJson(path.join(doctypePath, `${doctype_name.toLowerCase().replace(/\s+/g, '_')}.json`), doctypeJson, { spaces: 2 });

    // Create Python controller
    const pythonCode = `# Copyright (c) 2025, ${app_name} contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class ${doctype_name.replace(/\s+/g, '')}(Document):
    pass
`;

    await fs.writeFile(path.join(doctypePath, `${doctype_name.toLowerCase().replace(/\s+/g, '_')}.py`), pythonCode);

    // Create __init__.py
    await fs.writeFile(path.join(doctypePath, "__init__.py"), "");

    return {
      content: [
        {
          type: "text",
          text: `DocType "${doctype_name}" created successfully in app "${app_name}"`
        }
      ]
    };
  }

  private async runBenchCommand(args: any) {
    const { command, site, cwd = this.frappePath } = args;

    const fullCommand = site ? `bench --site ${site} ${command}` : `bench ${command}`;

    try {
      const result = execSync(fullCommand, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Command failed: ${error.message}\nStderr: ${error.stderr}`
          }
        ]
      };
    }
  }

  private async getAppStructure(args: any) {
    const { app_name } = args;
    const appPath = path.join(this.frappePath, "apps", app_name);

    if (!await fs.pathExists(appPath)) {
      throw new Error(`App "${app_name}" not found`);
    }

    const structure = await this.getDirectoryStructure(appPath);

    return {
      content: [
        {
          type: "text",
          text: `App "${app_name}" structure:\n${structure}`
        }
      ]
    };
  }

  private async createAPIEndpoint(args: any) {
    const { app_name, endpoint_name, method = "get", code } = args;

    const apiPath = path.join(this.frappePath, "apps", app_name, app_name, "api");
    await fs.ensureDir(apiPath);

    const fileName = `${endpoint_name}.py`;
    const filePath = path.join(apiPath, fileName);

    const apiCode = `# Copyright (c) 2025, ${app_name} contributors
# For license information, please see license.txt

import frappe
from frappe import _

@frappe.whitelist()
def ${endpoint_name}():
    """${endpoint_name} API endpoint"""
    try:
${code.split('\n').map((line: string) => '        ' + line).join('\n')}
    except Exception as e:
        frappe.log_error(f"Error in ${endpoint_name}: {str(e)}")
        frappe.throw(_("An error occurred while processing your request"))
`;

    await fs.writeFile(filePath, apiCode);

    return {
      content: [
        {
          type: "text",
          text: `API endpoint "${endpoint_name}" created in app "${app_name}"`
        }
      ]
    };
  }

  private async migrateDatabase(args: any) {
    const { site } = args;
    return await this.runBenchCommand({ command: "migrate", site });
  }

  private async installApp(args: any) {
    const { app_name, site } = args;
    return await this.runBenchCommand({ command: `install-app ${app_name}`, site });
  }

  private async createApp(args: any) {
    const { app_name, title, publisher, description = "" } = args;

    const command = `new-app ${app_name} --title "${title}" --publisher "${publisher}" ${description ? `--description "${description}"` : ""}`;
    return await this.runBenchCommand({ command });
  }

  private async createDocument(args: any) {
    const { doctype, data, site } = args;
    const docData = { doctype, ...data };
    const command = `execute frappe.client.insert --args '${JSON.stringify(docData)}'`;
    return await this.runBenchCommand({ command, site });
  }

  private async getDocument(args: any) {
    const { doctype, name, site } = args;
    const command = `execute frappe.client.get --args '${JSON.stringify([doctype, name])}'`;
    return await this.runBenchCommand({ command, site });
  }

  private async updateDocument(args: any) {
    const { doctype, name, data, site } = args;
    // For update, we can use insert which handles both create and update
    const docData = { doctype, name, ...data };
    const command = `execute frappe.client.insert --args '${JSON.stringify(docData)}'`;
    return await this.runBenchCommand({ command, site });
  }

  private async deleteDocument(args: any) {
    const { doctype, name, site } = args;
    const command = `execute frappe.client.delete --args '${JSON.stringify([doctype, name])}'`;
    return await this.runBenchCommand({ command, site });
  }

  private async listDocuments(args: any) {
    const { doctype, filters = {}, limit = 20, site } = args;
    const command = `execute frappe.client.get_list --args '${JSON.stringify([doctype, filters, limit])}'`;
    return await this.runBenchCommand({ command, site });
  }

  private async callMethod(args: any) {
    const { method, args: methodArgs = [], site } = args;
    const command = `execute ${method} --args '${JSON.stringify(methodArgs)}'`;
    return await this.runBenchCommand({ command, site });
  }

  private async getDocTypeSchema(args: any) {
    const { doctype, site } = args;
    const command = `execute frappe.client.get_doc --args '${JSON.stringify(["DocType", doctype])}'`;
    return await this.runBenchCommand({ command, site });
  }

  private async getFieldOptions(args: any) {
    const { doctype, fieldname, site } = args;
    // First get the DocType to find the field
    const schemaResult = await this.getDocTypeSchema({ doctype, site });
    // Parse the result and extract options for the field
    // This is simplified; in practice, we'd parse the JSON output
    return {
      content: [
        {
          type: "text",
          text: `Field options for ${fieldname} in ${doctype}: ${schemaResult.content[0].text}`
        }
      ]
    };
  }

  private async getDocTypeList(args: any) {
    const { site } = args;
    const command = `execute frappe.client.get_list --args '${JSON.stringify(["DocType"])}'`;
    return await this.runBenchCommand({ command, site });
  }

  private async getFrappeUsageInfo(args: any) {
    const { site } = args;
    const doctypes = await this.getDocTypeList({ site });
    const usage = {
      total_doctypes: 0, // Would parse from doctypes result
      common_doctypes: ["User", "DocType", "Role"],
      api_endpoints: ["/api/resource", "/api/method"],
      development_tips: [
        "Use frappe.client for CRUD operations",
        "DocTypes define data models",
        "Custom scripts in hooks.py"
      ]
    };
    return {
      content: [
        {
          type: "text",
          text: `Frappe Usage Info: ${JSON.stringify(usage, null, 2)}`
        }
      ]
    };
  }

  private async runQueryReport(args: any) {
    const { report_name, filters = {}, site } = args;
    const command = `execute frappe.desk.query_report.run --args '${JSON.stringify([report_name, filters])}'`;
    return await this.runBenchCommand({ command, site });
  }

  private async getReportMeta(args: any) {
    const { report_name, site } = args;
    const command = `execute frappe.client.get_doc --args '${JSON.stringify(["Report", report_name])}'`;
    return await this.runBenchCommand({ command, site });
  }

  private async listReports(args: any) {
    const { site } = args;
    const command = `execute frappe.client.get_list --args '${JSON.stringify(["Report"])}'`;
    return await this.runBenchCommand({ command, site });
  }

  private async runDocTypeReport(args: any) {
    const { doctype, filters = {}, site } = args;
    const command = `execute frappe.client.get_list --args '${JSON.stringify([doctype, filters])}'`;
    return await this.runBenchCommand({ command, site });
  }

  private async getFinancialStatements(args: any) {
    const { statement_type, company, fiscal_year, site } = args;
    // This would depend on ERPNext modules
    const methodMap: { [key: string]: string } = {
      "Profit and Loss": "erpnext.accounts.report.profit_and_loss_statement.profit_and_loss_statement.get_data",
      "Balance Sheet": "erpnext.accounts.report.balance_sheet.balance_sheet.get_data",
      "Cash Flow": "erpnext.accounts.report.cash_flow_statement.cash_flow_statement.get_data"
    };
    const method = methodMap[statement_type];
    if (!method) {
      throw new Error(`Unknown statement type: ${statement_type}`);
    }
    const command = `execute ${method} --args '${JSON.stringify({ company, fiscal_year })}'`;
    return await this.runBenchCommand({ command, site });
  }

  private async generateFrappeUIComponent(args: any) {
    const { component_name, component_type, props = {}, content = "" } = args;
    
    const componentTemplates: { [key: string]: string } = {
      Button: `<Button ${Object.entries(props).map(([k, v]) => `${k}="${v}"`).join(' ')}>
  ${content || 'Click me'}
</Button>`,
      Dialog: `<Dialog v-model="showDialog" :title="${props.title || 'Dialog Title'}" :options="{ size: 'lg' }">
  <template #body>
    ${content || 'Dialog content'}
  </template>
</Dialog>`,
      Form: `<Form @submit="handleSubmit">
  ${content || '<!-- Form fields here -->'}
  <Button type="submit">Submit</Button>
</Form>`,
      List: `<ListView :rows="items" row-key="name">
  <template #default="{ row }">
    ${content || '{{ row.name }}'}
  </template>
</ListView>`,
      DetailDrawer: `<DetailDrawer v-model:open="drawerOpen" :title="${props.title || 'Details'}">
  ${content || '<!-- Detail content -->'}
</DetailDrawer>`
    };

    const template = componentTemplates[component_type] || `<div>${content}</div>`;
    
    const componentCode = `<template>
  ${template}
</template>

<script setup>
import { ${component_type} } from 'frappe-ui'
</script>`;

    return {
      content: [
        {
          type: "text",
          text: `Generated ${component_type} component:\n\n${componentCode}`
        }
      ]
    };
  }

  private async generateVuePage(args: any) {
    const { page_name, route, components = [] } = args;
    
    const pageCode = `<template>
  <div class="page">
    <h1>${page_name}</h1>
    ${components.map((comp: string) => `<${comp} />`).join('\n    ')}
  </div>
</template>

<script setup>
${components.map((comp: string) => `import ${comp} from '@/components/${comp}.vue'`).join('\n')}
</script>

<style scoped>
.page {
  padding: 1rem;
}
</style>`;

    return {
      content: [
        {
          type: "text",
          text: `Generated Vue page for route ${route}:\n\n${pageCode}`
        }
      ]
    };
  }

  private async getVueComponentTree(args: any) {
    const { page } = args;
    
    // Simulated component tree - in real implementation, this would inspect running Vue app
    const tree = {
      page,
      components: [
        { name: "Header", children: [] },
        { name: "Sidebar", children: [] },
        { name: "MainContent", children: [
          { name: "ListView", children: [] },
          { name: "DetailDrawer", children: [] }
        ]}
      ]
    };

    return {
      content: [
        {
          type: "text",
          text: `Component tree for ${page}:\n${JSON.stringify(tree, null, 2)}`
        }
      ]
    };
  }

  private async createUIBlock(args: any) {
    const { block_type, theme = "light", customization = "" } = args;

    const templates: { [key: string]: string } = {
      hero: `<div class="hero min-h-screen bg-base-200">
  <div class="hero-content text-center">
    <div class="max-w-md">
      <h1 class="text-5xl font-bold">Hello there</h1>
      <p class="py-6">Provident cupiditate voluptatem et in. Quaerat fugiat ut assumenda excepturi exercitationem quasi.</p>
      <Button>Get Started</Button>
    </div>
  </div>
</div>`,
      features: `<div class="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h3 class="card-title">Feature 1</h3>
      <p>Description of feature 1</p>
    </div>
  </div>
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h3 class="card-title">Feature 2</h3>
      <p>Description of feature 2</p>
    </div>
  </div>
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body">
      <h3 class="card-title">Feature 3</h3>
      <p>Description of feature 3</p>
    </div>
  </div>
</div>`,
      navbar: `<div class="navbar bg-base-100">
  <div class="navbar-start">
    <div class="dropdown">
      <div tabindex="0" role="button" class="btn btn-ghost lg:hidden">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16" />
        </svg>
      </div>
      <ul tabindex="0" class="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-52 p-2 shadow">
        <li><a>Item 1</a></li>
        <li><a>Item 2</a></li>
      </ul>
    </div>
    <a class="btn btn-ghost text-xl">App Name</a>
  </div>
  <div class="navbar-center hidden lg:flex">
    <ul class="menu menu-horizontal px-1">
      <li><a>Home</a></li>
      <li><a>About</a></li>
      <li><a>Contact</a></li>
    </ul>
  </div>
  <div class="navbar-end">
    <Button>Login</Button>
  </div>
</div>`,
      card: `<div class="card bg-base-100 shadow-xl">
  <figure><img src="/placeholder.jpg" alt="Card" /></figure>
  <div class="card-body">
    <h2 class="card-title">Card Title</h2>
    <p>Card description goes here</p>
    <div class="card-actions justify-end">
      <Button>View</Button>
    </div>
  </div>
</div>`,
      form: `<Form @submit="handleSubmit" class="space-y-4">
  <div>
    <label class="label">
      <span class="label-text">Name</span>
    </label>
    <input type="text" placeholder="Enter name" class="input input-bordered w-full" />
  </div>
  <div>
    <label class="label">
      <span class="label-text">Email</span>
    </label>
    <input type="email" placeholder="Enter email" class="input input-bordered w-full" />
  </div>
  <Button type="submit" class="w-full">Submit</Button>
</Form>`
    };

    const baseTemplate = templates[block_type] || `<div class="p-4 bg-base-100 rounded-lg">${block_type} block</div>`;
    
    let customizedTemplate = baseTemplate;
    if (theme === "dark") {
      customizedTemplate = customizedTemplate.replace(/bg-base-100/g, "bg-base-300").replace(/bg-base-200/g, "bg-base-400");
    }
    
    if (customization) {
      customizedTemplate += `\n<!-- Customizations: ${customization} -->`;
    }

    return {
      content: [
        {
          type: "text",
          text: `Generated ${block_type} UI block (${theme} theme):\n\n${customizedTemplate}`
        }
      ]
    };
  }

  private async inspireUIBlock(args: any) {
    const { inspiration, framework = "vue" } = args;

    // Generate creative UI based on inspiration
    const creativeTemplates: { [key: string]: string } = {
      "dashboard": `<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
  <div class="max-w-7xl mx-auto">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="stats shadow">
        <div class="stat">
          <div class="stat-title">Total Users</div>
          <div class="stat-value">89,400</div>
          <div class="stat-desc">↗︎ 400 (22%)</div>
        </div>
      </div>
      <div class="stats shadow">
        <div class="stat">
          <div class="stat-title">Revenue</div>
          <div class="stat-value">$89,400</div>
          <div class="stat-desc">↗︎ 400 (22%)</div>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Analytics Chart</h2>
          <div class="h-64 bg-gradient-to-r from-purple-200 to-pink-200 rounded-lg flex items-center justify-center">
            <span class="text-gray-500">Chart Placeholder</span>
          </div>
        </div>
      </div>
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">Recent Activity</h2>
          <div class="space-y-4">
            <div class="flex items-center space-x-4">
              <div class="avatar placeholder">
                <div class="bg-neutral text-neutral-content rounded-full w-8">
                  <span class="text-xs">U</span>
                </div>
              </div>
              <div>
                <p class="text-sm">User activity here</p>
                <p class="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`,
      "landing": `<div class="min-h-screen bg-gradient-to-b from-blue-600 to-purple-700">
  <div class="container mx-auto px-6 py-12">
    <div class="text-center text-white mb-16">
      <h1 class="text-6xl font-bold mb-6">Welcome to Innovation</h1>
      <p class="text-xl mb-8 opacity-90">Transform your workflow with cutting-edge technology</p>
      <div class="flex justify-center space-x-4">
        <Button class="bg-white text-blue-600 hover:bg-gray-100">Get Started</Button>
        <Button variant="outline" class="border-white text-white hover:bg-white hover:text-blue-600">Learn More</Button>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-white">
        <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
          <span class="text-2xl">🚀</span>
        </div>
        <h3 class="text-xl font-semibold mb-2">Fast Performance</h3>
        <p class="opacity-90">Lightning-fast loading and smooth interactions</p>
      </div>
      <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-white">
        <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
          <span class="text-2xl">🔒</span>
        </div>
        <h3 class="text-xl font-semibold mb-2">Secure & Reliable</h3>
        <p class="opacity-90">Enterprise-grade security you can trust</p>
      </div>
      <div class="bg-white/10 backdrop-blur-sm rounded-lg p-6 text-white">
        <div class="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
          <span class="text-2xl">🎨</span>
        </div>
        <h3 class="text-xl font-semibold mb-2">Beautiful Design</h3>
        <p class="opacity-90">Stunning visuals that engage your users</p>
      </div>
    </div>
  </div>
</div>`
    };

    // Try to match inspiration to a template
    let selectedTemplate = creativeTemplates.dashboard; // default
    if (inspiration.toLowerCase().includes("landing")) {
      selectedTemplate = creativeTemplates.landing;
    }

    return {
      content: [
        {
          type: "text",
          text: `Inspired UI block for "${inspiration}" (${framework}):\n\n${selectedTemplate}`
        }
      ]
    };
  }

  private async refineUIBlock(args: any) {
    const { existing_code, improvements } = args;

    // Simple refinement logic - in practice, this could use AI or pattern matching
    let refinedCode = existing_code;

    if (improvements.toLowerCase().includes("responsive")) {
      refinedCode = refinedCode.replace(/class="/g, 'class="md:');
    }

    if (improvements.toLowerCase().includes("dark")) {
      refinedCode = refinedCode.replace(/bg-base-100/g, "bg-base-300 dark:bg-base-100");
    }

    if (improvements.toLowerCase().includes("animation")) {
      refinedCode = refinedCode.replace(/class="/g, 'class="transition-all duration-300 ');
    }

    return {
      content: [
        {
          type: "text",
          text: `Refined UI block with improvements "${improvements}":\n\n${refinedCode}`
        }
      ]
    };
  }

  private async getUITemplates(args: any) {
    const { category = "all" } = args;

    const templates = {
      layout: ["hero", "navbar", "sidebar", "footer", "grid", "flex"],
      component: ["button", "card", "form", "modal", "dropdown", "tabs"],
      page: ["dashboard", "landing", "profile", "settings", "login"],
      all: ["hero", "navbar", "sidebar", "footer", "button", "card", "form", "dashboard", "landing"]
    };

    const selectedTemplates = category === "all" ? templates.all : templates[category as keyof typeof templates] || [];

    return {
      content: [
        {
          type: "text",
          text: `Available ${category} UI templates:\n${selectedTemplates.map(t => `- ${t}`).join('\n')}\n\nUse frappe_create_ui_block to generate these templates.`
        }
      ]
    };
  }

  private async getDirectoryStructure(dirPath: string, prefix = ""): Promise<string> {
    const items = await fs.readdir(dirPath);
    let structure = "";

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = await fs.stat(itemPath);

      structure += `${prefix}${stat.isDirectory() ? '📁' : '📄'} ${item}\n`;

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        structure += await this.getDirectoryStructure(itemPath, prefix + "  ");
      }
    }

    return structure;
  }

  async run() {
    const port = process.env.PORT || 3000;
    const app = express();

    // Don't use express body parsing for /message endpoint
    // The SSE transport expects raw streams

    // CORS middleware
    app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
      }
      next();
    });

    // SSE endpoint
    app.get('/sse', async (req, res) => {
      console.error("Got new SSE connection");
      try {
        const serverInstance = this.createServer();
        const transport = new SSEServerTransport('/message', res);

        // Set up connection handlers
        serverInstance.onclose = () => {
          console.error("MCP Server connection closed");
          this.servers = this.servers.filter((s) => s !== serverInstance);
        };

        this.servers.push(serverInstance);
        await serverInstance.connect(transport);
        
        console.error("SSE connection established with sessionId:", (transport as any).sessionId);
      } catch (error) {
        console.error("SSE connection failed:", error);
        if (!res.headersSent) {
          res.status(500).send('Internal Server Error');
        }
      }
    });

    // Message endpoint
    app.post('/message', async (req, res) => {
      try {
        console.error("Received message");
        const sessionId = req.query.sessionId as string;

        if (!sessionId) {
          console.error("Missing sessionId in POST request");
          res.status(400).send('Missing sessionId');
          return;
        }

        const transport = this.servers
          .map((s) => s.transport)
          .find((t) => (t as SSEServerTransport).sessionId === sessionId);

        if (!transport) {
          console.error("Session not found:", sessionId);
          console.error("Available sessions:", this.servers.map(s => (s.transport as SSEServerTransport).sessionId));
          res.status(404).send('Session not found');
          return;
        }

        await (transport as SSEServerTransport).handlePostMessage(req, res);
        console.error("Message handled successfully");
      } catch (error) {
        console.error("Message handling failed:", error);
        if (!res.headersSent) {
          res.status(500).send('Internal Server Error');
        }
      }
    });

    app.listen(port, () => {
      console.error(`Frappe MCP Server running on SSE at http://localhost:${port}/sse`);
    });
  }
}

// Start the server
const server = new FrappeMCPServer();
server.run().catch(console.error);