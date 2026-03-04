import * as fs from "fs-extra";
import * as path from "path";
import { ToolModule, ToolResult, ToolContext } from "../types.js";
import { getAppModulePath, getPatchesPath, getFixturesPath, toSnakeCase } from "../utils/paths.js";
import { ensureAndWrite, readFileIfExists } from "../utils/files.js";

export const dataTools: ToolModule = {
  definitions: [
    {
      name: "frappe_export_fixtures",
      description: "Export fixture data for an app (exports DocTypes defined in hooks.py fixtures)",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
          site: { type: "string" },
        },
        required: ["app_name"],
      },
    },
    {
      name: "frappe_import_fixtures",
      description: "Import fixture data from an app's fixtures directory",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name (optional, imports all if not specified)" },
          site: { type: "string" },
        },
      },
    },
    {
      name: "frappe_create_patch",
      description: "Create a database migration patch file for an app. Patches run during bench migrate.",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
          patch_name: { type: "string", description: "Patch function/file name (e.g., 'update_customer_fields')" },
          code: { type: "string", description: "Python code for the patch execute() function" },
          patch_module: { type: "string", description: "Subdirectory (e.g., 'v1_0' for version grouping)" },
        },
        required: ["app_name", "patch_name", "code"],
      },
    },
    {
      name: "frappe_import_data",
      description: "Import data from CSV/JSON into a DocType using Frappe Data Import",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "Target DocType" },
          file_path: { type: "string", description: "Path to CSV/JSON file" },
          submit_after_import: { type: "boolean", default: false },
          site: { type: "string" },
        },
        required: ["doctype", "file_path"],
      },
    },
    {
      name: "frappe_export_data",
      description: "Export data from a DocType to JSON",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "Source DocType" },
          filters: { type: "object", description: "Export filters" },
          fields: { type: "array", items: { type: "string" }, description: "Fields to export" },
          limit: { type: "number", default: 100 },
          site: { type: "string" },
        },
        required: ["doctype"],
      },
    },
    {
      name: "frappe_get_data_import_template",
      description: "Get a CSV import template for a DocType",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          site: { type: "string" },
        },
        required: ["doctype"],
      },
    },
    {
      name: "frappe_run_patch",
      description: "Run a specific patch manually",
      inputSchema: {
        type: "object",
        properties: {
          patch_path: { type: "string", description: "Dotted path to patch module (e.g., app_name.patches.v1_0.my_patch)" },
          site: { type: "string" },
        },
        required: ["patch_path"],
      },
    },
    {
      name: "frappe_bulk_update",
      description: "Bulk update documents of a DocType",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          field: { type: "string", description: "Field to update" },
          value: { type: "string", description: "New value" },
          condition: { type: "string", description: "SQL WHERE condition (e.g., 'status = \"Draft\"')" },
          limit: { type: "number", default: 500 },
          site: { type: "string" },
        },
        required: ["doctype", "field", "value"],
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_export_fixtures":
        return await ctx.runBenchCommand({
          command: `export-fixtures --app ${args.app_name}`,
          site: args.site,
        });

      case "frappe_import_fixtures": {
        const cmd = args.app_name ? `import-fixtures --app ${args.app_name}` : "import-fixtures";
        return await ctx.runBenchCommand({ command: cmd, site: args.site });
      }

      case "frappe_create_patch": {
        const { app_name, patch_name, code, patch_module } = args;
        const patchesBase = getPatchesPath(ctx.frappePath, app_name);
        const patchDir = patch_module
          ? path.join(patchesBase, patch_module)
          : patchesBase;

        await fs.ensureDir(patchDir);

        // Ensure __init__.py files exist
        const initPath = path.join(patchesBase, "__init__.py");
        if (!await fs.pathExists(initPath)) {
          await fs.writeFile(initPath, "");
        }
        if (patch_module) {
          const subInitPath = path.join(patchDir, "__init__.py");
          if (!await fs.pathExists(subInitPath)) {
            await fs.writeFile(subInitPath, "");
          }
        }

        const patchCode = `import frappe


def execute():
\t"""${patch_name}: database migration patch"""
${code.split("\n").map((l: string) => "\t" + l).join("\n")}
`;

        const patchFile = path.join(patchDir, `${toSnakeCase(patch_name)}.py`);
        await ensureAndWrite(patchFile, patchCode);

        // Add to patches.txt
        const patchesTxtPath = path.join(getAppModulePath(ctx.frappePath, app_name), "patches.txt");
        const patchDotPath = patch_module
          ? `${app_name}.patches.${patch_module}.${toSnakeCase(patch_name)}`
          : `${app_name}.patches.${toSnakeCase(patch_name)}`;

        let patchesTxt = "";
        try {
          patchesTxt = await fs.readFile(patchesTxtPath, "utf8");
        } catch {}

        if (!patchesTxt.includes(patchDotPath)) {
          patchesTxt += `${patchDotPath}\n`;
          await fs.writeFile(patchesTxtPath, patchesTxt);
        }

        return { content: [{ type: "text", text: `Patch created:\n  File: ${patchFile}\n  Registered: ${patchDotPath} in patches.txt\n  Run via: bench migrate` }] };
      }

      case "frappe_import_data":
        return await ctx.runBenchCommand({
          command: `execute frappe.core.doctype.data_import.data_import.import_file --args '${JSON.stringify([args.doctype, args.file_path, args.submit_after_import || false])}'`,
          site: args.site,
        });

      case "frappe_export_data": {
        const exportArgs: any = [args.doctype, args.filters || {}];
        if (args.fields) exportArgs.push(args.fields);
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_list --args '${JSON.stringify(exportArgs)}'`,
          site: args.site,
        });
      }

      case "frappe_get_data_import_template":
        return await ctx.runBenchCommand({
          command: `export-csv "${args.doctype}"`,
          site: args.site,
        });

      case "frappe_run_patch":
        return await ctx.runBenchCommand({
          command: `run-patch ${args.patch_path}`,
          site: args.site,
        });

      case "frappe_bulk_update": {
        const updateCode = `frappe.db.sql("""UPDATE \`tab${args.doctype}\` SET ${args.field} = '${args.value}' ${args.condition ? `WHERE ${args.condition}` : ""} LIMIT ${args.limit || 500}""")`;
        return await ctx.runBenchCommand({
          command: `execute "${updateCode}"`,
          site: args.site,
        });
      }

      default:
        return null;
    }
  },
};
