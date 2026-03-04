import { ToolModule, ToolResult, ToolContext } from "../types.js";

export const permissionsTools: ToolModule = {
  definitions: [
    {
      name: "frappe_create_role",
      description: "Create a new Role in the Frappe system",
      inputSchema: {
        type: "object",
        properties: {
          role_name: { type: "string", description: "Name of the role" },
          desk_access: { type: "boolean", default: true, description: "Whether role has desk access" },
          is_custom: { type: "boolean", default: true },
          site: { type: "string" },
        },
        required: ["role_name"],
      },
    },
    {
      name: "frappe_add_permission",
      description: "Add DocType permission rules for a role (DocPerm row)",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          role: { type: "string", description: "Role name" },
          permlevel: { type: "number", default: 0, description: "Permission level" },
          read: { type: "boolean", default: true },
          write: { type: "boolean", default: false },
          create: { type: "boolean", default: false },
          delete: { type: "boolean", default: false },
          submit: { type: "boolean", default: false },
          cancel: { type: "boolean", default: false },
          amend: { type: "boolean", default: false },
          report: { type: "boolean", default: false },
          export: { type: "boolean", default: false },
          import: { type: "boolean", default: false },
          print: { type: "boolean", default: false },
          email: { type: "boolean", default: false },
          share: { type: "boolean", default: false },
          if_owner: { type: "boolean", default: false, description: "Apply only if user is document owner" },
          site: { type: "string" },
        },
        required: ["doctype", "role"],
      },
    },
    {
      name: "frappe_get_permissions",
      description: "Get all permission rules for a DocType",
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
      name: "frappe_add_user_permission",
      description: "Add a User Permission to restrict a user to specific documents",
      inputSchema: {
        type: "object",
        properties: {
          user: { type: "string", description: "User email" },
          allow: { type: "string", description: "DocType to restrict" },
          for_value: { type: "string", description: "Specific document name to allow" },
          applicable_for: { type: "string", description: "Apply restriction to this DocType only (optional)" },
          site: { type: "string" },
        },
        required: ["user", "allow", "for_value"],
      },
    },
    {
      name: "frappe_create_role_profile",
      description: "Create a Role Profile that groups multiple roles together",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Role Profile name" },
          roles: { type: "array", items: { type: "string" }, description: "List of roles to include" },
          site: { type: "string" },
        },
        required: ["name", "roles"],
      },
    },
    {
      name: "frappe_check_permission",
      description: "Check if a user has permission on a document",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          name: { type: "string", description: "Document name (optional)" },
          perm_type: { type: "string", enum: ["read", "write", "create", "delete", "submit", "cancel"], default: "read" },
          user: { type: "string", description: "User email (optional, defaults to current user)" },
          site: { type: "string" },
        },
        required: ["doctype"],
      },
    },
    {
      name: "frappe_setup_field_level_security",
      description: "Configure field-level permissions (permlevel) for DocType fields. v16 supports role-based field masking.",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          fieldname: { type: "string", description: "Field name" },
          permlevel: { type: "number", description: "Permission level (0-9)" },
          site: { type: "string" },
        },
        required: ["doctype", "fieldname", "permlevel"],
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_create_role": {
        const data = {
          doctype: "Role",
          role_name: args.role_name,
          desk_access: args.desk_access !== false ? 1 : 0,
          is_custom: args.is_custom !== false ? 1 : 0,
        };
        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }
      case "frappe_add_permission": {
        const permArgs = {
          doctype: args.doctype,
          role: args.role,
          permlevel: args.permlevel || 0,
          read: args.read !== false ? 1 : 0,
          write: args.write ? 1 : 0,
          create: args.create ? 1 : 0,
          delete: args.delete ? 1 : 0,
          submit: args.submit ? 1 : 0,
          cancel: args.cancel ? 1 : 0,
          amend: args.amend ? 1 : 0,
          report: args.report ? 1 : 0,
          export: args.export ? 1 : 0,
          import: args.import ? 1 : 0,
          print: args.print ? 1 : 0,
          email: args.email ? 1 : 0,
          share: args.share ? 1 : 0,
          if_owner: args.if_owner ? 1 : 0,
        };
        return await ctx.runBenchCommand({
          command: `execute frappe.permissions.add_permission --args '${JSON.stringify([args.doctype, args.role, args.permlevel || 0])}'`,
          site: args.site,
        });
      }
      case "frappe_get_permissions":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_list --args '${JSON.stringify(["DocPerm", { parent: args.doctype }])}'`,
          site: args.site,
        });
      case "frappe_add_user_permission": {
        const data = {
          doctype: "User Permission",
          user: args.user,
          allow: args.allow,
          for_value: args.for_value,
          applicable_for: args.applicable_for || "",
        };
        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }
      case "frappe_create_role_profile": {
        const data = {
          doctype: "Role Profile",
          role_profile: args.name,
          roles: args.roles.map((r: string) => ({ role: r })),
        };
        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }
      case "frappe_check_permission": {
        const checkArgs = [args.doctype, args.name || "", args.perm_type || "read"];
        if (args.user) checkArgs.push(args.user);
        return await ctx.runBenchCommand({
          command: `execute frappe.has_permission --args '${JSON.stringify(checkArgs)}'`,
          site: args.site,
        });
      }
      case "frappe_setup_field_level_security":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.set_value --args '${JSON.stringify(["DocField", { parent: args.doctype, fieldname: args.fieldname }, "permlevel", args.permlevel])}'`,
          site: args.site,
        });
      default:
        return null;
    }
  },
};
