import * as fs from "fs-extra";
import * as path from "path";
import { ToolModule, ToolResult, ToolContext } from "../types.js";
import { getTemplatesPath, getWwwPath, getAppModulePath, toSnakeCase } from "../utils/paths.js";
import { ensureAndWrite } from "../utils/files.js";

export const webTools: ToolModule = {
  definitions: [
    {
      name: "frappe_create_web_page",
      description: "Create a Web Page document for the website",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Page title" },
          route: { type: "string", description: "URL route (e.g., 'about-us')" },
          content_type: { type: "string", enum: ["Rich Text", "Markdown", "HTML", "Page Builder"], default: "Rich Text" },
          main_section: { type: "string", description: "Page content (HTML/Markdown)" },
          published: { type: "boolean", default: true },
          meta_title: { type: "string", description: "SEO meta title" },
          meta_description: { type: "string", description: "SEO meta description" },
          site: { type: "string" },
        },
        required: ["title", "route"],
      },
    },
    {
      name: "frappe_create_portal_page",
      description: "Create a Portal Page (www/ directory) with HTML/Jinja template and Python controller for a Frappe app",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
          page_name: { type: "string", description: "Page name (becomes URL route)" },
          title: { type: "string", description: "Page title" },
          html_template: { type: "string", description: "Jinja/HTML template content" },
          python_controller: { type: "string", description: "Python code for get_context(context)" },
          no_cache: { type: "boolean", default: false },
          show_sidebar: { type: "boolean", default: false },
          allow_guest: { type: "boolean", default: false },
        },
        required: ["app_name", "page_name", "title"],
      },
    },
    {
      name: "frappe_create_web_template",
      description: "Create a Jinja template file for emails, print, or web pages",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
          template_name: { type: "string", description: "Template file name" },
          template_type: { type: "string", enum: ["pages", "includes", "emails", "print_formats", "generators"], description: "Template directory/type" },
          content: { type: "string", description: "Jinja template content" },
        },
        required: ["app_name", "template_name", "template_type", "content"],
      },
    },
    {
      name: "frappe_create_web_form",
      description: "Create a Web Form for public-facing data entry",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Web Form title" },
          doc_type: { type: "string", description: "DocType to create documents for" },
          route: { type: "string", description: "URL route" },
          published: { type: "boolean", default: true },
          allow_edit: { type: "boolean", default: false },
          allow_multiple: { type: "boolean", default: true },
          login_required: { type: "boolean", default: true },
          allow_comments: { type: "boolean", default: false },
          allow_print: { type: "boolean", default: false },
          show_sidebar: { type: "boolean", default: false },
          web_form_fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                fieldname: { type: "string" },
                label: { type: "string" },
                fieldtype: { type: "string" },
                options: { type: "string" },
                reqd: { type: "boolean" },
                hidden: { type: "boolean" },
                read_only: { type: "boolean" },
                default: { type: "string" },
              },
              required: ["fieldname", "label", "fieldtype"],
            },
          },
          introduction_text: { type: "string", description: "Intro text shown at top of form" },
          success_message: { type: "string", description: "Message shown after submission" },
          success_url: { type: "string", description: "Redirect URL after submission" },
          site: { type: "string" },
        },
        required: ["title", "doc_type", "route"],
      },
    },
    {
      name: "frappe_update_website_settings",
      description: "Update website settings (homepage, navbar, footer, brand, favicon, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          home_page: { type: "string", description: "Homepage route" },
          brand_html: { type: "string", description: "Brand HTML/logo" },
          banner_html: { type: "string", description: "Banner HTML" },
          footer_address: { type: "string", description: "Footer address" },
          copyright: { type: "string", description: "Copyright text" },
          disable_signup: { type: "boolean" },
          head_html: { type: "string", description: "Custom HTML for <head>" },
          navbar: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                url: { type: "string" },
                parent_label: { type: "string" },
              },
            },
            description: "Navbar items",
          },
          site: { type: "string" },
        },
      },
    },
    {
      name: "frappe_list_web_pages",
      description: "List all web pages",
      inputSchema: {
        type: "object",
        properties: {
          published: { type: "boolean", description: "Filter by published status" },
          site: { type: "string" },
        },
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_create_web_page": {
        const data: any = {
          doctype: "Web Page",
          title: args.title,
          route: args.route,
          content_type: args.content_type || "Rich Text",
          main_section: args.main_section || "",
          published: args.published !== false ? 1 : 0,
        };
        if (args.meta_title) data.meta_title = args.meta_title;
        if (args.meta_description) data.meta_description = args.meta_description;
        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }

      case "frappe_create_portal_page": {
        const wwwPath = getWwwPath(ctx.frappePath, args.app_name);
        const pageName = toSnakeCase(args.page_name);

        const htmlContent = args.html_template || `{%- extends "templates/web.html" -%}

{%- block page_content -%}
<div class="container">
  <h1>{{ title }}</h1>
  <div>
    <!-- Page content here -->
  </div>
</div>
{%- endblock -%}`;

        const pyContent = args.python_controller || `import frappe

no_cache = ${args.no_cache ? 1 : 0}
${args.allow_guest ? "" : "\ndef get_context(context):\n\tif frappe.session.user == 'Guest':\n\t\tfrappe.throw('Login required', frappe.PermissionError)\n"}
def get_context(context):
\tcontext.title = "${args.title}"
\tcontext.show_sidebar = ${args.show_sidebar ? "True" : "False"}
`;

        await ensureAndWrite(path.join(wwwPath, `${pageName}.html`), htmlContent);
        await ensureAndWrite(path.join(wwwPath, `${pageName}.py`), pyContent);

        return { content: [{ type: "text", text: `Portal page created:\n  ${wwwPath}/${pageName}.html\n  ${wwwPath}/${pageName}.py\nAccess at: /${pageName}` }] };
      }

      case "frappe_create_web_template": {
        const templatesPath = getTemplatesPath(ctx.frappePath, args.app_name);
        const templateDir = path.join(templatesPath, args.template_type);
        const templatePath = path.join(templateDir, args.template_name);

        await ensureAndWrite(templatePath, args.content);
        return { content: [{ type: "text", text: `Template created at ${templatePath}` }] };
      }

      case "frappe_create_web_form": {
        const data: any = {
          doctype: "Web Form",
          title: args.title,
          doc_type: args.doc_type,
          route: args.route,
          published: args.published !== false ? 1 : 0,
          allow_edit: args.allow_edit ? 1 : 0,
          allow_multiple: args.allow_multiple !== false ? 1 : 0,
          login_required: args.login_required !== false ? 1 : 0,
          allow_comments: args.allow_comments ? 1 : 0,
          allow_print: args.allow_print ? 1 : 0,
          show_sidebar: args.show_sidebar ? 1 : 0,
          introduction_text: args.introduction_text || "",
          success_message: args.success_message || "",
          success_url: args.success_url || "",
        };
        if (args.web_form_fields) {
          data.web_form_fields = args.web_form_fields.map((f: any, idx: number) => ({
            fieldname: f.fieldname,
            label: f.label,
            fieldtype: f.fieldtype,
            options: f.options || "",
            reqd: f.reqd ? 1 : 0,
            hidden: f.hidden ? 1 : 0,
            read_only: f.read_only ? 1 : 0,
            default: f.default || "",
            idx: idx + 1,
          }));
        }
        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }

      case "frappe_update_website_settings": {
        const updateFields: any = {};
        if (args.home_page) updateFields.home_page = args.home_page;
        if (args.brand_html) updateFields.brand_html = args.brand_html;
        if (args.banner_html) updateFields.banner_html = args.banner_html;
        if (args.footer_address) updateFields.footer_address = args.footer_address;
        if (args.copyright) updateFields.copyright = args.copyright;
        if (args.disable_signup !== undefined) updateFields.disable_signup = args.disable_signup ? 1 : 0;
        if (args.head_html) updateFields.head_html = args.head_html;

        const results: string[] = [];
        for (const [field, value] of Object.entries(updateFields)) {
          await ctx.runBenchCommand({
            command: `execute frappe.client.set_value --args '${JSON.stringify(["Website Settings", "Website Settings", field, value])}'`,
            site: args.site,
          });
          results.push(`${field}: updated`);
        }

        return { content: [{ type: "text", text: `Website Settings updated:\n${results.join("\n")}` }] };
      }

      case "frappe_list_web_pages": {
        const filters: any = {};
        if (args.published !== undefined) filters.published = args.published ? 1 : 0;
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_list --args '${JSON.stringify(["Web Page", filters])}'`,
          site: args.site,
        });
      }

      default:
        return null;
    }
  },
};
