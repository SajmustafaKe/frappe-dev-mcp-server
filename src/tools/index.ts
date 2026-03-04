import { ToolRegistry } from "./registry.js";
import { doctypeTools } from "./doctype.tools.js";
import { documentTools } from "./document.tools.js";
import { appTools } from "./app.tools.js";
import { benchTools } from "./bench.tools.js";
import { apiTools } from "./api.tools.js";
import { reportTools } from "./report.tools.js";
import { uiTools } from "./ui.tools.js";
import { hooksTools } from "./hooks.tools.js";
import { permissionsTools } from "./permissions.tools.js";
import { workflowTools } from "./workflow.tools.js";
import { scriptsTools } from "./scripts.tools.js";
import { customizationTools } from "./customization.tools.js";
import { communicationTools } from "./communication.tools.js";
import { webTools } from "./web.tools.js";
import { printTools } from "./print.tools.js";
import { dashboardTools } from "./dashboard.tools.js";
import { backgroundTools } from "./background.tools.js";
import { dataTools } from "./data.tools.js";
import { advancedTools } from "./advanced.tools.js";
import { frontendTools } from "./frontend.tools.js";

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Core framework
  registry.register(doctypeTools);
  registry.register(documentTools);
  registry.register(appTools);
  registry.register(benchTools);
  registry.register(apiTools);

  // Hooks & configuration
  registry.register(hooksTools);

  // Permissions & security
  registry.register(permissionsTools);

  // Workflow & automation
  registry.register(workflowTools);

  // Scripts (server & client)
  registry.register(scriptsTools);

  // Customization
  registry.register(customizationTools);

  // Communication
  registry.register(communicationTools);

  // Web & portal
  registry.register(webTools);

  // Print & reports
  registry.register(printTools);
  registry.register(reportTools);

  // Dashboard & workspace
  registry.register(dashboardTools);

  // Background processing
  registry.register(backgroundTools);

  // Data management
  registry.register(dataTools);

  // Advanced (virtual doctypes, testing, pages, modules)
  registry.register(advancedTools);

  // Frontend SPA (frappe-ui + Vue.js + Tailwind)
  registry.register(frontendTools);

  // UI generation
  registry.register(uiTools);

  return registry;
}
