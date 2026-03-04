import * as path from "path";
import { ToolModule, ToolResult, ToolContext } from "../types.js";
import { getAppPath } from "../utils/paths.js";
import { ensureAndWrite, ensureAndWriteJson, readFileIfExists, getDirectoryStructure } from "../utils/files.js";

function getFrontendPath(frappePath: string, appName: string): string {
  return path.join(getAppPath(frappePath, appName), "frontend");
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

export const frontendTools: ToolModule = {
  definitions: [
    {
      name: "frappe_scaffold_frontend_app",
      description:
        "Scaffold a complete frappe-ui SPA inside a Frappe app's frontend/ directory with Vue 3, Vite, Tailwind CSS, frappe-ui, vue-router, and optionally Pinia",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Frappe app name" },
          title: { type: "string", description: "App display title" },
          use_pinia: { type: "boolean", default: true, description: "Include Pinia for state management" },
          auth_required: { type: "boolean", default: true, description: "Require authentication for all routes" },
        },
        required: ["app_name", "title"],
      },
    },
    {
      name: "frappe_create_frontend_page",
      description:
        "Create a Vue page component with frappe-ui patterns and register its route in the router",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Frappe app name" },
          page_name: { type: "string", description: "Page name (e.g., 'UserList', 'InvoiceDetail')" },
          route: { type: "string", description: "Vue Router route path (e.g., '/users', '/invoice/:id')" },
          layout: { type: "string", enum: ["sidebar", "full", "blank"], default: "full", description: "Page layout type" },
          requires_auth: { type: "boolean", default: true, description: "Route requires authentication" },
          page_title: { type: "string", description: "Document title for the page" },
        },
        required: ["app_name", "page_name", "route"],
      },
    },
    {
      name: "frappe_create_frontend_component",
      description:
        "Create a Vue component file on disk using frappe-ui patterns with proper imports",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Frappe app name" },
          component_name: { type: "string", description: "Component name (PascalCase)" },
          component_dir: {
            type: "string",
            enum: ["components", "pages", "components/ui", "components/layout", "components/forms"],
            default: "components",
            description: "Directory within src/",
          },
          template: { type: "string", description: "Vue template HTML content" },
          script_setup_code: { type: "string", description: "Code inside <script setup> block" },
          frappe_ui_imports: {
            type: "array",
            items: { type: "string" },
            description: "frappe-ui components to import (e.g., ['Button', 'Dialog', 'TextInput'])",
          },
          styles: { type: "string", description: "Optional scoped CSS styles" },
        },
        required: ["app_name", "component_name"],
      },
    },
    {
      name: "frappe_create_resource_composable",
      description:
        "Generate a composable wrapping frappe-ui's resource system (createDocumentResource, createListResource, or createResource/call)",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Frappe app name" },
          composable_name: { type: "string", description: "Composable name (e.g., 'useInvoice', 'useTaskList')" },
          resource_type: {
            type: "string",
            enum: ["document", "list", "call"],
            description: "Type of frappe-ui resource",
          },
          doctype: { type: "string", description: "DocType name (for document/list resource types)" },
          method: { type: "string", description: "API method path (for call resource type)" },
          fields: {
            type: "array",
            items: { type: "string" },
            description: "Fields to fetch (for list resource)",
          },
          filters: { type: "object", description: "Default filters" },
          page_length: { type: "number", default: 20, description: "Page length for list resource" },
          auto: { type: "boolean", default: true, description: "Auto-fetch on mount" },
          cache: { type: "boolean", default: false, description: "Enable caching with cache key" },
        },
        required: ["app_name", "composable_name", "resource_type"],
      },
    },
    {
      name: "frappe_create_pinia_store",
      description:
        "Create a Pinia store with frappe-ui resource integration for complex state management",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Frappe app name" },
          store_name: { type: "string", description: "Store name (e.g., 'user', 'settings')" },
          state_fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: { type: "string" },
                default_value: { type: "string" },
              },
              required: ["name"],
            },
            description: "State fields with optional type and default",
          },
          actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                code: { type: "string" },
              },
              required: ["name"],
            },
            description: "Store actions",
          },
          getters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                code: { type: "string" },
              },
              required: ["name"],
            },
            description: "Store getters",
          },
        },
        required: ["app_name", "store_name"],
      },
    },
    {
      name: "frappe_create_frontend_form",
      description:
        "Generate a form page/component with frappe-ui FormControl components, validation, and createDocumentResource integration for creating/editing documents",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Frappe app name" },
          form_name: { type: "string", description: "Form component name" },
          doctype: { type: "string", description: "Target DocType" },
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                fieldname: { type: "string" },
                label: { type: "string" },
                fieldtype: {
                  type: "string",
                  enum: ["Data", "Text", "Int", "Float", "Currency", "Date", "Datetime", "Select", "Link", "Check", "Attach", "Color", "Password", "Rating", "TextEditor"],
                },
                options: { type: "string", description: "Options for Select/Link fields" },
                required: { type: "boolean" },
              },
              required: ["fieldname", "label", "fieldtype"],
            },
            description: "Form fields",
          },
          layout: { type: "string", enum: ["single-column", "two-column"], default: "single-column" },
          mode: { type: "string", enum: ["create", "edit", "both"], default: "both", description: "Form mode - create new, edit existing, or both" },
        },
        required: ["app_name", "form_name", "doctype", "fields"],
      },
    },
    {
      name: "frappe_create_frontend_list",
      description:
        "Generate a list view page with frappe-ui ListView, createListResource, filters, pagination, search, and row click navigation",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Frappe app name" },
          list_name: { type: "string", description: "List component name" },
          doctype: { type: "string", description: "Source DocType" },
          fields: {
            type: "array",
            items: { type: "string" },
            description: "Fields to display as columns",
          },
          filters: { type: "object", description: "Default list filters" },
          page_length: { type: "number", default: 20 },
          order_by: { type: "string", default: "creation desc" },
          row_route: { type: "string", description: "Route to navigate on row click (e.g., '/invoice/:name')" },
          searchable: { type: "boolean", default: true, description: "Include search bar" },
        },
        required: ["app_name", "list_name", "doctype", "fields"],
      },
    },
    {
      name: "frappe_create_frontend_detail",
      description:
        "Generate a detail/show page for viewing a single document with createDocumentResource, field display, actions (submit/cancel/amend/delete), timeline, and comments",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Frappe app name" },
          detail_name: { type: "string", description: "Detail page component name (e.g., 'InvoiceDetail')" },
          doctype: { type: "string", description: "Source DocType" },
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                fieldname: { type: "string" },
                label: { type: "string" },
                fieldtype: { type: "string", enum: ["Data", "Text", "Int", "Float", "Currency", "Date", "Datetime", "Select", "Link", "Check", "Attach", "Color", "Rating", "TextEditor", "Duration", "Image"] },
              },
              required: ["fieldname", "label"],
            },
            description: "Fields to display on detail page",
          },
          route_param: { type: "string", default: "name", description: "Route parameter name for the document identifier" },
          layout: { type: "string", enum: ["full", "sidebar", "tabs"], default: "full", description: "Detail page layout" },
          tabs: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                fields: { type: "array", items: { type: "string" } },
              },
              required: ["label", "fields"],
            },
            description: "Tab definitions (only for tabs layout)",
          },
          show_timeline: { type: "boolean", default: true, description: "Show activity timeline/comments" },
          show_sidebar: { type: "boolean", default: false, description: "Show sidebar with metadata (owner, created, modified)" },
          actions: {
            type: "array",
            items: { type: "string", enum: ["edit", "delete", "submit", "cancel", "amend", "print", "email", "duplicate"] },
            description: "Actions to show in action menu",
          },
          child_tables: {
            type: "array",
            items: {
              type: "object",
              properties: {
                fieldname: { type: "string" },
                label: { type: "string" },
                columns: { type: "array", items: { type: "string" } },
              },
              required: ["fieldname", "label", "columns"],
            },
            description: "Child table sections to display",
          },
          back_route: { type: "string", description: "Route to navigate back to (e.g., '/invoices')" },
        },
        required: ["app_name", "detail_name", "doctype", "fields"],
      },
    },
    {
      name: "frappe_setup_frontend_proxy",
      description:
        "Create/update the proxyOptions.js file for connecting the Vite dev server to a Frappe backend site",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Frappe app name" },
          site_url: { type: "string", default: "http://localhost:8080", description: "Frappe site URL" },
          socket_port: { type: "number", default: 9000, description: "Socket.io port" },
        },
        required: ["app_name"],
      },
    },
    {
      name: "frappe_build_frontend",
      description: "Run the frontend build process (yarn build) and copy assets to the Frappe app's public directory",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Frappe app name" },
        },
        required: ["app_name"],
      },
    },
    {
      name: "frappe_get_frontend_structure",
      description: "Get the directory structure of a frappe-ui frontend app",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Frappe app name" },
        },
        required: ["app_name"],
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_scaffold_frontend_app": {
        const { app_name, title, use_pinia = true, auth_required = true } = args;
        const frontendDir = getFrontendPath(ctx.frappePath, app_name);
        const createdFiles: string[] = [];

        // package.json
        const packageJson: any = {
          name: `${app_name}-frontend`,
          private: true,
          version: "0.0.0",
          type: "module",
          scripts: {
            dev: "vite",
            build: "vite build",
            preview: "vite preview",
          },
          dependencies: {
            "frappe-ui": "^0.1",
            vue: "^3.4",
            "vue-router": "^4.2",
            "feather-icons": "^4.29",
            "showdown": "^2.1",
          },
          devDependencies: {
            "@vitejs/plugin-vue": "^5.0",
            autoprefixer: "^10.4",
            postcss: "^8.4",
            tailwindcss: "^3.4",
            vite: "^5.0",
          },
        };
        if (use_pinia) {
          packageJson.dependencies["pinia"] = "^2.1";
        }
        await ensureAndWriteJson(path.join(frontendDir, "package.json"), packageJson);
        createdFiles.push("package.json");

        // vite.config.js
        const viteConfig = `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { getProxyOptions } from './proxyOptions'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: '../${app_name}/public/frontend',
    emptyOutDir: true,
    target: 'es2015',
    sourcemap: true,
  },
  server: {
    port: 8080,
    proxy: getProxyOptions(),
  },
  optimizeDeps: {
    include: ['frappe-ui > feather-icons', 'showdown', 'engine.io-client'],
  },
})
`;
        await ensureAndWrite(path.join(frontendDir, "vite.config.js"), viteConfig);
        createdFiles.push("vite.config.js");

        // proxyOptions.js
        const proxyOptions = `const commonSiteConfig = {
  webserver_port: 8000,
}

const webserverPort = commonSiteConfig.webserver_port

export function getProxyOptions() {
  return {
    '^/(api|login|assets|files|private)': {
      target: \`http://localhost:\${webserverPort}\`,
      ws: true,
      router: function (req) {
        const siteNameFromHost = req.headers.host?.split(':')[0]
        return \`http://\${siteNameFromHost}:\${webserverPort}\`
      },
    },
  }
}
`;
        await ensureAndWrite(path.join(frontendDir, "proxyOptions.js"), proxyOptions);
        createdFiles.push("proxyOptions.js");

        // tailwind.config.js
        const tailwindConfig = `const frappeUIPreset = require('frappe-ui/src/utils/tailwind.config')

module.exports = {
  presets: [frappeUIPreset],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    './node_modules/frappe-ui/src/components/**/*.{vue,js,ts}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;
        await ensureAndWrite(path.join(frontendDir, "tailwind.config.js"), tailwindConfig);
        createdFiles.push("tailwind.config.js");

        // postcss.config.js
        const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;
        await ensureAndWrite(path.join(frontendDir, "postcss.config.js"), postcssConfig);
        createdFiles.push("postcss.config.js");

        // index.html
        const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`;
        await ensureAndWrite(path.join(frontendDir, "index.html"), indexHtml);
        createdFiles.push("index.html");

        // src/main.js
        const piniaImport = use_pinia ? `import { createPinia } from 'pinia'\n` : "";
        const piniaUse = use_pinia ? `app.use(createPinia())\n` : "";
        const authGuard = auth_required
          ? `
router.beforeEach(async (to, from, next) => {
  const isLoggedIn = document.cookie.includes('user_id=')
    && !document.cookie.includes('user_id=Guest')

  if (to.meta.requiresAuth !== false && !isLoggedIn) {
    window.location.href = \`/login?redirect-to=\${to.fullPath}\`
    return
  }
  next()
})
`
          : "";

        const mainJs = `import { createApp } from 'vue'
import { FrappeUI, resourcesPlugin, setConfig } from 'frappe-ui'
${piniaImport}import router from './router'
import App from './App.vue'

import './index.css'

setConfig('resourceFetcher', (options) => {
  return {
    ...options,
    headers: {
      'X-Frappe-Site-Name': window.location.hostname,
    },
  }
})
${authGuard}
const app = createApp(App)
app.use(router)
app.use(resourcesPlugin)
${piniaUse}
app.mount('#app')
`;
        await ensureAndWrite(path.join(frontendDir, "src", "main.js"), mainJs);
        createdFiles.push("src/main.js");

        // src/index.css
        const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;
        await ensureAndWrite(path.join(frontendDir, "src", "index.css"), indexCss);
        createdFiles.push("src/index.css");

        // src/App.vue
        const appVue = `<template>
  <router-view />
</template>

<script setup>
</script>
`;
        await ensureAndWrite(path.join(frontendDir, "src", "App.vue"), appVue);
        createdFiles.push("src/App.vue");

        // src/router.js
        const routerJs = `import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/pages/Home.vue'),
  },
]

const router = createRouter({
  history: createWebHistory('/${app_name}'),
  routes,
})

export default router
`;
        await ensureAndWrite(path.join(frontendDir, "src", "router.js"), routerJs);
        createdFiles.push("src/router.js");

        // src/pages/Home.vue
        const homeVue = `<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-gray-900">${title}</h1>
      <p class="mt-2 text-gray-600">Your frappe-ui SPA is ready.</p>
      <Button class="mt-4" variant="solid" @click="() => {}">Get Started</Button>
    </div>
  </div>
</template>

<script setup>
import { Button } from 'frappe-ui'
</script>
`;
        await ensureAndWrite(path.join(frontendDir, "src", "pages", "Home.vue"), homeVue);
        createdFiles.push("src/pages/Home.vue");

        // Create placeholder directories
        await ensureAndWrite(path.join(frontendDir, "src", "components", ".gitkeep"), "");
        await ensureAndWrite(path.join(frontendDir, "src", "composables", ".gitkeep"), "");
        if (use_pinia) {
          await ensureAndWrite(path.join(frontendDir, "src", "stores", ".gitkeep"), "");
        }
        createdFiles.push("src/components/", "src/composables/");
        if (use_pinia) createdFiles.push("src/stores/");

        // .gitignore
        const gitignore = `node_modules
dist
*.local
.env
`;
        await ensureAndWrite(path.join(frontendDir, ".gitignore"), gitignore);
        createdFiles.push(".gitignore");

        return {
          content: [
            {
              type: "text",
              text: `Scaffolded frappe-ui SPA for "${app_name}" at frontend/\n\nCreated files:\n${createdFiles.map((f) => `  - ${f}`).join("\n")}\n\nNext steps:\n  1. cd ${frontendDir}\n  2. yarn install\n  3. yarn dev\n\nThe dev server will proxy API calls to your Frappe site. Update proxyOptions.js with your site URL if needed.`,
            },
          ],
        };
      }

      case "frappe_create_frontend_page": {
        const { app_name, page_name, route, layout = "full", requires_auth = true, page_title } = args;
        const frontendDir = getFrontendPath(ctx.frappePath, app_name);
        const pageName = toPascalCase(page_name);
        const pageFilePath = path.join(frontendDir, "src", "pages", `${pageName}.vue`);

        let templateContent = "";
        if (layout === "sidebar") {
          templateContent = `<template>
  <div class="flex h-screen">
    <!-- Sidebar -->
    <aside class="w-64 border-r bg-white p-4">
      <h2 class="mb-4 text-lg font-semibold text-gray-900">${page_title || pageName}</h2>
      <nav class="space-y-1">
        <slot name="sidebar" />
      </nav>
    </aside>
    <!-- Main Content -->
    <main class="flex-1 overflow-auto bg-gray-50 p-6">
      <div class="mx-auto max-w-5xl">
        <slot name="default" />
      </div>
    </main>
  </div>
</template>`;
        } else if (layout === "blank") {
          templateContent = `<template>
  <div class="min-h-screen">
    <slot name="default" />
  </div>
</template>`;
        } else {
          templateContent = `<template>
  <div class="min-h-screen bg-gray-50">
    <header class="border-b bg-white px-6 py-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold text-gray-900">${page_title || pageName}</h1>
        <div class="flex items-center gap-2">
          <!-- Action buttons -->
        </div>
      </div>
    </header>
    <main class="mx-auto max-w-7xl p-6">
      <!-- Page content -->
    </main>
  </div>
</template>`;
        }

        const pageVue = `${templateContent}

<script setup>
import { ref } from 'vue'
${page_title ? `\nimport { useTitle } from '@vueuse/core'\nuseTitle('${page_title}')` : ""}
</script>
`;
        await ensureAndWrite(pageFilePath, pageVue);

        // Update router.js to add route
        const routerPath = path.join(frontendDir, "src", "router.js");
        let routerContent = (await readFileIfExists(routerPath)) || "";

        if (routerContent && !routerContent.includes(`'${route}'`)) {
          const routeEntry = `  {
    path: '${route}',
    name: '${pageName}',
    component: () => import('@/pages/${pageName}.vue'),${requires_auth ? "\n    meta: { requiresAuth: true }," : ""}
  },`;

          // Insert before the closing bracket of routes array
          const routesEnd = routerContent.lastIndexOf("]");
          if (routesEnd !== -1) {
            routerContent =
              routerContent.slice(0, routesEnd) +
              routeEntry +
              "\n" +
              routerContent.slice(routesEnd);
            await ensureAndWrite(routerPath, routerContent);
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `Created page "${pageName}" at src/pages/${pageName}.vue\nRegistered route: ${route}\nLayout: ${layout}`,
            },
          ],
        };
      }

      case "frappe_create_frontend_component": {
        const {
          app_name,
          component_name,
          component_dir = "components",
          template = "",
          script_setup_code = "",
          frappe_ui_imports = [],
          styles = "",
        } = args;
        const frontendDir = getFrontendPath(ctx.frappePath, app_name);
        const compName = toPascalCase(component_name);
        const filePath = path.join(frontendDir, "src", component_dir, `${compName}.vue`);

        const frappeImportLine =
          frappe_ui_imports.length > 0
            ? `import { ${frappe_ui_imports.join(", ")} } from 'frappe-ui'\n`
            : "";

        const templateBlock = template
          ? `<template>\n${template}\n</template>`
          : `<template>\n  <div>\n    <!-- ${compName} component -->\n  </div>\n</template>`;

        const scriptBlock = `<script setup>\n${frappeImportLine}import { ref } from 'vue'\n${script_setup_code ? "\n" + script_setup_code : ""}\n</script>`;

        const styleBlock = styles ? `\n\n<style scoped>\n${styles}\n</style>` : "";

        const componentVue = `${templateBlock}\n\n${scriptBlock}${styleBlock}\n`;

        await ensureAndWrite(filePath, componentVue);

        return {
          content: [
            {
              type: "text",
              text: `Created component "${compName}" at src/${component_dir}/${compName}.vue`,
            },
          ],
        };
      }

      case "frappe_create_resource_composable": {
        const {
          app_name,
          composable_name,
          resource_type,
          doctype,
          method,
          fields = [],
          filters = {},
          page_length = 20,
          auto = true,
          cache = false,
        } = args;
        const frontendDir = getFrontendPath(ctx.frappePath, app_name);
        const fileName = toCamelCase(composable_name);
        const filePath = path.join(frontendDir, "src", "composables", `${fileName}.js`);

        let code = "";

        if (resource_type === "document") {
          const cacheStr = cache ? `\n    cache: ['${doctype}', name],` : "";
          code = `import { createDocumentResource } from 'frappe-ui'

export function ${composable_name}(name) {
  const resource = createDocumentResource({
    doctype: '${doctype}',
    name,${cacheStr}
    auto: ${auto},
  })

  return resource
}
`;
        } else if (resource_type === "list") {
          const fieldsStr = fields.length > 0 ? `\n    fields: ${JSON.stringify(fields)},` : "";
          const filtersStr = Object.keys(filters).length > 0 ? `\n    filters: ${JSON.stringify(filters)},` : "";
          const cacheStr = cache ? `\n    cache: '${doctype}List',` : "";
          code = `import { createListResource } from 'frappe-ui'
import { ref, watch } from 'vue'

export function ${composable_name}(initialFilters = {}) {
  const searchQuery = ref('')

  const resource = createListResource({
    doctype: '${doctype}',${fieldsStr}
    filters: { ...${JSON.stringify(filters)}, ...initialFilters },
    orderBy: 'creation desc',
    pageLength: ${page_length},${cacheStr}
    auto: ${auto},
  })

  function applyFilters(newFilters) {
    resource.filters = { ...resource.filters, ...newFilters }
    resource.reload()
  }

  function nextPage() {
    resource.next()
  }

  function prevPage() {
    resource.previous()
  }

  return {
    ...resource,
    searchQuery,
    applyFilters,
    nextPage,
    prevPage,
  }
}
`;
        } else {
          // call
          const cacheStr = cache ? `\n    cache: '${composable_name}',` : "";
          code = `import { createResource } from 'frappe-ui'

export function ${composable_name}(params = {}) {
  const resource = createResource({
    url: '${method}',
    params,${cacheStr}
    auto: ${auto},
  })

  return resource
}
`;
        }

        await ensureAndWrite(filePath, code);

        return {
          content: [
            {
              type: "text",
              text: `Created ${resource_type} composable "${composable_name}" at src/composables/${fileName}.js\n\nUsage:\n  import { ${composable_name} } from '@/composables/${fileName}'\n  const resource = ${composable_name}(${resource_type === "document" ? "'DOC-NAME'" : ""})`,
            },
          ],
        };
      }

      case "frappe_create_pinia_store": {
        const { app_name, store_name, state_fields = [], actions = [], getters = [] } = args;
        const frontendDir = getFrontendPath(ctx.frappePath, app_name);
        const storeName = toCamelCase(store_name);
        const filePath = path.join(frontendDir, "src", "stores", `${storeName}.js`);

        const stateEntries = (state_fields as any[])
          .map((f) => {
            const defaultVal = f.default_value || (f.type === "boolean" ? "false" : f.type === "number" ? "0" : f.type === "array" ? "[]" : f.type === "object" ? "{}" : "null");
            return `      ${f.name}: ${defaultVal},`;
          })
          .join("\n");

        const getterEntries = (getters as any[])
          .map((g) => `    ${g.name}(state) {\n      ${g.code || `return state.${g.name}`}\n    },`)
          .join("\n");

        const actionEntries = (actions as any[])
          .map((a) => `    async ${a.name}() {\n      ${a.code || "// TODO: implement"}\n    },`)
          .join("\n");

        const code = `import { defineStore } from 'pinia'
import { createResource, call } from 'frappe-ui'

export const use${toPascalCase(store_name)}Store = defineStore('${storeName}', {
  state: () => ({
${stateEntries}
  }),
${getters.length ? `  getters: {\n${getterEntries}\n  },\n` : ""}  actions: {
${actionEntries || "    // TODO: Add actions"}
  },
})
`;
        await ensureAndWrite(filePath, code);

        return {
          content: [
            {
              type: "text",
              text: `Created Pinia store "use${toPascalCase(store_name)}Store" at src/stores/${storeName}.js\n\nUsage:\n  import { use${toPascalCase(store_name)}Store } from '@/stores/${storeName}'\n  const store = use${toPascalCase(store_name)}Store()`,
            },
          ],
        };
      }

      case "frappe_create_frontend_form": {
        const { app_name, form_name, doctype, fields, layout = "single-column", mode = "both" } = args;
        const frontendDir = getFrontendPath(ctx.frappePath, app_name);
        const formName = toPascalCase(form_name);
        const filePath = path.join(frontendDir, "src", "pages", `${formName}.vue`);

        const fieldTypeMap: Record<string, string> = {
          Data: "text",
          Text: "textarea",
          Int: "number",
          Float: "number",
          Currency: "number",
          Date: "date",
          Datetime: "datetime-local",
          Select: "select",
          Link: "autocomplete",
          Check: "checkbox",
          Attach: "file",
          Color: "color",
          Password: "password",
          Rating: "rating",
          TextEditor: "texteditor",
        };

        const fieldComponents = (fields as any[])
          .map((f: any) => {
            const inputType = fieldTypeMap[f.fieldtype] || "text";
            if (f.fieldtype === "Select" && f.options) {
              const opts = f.options
                .split("\n")
                .map((o: string) => `{ label: '${o}', value: '${o}' }`)
                .join(", ");
              return `      <FormControl
        type="select"
        label="${f.label}"
        v-model="form.${f.fieldname}"
        :options="[${opts}]"
        ${f.required ? ':required="true"' : ""}
      />`;
            }
            if (f.fieldtype === "Link") {
              return `      <Link
        doctype="${f.options || ""}"
        v-model="form.${f.fieldname}"
        label="${f.label}"
        ${f.required ? ':required="true"' : ""}
      />`;
            }
            if (f.fieldtype === "Check") {
              return `      <FormControl
        type="checkbox"
        label="${f.label}"
        v-model="form.${f.fieldname}"
      />`;
            }
            return `      <FormControl
        type="${inputType}"
        label="${f.label}"
        v-model="form.${f.fieldname}"
        ${f.required ? ':required="true"' : ""}
      />`;
          })
          .join("\n");

        const gridClass = layout === "two-column" ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "space-y-4";

        const formVue = `<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <div class="mx-auto max-w-3xl">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <router-link to="/" class="text-sm text-gray-500 hover:text-gray-700">&larr; Back</router-link>
          <h1 class="mt-1 text-2xl font-bold text-gray-900">
            {{ isEdit ? 'Edit' : 'New' }} ${doctype}
          </h1>
        </div>
        <div class="flex gap-2">
          <Button variant="subtle" @click="$router.back()">Cancel</Button>
          <Button variant="solid" @click="save" :loading="saving">
            {{ isEdit ? 'Save' : 'Create' }}
          </Button>
        </div>
      </div>

      <div class="rounded-lg border bg-white p-6">
        <div class="${gridClass}">
${fieldComponents}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, FormControl, createDocumentResource, call } from 'frappe-ui'

const route = useRoute()
const router = useRouter()
const saving = ref(false)
const isEdit = computed(() => !!route.params.name)

const form = reactive({
${(fields as any[]).map((f: any) => `  ${f.fieldname}: ${f.fieldtype === "Check" ? "false" : f.fieldtype === "Int" || f.fieldtype === "Float" || f.fieldtype === "Currency" ? "0" : "''"},`).join("\n")}
})

let doc = null

onMounted(async () => {
  if (isEdit.value) {
    doc = createDocumentResource({
      doctype: '${doctype}',
      name: route.params.name,
      auto: true,
      onSuccess(data) {
        Object.assign(form, data)
      },
    })
  }
})

async function save() {
  saving.value = true
  try {
    if (isEdit.value && doc) {
      await doc.setValue.submit(form)
    } else {
      await call('frappe.client.insert', {
        doc: { doctype: '${doctype}', ...form },
      })
    }
    router.back()
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}
</script>
`;
        await ensureAndWrite(filePath, formVue);

        return {
          content: [
            {
              type: "text",
              text: `Created form page "${formName}" at src/pages/${formName}.vue\nDocType: ${doctype}\nFields: ${fields.length}\nLayout: ${layout}\nMode: ${mode}`,
            },
          ],
        };
      }

      case "frappe_create_frontend_list": {
        const {
          app_name,
          list_name,
          doctype,
          fields,
          filters = {},
          page_length = 20,
          order_by = "creation desc",
          row_route,
          searchable = true,
        } = args;
        const frontendDir = getFrontendPath(ctx.frappePath, app_name);
        const listName = toPascalCase(list_name);
        const filePath = path.join(frontendDir, "src", "pages", `${listName}.vue`);

        const columnDefs = (fields as string[])
          .map((f) => `        { label: '${toPascalCase(f.replace(/_/g, " "))}', key: '${f}', width: 1 },`)
          .join("\n");

        const searchBlock = searchable
          ? `        <FormControl
          type="text"
          placeholder="Search..."
          v-model="searchQuery"
          @input="debouncedSearch"
          class="w-64"
        />`
          : "";

        const rowClickHandler = row_route
          ? `\n    @row-click="(row) => router.push('${row_route}'.replace(':name', row.name))"`
          : "";

        const listVue = `<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <div class="mx-auto max-w-7xl">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900">${doctype}</h1>
        <div class="flex items-center gap-3">
${searchBlock}
          <Button variant="solid" @click="$router.push('/${toKebabCase(doctype)}/new')">
            + New ${doctype}
          </Button>
        </div>
      </div>

      <div class="rounded-lg border bg-white">
        <ListView
          :columns="columns"
          :rows="list.data || []"
          row-key="name"${rowClickHandler}
        >
          <ListHeader />
          <ListRows>
            <ListRow
              v-for="row in list.data || []"
              :key="row.name"
              :row="row"
            />
          </ListRows>
        </ListView>

        <!-- Pagination -->
        <div class="flex items-center justify-between border-t px-4 py-3">
          <span class="text-sm text-gray-600">
            Showing {{ (list.data || []).length }} results
          </span>
          <div class="flex gap-2">
            <Button variant="subtle" :disabled="!list.hasPreviousPage" @click="list.previous()">
              Previous
            </Button>
            <Button variant="subtle" :disabled="!list.hasNextPage" @click="list.next()">
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, FormControl, ListView, ListHeader, ListRows, ListRow, createListResource } from 'frappe-ui'

const router = useRouter()
const searchQuery = ref('')

const columns = [
${columnDefs}
]

const list = createListResource({
  doctype: '${doctype}',
  fields: ${JSON.stringify(fields)},
  filters: ${JSON.stringify(filters)},
  orderBy: '${order_by}',
  pageLength: ${page_length},
  auto: true,
})

let debounceTimer = null
function debouncedSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (searchQuery.value) {
      list.filters = { ...list.filters, name: ['like', \`%\${searchQuery.value}%\`] }
    } else {
      const { name, ...rest } = list.filters
      list.filters = rest
    }
    list.reload()
  }, 300)
}
</script>
`;
        await ensureAndWrite(filePath, listVue);

        return {
          content: [
            {
              type: "text",
              text: `Created list page "${listName}" at src/pages/${listName}.vue\nDocType: ${doctype}\nColumns: ${fields.join(", ")}\nPage length: ${page_length}\nOrder: ${order_by}${row_route ? `\nRow click navigates to: ${row_route}` : ""}`,
            },
          ],
        };
      }

      case "frappe_create_frontend_detail": {
        const {
          app_name,
          detail_name,
          doctype,
          fields,
          route_param = "name",
          layout = "full",
          tabs = [],
          show_timeline = true,
          show_sidebar = false,
          actions = ["edit", "delete"],
          child_tables = [],
          back_route,
        } = args;
        const frontendDir = getFrontendPath(ctx.frappePath, app_name);
        const detailName = toPascalCase(detail_name);
        const filePath = path.join(frontendDir, "src", "pages", `${detailName}.vue`);

        // Build field display sections
        const fieldDisplayItems = (fields as any[]).map((f: any) => {
          const fieldtype = f.fieldtype || "Data";
          if (fieldtype === "Image" || fieldtype === "Attach") {
            return `          <div>
            <label class="text-sm font-medium text-gray-500">${f.label}</label>
            <img v-if="doc.doc?.${f.fieldname}" :src="doc.doc.${f.fieldname}" class="mt-1 h-32 rounded-lg object-cover" />
            <span v-else class="mt-1 block text-sm text-gray-400">No image</span>
          </div>`;
          }
          if (fieldtype === "Check") {
            return `          <div>
            <label class="text-sm font-medium text-gray-500">${f.label}</label>
            <span class="mt-1 block">
              <Badge :variant="doc.doc?.${f.fieldname} ? 'success' : 'subtle'">
                {{ doc.doc?.${f.fieldname} ? 'Yes' : 'No' }}
              </Badge>
            </span>
          </div>`;
          }
          if (fieldtype === "Currency" || fieldtype === "Float") {
            return `          <div>
            <label class="text-sm font-medium text-gray-500">${f.label}</label>
            <p class="mt-1 text-sm text-gray-900">{{ formatNumber(doc.doc?.${f.fieldname}) }}</p>
          </div>`;
          }
          if (fieldtype === "Date" || fieldtype === "Datetime") {
            return `          <div>
            <label class="text-sm font-medium text-gray-500">${f.label}</label>
            <p class="mt-1 text-sm text-gray-900">{{ formatDate(doc.doc?.${f.fieldname}) }}</p>
          </div>`;
          }
          if (fieldtype === "Rating") {
            return `          <div>
            <label class="text-sm font-medium text-gray-500">${f.label}</label>
            <div class="mt-1 flex gap-1">
              <span v-for="i in 5" :key="i" :class="i <= (doc.doc?.${f.fieldname} || 0) ? 'text-yellow-400' : 'text-gray-300'">★</span>
            </div>
          </div>`;
          }
          if (fieldtype === "Text" || fieldtype === "TextEditor") {
            return `          <div class="col-span-full">
            <label class="text-sm font-medium text-gray-500">${f.label}</label>
            <div class="mt-1 rounded-lg border bg-gray-50 p-3 text-sm text-gray-900" v-html="doc.doc?.${f.fieldname} || '-'"></div>
          </div>`;
          }
          if (fieldtype === "Link") {
            return `          <div>
            <label class="text-sm font-medium text-gray-500">${f.label}</label>
            <p class="mt-1 text-sm text-blue-600 hover:underline cursor-pointer">{{ doc.doc?.${f.fieldname} || '-' }}</p>
          </div>`;
          }
          return `          <div>
            <label class="text-sm font-medium text-gray-500">${f.label}</label>
            <p class="mt-1 text-sm text-gray-900">{{ doc.doc?.${f.fieldname} || '-' }}</p>
          </div>`;
        });

        // Build action buttons
        const actionButtons: string[] = [];
        if ((actions as string[]).includes("edit")) {
          actionButtons.push(`          <Button variant="subtle" @click="editDoc">Edit</Button>`);
        }
        if ((actions as string[]).includes("submit")) {
          actionButtons.push(`          <Button v-if="doc.doc?.docstatus === 0" variant="solid" theme="green" @click="submitDoc">Submit</Button>`);
        }
        if ((actions as string[]).includes("cancel")) {
          actionButtons.push(`          <Button v-if="doc.doc?.docstatus === 1" variant="subtle" theme="red" @click="cancelDoc">Cancel</Button>`);
        }
        if ((actions as string[]).includes("amend")) {
          actionButtons.push(`          <Button v-if="doc.doc?.docstatus === 2" variant="subtle" @click="amendDoc">Amend</Button>`);
        }
        if ((actions as string[]).includes("print")) {
          actionButtons.push(`          <Button variant="ghost" @click="printDoc">Print</Button>`);
        }
        if ((actions as string[]).includes("duplicate")) {
          actionButtons.push(`          <Button variant="ghost" @click="duplicateDoc">Duplicate</Button>`);
        }
        if ((actions as string[]).includes("delete")) {
          actionButtons.push(`          <Button variant="ghost" theme="red" @click="deleteDoc">Delete</Button>`);
        }

        // Build child table sections
        const childTableSections = (child_tables as any[]).map((ct: any) => {
          const colHeaders = ct.columns.map((c: string) => `              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">${toPascalCase(c.replace(/_/g, " "))}</th>`).join("\n");
          const colCells = ct.columns.map((c: string) => `              <td class="px-4 py-2 text-sm text-gray-900">{{ row.${c} }}</td>`).join("\n");
          return `
        <!-- ${ct.label} -->
        <div class="mt-6 rounded-lg border bg-white">
          <div class="border-b px-4 py-3">
            <h3 class="text-sm font-semibold text-gray-900">${ct.label}</h3>
          </div>
          <table class="min-w-full">
            <thead class="bg-gray-50">
              <tr>
${colHeaders}
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="(row, idx) in doc.doc?.${ct.fieldname} || []" :key="idx">
${colCells}
              </tr>
              <tr v-if="!doc.doc?.${ct.fieldname}?.length">
                <td :colspan="${ct.columns.length}" class="px-4 py-6 text-center text-sm text-gray-400">No items</td>
              </tr>
            </tbody>
          </table>
        </div>`;
        });

        // Build tabs if layout is tabs
        let contentBlock = "";
        if (layout === "tabs" && tabs.length > 0) {
          const tabDefs = (tabs as any[]).map((t: any) => `{ label: '${t.label}' }`).join(", ");
          const tabPanels = (tabs as any[]).map((t: any, idx: number) => {
            const tabFields = fieldDisplayItems.filter((_: string, i: number) => {
              const fieldName = (fields as any[])[i].fieldname;
              return (t.fields as string[]).includes(fieldName);
            });
            return `        <div v-if="activeTab === ${idx}" class="grid grid-cols-1 gap-4 md:grid-cols-2">
${tabFields.join("\n")}
        </div>`;
          });
          contentBlock = `      <div class="mb-4 border-b">
          <nav class="flex gap-4">
            <button
              v-for="(tab, idx) in tabs"
              :key="tab.label"
              @click="activeTab = idx"
              :class="['px-3 py-2 text-sm font-medium border-b-2 -mb-px', activeTab === idx ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700']"
            >
              {{ tab.label }}
            </button>
          </nav>
        </div>
${tabPanels.join("\n")}`;
        } else {
          contentBlock = `        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
${fieldDisplayItems.join("\n")}
        </div>`;
        }

        // Sidebar metadata
        const sidebarBlock = show_sidebar
          ? `
      <!-- Sidebar -->
      <aside class="w-72 space-y-4">
        <div class="rounded-lg border bg-white p-4">
          <h3 class="mb-3 text-sm font-semibold text-gray-900">Info</h3>
          <dl class="space-y-2 text-sm">
            <div>
              <dt class="text-gray-500">Owner</dt>
              <dd class="text-gray-900">{{ doc.doc?.owner }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Created</dt>
              <dd class="text-gray-900">{{ formatDate(doc.doc?.creation) }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Modified</dt>
              <dd class="text-gray-900">{{ formatDate(doc.doc?.modified) }}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Modified By</dt>
              <dd class="text-gray-900">{{ doc.doc?.modified_by }}</dd>
            </div>
          </dl>
        </div>
      </aside>`
          : "";

        // Timeline block
        const timelineBlock = show_timeline
          ? `
        <!-- Activity Timeline -->
        <div class="mt-6 rounded-lg border bg-white p-4">
          <h3 class="mb-4 text-sm font-semibold text-gray-900">Activity</h3>
          <div v-if="comments.data?.length" class="space-y-4">
            <div v-for="comment in comments.data" :key="comment.name" class="flex gap-3">
              <div class="h-8 w-8 flex-shrink-0 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                {{ (comment.owner || '?')[0].toUpperCase() }}
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-gray-900">{{ comment.owner }}</span>
                  <span class="text-xs text-gray-500">{{ formatDate(comment.creation) }}</span>
                </div>
                <div class="mt-1 text-sm text-gray-700" v-html="comment.content"></div>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-gray-400">No activity yet.</p>

          <!-- Add Comment -->
          <div class="mt-4 flex gap-2">
            <FormControl type="text" v-model="newComment" placeholder="Add a comment..." class="flex-1" />
            <Button variant="subtle" @click="addComment" :disabled="!newComment">Post</Button>
          </div>
        </div>`
          : "";

        const backLink = back_route
          ? `<router-link to="${back_route}" class="text-sm text-gray-500 hover:text-gray-700">&larr; Back</router-link>`
          : `<button @click="$router.back()" class="text-sm text-gray-500 hover:text-gray-700">&larr; Back</button>`;

        // Build the main layout
        const mainContentClass = show_sidebar ? "flex-1" : "";
        const outerWrapClass = show_sidebar ? "flex gap-6" : "";

        const detailVue = `<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <div class="mx-auto max-w-7xl">
      <!-- Header -->
      <div class="mb-6">
        ${backLink}
        <div class="mt-2 flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">{{ doc.doc?.name || 'Loading...' }}</h1>
            <div v-if="doc.doc?.docstatus !== undefined" class="mt-1">
              <Badge :variant="statusVariant">{{ statusLabel }}</Badge>
            </div>
          </div>
          <div class="flex items-center gap-2">
${actionButtons.join("\n")}
          </div>
        </div>
      </div>

      <div class="${outerWrapClass}">
        <div class="${mainContentClass}">
          <!-- Main Content -->
          <div class="rounded-lg border bg-white p-6">
${contentBlock}
          </div>
${childTableSections.join("\n")}
${timelineBlock}
        </div>
${sidebarBlock}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button, Badge, FormControl, createDocumentResource${show_timeline ? ", createListResource, call" : ""} } from 'frappe-ui'

const route = useRoute()
const router = useRouter()
${layout === "tabs" ? `const activeTab = ref(0)\nconst tabs = [${(tabs as any[]).map((t: any) => `{ label: '${t.label}' }`).join(", ")}]\n` : ""}
const doc = createDocumentResource({
  doctype: '${doctype}',
  name: route.params.${route_param},
  auto: true,
})

const statusLabel = computed(() => {
  if (doc.doc?.docstatus === 0) return 'Draft'
  if (doc.doc?.docstatus === 1) return 'Submitted'
  if (doc.doc?.docstatus === 2) return 'Cancelled'
  return doc.doc?.status || 'Active'
})

const statusVariant = computed(() => {
  if (doc.doc?.docstatus === 0) return 'subtle'
  if (doc.doc?.docstatus === 1) return 'success'
  if (doc.doc?.docstatus === 2) return 'warning'
  return 'info'
})

function formatDate(val) {
  if (!val) return '-'
  return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatNumber(val) {
  if (val == null) return '-'
  return Number(val).toLocaleString()
}

${(actions as string[]).includes("edit") ? `function editDoc() {\n  router.push(\`/${toKebabCase(doctype)}/\${doc.doc.name}/edit\`)\n}\n` : ""}
${(actions as string[]).includes("delete") ? `async function deleteDoc() {\n  if (confirm('Are you sure you want to delete this ${doctype}?')) {\n    await doc.delete.submit()\n    router.push('${back_route || "/"}')\n  }\n}\n` : ""}
${(actions as string[]).includes("submit") ? `async function submitDoc() {\n  if (confirm('Submit this ${doctype}?')) {\n    await doc.setValue.submit({ docstatus: 1 })\n    doc.reload()\n  }\n}\n` : ""}
${(actions as string[]).includes("cancel") ? `async function cancelDoc() {\n  if (confirm('Cancel this ${doctype}?')) {\n    await call('frappe.client.cancel', { doctype: '${doctype}', name: doc.doc.name })\n    doc.reload()\n  }\n}\n` : ""}
${(actions as string[]).includes("amend") ? `async function amendDoc() {\n  const res = await call('frappe.client.amend', { doctype: '${doctype}', name: doc.doc.name })\n  if (res?.name) router.push(\`/${toKebabCase(doctype)}/\${res.name}/edit\`)\n}\n` : ""}
${(actions as string[]).includes("print") ? `function printDoc() {\n  window.open(\`/api/method/frappe.utils.print_format.download_pdf?doctype=${encodeURIComponent(doctype)}&name=\${doc.doc.name}\`)\n}\n` : ""}
${(actions as string[]).includes("duplicate") ? `async function duplicateDoc() {\n  const res = await call('frappe.client.insert', {\n    doc: { ...doc.doc, name: undefined, docstatus: 0 },\n  })\n  if (res?.name) router.push(\`/${toKebabCase(doctype)}/\${res.name}\`)\n}\n` : ""}
${show_timeline ? `const newComment = ref('')

const comments = createListResource({
  doctype: 'Comment',
  fields: ['name', 'content', 'owner', 'creation'],
  filters: {
    reference_doctype: '${doctype}',
    reference_name: route.params.${route_param},
    comment_type: 'Comment',
  },
  orderBy: 'creation desc',
  pageLength: 20,
  auto: true,
})

async function addComment() {
  if (!newComment.value.trim()) return
  await call('frappe.client.insert', {
    doc: {
      doctype: 'Comment',
      reference_doctype: '${doctype}',
      reference_name: route.params.${route_param},
      content: newComment.value,
      comment_type: 'Comment',
    },
  })
  newComment.value = ''
  comments.reload()
}` : ""}
</script>
`;
        await ensureAndWrite(filePath, detailVue);

        return {
          content: [
            {
              type: "text",
              text: `Created detail page "${detailName}" at src/pages/${detailName}.vue\nDocType: ${doctype}\nFields: ${fields.length}\nLayout: ${layout}\nActions: ${(actions as string[]).join(", ")}\nTimeline: ${show_timeline}\nSidebar: ${show_sidebar}\nChild tables: ${child_tables.length}`,
            },
          ],
        };
      }

      case "frappe_setup_frontend_proxy": {
        const { app_name, site_url = "http://localhost:8080", socket_port = 9000 } = args;
        const frontendDir = getFrontendPath(ctx.frappePath, app_name);
        const filePath = path.join(frontendDir, "proxyOptions.js");

        // Parse URL to get host and port
        let host = "localhost";
        let port = 8000;
        try {
          const url = new URL(site_url);
          host = url.hostname;
          port = parseInt(url.port) || 8000;
        } catch {}

        const proxyContent = `const commonSiteConfig = {
  webserver_port: ${port},
}

const webserverPort = commonSiteConfig.webserver_port

export function getProxyOptions() {
  return {
    '^/(api|login|assets|files|private)': {
      target: 'http://${host}:\${webserverPort}',
      ws: true,
      router: function (req) {
        const siteNameFromHost = req.headers.host?.split(':')[0]
        return \`http://\${siteNameFromHost}:\${webserverPort}\`
      },
    },
    '^/socket\\.io': {
      target: 'http://${host}:${socket_port}',
      ws: true,
    },
  }
}
`;
        await ensureAndWrite(filePath, proxyContent);

        return {
          content: [
            {
              type: "text",
              text: `Updated proxy configuration at frontend/proxyOptions.js\nBackend: http://${host}:${port}\nSocket.io: http://${host}:${socket_port}`,
            },
          ],
        };
      }

      case "frappe_build_frontend": {
        const { app_name } = args;
        const frontendDir = getFrontendPath(ctx.frappePath, app_name);

        return await ctx.runBenchCommand({
          command: `bash -c "cd ${frontendDir} && yarn build"`,
          cwd: frontendDir,
        });
      }

      case "frappe_get_frontend_structure": {
        const { app_name } = args;
        const frontendDir = getFrontendPath(ctx.frappePath, app_name);

        const structure = await getDirectoryStructure(frontendDir);
        if (!structure) {
          return {
            content: [
              {
                type: "text",
                text: `No frontend directory found at ${frontendDir}. Use frappe_scaffold_frontend_app to create one.`,
              },
            ],
          };
        }

        return {
          content: [{ type: "text", text: `Frontend structure for "${app_name}":\n\n${structure}` }],
        };
      }

      default:
        return null;
    }
  },
};
