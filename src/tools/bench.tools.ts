import { ToolModule, ToolResult, ToolContext } from "../types.js";

export const benchTools: ToolModule = {
  definitions: [
    {
      name: "frappe_run_bench_command",
      description: "Execute any bench command for Frappe development",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Bench command to execute" },
          site: { type: "string", description: "Site name (optional)" },
          cwd: { type: "string", description: "Working directory (optional)" },
        },
        required: ["command"],
      },
    },
    {
      name: "frappe_migrate_database",
      description: "Run database migration for a Frappe site",
      inputSchema: {
        type: "object",
        properties: {
          site: { type: "string", description: "Site name to migrate" },
        },
        required: ["site"],
      },
    },
    {
      name: "frappe_build_assets",
      description: "Build front-end assets for all apps or a specific app",
      inputSchema: {
        type: "object",
        properties: {
          app: { type: "string", description: "Specific app to build (optional, builds all if not specified)" },
          production: { type: "boolean", default: false, description: "Build for production" },
        },
      },
    },
    {
      name: "frappe_clear_cache",
      description: "Clear cache for a Frappe site",
      inputSchema: {
        type: "object",
        properties: {
          site: { type: "string", description: "Site name (optional)" },
        },
      },
    },
    {
      name: "frappe_setup_requirements",
      description: "Install Python and Node dependencies for all apps",
      inputSchema: {
        type: "object",
        properties: {
          app: { type: "string", description: "Specific app (optional)" },
        },
      },
    },
    {
      name: "frappe_restart",
      description: "Restart bench services (web, worker, scheduler)",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "frappe_new_site",
      description: "Create a new Frappe site",
      inputSchema: {
        type: "object",
        properties: {
          site_name: { type: "string", description: "Site domain name" },
          db_name: { type: "string", description: "Database name (optional)" },
          admin_password: { type: "string", description: "Admin password" },
          mariadb_root_password: { type: "string", description: "MariaDB root password (optional)" },
        },
        required: ["site_name"],
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_run_bench_command":
        return await ctx.runBenchCommand(args);
      case "frappe_migrate_database":
        return await ctx.runBenchCommand({ command: "migrate", site: args.site });
      case "frappe_build_assets": {
        let cmd = "build";
        if (args.app) cmd += ` --app ${args.app}`;
        if (args.production) cmd += " --production";
        return await ctx.runBenchCommand({ command: cmd });
      }
      case "frappe_clear_cache":
        return await ctx.runBenchCommand({ command: "clear-cache", site: args.site });
      case "frappe_setup_requirements": {
        const cmd = args.app ? `setup requirements --app ${args.app}` : "setup requirements";
        return await ctx.runBenchCommand({ command: cmd });
      }
      case "frappe_restart":
        return await ctx.runBenchCommand({ command: "restart" });
      case "frappe_new_site": {
        let cmd = `new-site ${args.site_name}`;
        if (args.admin_password) cmd += ` --admin-password ${args.admin_password}`;
        if (args.db_name) cmd += ` --db-name ${args.db_name}`;
        if (args.mariadb_root_password) cmd += ` --mariadb-root-password ${args.mariadb_root_password}`;
        return await ctx.runBenchCommand({ command: cmd });
      }
      default:
        return null;
    }
  },
};
