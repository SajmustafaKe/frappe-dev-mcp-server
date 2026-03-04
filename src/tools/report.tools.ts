import * as fs from "fs-extra";
import * as path from "path";
import { ToolModule, ToolResult, ToolContext } from "../types.js";
import { getModulePath, toSnakeCase } from "../utils/paths.js";
import { ensureAndWrite } from "../utils/files.js";

export const reportTools: ToolModule = {
  definitions: [
    {
      name: "frappe_list_reports",
      description: "List all available reports, optionally filtered by type or DocType",
      inputSchema: {
        type: "object",
        properties: {
          report_type: { type: "string", enum: ["Report Builder", "Script Report", "Query Report", "Custom"], description: "Filter by report type" },
          ref_doctype: { type: "string", description: "Filter by reference DocType" },
          site: { type: "string" },
        },
      },
    },
    {
      name: "frappe_run_query_report",
      description: "Execute a Frappe query report with filters",
      inputSchema: {
        type: "object",
        properties: {
          report_name: { type: "string", description: "Report name" },
          filters: { type: "object", description: "Report filters" },
          site: { type: "string" },
        },
        required: ["report_name"],
      },
    },
    {
      name: "frappe_get_report_meta",
      description: "Get metadata for a Frappe report (columns, filters, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          report_name: { type: "string", description: "Report name" },
          site: { type: "string" },
        },
        required: ["report_name"],
      },
    },
    {
      name: "frappe_run_doctype_report",
      description: "Generate a quick report based on a DocType listing with filters",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          filters: { type: "object", description: "Filter conditions" },
          fields: { type: "array", items: { type: "string" }, description: "Fields to include" },
          order_by: { type: "string", description: "Sort expression" },
          limit: { type: "number", default: 100 },
          site: { type: "string" },
        },
        required: ["doctype"],
      },
    },
    {
      name: "frappe_get_financial_statements",
      description: "Get financial statements (Profit & Loss, Balance Sheet, Cash Flow) from ERPNext",
      inputSchema: {
        type: "object",
        properties: {
          statement_type: { type: "string", enum: ["Profit and Loss", "Balance Sheet", "Cash Flow"], description: "Type of financial statement" },
          company: { type: "string", description: "Company name" },
          fiscal_year: { type: "string", description: "Fiscal year" },
          site: { type: "string" },
        },
        required: ["statement_type", "company", "fiscal_year"],
      },
    },
    {
      name: "frappe_create_script_report",
      description: "Create a Script Report with Python data generation and optional JS client-side script",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
          module: { type: "string", description: "Module name" },
          report_name: { type: "string", description: "Report name" },
          ref_doctype: { type: "string", description: "Reference DocType" },
          columns: {
            type: "array",
            description: "Report column definitions",
            items: {
              type: "object",
              properties: {
                fieldname: { type: "string" },
                label: { type: "string" },
                fieldtype: { type: "string" },
                width: { type: "number" },
                options: { type: "string" },
              },
              required: ["fieldname", "label", "fieldtype"],
            },
          },
          filters: {
            type: "array",
            description: "Report filter definitions",
            items: {
              type: "object",
              properties: {
                fieldname: { type: "string" },
                label: { type: "string" },
                fieldtype: { type: "string" },
                options: { type: "string" },
                default: { type: "string" },
                reqd: { type: "boolean" },
              },
              required: ["fieldname", "label", "fieldtype"],
            },
          },
          python_code: { type: "string", description: "Python code for the execute() function body" },
          js_code: { type: "string", description: "Optional JavaScript for client-side filters" },
        },
        required: ["app_name", "module", "report_name", "ref_doctype", "columns"],
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_list_reports": {
        const filters: any = {};
        if (args.report_type) filters.report_type = args.report_type;
        if (args.ref_doctype) filters.ref_doctype = args.ref_doctype;
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_list --args '${JSON.stringify(["Report", filters])}'`,
          site: args.site,
        });
      }

      case "frappe_run_query_report":
        return await ctx.runBenchCommand({
          command: `execute frappe.desk.query_report.run --args '${JSON.stringify([args.report_name, args.filters || {}])}'`,
          site: args.site,
        });

      case "frappe_get_report_meta":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_doc --args '${JSON.stringify(["Report", args.report_name])}'`,
          site: args.site,
        });

      case "frappe_run_doctype_report": {
        const listArgs: any = [args.doctype, args.filters || {}];
        if (args.fields) listArgs.push(args.fields);
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_list --args '${JSON.stringify(listArgs)}'`,
          site: args.site,
        });
      }

      case "frappe_get_financial_statements": {
        const methodMap: Record<string, string> = {
          "Profit and Loss": "erpnext.accounts.report.profit_and_loss_statement.profit_and_loss_statement.get_data",
          "Balance Sheet": "erpnext.accounts.report.balance_sheet.balance_sheet.get_data",
          "Cash Flow": "erpnext.accounts.report.cash_flow_statement.cash_flow_statement.get_data",
        };
        const method = methodMap[args.statement_type];
        if (!method) {
          return { content: [{ type: "text", text: `Unknown statement type: ${args.statement_type}` }] };
        }
        return await ctx.runBenchCommand({
          command: `execute ${method} --args '${JSON.stringify({ company: args.company, fiscal_year: args.fiscal_year })}'`,
          site: args.site,
        });
      }

      case "frappe_create_script_report": {
        const { app_name, module, report_name, ref_doctype, columns, filters, python_code, js_code } = args;
        const reportSnake = toSnakeCase(report_name);
        const reportPath = path.join(
          getModulePath(ctx.frappePath, app_name, module),
          "report",
          reportSnake
        );

        await fs.ensureDir(reportPath);
        await fs.writeFile(path.join(reportPath, "__init__.py"), "");

        // Report JSON
        const reportJson = {
          name: report_name,
          doctype: "Report",
          ref_doctype,
          report_type: "Script Report",
          is_standard: "Yes",
          module,
        };
        await fs.writeJson(path.join(reportPath, `${reportSnake}.json`), reportJson, { spaces: 2 });

        // Python file
        const columnsStr = columns.map((c: any) =>
          `\t\t{"fieldname": "${c.fieldname}", "label": _("${c.label}"), "fieldtype": "${c.fieldtype}", "width": ${c.width || 150}${c.options ? `, "options": "${c.options}"` : ""}}`
        ).join(",\n");

        const filtersStr = filters
          ? filters.map((f: any) =>
              `\t\t{"fieldname": "${f.fieldname}", "label": _("${f.label}"), "fieldtype": "${f.fieldtype}"${f.options ? `, "options": "${f.options}"` : ""}${f.default ? `, "default": "${f.default}"` : ""}${f.reqd ? ', "reqd": 1' : ""}}`
            ).join(",\n")
          : "";

        const pyCode = `# Copyright (c) ${new Date().getFullYear()}, ${app_name} contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
\tcolumns = [
${columnsStr}
\t]

\tdata = get_data(filters)

\treturn columns, data


def get_data(filters):
${python_code ? python_code.split("\n").map((l: string) => "\t" + l).join("\n") : "\tdata = []\n\treturn data"}
`;

        await fs.writeFile(path.join(reportPath, `${reportSnake}.py`), pyCode);

        // JS file (optional)
        if (js_code || filters) {
          const jsFiltersStr = filters
            ? filters.map((f: any) => {
                let filter = `\t\t{\n\t\t\tfieldname: "${f.fieldname}",\n\t\t\tlabel: __("${f.label}"),\n\t\t\tfieldtype: "${f.fieldtype}"`;
                if (f.options) filter += `,\n\t\t\toptions: "${f.options}"`;
                if (f.default) filter += `,\n\t\t\tdefault: "${f.default}"`;
                if (f.reqd) filter += `,\n\t\t\treqd: 1`;
                filter += `\n\t\t}`;
                return filter;
              }).join(",\n")
            : "";

          const jsContent = `// Copyright (c) ${new Date().getFullYear()}, ${app_name} contributors
// For license information, please see license.txt

frappe.query_reports["${report_name}"] = {
\tfilters: [
${jsFiltersStr}
\t],
${js_code ? "\t" + js_code : ""}
};
`;

          await fs.writeFile(path.join(reportPath, `${reportSnake}.js`), jsContent);
        }

        return { content: [{ type: "text", text: `Script Report "${report_name}" created at ${reportPath}\nFiles: ${reportSnake}.json, ${reportSnake}.py${js_code || filters ? `, ${reportSnake}.js` : ""}` }] };
      }

      default:
        return null;
    }
  },
};
