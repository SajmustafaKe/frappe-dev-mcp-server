import { ToolModule, ToolResult, ToolContext } from "../types.js";

export const customizationTools: ToolModule = {
  definitions: [
    {
      name: "frappe_add_custom_field",
      description: "Add a Custom Field to an existing DocType without modifying the original app's code",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType to add field to" },
          fieldname: { type: "string", description: "Field name" },
          label: { type: "string", description: "Field label" },
          fieldtype: { type: "string", description: "Field type (Data, Link, Select, etc.)" },
          options: { type: "string", description: "Options for Select/Link fields" },
          insert_after: { type: "string", description: "Field name to insert after" },
          reqd: { type: "boolean", default: false },
          default: { type: "string", description: "Default value" },
          read_only: { type: "boolean", default: false },
          hidden: { type: "boolean", default: false },
          unique: { type: "boolean", default: false },
          in_list_view: { type: "boolean", default: false },
          in_standard_filter: { type: "boolean", default: false },
          depends_on: { type: "string", description: "Conditional display expression" },
          mandatory_depends_on: { type: "string" },
          fetch_from: { type: "string", description: "Fetch value from linked document field" },
          description: { type: "string" },
          is_virtual: { type: "boolean", default: false, description: "Virtual field (computed, no db column)" },
          site: { type: "string" },
        },
        required: ["doctype", "fieldname", "label", "fieldtype"],
      },
    },
    {
      name: "frappe_add_custom_fields_bulk",
      description: "Add multiple Custom Fields to one or more DocTypes at once",
      inputSchema: {
        type: "object",
        properties: {
          fields: {
            type: "object",
            description: "Map of DocType name to array of field definitions",
            additionalProperties: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  fieldname: { type: "string" },
                  label: { type: "string" },
                  fieldtype: { type: "string" },
                  options: { type: "string" },
                  insert_after: { type: "string" },
                  reqd: { type: "boolean" },
                },
                required: ["fieldname", "label", "fieldtype"],
              },
            },
          },
          site: { type: "string" },
        },
        required: ["fields"],
      },
    },
    {
      name: "frappe_add_property_setter",
      description: "Change a property of an existing DocType field without modifying the original code",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          fieldname: { type: "string", description: "Field name (use '' for DocType-level properties)" },
          property: { type: "string", description: "Property name to change (e.g., 'hidden', 'reqd', 'default', 'options', 'in_list_view', 'read_only', 'label', 'sort_field', 'sort_order')" },
          value: { type: "string", description: "New value for the property" },
          property_type: { type: "string", enum: ["Check", "Data", "Int", "Select", "Small Text", "Text", "Text Editor"], description: "Data type of the property value" },
          site: { type: "string" },
        },
        required: ["doctype", "fieldname", "property", "value"],
      },
    },
    {
      name: "frappe_get_customize_form",
      description: "Get the full customization of a DocType (custom fields, property setters, etc.)",
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
      name: "frappe_list_custom_fields",
      description: "List all Custom Fields for a DocType",
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
      name: "frappe_delete_custom_field",
      description: "Delete a Custom Field from a DocType",
      inputSchema: {
        type: "object",
        properties: {
          doctype: { type: "string", description: "DocType name" },
          fieldname: { type: "string", description: "Custom Field name (format: DocType-fieldname)" },
          site: { type: "string" },
        },
        required: ["doctype", "fieldname"],
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_add_custom_field": {
        const data: any = {
          doctype: "Custom Field",
          dt: args.doctype,
          fieldname: args.fieldname,
          label: args.label,
          fieldtype: args.fieldtype,
          options: args.options || "",
          insert_after: args.insert_after || "",
          reqd: args.reqd ? 1 : 0,
          default: args.default || "",
          read_only: args.read_only ? 1 : 0,
          hidden: args.hidden ? 1 : 0,
          unique: args.unique ? 1 : 0,
          in_list_view: args.in_list_view ? 1 : 0,
          in_standard_filter: args.in_standard_filter ? 1 : 0,
          depends_on: args.depends_on || "",
          mandatory_depends_on: args.mandatory_depends_on || "",
          fetch_from: args.fetch_from || "",
          description: args.description || "",
          is_virtual: args.is_virtual ? 1 : 0,
        };
        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }

      case "frappe_add_custom_fields_bulk": {
        const customFields: any[] = [];
        for (const [dt, fields] of Object.entries(args.fields as Record<string, any[]>)) {
          for (const field of fields) {
            customFields.push({
              doctype: "Custom Field",
              dt,
              fieldname: field.fieldname,
              label: field.label,
              fieldtype: field.fieldtype,
              options: field.options || "",
              insert_after: field.insert_after || "",
              reqd: field.reqd ? 1 : 0,
            });
          }
        }
        const results: string[] = [];
        for (const cf of customFields) {
          const result = await ctx.runBenchCommand({
            command: `execute frappe.client.insert --args '${JSON.stringify(cf)}'`,
            site: args.site,
          });
          results.push(`${cf.dt}.${cf.fieldname}: ${result.content[0].text.substring(0, 50)}`);
        }
        return { content: [{ type: "text", text: `Added ${customFields.length} custom field(s):\n${results.join("\n")}` }] };
      }

      case "frappe_add_property_setter": {
        const data = {
          doctype: "Property Setter",
          doc_type: args.doctype,
          field_name: args.fieldname || "",
          property: args.property,
          value: args.value,
          property_type: args.property_type || "Data",
        };
        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }

      case "frappe_get_customize_form":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get --args '${JSON.stringify(["Customize Form", { doc_type: args.doctype }])}'`,
          site: args.site,
        });

      case "frappe_list_custom_fields":
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_list --args '${JSON.stringify(["Custom Field", { dt: args.doctype }])}'`,
          site: args.site,
        });

      case "frappe_delete_custom_field": {
        const cfName = args.fieldname.includes("-") ? args.fieldname : `${args.doctype}-${args.fieldname}`;
        return await ctx.runBenchCommand({
          command: `execute frappe.client.delete --args '${JSON.stringify(["Custom Field", cfName])}'`,
          site: args.site,
        });
      }

      default:
        return null;
    }
  },
};
