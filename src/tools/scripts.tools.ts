import * as fs from "fs-extra";
import * as path from "path";
import { ToolModule, ToolResult, ToolContext } from "../types.js";
import { toSnakeCase, getDoctypePath } from "../utils/paths.js";
import { ensureAndWrite } from "../utils/files.js";

export const scriptsTools: ToolModule = {
  definitions: [
    {
      name: "frappe_create_server_script",
      description: "Create a Server Script (DocType Event, API, Permission Query, or Scheduled) directly in Frappe's database",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Script name" },
          script_type: { type: "string", enum: ["DocType Event", "API", "Permission Query", "Scheduler Event"], description: "Type of server script" },
          doctype_event: { type: "string", enum: ["Before Insert", "Before Validate", "Before Save", "After Insert", "After Save", "Before Submit", "After Submit", "Before Cancel", "After Cancel", "After Delete", "Before Delete"], description: "Document event (for DocType Event type)" },
          reference_doctype: { type: "string", description: "DocType to attach event to" },
          api_method: { type: "string", description: "API method name (for API type)" },
          event_frequency: { type: "string", enum: ["All", "Hourly", "Daily", "Weekly", "Monthly", "Yearly", "Hourly Long", "Daily Long", "Weekly Long", "Monthly Long", "Cron"], description: "Frequency (for Scheduler Event type)" },
          cron_format: { type: "string", description: "Cron expression (if frequency is Cron)" },
          script: { type: "string", description: "Python script code" },
          allow_guest: { type: "boolean", default: false, description: "Allow guest access (API type only)" },
          disabled: { type: "boolean", default: false },
          site: { type: "string" },
        },
        required: ["name", "script_type", "script"],
      },
    },
    {
      name: "frappe_create_client_script",
      description: "Create a Client Script (custom JavaScript form script) for a DocType",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Script name" },
          dt: { type: "string", description: "DocType to attach script to" },
          view: { type: "string", enum: ["Form", "List", "Report"], default: "Form", description: "View type" },
          script: { type: "string", description: "JavaScript code" },
          enabled: { type: "boolean", default: true },
          site: { type: "string" },
        },
        required: ["name", "dt", "script"],
      },
    },
    {
      name: "frappe_create_controller_method",
      description: "Add a controller method (Python) to an existing DocType's controller file. Common methods: validate, before_save, after_insert, on_submit, on_cancel, on_update_after_submit, before_naming, autoname.",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
          module: { type: "string", description: "Module name" },
          doctype_name: { type: "string", description: "DocType name" },
          method_name: { type: "string", description: "Method name (e.g., 'validate', 'before_save')" },
          code: { type: "string", description: "Python method body (indented with tabs)" },
          decorator: { type: "string", description: "Optional decorator (e.g., 'frappe.whitelist()')" },
        },
        required: ["app_name", "module", "doctype_name", "method_name", "code"],
      },
    },
    {
      name: "frappe_create_form_js",
      description: "Create or update a DocType's form JavaScript file (.js) for client-side customization",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
          module: { type: "string", description: "Module name" },
          doctype_name: { type: "string", description: "DocType name" },
          events: {
            type: "object",
            description: "Map of event name to JavaScript code. Events: setup, refresh, onload, validate, before_save, after_save, on_submit, before_submit, etc.",
            additionalProperties: { type: "string" },
          },
          custom_buttons: {
            type: "array",
            description: "Custom buttons to add to the form",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                group: { type: "string", description: "Button group (optional)" },
                action: { type: "string", description: "JavaScript code for button action" },
              },
              required: ["label", "action"],
            },
          },
        },
        required: ["app_name", "module", "doctype_name"],
      },
    },
    {
      name: "frappe_create_list_js",
      description: "Create a DocType's list view JavaScript file for list view customization",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
          module: { type: "string", description: "Module name" },
          doctype_name: { type: "string", description: "DocType name" },
          onload_code: { type: "string", description: "JavaScript code for onload event" },
          formatters: { type: "object", description: "Field formatters: { fieldname: 'js code returning formatted value' }", additionalProperties: { type: "string" } },
          button: { type: "object", properties: { label: { type: "string" }, action: { type: "string" }, primary: { type: "boolean" } }, description: "Add a list view button" },
          indicators: { type: "string", description: "JavaScript code for get_indicator function" },
        },
        required: ["app_name", "module", "doctype_name"],
      },
    },
    {
      name: "frappe_list_server_scripts",
      description: "List all Server Scripts",
      inputSchema: {
        type: "object",
        properties: {
          script_type: { type: "string", enum: ["DocType Event", "API", "Permission Query", "Scheduler Event"], description: "Filter by type" },
          site: { type: "string" },
        },
      },
    },
    {
      name: "frappe_list_client_scripts",
      description: "List all Client Scripts",
      inputSchema: {
        type: "object",
        properties: {
          dt: { type: "string", description: "Filter by DocType" },
          site: { type: "string" },
        },
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_create_server_script": {
        const data: any = {
          doctype: "Server Script",
          name: args.name,
          script_type: args.script_type,
          script: args.script,
          disabled: args.disabled ? 1 : 0,
        };
        if (args.script_type === "DocType Event") {
          data.reference_doctype = args.reference_doctype;
          data.doctype_event = args.doctype_event;
        } else if (args.script_type === "API") {
          data.api_method = args.api_method;
          data.allow_guest = args.allow_guest ? 1 : 0;
        } else if (args.script_type === "Scheduler Event") {
          data.event_frequency = args.event_frequency;
          if (args.cron_format) data.cron_format = args.cron_format;
        } else if (args.script_type === "Permission Query") {
          data.reference_doctype = args.reference_doctype;
        }
        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }

      case "frappe_create_client_script": {
        const data = {
          doctype: "Client Script",
          name: args.name,
          dt: args.dt,
          view: args.view || "Form",
          script: args.script,
          enabled: args.enabled !== false ? 1 : 0,
        };
        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }

      case "frappe_create_controller_method": {
        const snakeName = toSnakeCase(args.doctype_name);
        const ctrlPath = path.join(
          getDoctypePath(ctx.frappePath, args.app_name, args.module, args.doctype_name),
          `${snakeName}.py`
        );

        let content: string;
        try {
          content = await fs.readFile(ctrlPath, "utf8");
        } catch {
          return { content: [{ type: "text", text: `Controller file not found: ${ctrlPath}` }] };
        }

        const decorator = args.decorator ? `\t@${args.decorator}\n` : "";
        const method = `\n${decorator}\tdef ${args.method_name}(self):\n${args.code.split("\n").map((l: string) => "\t\t" + l).join("\n")}\n`;

        // Append before the end of the class
        const lastPassIdx = content.lastIndexOf("\tpass");
        if (lastPassIdx > -1) {
          content = content.slice(0, lastPassIdx) + method + content.slice(lastPassIdx + 5);
        } else {
          content += method;
        }

        await fs.writeFile(ctrlPath, content);
        return { content: [{ type: "text", text: `Added method "${args.method_name}" to ${ctrlPath}` }] };
      }

      case "frappe_create_form_js": {
        const snakeName = toSnakeCase(args.doctype_name);
        const jsPath = path.join(
          getDoctypePath(ctx.frappePath, args.app_name, args.module, args.doctype_name),
          `${snakeName}.js`
        );

        let eventCode = "";
        if (args.events) {
          eventCode = Object.entries(args.events as Record<string, string>)
            .map(([event, code]) => `\t${event}(frm) {\n\t\t${code}\n\t}`)
            .join(",\n\n");
        }

        let buttonCode = "";
        if (args.custom_buttons && args.custom_buttons.length > 0) {
          const buttons = args.custom_buttons.map((btn: any) => {
            const group = btn.group ? `, __('${btn.group}')` : "";
            return `\t\tfrm.add_custom_button(__('${btn.label}'), function() {\n\t\t\t${btn.action}\n\t\t}${group});`;
          }).join("\n");

          if (eventCode.includes("refresh(frm)")) {
            // Inject button code into refresh
            eventCode = eventCode.replace("refresh(frm) {\n\t\t", `refresh(frm) {\n${buttons}\n\t\t`);
          } else {
            const refreshEvent = `\trefresh(frm) {\n${buttons}\n\t}`;
            eventCode = eventCode ? `${refreshEvent},\n\n${eventCode}` : refreshEvent;
          }
        }

        const jsCode = `// Copyright (c) ${new Date().getFullYear()}, ${args.app_name} contributors
// For license information, please see license.txt

frappe.ui.form.on('${args.doctype_name}', {
${eventCode}
});
`;

        await ensureAndWrite(jsPath, jsCode);
        return { content: [{ type: "text", text: `Created form JS at ${jsPath}` }] };
      }

      case "frappe_create_list_js": {
        const snakeName = toSnakeCase(args.doctype_name);
        const jsPath = path.join(
          getDoctypePath(ctx.frappePath, args.app_name, args.module, args.doctype_name),
          `${snakeName}_list.js`
        );

        let body = "";
        if (args.onload_code) body += `\tonload(listview) {\n\t\t${args.onload_code}\n\t},\n`;

        if (args.formatters) {
          const fmts = Object.entries(args.formatters as Record<string, string>)
            .map(([field, code]) => `\t\t${field}(val, d, f) {\n\t\t\t${code}\n\t\t}`)
            .join(",\n");
          body += `\tformatters: {\n${fmts}\n\t},\n`;
        }

        if (args.button) {
          body += `\tbutton: {\n\t\tshow(doc) { return true; },\n\t\tget_label() { return __('${args.button.label}'); },\n\t\tget_description(doc) { return ''; },\n\t\taction(doc) { ${args.button.action} },\n\t\tprimary: ${args.button.primary || false},\n\t},\n`;
        }

        if (args.indicators) {
          body += `\tget_indicator(doc) {\n\t\t${args.indicators}\n\t},\n`;
        }

        const jsCode = `frappe.listview_settings['${args.doctype_name}'] = {\n${body}};\n`;

        await ensureAndWrite(jsPath, jsCode);
        return { content: [{ type: "text", text: `Created list JS at ${jsPath}` }] };
      }

      case "frappe_list_server_scripts": {
        const filters: any = {};
        if (args.script_type) filters.script_type = args.script_type;
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_list --args '${JSON.stringify(["Server Script", filters])}'`,
          site: args.site,
        });
      }

      case "frappe_list_client_scripts": {
        const filters: any = {};
        if (args.dt) filters.dt = args.dt;
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_list --args '${JSON.stringify(["Client Script", filters])}'`,
          site: args.site,
        });
      }

      default:
        return null;
    }
  },
};
