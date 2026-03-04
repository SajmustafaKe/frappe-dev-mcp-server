import * as fs from "fs-extra";
import * as path from "path";
import { ToolModule, ToolResult, ToolContext } from "../types.js";
import { getAppModulePath, toSnakeCase } from "../utils/paths.js";
import { ensureAndWrite } from "../utils/files.js";

export const printTools: ToolModule = {
  definitions: [
    {
      name: "frappe_create_print_format",
      description: "Create a custom Print Format (HTML/Jinja) for a DocType. v16 supports custom print formats for reports.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Print Format name" },
          doctype: { type: "string", description: "DocType this format applies to" },
          html: { type: "string", description: "HTML/Jinja template for the print format" },
          print_format_type: { type: "string", enum: ["Jinja", "JS"], default: "Jinja" },
          standard: { type: "string", enum: ["Yes", "No"], default: "No" },
          custom_format: { type: "boolean", default: true },
          default_print_language: { type: "string", default: "en" },
          css: { type: "string", description: "Custom CSS for print format" },
          app_name: { type: "string", description: "App name (for file-based standard print formats)" },
          site: { type: "string" },
        },
        required: ["name", "doctype", "html"],
      },
    },
    {
      name: "frappe_create_letter_head",
      description: "Create a Letter Head template for document printing",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Letter Head name" },
          content: { type: "string", description: "HTML content for letter head header" },
          footer: { type: "string", description: "HTML content for letter head footer" },
          is_default: { type: "boolean", default: false },
          image: { type: "string", description: "Image URL for letter head" },
          site: { type: "string" },
        },
        required: ["name"],
      },
    },
    {
      name: "frappe_list_print_formats",
      description: "List all Print Formats, optionally filtered by DocType",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "Filter by DocType" },
          site: { type: "string" },
        },
      },
    },
    {
      name: "frappe_get_print",
      description: "Get rendered print output for a document",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          name: { type: "string", description: "Document name" },
          print_format: { type: "string", description: "Print format name (optional)" },
          letterhead: { type: "string", description: "Letter Head name (optional)" },
          site: { type: "string" },
        },
        required: ["doctype", "name"],
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_create_print_format": {
        if (args.standard === "Yes" && args.app_name) {
          // File-based standard print format
          const pfPath = path.join(
            getAppModulePath(ctx.frappePath, args.app_name),
            "print_format",
            toSnakeCase(args.name)
          );
          await fs.ensureDir(pfPath);

          const pfJson = {
            name: args.name,
            doctype: "Print Format",
            doc_type: args.doctype,
            print_format_type: args.print_format_type || "Jinja",
            standard: "Yes",
            custom_format: 1,
            default_print_language: args.default_print_language || "en",
          };
          await fs.writeJson(path.join(pfPath, `${toSnakeCase(args.name)}.json`), pfJson, { spaces: 2 });
          await ensureAndWrite(path.join(pfPath, `${toSnakeCase(args.name)}.html`), args.html);
          if (args.css) {
            await ensureAndWrite(path.join(pfPath, `${toSnakeCase(args.name)}.css`), args.css);
          }

          return { content: [{ type: "text", text: `Standard Print Format "${args.name}" created at ${pfPath}` }] };
        }

        // Database-based custom print format
        const data: any = {
          doctype: "Print Format",
          name: args.name,
          doc_type: args.doctype,
          html: args.html,
          print_format_type: args.print_format_type || "Jinja",
          standard: "No",
          custom_format: 1,
          default_print_language: args.default_print_language || "en",
        };
        if (args.css) data.css = args.css;

        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }

      case "frappe_create_letter_head": {
        const data: any = {
          doctype: "Letter Head",
          letter_head_name: args.name,
          content: args.content || "",
          footer: args.footer || "",
          is_default: args.is_default ? 1 : 0,
        };
        if (args.image) data.image = args.image;
        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }

      case "frappe_list_print_formats": {
        const filters: any = {};
        if (args.doctype) filters.doc_type = args.doctype;
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_list --args '${JSON.stringify(["Print Format", filters])}'`,
          site: args.site,
        });
      }

      case "frappe_get_print":
        return await ctx.runBenchCommand({
          command: `execute frappe.utils.print_format.download_pdf --args '${JSON.stringify([args.doctype, args.name, args.print_format || "", args.letterhead || ""])}'`,
          site: args.site,
        });

      default:
        return null;
    }
  },
};
