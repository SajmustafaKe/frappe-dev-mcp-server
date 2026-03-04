import { ToolModule, ToolResult, ToolContext } from "../types.js";

export const communicationTools: ToolModule = {
  definitions: [
    {
      name: "frappe_create_notification",
      description: "Create a Frappe Notification (email, system, SMS, or push notification triggered by document events)",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Notification name" },
          channel: { type: "string", enum: ["Email", "System Notification", "SMS", "Slack"], description: "Notification channel" },
          doctype: { type: "string", description: "DocType that triggers the notification" },
          event: { type: "string", enum: ["New", "Save", "Submit", "Cancel", "Days After", "Days Before", "Value Change", "Method", "Custom"], description: "Triggering event" },
          subject: { type: "string", description: "Notification subject (supports Jinja)" },
          message: { type: "string", description: "Notification body (HTML/Jinja template)" },
          recipients: { type: "array", items: { type: "object", properties: { receiver_by_document_field: { type: "string" }, receiver_by_role: { type: "string" }, cc: { type: "string" }, bcc: { type: "string" } } }, description: "Recipient rules" },
          condition: { type: "string", description: "Python condition for sending (e.g., 'doc.status == \"Approved\"')" },
          value_changed: { type: "string", description: "Field name (for Value Change event)" },
          days_in_advance: { type: "number", description: "Days before/after (for Days Before/After events)" },
          date_changed: { type: "string", description: "Date field (for Days Before/After events)" },
          attach_print: { type: "boolean", default: false, description: "Attach print format (v16: can now attach files from DocType)" },
          print_format: { type: "string", description: "Print format to attach" },
          enabled: { type: "boolean", default: true },
          site: { type: "string" },
        },
        required: ["name", "channel", "doctype", "event"],
      },
    },
    {
      name: "frappe_create_email_template",
      description: "Create an Email Template with Jinja support for use in notifications and emails",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Template name" },
          subject: { type: "string", description: "Email subject (supports Jinja: {{ doc.name }})" },
          response: { type: "string", description: "Email body HTML (supports Jinja: {{ doc.field }})" },
          reference_doctype: { type: "string", description: "Associated DocType for context variables" },
          enabled: { type: "boolean", default: true },
          site: { type: "string" },
        },
        required: ["name", "subject", "response"],
      },
    },
    {
      name: "frappe_send_email",
      description: "Send an email programmatically via Frappe. Note: v16 frappe.sendmail(now=True) no longer commits transactions.",
      inputSchema: {
        type: "object",
        properties: {
          recipients: { type: "array", items: { type: "string" }, description: "List of email addresses" },
          subject: { type: "string", description: "Email subject" },
          message: { type: "string", description: "Email body (HTML)" },
          template: { type: "string", description: "Email template name (optional)" },
          args: { type: "object", description: "Template variables (optional)" },
          reference_doctype: { type: "string", description: "Reference DocType (optional)" },
          reference_name: { type: "string", description: "Reference document name (optional)" },
          site: { type: "string" },
        },
        required: ["recipients", "subject"],
      },
    },
    {
      name: "frappe_list_notifications",
      description: "List all Notification documents",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "Filter by DocType" },
          enabled: { type: "boolean", description: "Filter by enabled status" },
          site: { type: "string" },
        },
      },
    },
    {
      name: "frappe_create_webhook",
      description: "Create a Webhook to send data to external services on document events",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Webhook name" },
          doctype: { type: "string", description: "DocType that triggers webhook" },
          webhook_docevent: { type: "string", enum: ["after_insert", "on_update", "on_submit", "on_cancel", "on_trash", "on_update_after_submit", "on_change"], description: "Document event trigger" },
          request_url: { type: "string", description: "URL to send webhook data to" },
          request_method: { type: "string", enum: ["POST", "PUT", "DELETE"], default: "POST" },
          request_structure: { type: "string", enum: ["Form URL-Encoded", "JSON"], default: "JSON" },
          webhook_headers: { type: "array", items: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } } }, description: "HTTP headers" },
          webhook_data: { type: "array", items: { type: "object", properties: { fieldname: { type: "string" }, key: { type: "string" } } }, description: "Data mapping" },
          condition: { type: "string", description: "Python condition" },
          enabled: { type: "boolean", default: true },
          site: { type: "string" },
        },
        required: ["name", "doctype", "webhook_docevent", "request_url"],
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_create_notification": {
        const data: any = {
          doctype: "Notification",
          name: args.name,
          channel: args.channel,
          document_type: args.doctype,
          event: args.event,
          subject: args.subject || "",
          message: args.message || "",
          condition: args.condition || "",
          enabled: args.enabled !== false ? 1 : 0,
          attach_print: args.attach_print ? 1 : 0,
          print_format: args.print_format || "",
        };
        if (args.value_changed) data.value_changed = args.value_changed;
        if (args.days_in_advance) data.days_in_advance = args.days_in_advance;
        if (args.date_changed) data.date_changed = args.date_changed;
        if (args.recipients) data.recipients = args.recipients;

        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }

      case "frappe_create_email_template": {
        const data = {
          doctype: "Email Template",
          name: args.name,
          subject: args.subject,
          response: args.response,
          reference_doctype: args.reference_doctype || "",
          enabled: args.enabled !== false ? 1 : 0,
        };
        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }

      case "frappe_send_email": {
        const emailArgs: any = {
          recipients: args.recipients,
          subject: args.subject,
        };
        if (args.message) emailArgs.message = args.message;
        if (args.template) emailArgs.template = args.template;
        if (args.args) emailArgs.args = args.args;
        if (args.reference_doctype) emailArgs.reference_doctype = args.reference_doctype;
        if (args.reference_name) emailArgs.reference_name = args.reference_name;

        return await ctx.runBenchCommand({
          command: `execute frappe.sendmail --kwargs '${JSON.stringify(emailArgs)}'`,
          site: args.site,
        });
      }

      case "frappe_list_notifications": {
        const filters: any = {};
        if (args.doctype) filters.document_type = args.doctype;
        if (args.enabled !== undefined) filters.enabled = args.enabled ? 1 : 0;
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_list --args '${JSON.stringify(["Notification", filters])}'`,
          site: args.site,
        });
      }

      case "frappe_create_webhook": {
        const data: any = {
          doctype: "Webhook",
          name: args.name,
          webhook_doctype: args.doctype,
          webhook_docevent: args.webhook_docevent,
          request_url: args.request_url,
          request_method: args.request_method || "POST",
          request_structure: args.request_structure || "JSON",
          condition: args.condition || "",
          enabled: args.enabled !== false ? 1 : 0,
        };
        if (args.webhook_headers) data.webhook_headers = args.webhook_headers;
        if (args.webhook_data) data.webhook_data = args.webhook_data;

        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }

      default:
        return null;
    }
  },
};
