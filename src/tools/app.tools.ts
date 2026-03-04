import * as fs from "fs-extra";
import { ToolModule, ToolResult, ToolContext } from "../types.js";
import { getDirectoryStructure } from "../utils/files.js";

export const appTools: ToolModule = {
  definitions: [
    {
      name: "frappe_create_app",
      description: "Create a new Frappe app with the bench scaffolding",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name (snake_case)" },
          title: { type: "string", description: "App title" },
          publisher: { type: "string", description: "Publisher name" },
          description: { type: "string", description: "App description" },
        },
        required: ["app_name", "title", "publisher"],
      },
    },
    {
      name: "frappe_install_app",
      description: "Install a Frappe app on a site",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
          site: { type: "string", description: "Site name" },
        },
        required: ["app_name", "site"],
      },
    },
    {
      name: "frappe_get_app_structure",
      description: "Get the directory structure of a Frappe app",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
        },
        required: ["app_name"],
      },
    },
    {
      name: "frappe_list_apps",
      description: "List all installed apps on a site",
      inputSchema: {
        type: "object",
        properties: {
          site: { type: "string", description: "Site name (optional)" },
        },
      },
    },
    {
      name: "frappe_uninstall_app",
      description: "Uninstall a Frappe app from a site",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name to uninstall" },
          site: { type: "string", description: "Site name" },
          yes: { type: "boolean", default: true, description: "Skip confirmation" },
        },
        required: ["app_name", "site"],
      },
    },
    {
      name: "frappe_get_app",
      description: "Clone/get a Frappe app from a git URL",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "Git repository URL" },
          branch: { type: "string", description: "Git branch (optional)" },
        },
        required: ["url"],
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_create_app": {
        const { app_name, title, publisher, description = "" } = args;
        const command = `new-app ${app_name} --title "${title}" --publisher "${publisher}" ${description ? `--description "${description}"` : ""}`;
        return await ctx.runBenchCommand({ command });
      }
      case "frappe_install_app":
        return await ctx.runBenchCommand({ command: `install-app ${args.app_name}`, site: args.site });
      case "frappe_get_app_structure": {
        const appPath = ctx.getAppPath(args.app_name);
        if (!await fs.pathExists(appPath)) {
          return { content: [{ type: "text", text: `App "${args.app_name}" not found at ${appPath}` }] };
        }
        const structure = await getDirectoryStructure(appPath);
        return { content: [{ type: "text", text: `App "${args.app_name}" structure:\n${structure}` }] };
      }
      case "frappe_list_apps":
        return await ctx.runBenchCommand({ command: "list-apps", site: args.site });
      case "frappe_uninstall_app":
        return await ctx.runBenchCommand({ command: `uninstall-app ${args.app_name} ${args.yes !== false ? "--yes" : ""}`, site: args.site });
      case "frappe_get_app": {
        const command = `get-app ${args.url}${args.branch ? ` --branch ${args.branch}` : ""}`;
        return await ctx.runBenchCommand({ command });
      }
      default:
        return null;
    }
  },
};
