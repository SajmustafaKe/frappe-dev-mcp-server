import { ToolModule, ToolResult, ToolContext } from "../types.js";

export const documentTools: ToolModule = {
  definitions: [
    {
      name: "frappe_create_document",
      description: "Create a new Frappe document",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          data: { type: "object", description: "Document field values" },
          site: { type: "string", description: "Site name (optional)" },
        },
        required: ["doctype", "data"],
      },
    },
    {
      name: "frappe_get_document",
      description: "Retrieve a Frappe document by DocType and name",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          name: { type: "string", description: "Document name" },
          site: { type: "string", description: "Site name (optional)" },
        },
        required: ["doctype", "name"],
      },
    },
    {
      name: "frappe_update_document",
      description: "Update an existing Frappe document",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          name: { type: "string", description: "Document name" },
          data: { type: "object", description: "Fields to update" },
          site: { type: "string", description: "Site name (optional)" },
        },
        required: ["doctype", "name", "data"],
      },
    },
    {
      name: "frappe_delete_document",
      description: "Delete a Frappe document",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          name: { type: "string", description: "Document name" },
          site: { type: "string", description: "Site name (optional)" },
        },
        required: ["doctype", "name"],
      },
    },
    {
      name: "frappe_list_documents",
      description: "List Frappe documents with filters, field selection, ordering, and pagination",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          filters: { type: "object", description: "Filter conditions" },
          fields: { type: "array", items: { type: "string" }, description: "Fields to return" },
          order_by: { type: "string", description: "Sort expression (v16 default: creation desc)" },
          limit: { type: "number", default: 20, description: "Max documents to return" },
          site: { type: "string", description: "Site name (optional)" },
        },
        required: ["doctype"],
      },
    },
    {
      name: "frappe_get_count",
      description: "Get count of documents matching filters",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          filters: { type: "object", description: "Filter conditions" },
          site: { type: "string", description: "Site name (optional)" },
        },
        required: ["doctype"],
      },
    },
    {
      name: "frappe_get_value",
      description: "Get specific field value(s) from a document",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          name: { type: "string", description: "Document name or filters" },
          fieldname: { type: "string", description: "Field name or comma-separated field names" },
          site: { type: "string", description: "Site name (optional)" },
        },
        required: ["doctype", "fieldname"],
      },
    },
    {
      name: "frappe_set_value",
      description: "Set a specific field value on a document",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          name: { type: "string", description: "Document name" },
          fieldname: { type: "string", description: "Field name" },
          value: { type: "string", description: "New value" },
          site: { type: "string", description: "Site name (optional)" },
        },
        required: ["doctype", "name", "fieldname", "value"],
      },
    },
    {
      name: "frappe_rename_document",
      description: "Rename a document",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          old_name: { type: "string", description: "Current document name" },
          new_name: { type: "string", description: "New document name" },
          site: { type: "string", description: "Site name (optional)" },
        },
        required: ["doctype", "old_name", "new_name"],
      },
    },
    {
      name: "frappe_submit_document",
      description: "Submit a submittable document",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          name: { type: "string", description: "Document name" },
          site: { type: "string", description: "Site name (optional)" },
        },
        required: ["doctype", "name"],
      },
    },
    {
      name: "frappe_cancel_document",
      description: "Cancel a submitted document",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          name: { type: "string", description: "Document name" },
          site: { type: "string", description: "Site name (optional)" },
        },
        required: ["doctype", "name"],
      },
    },
    {
      name: "frappe_amend_document",
      description: "Amend a cancelled document (create amended copy)",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          name: { type: "string", description: "Document name to amend" },
          site: { type: "string", description: "Site name (optional)" },
        },
        required: ["doctype", "name"],
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_create_document": {
        const docData = { doctype: args.doctype, ...args.data };
        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(docData)}'`,
          site: args.site,
        });
      }
      case "frappe_get_document":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get --args '${JSON.stringify([args.doctype, args.name])}'`,
          site: args.site,
        });
      case "frappe_update_document": {
        const updateData = { doctype: args.doctype, name: args.name, ...args.data };
        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(updateData)}'`,
          site: args.site,
        });
      }
      case "frappe_delete_document":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.delete --args '${JSON.stringify([args.doctype, args.name])}'`,
          site: args.site,
        });
      case "frappe_list_documents": {
        const listArgs: any = [args.doctype, args.filters || {}];
        if (args.fields) listArgs.push(args.fields);
        if (args.order_by) listArgs.push(null, args.order_by);
        if (args.limit) listArgs.push(args.limit);
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_list --args '${JSON.stringify(listArgs)}'`,
          site: args.site,
        });
      }
      case "frappe_get_count":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_count --args '${JSON.stringify([args.doctype, args.filters || {}])}'`,
          site: args.site,
        });
      case "frappe_get_value":
        return await ctx.runBenchCommand({
          command: `execute frappe.db.get_value --args '${JSON.stringify([args.doctype, args.name || {}, args.fieldname])}'`,
          site: args.site,
        });
      case "frappe_set_value":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.set_value --args '${JSON.stringify([args.doctype, args.name, args.fieldname, args.value])}'`,
          site: args.site,
        });
      case "frappe_rename_document":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.rename_doc --args '${JSON.stringify([args.doctype, args.old_name, args.new_name])}'`,
          site: args.site,
        });
      case "frappe_submit_document":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.submit --args '${JSON.stringify({ doctype: args.doctype, name: args.name })}'`,
          site: args.site,
        });
      case "frappe_cancel_document":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.cancel --args '${JSON.stringify({ doctype: args.doctype, name: args.name })}'`,
          site: args.site,
        });
      case "frappe_amend_document":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.amend --args '${JSON.stringify({ doctype: args.doctype, name: args.name })}'`,
          site: args.site,
        });
      default:
        return null;
    }
  },
};
