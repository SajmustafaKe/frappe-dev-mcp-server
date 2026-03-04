import { ToolModule, ToolResult, ToolContext } from "../types.js";

export const workflowTools: ToolModule = {
  definitions: [
    {
      name: "frappe_create_workflow",
      description: "Create a complete Workflow with states, transitions, and actions for a DocType",
      inputSchema: {
        type: "object",
        properties: {
          workflow_name: { type: "string", description: "Name of the workflow" },
          doctype: { type: "string", description: "DocType to apply workflow to" },
          is_active: { type: "boolean", default: true },
          workflow_state_field: { type: "string", default: "workflow_state", description: "Field to store workflow state" },
          states: {
            type: "array",
            description: "Workflow states",
            items: {
              type: "object",
              properties: {
                state: { type: "string", description: "State name" },
                doc_status: { type: "number", enum: [0, 1, 2], description: "0=Draft, 1=Submitted, 2=Cancelled" },
                allow_edit: { type: "string", description: "Role that can edit in this state" },
                is_optional_state: { type: "boolean", default: false },
                style: { type: "string", enum: ["Primary", "Success", "Warning", "Danger", "Info", "Inverse"], description: "State indicator color" },
              },
              required: ["state", "doc_status"],
            },
          },
          transitions: {
            type: "array",
            description: "Workflow transitions",
            items: {
              type: "object",
              properties: {
                state: { type: "string", description: "Current state" },
                action: { type: "string", description: "Action label (button text)" },
                next_state: { type: "string", description: "Target state" },
                allowed: { type: "string", description: "Role allowed to perform this action" },
                condition: { type: "string", description: "Python condition expression (optional)" },
                allow_self_approval: { type: "boolean", default: true },
              },
              required: ["state", "action", "next_state", "allowed"],
            },
          },
          site: { type: "string" },
        },
        required: ["workflow_name", "doctype", "states", "transitions"],
      },
    },
    {
      name: "frappe_get_workflow",
      description: "Get workflow definition for a DocType",
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
      name: "frappe_apply_workflow_action",
      description: "Apply a workflow action/transition on a document",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          name: { type: "string", description: "Document name" },
          action: { type: "string", description: "Workflow action to apply" },
          site: { type: "string" },
        },
        required: ["doctype", "name", "action"],
      },
    },
    {
      name: "frappe_get_workflow_actions",
      description: "Get available workflow actions for a document based on current state and user role",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          name: { type: "string", description: "Document name" },
          site: { type: "string" },
        },
        required: ["doctype", "name"],
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_create_workflow": {
        const data = {
          doctype: "Workflow",
          workflow_name: args.workflow_name,
          document_type: args.doctype,
          is_active: args.is_active !== false ? 1 : 0,
          workflow_state_field: args.workflow_state_field || "workflow_state",
          states: args.states.map((s: any, idx: number) => ({
            state: s.state,
            doc_status: s.doc_status.toString(),
            allow_edit: s.allow_edit || "",
            is_optional_state: s.is_optional_state ? 1 : 0,
            style: s.style || "",
            idx: idx + 1,
          })),
          transitions: args.transitions.map((t: any, idx: number) => ({
            state: t.state,
            action: t.action,
            next_state: t.next_state,
            allowed: t.allowed,
            condition: t.condition || "",
            allow_self_approval: t.allow_self_approval !== false ? 1 : 0,
            idx: idx + 1,
          })),
        };
        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }
      case "frappe_get_workflow":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_list --args '${JSON.stringify(["Workflow", { document_type: args.doctype, is_active: 1 }])}'`,
          site: args.site,
        });
      case "frappe_apply_workflow_action":
        return await ctx.runBenchCommand({
          command: `execute frappe.model.workflow.apply_workflow --args '${JSON.stringify([{ doctype: args.doctype, name: args.name }, args.action])}'`,
          site: args.site,
        });
      case "frappe_get_workflow_actions":
        return await ctx.runBenchCommand({
          command: `execute frappe.model.workflow.get_transitions --args '${JSON.stringify([{ doctype: args.doctype, name: args.name }])}'`,
          site: args.site,
        });
      default:
        return null;
    }
  },
};
