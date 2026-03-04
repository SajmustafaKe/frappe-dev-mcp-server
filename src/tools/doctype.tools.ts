import * as fs from "fs-extra";
import * as path from "path";
import { ToolModule, ToolResult, ToolContext } from "../types.js";
import { toSnakeCase, toPascalCase } from "../utils/paths.js";

const FIELD_TYPES = [
  "Data", "Int", "Float", "Currency", "Date", "Datetime", "Time",
  "Text", "Small Text", "Long Text", "Text Editor", "HTML Editor", "Markdown Editor", "Code",
  "Check", "Select", "Link", "Dynamic Link", "Table", "Table MultiSelect",
  "Attach", "Attach Image", "Image",
  "Password", "Read Only", "Autocomplete",
  "Barcode", "Geolocation", "Color", "Rating", "Duration", "Icon",
  "Phone", "JSON",
  "Section Break", "Column Break", "Tab Break", "Heading",
  "HTML", "Fold",
  "Signature",
];

export const doctypeTools: ToolModule = {
  definitions: [
    {
      name: "frappe_create_doctype",
      description: "Create a new Frappe DocType with JSON definition and Python controller. Supports all v16 field types including Tab Break, Dynamic Link, Table MultiSelect, Geolocation, JSON, etc.",
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
                fieldtype: { type: "string", enum: FIELD_TYPES },
                reqd: { type: "boolean", default: false },
                unique: { type: "boolean", default: false },
                options: { type: "string", description: "Options for Select/Link/Dynamic Link fields" },
                default: { type: "string", description: "Default value" },
                in_list_view: { type: "boolean", default: false },
                in_standard_filter: { type: "boolean", default: false },
                read_only: { type: "boolean", default: false },
                hidden: { type: "boolean", default: false },
                depends_on: { type: "string", description: "Conditional display expression" },
                mandatory_depends_on: { type: "string" },
                read_only_depends_on: { type: "string" },
                fetch_from: { type: "string", description: "Fetch value from linked document" },
                fetch_if_empty: { type: "boolean", default: false },
                description: { type: "string" },
              },
              required: ["fieldname", "label", "fieldtype"],
            },
          },
          is_submittable: { type: "boolean", default: false },
          is_child: { type: "boolean", default: false },
          is_virtual: { type: "boolean", default: false, description: "Virtual DocType (no database table)" },
          is_tree: { type: "boolean", default: false },
          is_single: { type: "boolean", default: false, description: "Single DocType (one record)" },
          naming_rule: { type: "string", enum: ["Set by user", "Autoincrement", "By fieldname", "By Naming Series", "Expression", "Random", "By script"], description: "How the document name is generated" },
          autoname: { type: "string", description: "Autoname pattern (e.g., 'naming_series:', 'field:fieldname', 'format:{}-{}' )" },
          title_field: { type: "string", description: "Field to use as document title" },
          search_fields: { type: "string", description: "Comma-separated list of fields for search" },
          sort_field: { type: "string", default: "creation", description: "Default sort field (v16 default: creation)" },
          sort_order: { type: "string", enum: ["ASC", "DESC"], default: "DESC" },
          track_changes: { type: "boolean", default: true },
          permissions: {
            type: "array",
            description: "Permission rules for the DocType",
            items: {
              type: "object",
              properties: {
                role: { type: "string" },
                read: { type: "boolean", default: true },
                write: { type: "boolean", default: false },
                create: { type: "boolean", default: false },
                delete: { type: "boolean", default: false },
                submit: { type: "boolean", default: false },
                cancel: { type: "boolean", default: false },
                amend: { type: "boolean", default: false },
                export: { type: "boolean", default: false },
                import: { type: "boolean", default: false },
                report: { type: "boolean", default: false },
                print: { type: "boolean", default: false },
                email: { type: "boolean", default: false },
                share: { type: "boolean", default: false },
              },
              required: ["role"],
            },
          },
        },
        required: ["app_name", "doctype_name", "module", "fields"],
      },
    },
    {
      name: "frappe_get_doctype_schema",
      description: "Get the complete schema/structure of a DocType including fields, permissions, and properties",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          site: { type: "string", description: "Site name (optional)" },
        },
        required: ["doctype"],
      },
    },
    {
      name: "frappe_get_doctype_list",
      description: "List all available DocTypes, optionally filtered by module or app",
      inputSchema: {
        type: "object",
        properties: {
          site: { type: "string", description: "Site name (optional)" },
          module: { type: "string", description: "Filter by module name" },
          app: { type: "string", description: "Filter by app name" },
        },
      },
    },
    {
      name: "frappe_get_field_options",
      description: "Get available options for Link or Select fields in a DocType",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          fieldname: { type: "string", description: "Field name" },
          site: { type: "string", description: "Site name (optional)" },
        },
        required: ["doctype", "fieldname"],
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_create_doctype":
        return await createDocType(args, ctx);
      case "frappe_get_doctype_schema":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_doc --args '${JSON.stringify(["DocType", args.doctype])}'`,
          site: args.site,
        });
      case "frappe_get_doctype_list": {
        const filters: any = {};
        if (args.module) filters.module = args.module;
        const command = `execute frappe.client.get_list --args '${JSON.stringify(["DocType", filters])}'`;
        return await ctx.runBenchCommand({ command, site: args.site });
      }
      case "frappe_get_field_options": {
        const command = `execute frappe.client.get_doc --args '${JSON.stringify(["DocType", args.doctype])}'`;
        const result = await ctx.runBenchCommand({ command, site: args.site });
        return {
          content: [{ type: "text", text: `Field options for ${args.fieldname} in ${args.doctype}: ${result.content[0].text}` }],
        };
      }
      default:
        return null;
    }
  },
};

async function createDocType(args: any, ctx: ToolContext): Promise<ToolResult> {
  const {
    app_name, doctype_name, module, fields,
    is_submittable = false, is_child = false, is_virtual = false,
    is_tree = false, is_single = false,
    naming_rule, autoname, title_field, search_fields,
    sort_field = "creation", sort_order = "DESC",
    track_changes = true, permissions,
  } = args;

  const snakeName = toSnakeCase(doctype_name);
  const pascalName = toPascalCase(doctype_name);
  const doctypePath = path.join(ctx.getAppPath(app_name), app_name, toSnakeCase(module), "doctype", snakeName);

  const doctypeJson: any = {
    name: doctype_name,
    doctype: "DocType",
    module,
    custom: 0,
    is_submittable: is_submittable ? 1 : 0,
    istable: is_child ? 1 : 0,
    is_virtual: is_virtual ? 1 : 0,
    is_tree: is_tree ? 1 : 0,
    issingle: is_single ? 1 : 0,
    sort_field,
    sort_order,
    track_changes: track_changes ? 1 : 0,
    fields: fields.map((field: any, index: number) => ({
      fieldname: field.fieldname,
      label: field.label,
      fieldtype: field.fieldtype,
      reqd: field.reqd ? 1 : 0,
      unique: field.unique ? 1 : 0,
      options: field.options || "",
      default: field.default || "",
      in_list_view: field.in_list_view ? 1 : 0,
      in_standard_filter: field.in_standard_filter ? 1 : 0,
      read_only: field.read_only ? 1 : 0,
      hidden: field.hidden ? 1 : 0,
      depends_on: field.depends_on || "",
      mandatory_depends_on: field.mandatory_depends_on || "",
      read_only_depends_on: field.read_only_depends_on || "",
      fetch_from: field.fetch_from || "",
      fetch_if_empty: field.fetch_if_empty ? 1 : 0,
      description: field.description || "",
      idx: index + 1,
    })),
    permissions: permissions || [
      { role: "System Manager", read: 1, write: 1, create: 1, delete: 1, submit: is_submittable ? 1 : 0, cancel: is_submittable ? 1 : 0, amend: is_submittable ? 1 : 0 },
    ],
  };

  if (naming_rule) doctypeJson.naming_rule = naming_rule;
  if (autoname) doctypeJson.autoname = autoname;
  if (title_field) doctypeJson.title_field = title_field;
  if (search_fields) doctypeJson.search_fields = search_fields;

  await fs.ensureDir(doctypePath);
  await fs.writeJson(path.join(doctypePath, `${snakeName}.json`), doctypeJson, { spaces: 2 });

  const baseClass = is_tree ? "NestedSet" : "Document";
  const baseImport = is_tree
    ? "from frappe.utils.nestedset import NestedSet"
    : "from frappe.model.document import Document";

  const pythonCode = `# Copyright (c) ${new Date().getFullYear()}, ${app_name} contributors
# For license information, please see license.txt

import frappe
${baseImport}


class ${pascalName}(${baseClass}):
\tpass
`;

  await fs.writeFile(path.join(doctypePath, `${snakeName}.py`), pythonCode);
  await fs.writeFile(path.join(doctypePath, "__init__.py"), "");

  // Create test file
  const testCode = `# Copyright (c) ${new Date().getFullYear()}, ${app_name} contributors
# For license information, please see license.txt

import frappe
from frappe.tests import IntegrationTestCase, UnitTestCase


class UnitTest${pascalName}(UnitTestCase):
\t"""Unit tests for ${doctype_name}."""
\tpass


class TestIntegration${pascalName}(IntegrationTestCase):
\t"""Integration tests for ${doctype_name}."""
\tpass
`;

  await fs.writeFile(path.join(doctypePath, `test_${snakeName}.py`), testCode);

  return {
    content: [{ type: "text", text: `DocType "${doctype_name}" created successfully in app "${app_name}" module "${module}"\nPath: ${doctypePath}\nFiles: ${snakeName}.json, ${snakeName}.py, test_${snakeName}.py, __init__.py` }],
  };
}
