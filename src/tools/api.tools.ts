import * as fs from "fs-extra";
import * as path from "path";
import { ToolModule, ToolResult, ToolContext } from "../types.js";
import { getApiPath, getAppModulePath } from "../utils/paths.js";

export const apiTools: ToolModule = {
  definitions: [
    {
      name: "frappe_create_api_endpoint",
      description: "Create a custom whitelisted API endpoint for a Frappe app",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Name of the Frappe app" },
          endpoint_name: { type: "string", description: "Function name for the API endpoint" },
          method: { type: "string", enum: ["get", "post", "put", "delete"], default: "get", description: "HTTP method" },
          code: { type: "string", description: "Python code for the API endpoint body" },
          allow_guest: { type: "boolean", default: false, description: "Allow guest access" },
          methods: { type: "array", items: { type: "string", enum: ["GET", "POST", "PUT", "DELETE"] }, description: "Allowed HTTP methods (v16 method restrictions)" },
        },
        required: ["app_name", "endpoint_name", "code"],
      },
    },
    {
      name: "frappe_call_method",
      description: "Execute a whitelisted Frappe/ERPNext method via bench. Note: In v16, state-changing methods require POST.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", description: "Dotted method path" },
          args: { type: "object", description: "Method arguments" },
          site: { type: "string", description: "Site name (optional)" },
        },
        required: ["method"],
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_create_api_endpoint": {
        const { app_name, endpoint_name, method = "get", code, allow_guest = false, methods } = args;
        const apiPath = getApiPath(ctx.frappePath, app_name);
        await fs.ensureDir(apiPath);

        const initPath = path.join(apiPath, "__init__.py");
        if (!await fs.pathExists(initPath)) {
          await fs.writeFile(initPath, "");
        }

        const whitelistDecorator = allow_guest
          ? `@frappe.whitelist(allow_guest=True${methods ? `, methods=${JSON.stringify(methods)}` : ""})`
          : `@frappe.whitelist(${methods ? `methods=${JSON.stringify(methods)}` : ""})`;

        const apiCode = `# Copyright (c) ${new Date().getFullYear()}, ${app_name} contributors
# For license information, please see license.txt

import frappe
from frappe import _


${whitelistDecorator}
def ${endpoint_name}(**kwargs):
\t"""${endpoint_name} API endpoint (${method.toUpperCase()})"""
\ttry:
${code.split("\n").map((line: string) => "\t\t" + line).join("\n")}
\texcept Exception as e:
\t\tfrappe.log_error(f"Error in ${endpoint_name}: {str(e)}")
\t\tfrappe.throw(_("An error occurred while processing your request"))
`;

        await fs.writeFile(path.join(apiPath, `${endpoint_name}.py`), apiCode);

        return {
          content: [{ type: "text", text: `API endpoint "${endpoint_name}" created at ${app_name}/${app_name}/api/${endpoint_name}.py\nCall via: /api/method/${app_name}.api.${endpoint_name}.${endpoint_name}` }],
        };
      }
      case "frappe_call_method": {
        const command = `execute ${args.method} --args '${JSON.stringify(args.args || {})}'`;
        return await ctx.runBenchCommand({ command, site: args.site });
      }
      default:
        return null;
    }
  },
};
