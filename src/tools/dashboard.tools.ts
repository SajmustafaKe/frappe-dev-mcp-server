import { ToolModule, ToolResult, ToolContext } from "../types.js";

export const dashboardTools: ToolModule = {
  definitions: [
    {
      name: "frappe_create_dashboard_chart",
      description: "Create a Dashboard Chart for data visualization",
      inputSchema: {
        type: "object",
        properties: {
          chart_name: { type: "string", description: "Chart name" },
          chart_type: { type: "string", enum: ["Count", "Sum", "Average", "Group By", "Custom"], description: "Chart type" },
          document_type: { type: "string", description: "Source DocType" },
          based_on: { type: "string", description: "Date field to base chart on" },
          value_based_on: { type: "string", description: "Value field (for Sum/Average)" },
          group_by_based_on: { type: "string", description: "Group by field" },
          time_interval: { type: "string", enum: ["Yearly", "Quarterly", "Monthly", "Weekly", "Daily"], default: "Monthly" },
          timespan: { type: "string", enum: ["Last Year", "Last Quarter", "Last Month", "Last Week", "Select Date Range"], default: "Last Year" },
          type: { type: "string", enum: ["Line", "Bar", "Percentage", "Pie", "Donut", "Heatmap"], default: "Line", description: "Visual chart type" },
          filters_json: { type: "string", description: "JSON string of filters" },
          color: { type: "string", description: "Chart color hex code" },
          is_public: { type: "boolean", default: true },
          custom_options: { type: "string", description: "Custom chart.js options (for Custom type)" },
          source: { type: "string", description: "Report name (for Report-based charts)" },
          site: { type: "string" },
        },
        required: ["chart_name", "chart_type", "document_type"],
      },
    },
    {
      name: "frappe_create_number_card",
      description: "Create a Number Card for dashboard KPIs",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Number Card name" },
          document_type: { type: "string", description: "Source DocType" },
          function: { type: "string", enum: ["Count", "Sum", "Average", "Minimum", "Maximum"], description: "Aggregation function" },
          aggregate_function_based_on: { type: "string", description: "Field for aggregation (for Sum/Average/Min/Max)" },
          filters_json: { type: "string", description: "JSON string of filters" },
          label: { type: "string", description: "Display label" },
          color: { type: "string", description: "Card color" },
          show_percentage_stats: { type: "boolean", default: true },
          stats_time_interval: { type: "string", enum: ["Daily", "Weekly", "Monthly", "Yearly"], default: "Monthly" },
          is_public: { type: "boolean", default: true },
          site: { type: "string" },
        },
        required: ["name", "document_type", "function"],
      },
    },
    {
      name: "frappe_create_workspace",
      description: "Create a Workspace page (v16 redesigned workspace with sidebar navigation)",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Workspace name" },
          module: { type: "string", description: "Module name" },
          label: { type: "string", description: "Display label" },
          icon: { type: "string", description: "Icon name" },
          is_public: { type: "boolean", default: true },
          for_user: { type: "string", description: "User email (for private workspaces)" },
          shortcuts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                type: { type: "string", enum: ["DocType", "Report", "Page", "URL"] },
                link_to: { type: "string" },
                color: { type: "string" },
                icon: { type: "string" },
                stats_filter: { type: "string", description: "JSON filter for count badge" },
              },
              required: ["label", "type", "link_to"],
            },
            description: "Quick shortcuts",
          },
          links: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                type: { type: "string", enum: ["DocType", "Report", "Page", "URL"] },
                link_to: { type: "string" },
                link_type: { type: "string", enum: ["Link", "Card Break"], default: "Link" },
                onboard: { type: "boolean", default: false },
                dependencies: { type: "string" },
              },
              required: ["label", "type", "link_to"],
            },
            description: "Navigation links",
          },
          charts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                chart_name: { type: "string" },
                label: { type: "string" },
              },
              required: ["chart_name"],
            },
            description: "Dashboard charts to include",
          },
          number_cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                number_card_name: { type: "string" },
                label: { type: "string" },
              },
              required: ["number_card_name"],
            },
            description: "Number cards to include",
          },
          site: { type: "string" },
        },
        required: ["name", "label"],
      },
    },
    {
      name: "frappe_list_workspaces",
      description: "List all workspaces",
      inputSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "Filter by module" },
          is_public: { type: "boolean" },
          site: { type: "string" },
        },
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_create_dashboard_chart": {
        const data: any = {
          doctype: "Dashboard Chart",
          chart_name: args.chart_name,
          chart_type: args.chart_type,
          document_type: args.document_type,
          based_on: args.based_on || "",
          value_based_on: args.value_based_on || "",
          group_by_based_on: args.group_by_based_on || "",
          time_interval: args.time_interval || "Monthly",
          timespan: args.timespan || "Last Year",
          type: args.type || "Line",
          filters_json: args.filters_json || "[]",
          color: args.color || "",
          is_public: args.is_public !== false ? 1 : 0,
        };
        if (args.custom_options) data.custom_options = args.custom_options;
        if (args.source) data.source = args.source;

        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }

      case "frappe_create_number_card": {
        const data: any = {
          doctype: "Number Card",
          name: args.name,
          document_type: args.document_type,
          function: args.function,
          aggregate_function_based_on: args.aggregate_function_based_on || "",
          filters_json: args.filters_json || "[]",
          label: args.label || args.name,
          color: args.color || "",
          show_percentage_stats: args.show_percentage_stats !== false ? 1 : 0,
          stats_time_interval: args.stats_time_interval || "Monthly",
          is_public: args.is_public !== false ? 1 : 0,
        };
        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }

      case "frappe_create_workspace": {
        const data: any = {
          doctype: "Workspace",
          name: args.name,
          module: args.module || "",
          label: args.label,
          icon: args.icon || "",
          is_public: args.is_public !== false ? 1 : 0,
          for_user: args.for_user || "",
        };
        if (args.shortcuts) {
          data.shortcuts = args.shortcuts.map((s: any, idx: number) => ({
            label: s.label,
            type: s.type,
            link_to: s.link_to,
            color: s.color || "",
            icon: s.icon || "",
            stats_filter: s.stats_filter || "",
            idx: idx + 1,
          }));
        }
        if (args.links) {
          data.links = args.links.map((l: any, idx: number) => ({
            label: l.label,
            type: l.type,
            link_to: l.link_to,
            link_type: l.link_type || "Link",
            onboard: l.onboard ? 1 : 0,
            dependencies: l.dependencies || "",
            idx: idx + 1,
          }));
        }
        if (args.charts) {
          data.charts = args.charts.map((c: any, idx: number) => ({
            chart_name: c.chart_name,
            label: c.label || c.chart_name,
            idx: idx + 1,
          }));
        }
        if (args.number_cards) {
          data.number_cards = args.number_cards.map((n: any, idx: number) => ({
            number_card_name: n.number_card_name,
            label: n.label || n.number_card_name,
            idx: idx + 1,
          }));
        }

        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(data)}'`,
          site: args.site,
        });
      }

      case "frappe_list_workspaces": {
        const filters: any = {};
        if (args.module) filters.module = args.module;
        if (args.is_public !== undefined) filters.is_public = args.is_public ? 1 : 0;
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_list --args '${JSON.stringify(["Workspace", filters])}'`,
          site: args.site,
        });
      }

      default:
        return null;
    }
  },
};
