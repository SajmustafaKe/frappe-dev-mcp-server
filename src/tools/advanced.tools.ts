import * as fs from "fs-extra";
import * as path from "path";
import { ToolModule, ToolResult, ToolContext } from "../types.js";
import { getModulePath, getDoctypePath, toSnakeCase, toPascalCase, getAppModulePath } from "../utils/paths.js";
import { ensureAndWrite } from "../utils/files.js";

export const advancedTools: ToolModule = {
  definitions: [
    {
      name: "frappe_create_virtual_doctype",
      description: "Create a Virtual DocType (no database table, data from external source or computed). Common in v16 for API-backed data.",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
          doctype_name: { type: "string", description: "Virtual DocType name" },
          module: { type: "string", description: "Module name" },
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                fieldname: { type: "string" },
                label: { type: "string" },
                fieldtype: { type: "string" },
                options: { type: "string" },
                in_list_view: { type: "boolean" },
              },
              required: ["fieldname", "label", "fieldtype"],
            },
          },
          get_list_code: { type: "string", description: "Python code for get_list() class method" },
          get_count_code: { type: "string", description: "Python code for get_count() class method" },
          get_one_code: { type: "string", description: "Python code for get_doc() to load a single record" },
        },
        required: ["app_name", "doctype_name", "module", "fields"],
      },
    },
    {
      name: "frappe_create_module_def",
      description: "Create a Module Definition for a Frappe app",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
          module_name: { type: "string", description: "Module name" },
          module_label: { type: "string", description: "Display label" },
          color: { type: "string", description: "Module color" },
          icon: { type: "string", description: "Module icon" },
        },
        required: ["app_name", "module_name"],
      },
    },
    {
      name: "frappe_create_test",
      description: "Create a test file (unit + integration) for a DocType using Frappe v16 test patterns",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
          module: { type: "string", description: "Module name" },
          doctype_name: { type: "string", description: "DocType name" },
          test_cases: {
            type: "array",
            description: "Test case definitions",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Test method name" },
                type: { type: "string", enum: ["unit", "integration"], default: "integration" },
                code: { type: "string", description: "Test method body" },
              },
              required: ["name", "code"],
            },
          },
          test_records: {
            type: "array",
            description: "Test record data for fixtures",
            items: { type: "object" },
          },
        },
        required: ["app_name", "module", "doctype_name"],
      },
    },
    {
      name: "frappe_run_tests",
      description: "Run tests for a Frappe app, module, or specific DocType",
      inputSchema: {
        type: "object",
        properties: {
          app: { type: "string", description: "App to test" },
          module: { type: "string", description: "Module to test" },
          doctype: { type: "string", description: "DocType to test" },
          test: { type: "string", description: "Specific test file path" },
          verbose: { type: "boolean", default: false },
          failfast: { type: "boolean", default: false },
          site: { type: "string" },
        },
      },
    },
    {
      name: "frappe_create_document_naming",
      description: "Configure document naming rules (Naming Series, autoname patterns, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          naming_rule: { type: "string", enum: ["Set by user", "Autoincrement", "By fieldname", "By Naming Series", "Expression", "Random", "By script"] },
          autoname: { type: "string", description: "Autoname expression (e.g., 'INV-.YYYY.-.#####', 'field:customer_name', 'naming_series:', 'format:ORD-{customer}-{####}')" },
          site: { type: "string" },
        },
        required: ["doctype", "naming_rule"],
      },
    },
    {
      name: "frappe_get_frappe_usage_info",
      description: "Get comprehensive Frappe development information: version, installed apps, DocType stats, API endpoints, and development tips",
      inputSchema: {
        type: "object",
        properties: {
          site: { type: "string", description: "Site name (optional)" },
        },
      },
    },
    {
      name: "frappe_create_page",
      description: "Create a custom Desk Page (single-page application within the desk). In v16, pages JS is evaluated as IIFE.",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
          module: { type: "string", description: "Module name" },
          page_name: { type: "string", description: "Page name" },
          title: { type: "string", description: "Page title" },
          icon: { type: "string", description: "Page icon" },
          js_code: { type: "string", description: "Page JavaScript code" },
          css_code: { type: "string", description: "Page CSS code" },
          html_code: { type: "string", description: "Page HTML template" },
        },
        required: ["app_name", "module", "page_name", "title"],
      },
    },
    {
      name: "frappe_create_doctype_dashboard",
      description: "Create a DocType dashboard configuration showing connections, charts, and related documents",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
          module: { type: "string", description: "Module name" },
          doctype_name: { type: "string", description: "DocType name" },
          transactions: {
            type: "array",
            description: "Transaction groups (connections to other DocTypes)",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                items: { type: "array", items: { type: "string" } },
              },
              required: ["label", "items"],
            },
          },
          heatmap: { type: "boolean", default: false, description: "Show heatmap" },
          heatmap_message: { type: "string" },
          fieldname: { type: "string", description: "Link field name in connected DocTypes" },
          non_standard_fieldnames: {
            type: "object",
            description: "Map of DocType to custom link field name",
            additionalProperties: { type: "string" },
          },
        },
        required: ["app_name", "module", "doctype_name", "transactions"],
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_create_virtual_doctype": {
        const snakeName = toSnakeCase(args.doctype_name);
        const pascalName = toPascalCase(args.doctype_name);
        const doctypePath = path.join(
          getModulePath(ctx.frappePath, args.app_name, args.module),
          "doctype",
          snakeName
        );

        await fs.ensureDir(doctypePath);

        const doctypeJson = {
          name: args.doctype_name,
          doctype: "DocType",
          module: args.module,
          custom: 0,
          is_virtual: 1,
          fields: args.fields.map((f: any, idx: number) => ({
            fieldname: f.fieldname,
            label: f.label,
            fieldtype: f.fieldtype,
            options: f.options || "",
            in_list_view: f.in_list_view ? 1 : 0,
            idx: idx + 1,
          })),
          permissions: [{ role: "System Manager", read: 1, write: 1, create: 1, delete: 1 }],
        };

        await fs.writeJson(path.join(doctypePath, `${snakeName}.json`), doctypeJson, { spaces: 2 });

        const pyCode = `# Copyright (c) ${new Date().getFullYear()}, ${args.app_name} contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ${pascalName}(Document):
\t"""Virtual DocType - data not stored in database."""

\t@staticmethod
\tdef get_list(args):
\t\t"""Return list of records."""
${args.get_list_code ? args.get_list_code.split("\n").map((l: string) => "\t\t" + l).join("\n") : "\t\treturn []"}

\t@staticmethod
\tdef get_count(args):
\t\t"""Return count of records."""
${args.get_count_code ? args.get_count_code.split("\n").map((l: string) => "\t\t" + l).join("\n") : "\t\treturn 0"}

\tdef db_insert(self, *args, **kwargs):
\t\tpass

\tdef db_update(self):
\t\tpass

\tdef load_from_db(self):
\t\t"""Load a single record."""
${args.get_one_code ? args.get_one_code.split("\n").map((l: string) => "\t\t" + l).join("\n") : "\t\tpass"}

\tdef delete(self):
\t\tpass
`;

        await fs.writeFile(path.join(doctypePath, `${snakeName}.py`), pyCode);
        await fs.writeFile(path.join(doctypePath, "__init__.py"), "");

        return { content: [{ type: "text", text: `Virtual DocType "${args.doctype_name}" created at ${doctypePath}\nImplement get_list(), get_count(), and load_from_db() to provide data.` }] };
      }

      case "frappe_create_module_def": {
        const { app_name, module_name, module_label, color, icon } = args;
        const modulePath = getModulePath(ctx.frappePath, app_name, module_name);
        await fs.ensureDir(modulePath);

        const initPath = path.join(modulePath, "__init__.py");
        if (!await fs.pathExists(initPath)) {
          await fs.writeFile(initPath, "");
        }

        // Create module.json
        const moduleJson = {
          module_name: module_name,
          label: module_label || module_name,
          color: color || "",
          icon: icon || "",
          type: "module",
          app: app_name,
        };

        // Add to modules.txt
        const modulesTxtPath = path.join(getAppModulePath(ctx.frappePath, app_name), "modules.txt");
        let modulesTxt = "";
        try {
          modulesTxt = await fs.readFile(modulesTxtPath, "utf8");
        } catch {}

        if (!modulesTxt.includes(module_name)) {
          modulesTxt += `${module_name}\n`;
          await fs.writeFile(modulesTxtPath, modulesTxt);
        }

        return { content: [{ type: "text", text: `Module "${module_name}" created at ${modulePath} and registered in modules.txt` }] };
      }

      case "frappe_create_test": {
        const { app_name, module, doctype_name, test_cases, test_records } = args;
        const snakeName = toSnakeCase(doctype_name);
        const pascalName = toPascalCase(doctype_name);
        const testPath = path.join(
          getDoctypePath(ctx.frappePath, app_name, module, doctype_name),
          `test_${snakeName}.py`
        );

        const unitTests = (test_cases || [])
          .filter((t: any) => t.type === "unit")
          .map((t: any) => `\tdef test_${t.name}(self):\n${t.code.split("\n").map((l: string) => "\t\t" + l).join("\n")}\n`)
          .join("\n");

        const integrationTests = (test_cases || [])
          .filter((t: any) => t.type !== "unit")
          .map((t: any) => `\tdef test_${t.name}(self):\n${t.code.split("\n").map((l: string) => "\t\t" + l).join("\n")}\n`)
          .join("\n");

        const testCode = `# Copyright (c) ${new Date().getFullYear()}, ${app_name} contributors
# For license information, please see license.txt

import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase


class UnitTest${pascalName}(UnitTestCase):
\t"""Unit tests for ${doctype_name}."""
${unitTests || "\tpass\n"}

class TestIntegration${pascalName}(IntegrationTestCase):
\t"""Integration tests for ${doctype_name}."""
${integrationTests || "\tpass\n"}
`;

        await ensureAndWrite(testPath, testCode);

        // Write test records if provided
        if (test_records && test_records.length > 0) {
          const recordsPath = path.join(
            getDoctypePath(ctx.frappePath, app_name, module, doctype_name),
            `test_${snakeName}.json`
          );
          await fs.writeJson(recordsPath, test_records, { spaces: 2 });
        }

        return { content: [{ type: "text", text: `Test file created at ${testPath}\nUnit tests: ${unitTests ? "yes" : "none"}\nIntegration tests: ${integrationTests ? "yes" : "none"}` }] };
      }

      case "frappe_run_tests": {
        let cmd = "run-tests";
        if (args.app) cmd += ` --app ${args.app}`;
        if (args.module) cmd += ` --module ${args.module}`;
        if (args.doctype) cmd += ` --doctype "${args.doctype}"`;
        if (args.test) cmd += ` --test ${args.test}`;
        if (args.verbose) cmd += " --verbose";
        if (args.failfast) cmd += " --failfast";
        return await ctx.runBenchCommand({ command: cmd, site: args.site });
      }

      case "frappe_create_document_naming":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.set_value --args '${JSON.stringify(["DocType", args.doctype, { naming_rule: args.naming_rule, autoname: args.autoname || "" }])}'`,
          site: args.site,
        });

      case "frappe_get_frappe_usage_info": {
        const usage = {
          framework: "Frappe Framework v16",
          key_changes_v16: [
            "Default sort changed from 'modified' to 'creation'",
            "has_permission hooks must explicitly return True",
            "State-changing whitelisted methods require POST",
            "Redesigned Workspace with persistent sidebar",
            "~2x performance improvement (Frappe Caffeine)",
            "Role-based field masking",
            "JS evaluated as IIFEs (no global scope pollution)",
            "frappe.sendmail(now=True) no longer commits transactions",
          ],
          common_doctypes: ["User", "DocType", "Role", "Custom Field", "Property Setter", "Notification", "Workflow", "Server Script", "Client Script"],
          api_endpoints: ["/api/resource/{doctype}", "/api/method/{method}", "/api/resource/{doctype}/{name}"],
          development_tips: [
            "Use frappe.client for CRUD operations",
            "DocTypes define data models with JSON + Python controller",
            "hooks.py is the central configuration for app behavior",
            "Server Scripts for no-code automation",
            "Client Scripts for UI customization without app changes",
            "Custom Fields to extend third-party DocTypes",
            "Property Setters to modify field properties",
            "Fixtures for exportable configuration",
            "patches.txt for database migration scripts",
          ],
        };
        return { content: [{ type: "text", text: `Frappe Development Info:\n${JSON.stringify(usage, null, 2)}` }] };
      }

      case "frappe_create_page": {
        const { app_name, module, page_name, title, icon, js_code, css_code, html_code } = args;
        const pageSnake = toSnakeCase(page_name);
        const pagePath = path.join(getModulePath(ctx.frappePath, app_name, module), "page", pageSnake);

        await fs.ensureDir(pagePath);
        await fs.writeFile(path.join(pagePath, "__init__.py"), "");

        const pageJson = {
          name: page_name,
          doctype: "Page",
          module,
          title,
          icon: icon || "",
          standard: "Yes",
        };
        await fs.writeJson(path.join(pagePath, `${pageSnake}.json`), pageJson, { spaces: 2 });

        // v16: Pages are evaluated as IIFEs
        const jsContent = js_code || `frappe.pages['${page_name}'] = {
\tsetup: function(wrapper) {
\t\tlet page = frappe.ui.make_app_page({
\t\t\tparent: wrapper,
\t\t\ttitle: '${title}',
\t\t\tsingle_column: true
\t\t});
\t}
};`;
        await fs.writeFile(path.join(pagePath, `${pageSnake}.js`), jsContent);

        if (css_code) {
          await fs.writeFile(path.join(pagePath, `${pageSnake}.css`), css_code);
        }

        const htmlContent = html_code || `<div class="page-content">\n\t<!-- Page content -->\n</div>`;
        await fs.writeFile(path.join(pagePath, `${pageSnake}.html`), htmlContent);

        return { content: [{ type: "text", text: `Page "${page_name}" created at ${pagePath}\nAccess via: /app/${pageSnake}` }] };
      }

      case "frappe_create_doctype_dashboard": {
        const { app_name, module, doctype_name, transactions, heatmap, heatmap_message, fieldname, non_standard_fieldnames } = args;
        const snakeName = toSnakeCase(doctype_name);
        const dashboardPath = path.join(
          getDoctypePath(ctx.frappePath, app_name, module, doctype_name),
          `${snakeName}_dashboard.py`
        );

        const txnStr = transactions.map((t: any) =>
          `\t\t{"label": _("${t.label}"), "items": ${JSON.stringify(t.items)}}`
        ).join(",\n");

        const dashCode = `from frappe import _


def get_data():
\treturn {
\t\t"fieldname": "${fieldname || toSnakeCase(doctype_name)}",
${heatmap ? `\t\t"heatmap": True,\n\t\t"heatmap_message": _("${heatmap_message || ""}"),\n` : ""}\
${non_standard_fieldnames ? `\t\t"non_standard_fieldnames": ${JSON.stringify(non_standard_fieldnames)},\n` : ""}\
\t\t"transactions": [
${txnStr}
\t\t]
\t}
`;

        await ensureAndWrite(dashboardPath, dashCode);
        return { content: [{ type: "text", text: `DocType dashboard created at ${dashboardPath}` }] };
      }

      default:
        return null;
    }
  },
};
