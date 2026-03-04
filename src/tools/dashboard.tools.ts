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
      description: "Create a Workspace page (v16 redesigned workspace with sidebar navigation and desktop icon support)",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Workspace name" },
          module: { type: "string", description: "Module name" },
          label: { type: "string", description: "Display label" },
          icon: { type: "string", description: "Icon name (shown on desktop screen for public workspaces)" },
          is_public: { type: "boolean", default: true, description: "Public workspaces appear as icons on the v16 desktop screen" },
          for_user: { type: "string", description: "User email (for private 'My Workspaces' - accessible via sidebar)" },
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
            description: "Quick shortcuts shown on workspace page",
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
      name: "frappe_create_workspace_sidebar",
      description: "Create a Workspace Sidebar (v16) - the persistent left sidebar navigation. Public sidebars (no for_user) appear for all users. Private sidebars (with for_user) appear only for that user in 'My Workspaces'.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Sidebar title (used as document name)" },
          header_icon: { type: "string", description: "Icon displayed in the sidebar header (emoji or icon name)" },
          for_user: { type: "string", description: "User email for private sidebar (leave empty for public/standard)" },
          standard: { type: "boolean", default: false, description: "Whether this is a standard (app-bundled) sidebar" },
          app: { type: "string", description: "App name (required if standard=true)" },
          items: {
            type: "array",
            description: "Sidebar navigation items (Workspace Sidebar Item child table)",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["Link", "Section Break", "Spacer", "Sidebar Item Group"], default: "Link", description: "Item type" },
                label: { type: "string", description: "Display label" },
                link_type: { type: "string", enum: ["DocType", "Page", "Report", "Workspace", "Dashboard", "URL"], default: "DocType", description: "What the link points to (for Link type)" },
                link_to: { type: "string", description: "Target document/page name (for non-URL link types)" },
                url: { type: "string", description: "URL (only when link_type is 'URL')" },
                icon: { type: "string", description: "Item icon (emoji supported)" },
                child: { type: "boolean", default: false, description: "Whether this is a child/nested item" },
                indent: { type: "boolean", default: false, description: "Indent the section (for Section Break type)" },
                collapsible: { type: "boolean", default: true, description: "Whether section is collapsible (for Section Break)" },
                keep_closed: { type: "boolean", default: false, description: "Start section collapsed (for Section Break)" },
                show_arrow: { type: "boolean", default: false, description: "Show expand arrow (for indented sections)" },
                navigate_to_tab: { type: "string", description: "Navigate to specific tab when link_type is DocType" },
                display_depends_on: { type: "string", description: "JS expression for conditional display" },
                filters: { type: "string", description: "JSON filters applied when navigating" },
                route_options: { type: "string", description: "JSON route options for navigation" },
              },
              required: ["type", "label"],
            },
          },
          site: { type: "string" },
        },
        required: ["title", "items"],
      },
    },
    {
      name: "frappe_get_workspace_sidebar",
      description: "Get the Workspace Sidebar configuration for the current user or a specific sidebar by title",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Sidebar title (optional, gets all if not specified)" },
          for_user: { type: "string", description: "User email to get user-specific sidebar" },
          site: { type: "string" },
        },
      },
    },
    {
      name: "frappe_update_workspace_sidebar",
      description: "Update an existing Workspace Sidebar - add, remove, or reorder items",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Sidebar title to update" },
          items: {
            type: "array",
            description: "Complete replacement list of sidebar items",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["Link", "Section Break", "Spacer", "Sidebar Item Group"], default: "Link" },
                label: { type: "string" },
                link_type: { type: "string", enum: ["DocType", "Page", "Report", "Workspace", "Dashboard", "URL"] },
                link_to: { type: "string" },
                url: { type: "string" },
                icon: { type: "string" },
                child: { type: "boolean", default: false },
                collapsible: { type: "boolean", default: true },
                keep_closed: { type: "boolean", default: false },
                display_depends_on: { type: "string" },
                filters: { type: "string" },
              },
              required: ["type", "label"],
            },
          },
          site: { type: "string" },
        },
        required: ["title", "items"],
      },
    },
    {
      name: "frappe_add_to_my_workspace",
      description: "Add a workspace to the current user's 'My Workspaces' sidebar (v16 private workspace cloning)",
      inputSchema: {
        type: "object",
        properties: {
          workspace_name: { type: "string", description: "Name of the public workspace to add to My Workspaces" },
          user: { type: "string", description: "User email" },
          site: { type: "string" },
        },
        required: ["workspace_name", "user"],
      },
    },
    {
      name: "frappe_list_workspace_sidebars",
      description: "List all Workspace Sidebars (v16), optionally filtered by user or standard status",
      inputSchema: {
        type: "object",
        properties: {
          for_user: { type: "string", description: "Filter by user email" },
          standard: { type: "boolean", description: "Filter by standard flag" },
          site: { type: "string" },
        },
      },
    },
    {
      name: "frappe_list_workspaces",
      description: "List all workspaces (v16: public ones appear as desktop icons, private ones in 'My Workspaces' sidebar)",
      inputSchema: {
        type: "object",
        properties: {
          module: { type: "string", description: "Filter by module" },
          is_public: { type: "boolean", description: "Filter: true=desktop icons, false=private" },
          for_user: { type: "string", description: "Filter by user (for private workspaces)" },
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

      case "frappe_create_workspace_sidebar": {
        const sidebarData: any = {
          doctype: "Workspace Sidebar",
          title: args.title,
          header_icon: args.header_icon || "",
          for_user: args.for_user || "",
          standard: args.standard ? 1 : 0,
          app: args.app || "",
          items: args.items.map((item: any, idx: number) => {
            const sidebarItem: any = {
              type: item.type || "Link",
              label: item.label,
              icon: item.icon || "",
              child: item.child ? 1 : 0,
              idx: idx + 1,
            };

            if (item.type === "Link" || !item.type) {
              sidebarItem.link_type = item.link_type || "DocType";
              if (item.link_type === "URL") {
                sidebarItem.url = item.url || "";
              } else {
                sidebarItem.link_to = item.link_to || "";
              }
              if (item.navigate_to_tab) sidebarItem.navigate_to_tab = item.navigate_to_tab;
              if (item.filters) sidebarItem.filters = item.filters;
              if (item.route_options) sidebarItem.route_options = item.route_options;
            }

            if (item.type === "Section Break") {
              sidebarItem.indent = item.indent ? 1 : 0;
              sidebarItem.collapsible = item.collapsible !== false ? 1 : 0;
              sidebarItem.keep_closed = item.keep_closed ? 1 : 0;
              sidebarItem.show_arrow = item.show_arrow ? 1 : 0;
            }

            if (item.display_depends_on) sidebarItem.display_depends_on = item.display_depends_on;

            return sidebarItem;
          }),
        };

        return await ctx.runBenchCommand({
          command: `execute frappe.client.insert --args '${JSON.stringify(sidebarData)}'`,
          site: args.site,
        });
      }

      case "frappe_get_workspace_sidebar": {
        if (args.title) {
          return await ctx.runBenchCommand({
            command: `execute frappe.client.get --args '${JSON.stringify(["Workspace Sidebar", args.title])}'`,
            site: args.site,
          });
        }
        const filters: any = {};
        if (args.for_user) filters.for_user = args.for_user;
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_list --args '${JSON.stringify(["Workspace Sidebar", filters, ["title", "header_icon", "for_user", "standard", "app"]])}'`,
          site: args.site,
        });
      }

      case "frappe_update_workspace_sidebar": {
        // Get existing sidebar, update items
        const updateData: any = {
          doctype: "Workspace Sidebar",
          name: args.title,
          items: args.items.map((item: any, idx: number) => {
            const sidebarItem: any = {
              type: item.type || "Link",
              label: item.label,
              icon: item.icon || "",
              child: item.child ? 1 : 0,
              idx: idx + 1,
            };
            if (item.type === "Link" || !item.type) {
              sidebarItem.link_type = item.link_type || "DocType";
              if (item.link_type === "URL") {
                sidebarItem.url = item.url || "";
              } else {
                sidebarItem.link_to = item.link_to || "";
              }
            }
            if (item.type === "Section Break") {
              sidebarItem.collapsible = item.collapsible !== false ? 1 : 0;
              sidebarItem.keep_closed = item.keep_closed ? 1 : 0;
            }
            if (item.display_depends_on) sidebarItem.display_depends_on = item.display_depends_on;
            if (item.filters) sidebarItem.filters = item.filters;
            return sidebarItem;
          }),
        };

        return await ctx.runBenchCommand({
          command: `execute frappe.client.save --args '${JSON.stringify(updateData)}'`,
          site: args.site,
        });
      }

      case "frappe_add_to_my_workspace": {
        // In v16, this clones a public workspace to a user's private "My Workspaces" with title format: WorkspaceName-username
        return await ctx.runBenchCommand({
          command: `execute frappe.desk.doctype.workspace_sidebar.workspace_sidebar.add_to_my_workspace --args '${JSON.stringify({ workspace: args.workspace_name, user: args.user })}'`,
          site: args.site,
        });
      }

      case "frappe_list_workspace_sidebars": {
        const filters: any = {};
        if (args.for_user) filters.for_user = args.for_user;
        if (args.standard !== undefined) filters.standard = args.standard ? 1 : 0;
        return await ctx.runBenchCommand({
          command: `execute frappe.client.get_list --args '${JSON.stringify(["Workspace Sidebar", filters, ["title", "header_icon", "for_user", "standard", "app"]])}'`,
          site: args.site,
        });
      }

      case "frappe_list_workspaces": {
        const filters: any = {};
        if (args.module) filters.module = args.module;
        if (args.is_public !== undefined) filters.is_public = args.is_public ? 1 : 0;
        if (args.for_user) filters.for_user = args.for_user;
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
