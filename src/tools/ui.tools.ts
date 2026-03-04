import { ToolModule, ToolResult, ToolContext } from "../types.js";

export const uiTools: ToolModule = {
  definitions: [
    {
      name: "frappe_generate_frappe_ui_component",
      description: "Generate a Vue 3 component using frappe-ui library",
      inputSchema: {
        type: "object",
        properties: {
          component_name: { type: "string", description: "Component name" },
          component_type: { type: "string", enum: ["Button", "Dialog", "Form", "List", "DetailDrawer", "TextInput", "Autocomplete", "Avatar", "Badge", "Breadcrumbs", "Card", "Dropdown", "ErrorMessage", "FeatherIcon", "FileUploader", "GreenCheckIcon", "LoadingIndicator", "LoadingText", "Popover", "Rating", "Spinner", "Switch", "Tabs", "TextEditor", "Toast", "Tooltip"], description: "frappe-ui component type" },
          props: { type: "object", description: "Component props" },
          content: { type: "string", description: "Slot content" },
        },
        required: ["component_name", "component_type"],
      },
    },
    {
      name: "frappe_generate_vue_page",
      description: "Generate a complete Vue page with frappe-ui layout and components",
      inputSchema: {
        type: "object",
        properties: {
          page_name: { type: "string", description: "Page name" },
          route: { type: "string", description: "Vue Router route path" },
          components: { type: "array", items: { type: "string" }, description: "Components to include" },
          layout: { type: "string", enum: ["single-column", "sidebar", "full-width"], default: "single-column" },
        },
        required: ["page_name", "route"],
      },
    },
    {
      name: "frappe_get_vue_component_tree",
      description: "Get the Vue component tree structure for a page",
      inputSchema: {
        type: "object",
        properties: {
          page: { type: "string", description: "Page name" },
        },
        required: ["page"],
      },
    },
    {
      name: "frappe_create_ui_block",
      description: "Create UI blocks using frappe-ui and Tailwind CSS patterns",
      inputSchema: {
        type: "object",
        properties: {
          block_type: { type: "string", enum: ["hero", "features", "pricing", "contact", "footer", "navbar", "sidebar", "card", "form", "stats", "table", "timeline", "empty-state"], description: "Block type" },
          theme: { type: "string", enum: ["light", "dark", "auto"], default: "light" },
          customization: { type: "string", description: "Customization instructions" },
        },
        required: ["block_type"],
      },
    },
    {
      name: "frappe_inspire_ui_block",
      description: "Generate creative UI blocks inspired by modern design patterns",
      inputSchema: {
        type: "object",
        properties: {
          inspiration: { type: "string", description: "Design inspiration description" },
          framework: { type: "string", enum: ["vue", "react", "svelte"], default: "vue" },
        },
        required: ["inspiration"],
      },
    },
    {
      name: "frappe_refine_ui_block",
      description: "Refine and improve existing UI blocks with responsive, dark mode, or animation enhancements",
      inputSchema: {
        type: "object",
        properties: {
          existing_code: { type: "string", description: "Existing HTML/Vue code" },
          improvements: { type: "string", description: "Desired improvements (e.g., 'responsive', 'dark mode', 'animation')" },
        },
        required: ["existing_code", "improvements"],
      },
    },
    {
      name: "frappe_get_ui_templates",
      description: "Get available UI templates and patterns organized by category",
      inputSchema: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["layout", "component", "page", "all"], default: "all" },
        },
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_generate_frappe_ui_component": {
        const { component_name, component_type, props = {}, content = "" } = args;
        const propsStr = Object.entries(props).map(([k, v]) => `${k}="${v}"`).join(" ");

        const componentTemplates: Record<string, string> = {
          Button: `<Button ${propsStr}>${content || "Click me"}</Button>`,
          Dialog: `<Dialog v-model="showDialog" :options="{ title: '${props.title || "Dialog"}', size: 'lg' }">\n  <template #body-content>\n    ${content || "Dialog content"}\n  </template>\n</Dialog>`,
          Form: `<Form @submit="handleSubmit">\n  ${content || "<!-- Form fields -->"}\n  <Button type="submit">Submit</Button>\n</Form>`,
          List: `<ListView :columns="columns" :rows="rows" row-key="name">\n  <template #default="{ row }">\n    ${content || "{{ row.name }}"}\n  </template>\n</ListView>`,
          DetailDrawer: `<DetailDrawer v-model:open="drawerOpen" :title="'${props.title || "Details"}'">\n  ${content || "<!-- Detail content -->"}\n</DetailDrawer>`,
          TextInput: `<TextInput v-model="value" ${propsStr} />`,
          Autocomplete: `<Autocomplete v-model="selected" :options="options" ${propsStr} />`,
          Card: `<div class="rounded-lg border p-4">\n  ${content || "<h3>Card Title</h3><p>Card content</p>"}\n</div>`,
          Tabs: `<Tabs v-model="activeTab" :tabs="tabs">\n  <template #default="{ tab }">\n    ${content || "{{ tab.label }}"}\n  </template>\n</Tabs>`,
        };

        const template = componentTemplates[component_type] || `<${component_type} ${propsStr}>${content}</${component_type}>`;

        const code = `<template>\n  ${template}\n</template>\n\n<script setup>\nimport { ${component_type} } from 'frappe-ui'\nimport { ref } from 'vue'\n</script>`;
        return { content: [{ type: "text", text: `Generated ${component_type} component "${component_name}":\n\n${code}` }] };
      }

      case "frappe_generate_vue_page": {
        const { page_name, route, components = [], layout = "single-column" } = args;
        const layoutClass = layout === "sidebar" ? "flex" : layout === "full-width" ? "w-full" : "max-w-4xl mx-auto";
        const imports = components.map((c: string) => `import ${c} from '@/components/${c}.vue'`).join("\n");
        const componentTags = components.map((c: string) => `<${c} />`).join("\n      ");

        const code = `<template>\n  <div class="${layoutClass} p-6">\n    <h1 class="text-2xl font-bold mb-4">${page_name}</h1>\n    <div class="space-y-4">\n      ${componentTags}\n    </div>\n  </div>\n</template>\n\n<script setup>\n${imports}\n</script>`;
        return { content: [{ type: "text", text: `Generated Vue page for route "${route}":\n\n${code}` }] };
      }

      case "frappe_get_vue_component_tree": {
        const tree = {
          page: args.page,
          components: [
            { name: "Header", children: [] },
            { name: "Sidebar", children: [] },
            { name: "MainContent", children: [{ name: "ListView", children: [] }, { name: "DetailDrawer", children: [] }] },
          ],
        };
        return { content: [{ type: "text", text: `Component tree for ${args.page}:\n${JSON.stringify(tree, null, 2)}` }] };
      }

      case "frappe_create_ui_block": {
        const templates: Record<string, string> = {
          hero: `<div class="hero min-h-screen bg-base-200">\n  <div class="hero-content text-center">\n    <div class="max-w-md">\n      <h1 class="text-5xl font-bold">Hello there</h1>\n      <p class="py-6">Description text goes here.</p>\n      <Button>Get Started</Button>\n    </div>\n  </div>\n</div>`,
          features: `<div class="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">\n  <div class="card bg-base-100 shadow-xl"><div class="card-body"><h3 class="card-title">Feature 1</h3><p>Description</p></div></div>\n  <div class="card bg-base-100 shadow-xl"><div class="card-body"><h3 class="card-title">Feature 2</h3><p>Description</p></div></div>\n  <div class="card bg-base-100 shadow-xl"><div class="card-body"><h3 class="card-title">Feature 3</h3><p>Description</p></div></div>\n</div>`,
          navbar: `<div class="navbar bg-base-100">\n  <div class="navbar-start"><a class="btn btn-ghost text-xl">App</a></div>\n  <div class="navbar-center hidden lg:flex"><ul class="menu menu-horizontal px-1"><li><a>Home</a></li><li><a>About</a></li></ul></div>\n  <div class="navbar-end"><Button>Login</Button></div>\n</div>`,
          card: `<div class="card bg-base-100 shadow-xl">\n  <div class="card-body">\n    <h2 class="card-title">Title</h2>\n    <p>Content</p>\n    <div class="card-actions justify-end"><Button>View</Button></div>\n  </div>\n</div>`,
          form: `<form @submit.prevent="handleSubmit" class="space-y-4">\n  <TextInput label="Name" v-model="form.name" />\n  <TextInput label="Email" type="email" v-model="form.email" />\n  <Button type="submit" class="w-full">Submit</Button>\n</form>`,
          stats: `<div class="grid grid-cols-1 md:grid-cols-4 gap-4">\n  <div class="stat bg-base-100 rounded-lg p-4"><div class="stat-title">Users</div><div class="stat-value">31K</div><div class="stat-desc text-green-500">+12%</div></div>\n  <div class="stat bg-base-100 rounded-lg p-4"><div class="stat-title">Revenue</div><div class="stat-value">$4.2M</div><div class="stat-desc text-green-500">+8%</div></div>\n</div>`,
          table: `<div class="overflow-x-auto">\n  <table class="table w-full">\n    <thead><tr><th>Name</th><th>Status</th><th>Amount</th></tr></thead>\n    <tbody><tr><td>Row 1</td><td><span class="badge badge-success">Active</span></td><td>$1,200</td></tr></tbody>\n  </table>\n</div>`,
          timeline: `<ul class="timeline timeline-vertical">\n  <li><div class="timeline-start">Step 1</div><div class="timeline-middle"><span class="badge badge-primary">1</span></div><div class="timeline-end">Description</div></li>\n  <li><div class="timeline-start">Step 2</div><div class="timeline-middle"><span class="badge">2</span></div><div class="timeline-end">Description</div></li>\n</ul>`,
          "empty-state": `<div class="flex flex-col items-center justify-center p-12 text-center">\n  <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4"><span class="text-2xl text-gray-400">?</span></div>\n  <h3 class="text-lg font-semibold text-gray-700">No items found</h3>\n  <p class="text-gray-500 mt-1">Get started by creating your first item.</p>\n  <Button class="mt-4">Create New</Button>\n</div>`,
        };

        let template = templates[args.block_type] || `<div class="p-4">${args.block_type} block</div>`;
        if (args.theme === "dark") {
          template = template.replace(/bg-base-100/g, "bg-base-300").replace(/bg-base-200/g, "bg-base-400");
        }
        if (args.customization) template += `\n<!-- Customization: ${args.customization} -->`;

        return { content: [{ type: "text", text: `Generated ${args.block_type} UI block (${args.theme || "light"}):\n\n${template}` }] };
      }

      case "frappe_inspire_ui_block": {
        const creativeTemplates: Record<string, string> = {
          dashboard: `<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">\n  <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">\n    <div class="stats shadow"><div class="stat"><div class="stat-title">Users</div><div class="stat-value">89,400</div></div></div>\n  </div>\n</div>`,
          landing: `<div class="min-h-screen bg-gradient-to-b from-blue-600 to-purple-700">\n  <div class="container mx-auto px-6 py-12 text-center text-white">\n    <h1 class="text-6xl font-bold mb-6">Welcome to Innovation</h1>\n    <p class="text-xl mb-8">Transform your workflow</p>\n    <div class="flex justify-center gap-4"><Button>Get Started</Button><Button variant="outline">Learn More</Button></div>\n  </div>\n</div>`,
        };
        const key = Object.keys(creativeTemplates).find((k) => args.inspiration.toLowerCase().includes(k)) || "dashboard";
        return { content: [{ type: "text", text: `Inspired UI block for "${args.inspiration}" (${args.framework}):\n\n${creativeTemplates[key]}` }] };
      }

      case "frappe_refine_ui_block": {
        let refined = args.existing_code;
        if (args.improvements.toLowerCase().includes("responsive")) refined = refined.replace(/class="/g, 'class="md:');
        if (args.improvements.toLowerCase().includes("dark")) refined = refined.replace(/bg-base-100/g, "bg-base-300 dark:bg-base-100");
        if (args.improvements.toLowerCase().includes("animation")) refined = refined.replace(/class="/g, 'class="transition-all duration-300 ');
        return { content: [{ type: "text", text: `Refined UI block:\n\n${refined}` }] };
      }

      case "frappe_get_ui_templates": {
        const templates: Record<string, string[]> = {
          layout: ["hero", "navbar", "sidebar", "footer", "grid", "flex"],
          component: ["button", "card", "form", "modal", "dropdown", "tabs", "table", "stats", "timeline", "empty-state"],
          page: ["dashboard", "landing", "profile", "settings", "login"],
          all: ["hero", "navbar", "sidebar", "footer", "button", "card", "form", "dashboard", "landing", "stats", "table", "timeline", "empty-state"],
        };
        const category = args.category || "all";
        const list = templates[category] || templates.all;
        return { content: [{ type: "text", text: `Available ${category} UI templates:\n${list.map((t) => `- ${t}`).join("\n")}\n\nUse frappe_create_ui_block to generate these.` }] };
      }

      default:
        return null;
    }
  },
};
