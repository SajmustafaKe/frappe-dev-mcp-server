import * as fs from "fs-extra";
import { ToolModule, ToolResult, ToolContext } from "../types.js";
import { getHooksPath, getAppModulePath } from "../utils/paths.js";
import { readFileIfExists } from "../utils/files.js";

export const hooksTools: ToolModule = {
  definitions: [
    {
      name: "frappe_get_hooks",
      description: "Read and display the current hooks.py file of a Frappe app",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Name of the Frappe app" },
        },
        required: ["app_name"],
      },
    },
    {
      name: "frappe_add_doc_events",
      description: "Add document event hooks (before_save, after_insert, on_submit, on_cancel, on_update, before_validate, etc.) to hooks.py",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Name of the Frappe app" },
          doctype: { type: "string", description: "DocType name (use '*' for all DocTypes)" },
          events: {
            type: "object",
            description: "Map of event name to handler dotted path",
            additionalProperties: { type: "string" },
          },
        },
        required: ["app_name", "doctype", "events"],
      },
    },
    {
      name: "frappe_add_scheduler_events",
      description: "Add scheduler event hooks (cron, all, daily, hourly, weekly, monthly) to hooks.py",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Name of the Frappe app" },
          frequency: { type: "string", enum: ["all", "daily", "hourly", "weekly", "monthly", "yearly", "cron"], description: "Scheduler frequency" },
          cron_expression: { type: "string", description: "Cron expression (only if frequency is 'cron')" },
          method: { type: "string", description: "Dotted path to the Python method" },
        },
        required: ["app_name", "frequency", "method"],
      },
    },
    {
      name: "frappe_add_web_include",
      description: "Add app_include_js, app_include_css, web_include_js, or web_include_css entries to hooks.py",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Name of the Frappe app" },
          include_type: { type: "string", enum: ["app_include_js", "app_include_css", "web_include_js", "web_include_css"], description: "Type of web include" },
          path: { type: "string", description: "Path to the JS/CSS file (e.g., /assets/app_name/js/file.js)" },
        },
        required: ["app_name", "include_type", "path"],
      },
    },
    {
      name: "frappe_add_override_method",
      description: "Add override_whitelisted_methods or override_doctype_class entries to hooks.py",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Name of the Frappe app" },
          override_type: { type: "string", enum: ["override_whitelisted_methods", "override_doctype_class"], description: "Type of override" },
          original: { type: "string", description: "Original method/class dotted path" },
          replacement: { type: "string", description: "Replacement method/class dotted path" },
        },
        required: ["app_name", "override_type", "original", "replacement"],
      },
    },
    {
      name: "frappe_add_fixtures",
      description: "Add fixtures list to hooks.py for exporting configuration data",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Name of the Frappe app" },
          fixtures: {
            type: "array",
            description: "List of DocTypes or filter-based fixture definitions",
            items: {
              oneOf: [
                { type: "string", description: "DocType name" },
                {
                  type: "object",
                  properties: {
                    dt: { type: "string", description: "DocType name" },
                    filters: { type: "array", description: "Filter conditions as [fieldname, operator, value] arrays" },
                  },
                  required: ["dt"],
                },
              ],
            },
          },
        },
        required: ["app_name", "fixtures"],
      },
    },
    {
      name: "frappe_add_jinja",
      description: "Add custom Jinja methods or filters to hooks.py",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Name of the Frappe app" },
          jinja_type: { type: "string", enum: ["methods", "filters"], description: "Type of Jinja extension" },
          dotted_path: { type: "string", description: "Dotted path to the Python method" },
        },
        required: ["app_name", "jinja_type", "dotted_path"],
      },
    },
    {
      name: "frappe_add_boot_session",
      description: "Add boot_session hook to hooks.py for custom boot data",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Name of the Frappe app" },
          method: { type: "string", description: "Dotted path to boot session method" },
        },
        required: ["app_name", "method"],
      },
    },
    {
      name: "frappe_add_permission_query",
      description: "Add permission_query_conditions or has_permission hooks to hooks.py",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Name of the Frappe app" },
          hook_type: { type: "string", enum: ["permission_query_conditions", "has_permission"], description: "Type of permission hook" },
          doctype: { type: "string", description: "DocType name" },
          method: { type: "string", description: "Dotted path to the handler method. Note: v16 requires has_permission to explicitly return True." },
        },
        required: ["app_name", "hook_type", "doctype", "method"],
      },
    },
    {
      name: "frappe_add_website_generator",
      description: "Add website_generators hook for DocTypes that generate web pages",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Name of the Frappe app" },
          doctype: { type: "string", description: "DocType that generates web pages" },
        },
        required: ["app_name", "doctype"],
      },
    },
    {
      name: "frappe_set_hooks_property",
      description: "Set any arbitrary property in hooks.py (for hooks not covered by specialized tools)",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Name of the Frappe app" },
          property_name: { type: "string", description: "Hook property name (e.g., 'on_session_creation', 'before_migrate', 'after_install')" },
          value: { type: "string", description: "Python value to set (string representation)" },
        },
        required: ["app_name", "property_name", "value"],
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_get_hooks": {
        const hooksPath = getHooksPath(ctx.frappePath, args.app_name);
        const content = await readFileIfExists(hooksPath);
        if (!content) {
          return { content: [{ type: "text", text: `hooks.py not found for app "${args.app_name}"` }] };
        }
        return { content: [{ type: "text", text: `hooks.py for "${args.app_name}":\n\n${content}` }] };
      }

      case "frappe_add_doc_events": {
        const { app_name, doctype, events } = args;
        const hooksPath = getHooksPath(ctx.frappePath, app_name);
        let content = await readFileIfExists(hooksPath) || "";

        const eventEntries = Object.entries(events as Record<string, string>)
          .map(([event, handler]) => `\t\t"${event}": "${handler}",`)
          .join("\n");

        const docEventsBlock = `\n\ndoc_events = {\n\t"${doctype}": {\n${eventEntries}\n\t}\n}\n`;

        if (content.includes("doc_events")) {
          // Insert into existing doc_events dict
          const insertPoint = content.indexOf("doc_events = {") + "doc_events = {".length;
          const newEntry = `\n\t"${doctype}": {\n${eventEntries}\n\t},`;
          content = content.slice(0, insertPoint) + newEntry + content.slice(insertPoint);
        } else {
          content += docEventsBlock;
        }

        await fs.writeFile(hooksPath, content);
        return { content: [{ type: "text", text: `Added doc_events for "${doctype}" in ${app_name}/hooks.py:\n${Object.entries(events as Record<string, string>).map(([e, h]) => `  ${e} -> ${h}`).join("\n")}` }] };
      }

      case "frappe_add_scheduler_events": {
        const { app_name, frequency, cron_expression, method } = args;
        const hooksPath = getHooksPath(ctx.frappePath, app_name);
        let content = await readFileIfExists(hooksPath) || "";

        if (frequency === "cron") {
          const cronBlock = `\n\nscheduler_events = {\n\t"cron": {\n\t\t"${cron_expression}": [\n\t\t\t"${method}",\n\t\t]\n\t}\n}\n`;
          if (content.includes("scheduler_events")) {
            const insertPoint = content.indexOf("scheduler_events = {") + "scheduler_events = {".length;
            const entry = `\n\t"cron": {\n\t\t"${cron_expression}": [\n\t\t\t"${method}",\n\t\t]\n\t},`;
            content = content.slice(0, insertPoint) + entry + content.slice(insertPoint);
          } else {
            content += cronBlock;
          }
        } else {
          const freqBlock = `\n\nscheduler_events = {\n\t"${frequency}": [\n\t\t"${method}",\n\t]\n}\n`;
          if (content.includes("scheduler_events")) {
            const insertPoint = content.indexOf("scheduler_events = {") + "scheduler_events = {".length;
            const entry = `\n\t"${frequency}": [\n\t\t"${method}",\n\t],`;
            content = content.slice(0, insertPoint) + entry + content.slice(insertPoint);
          } else {
            content += freqBlock;
          }
        }

        await fs.writeFile(hooksPath, content);
        return { content: [{ type: "text", text: `Added scheduler_events (${frequency}) -> ${method} in ${app_name}/hooks.py` }] };
      }

      case "frappe_add_web_include": {
        const { app_name, include_type, path: includePath } = args;
        const hooksPath = getHooksPath(ctx.frappePath, app_name);
        let content = await readFileIfExists(hooksPath) || "";

        if (content.includes(`${include_type}`)) {
          // Append to existing list
          const regex = new RegExp(`(${include_type}\\s*=\\s*\\[)`, "m");
          content = content.replace(regex, `$1\n\t"${includePath}",`);
        } else {
          content += `\n\n${include_type} = [\n\t"${includePath}",\n]\n`;
        }

        await fs.writeFile(hooksPath, content);
        return { content: [{ type: "text", text: `Added ${include_type} entry "${includePath}" in ${app_name}/hooks.py` }] };
      }

      case "frappe_add_override_method": {
        const { app_name, override_type, original, replacement } = args;
        const hooksPath = getHooksPath(ctx.frappePath, app_name);
        let content = await readFileIfExists(hooksPath) || "";

        if (content.includes(override_type)) {
          const insertPoint = content.indexOf(`${override_type} = {`) + `${override_type} = {`.length;
          const entry = `\n\t"${original}": "${replacement}",`;
          content = content.slice(0, insertPoint) + entry + content.slice(insertPoint);
        } else {
          content += `\n\n${override_type} = {\n\t"${original}": "${replacement}",\n}\n`;
        }

        await fs.writeFile(hooksPath, content);
        return { content: [{ type: "text", text: `Added ${override_type}: "${original}" -> "${replacement}" in ${app_name}/hooks.py` }] };
      }

      case "frappe_add_fixtures": {
        const { app_name, fixtures } = args;
        const hooksPath = getHooksPath(ctx.frappePath, app_name);
        let content = await readFileIfExists(hooksPath) || "";

        const fixtureEntries = (fixtures as any[]).map((f) => {
          if (typeof f === "string") return `\t"${f}",`;
          return `\t{"dt": "${f.dt}"${f.filters ? `, "filters": ${JSON.stringify(f.filters)}` : ""}},`;
        }).join("\n");

        if (content.includes("fixtures = [")) {
          const regex = /(fixtures\s*=\s*\[)/m;
          content = content.replace(regex, `$1\n${fixtureEntries}`);
        } else {
          content += `\n\nfixtures = [\n${fixtureEntries}\n]\n`;
        }

        await fs.writeFile(hooksPath, content);
        return { content: [{ type: "text", text: `Added ${fixtures.length} fixture(s) to ${app_name}/hooks.py` }] };
      }

      case "frappe_add_jinja": {
        const { app_name, jinja_type, dotted_path } = args;
        const hooksPath = getHooksPath(ctx.frappePath, app_name);
        let content = await readFileIfExists(hooksPath) || "";

        const hookName = `jinja = {\n\t"${jinja_type}": [\n\t\t"${dotted_path}",\n\t]\n}`;
        if (content.includes("jinja")) {
          const regex = /(jinja\s*=\s*\{)/m;
          content = content.replace(regex, `$1\n\t"${jinja_type}": [\n\t\t"${dotted_path}",\n\t],`);
        } else {
          content += `\n\n${hookName}\n`;
        }

        await fs.writeFile(hooksPath, content);
        return { content: [{ type: "text", text: `Added Jinja ${jinja_type} "${dotted_path}" in ${app_name}/hooks.py` }] };
      }

      case "frappe_add_boot_session": {
        const { app_name, method } = args;
        const hooksPath = getHooksPath(ctx.frappePath, app_name);
        let content = await readFileIfExists(hooksPath) || "";
        content += `\n\nboot_session = "${method}"\n`;
        await fs.writeFile(hooksPath, content);
        return { content: [{ type: "text", text: `Added boot_session hook -> ${method} in ${app_name}/hooks.py` }] };
      }

      case "frappe_add_permission_query": {
        const { app_name, hook_type, doctype, method } = args;
        const hooksPath = getHooksPath(ctx.frappePath, app_name);
        let content = await readFileIfExists(hooksPath) || "";

        if (content.includes(hook_type)) {
          const insertPoint = content.indexOf(`${hook_type} = {`) + `${hook_type} = {`.length;
          const entry = `\n\t"${doctype}": "${method}",`;
          content = content.slice(0, insertPoint) + entry + content.slice(insertPoint);
        } else {
          content += `\n\n${hook_type} = {\n\t"${doctype}": "${method}",\n}\n`;
        }

        await fs.writeFile(hooksPath, content);
        const note = hook_type === "has_permission" ? " (Note: v16 requires explicitly returning True)" : "";
        return { content: [{ type: "text", text: `Added ${hook_type} for "${doctype}" -> "${method}" in ${app_name}/hooks.py${note}` }] };
      }

      case "frappe_add_website_generator": {
        const { app_name, doctype } = args;
        const hooksPath = getHooksPath(ctx.frappePath, app_name);
        let content = await readFileIfExists(hooksPath) || "";

        if (content.includes("website_generators")) {
          const regex = /(website_generators\s*=\s*\[)/m;
          content = content.replace(regex, `$1\n\t"${doctype}",`);
        } else {
          content += `\n\nwebsite_generators = [\n\t"${doctype}",\n]\n`;
        }

        await fs.writeFile(hooksPath, content);
        return { content: [{ type: "text", text: `Added website_generator "${doctype}" in ${app_name}/hooks.py` }] };
      }

      case "frappe_set_hooks_property": {
        const { app_name, property_name, value } = args;
        const hooksPath = getHooksPath(ctx.frappePath, app_name);
        let content = await readFileIfExists(hooksPath) || "";
        content += `\n\n${property_name} = ${value}\n`;
        await fs.writeFile(hooksPath, content);
        return { content: [{ type: "text", text: `Set ${property_name} in ${app_name}/hooks.py` }] };
      }

      default:
        return null;
    }
  },
};
