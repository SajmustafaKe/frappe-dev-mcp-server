import * as fs from "fs-extra";
import * as path from "path";
import { ToolModule, ToolResult, ToolContext } from "../types.js";
import { getAppModulePath, toSnakeCase } from "../utils/paths.js";
import { ensureAndWrite } from "../utils/files.js";

export const backgroundTools: ToolModule = {
  definitions: [
    {
      name: "frappe_enqueue_job",
      description: "Enqueue a background job using frappe.enqueue() (RQ)",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", description: "Dotted path to the Python method" },
          queue: { type: "string", enum: ["default", "short", "long"], default: "default", description: "RQ queue" },
          timeout: { type: "number", default: 300, description: "Job timeout in seconds" },
          kwargs: { type: "object", description: "Keyword arguments to pass to the method" },
          is_async: { type: "boolean", default: true, description: "Run asynchronously" },
          at_front: { type: "boolean", default: false, description: "Add to front of queue" },
          job_name: { type: "string", description: "Unique job name (prevents duplicate jobs)" },
          deduplicate: { type: "boolean", default: false, description: "Prevent duplicate jobs" },
          site: { type: "string" },
        },
        required: ["method"],
      },
    },
    {
      name: "frappe_get_job_status",
      description: "Get the status of background jobs",
      inputSchema: {
        type: "object",
        properties: {
          job_name: { type: "string", description: "Job name to check" },
          queue: { type: "string", description: "Queue to check" },
          site: { type: "string" },
        },
      },
    },
    {
      name: "frappe_create_scheduled_task",
      description: "Create a Python method and register it as a scheduled task in hooks.py",
      inputSchema: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "App name" },
          task_name: { type: "string", description: "Task function name" },
          frequency: { type: "string", enum: ["all", "daily", "hourly", "weekly", "monthly", "yearly", "cron"], description: "Execution frequency" },
          cron_expression: { type: "string", description: "Cron expression (if frequency is 'cron')" },
          code: { type: "string", description: "Python code for the task function" },
          module_name: { type: "string", default: "tasks", description: "Module file name (default: tasks)" },
        },
        required: ["app_name", "task_name", "frequency", "code"],
      },
    },
    {
      name: "frappe_scheduler_status",
      description: "Check scheduler status or enable/disable scheduler",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["status", "enable", "disable", "resume", "pause"], description: "Scheduler action" },
          site: { type: "string" },
        },
        required: ["action"],
      },
    },
    {
      name: "frappe_purge_jobs",
      description: "Purge failed/pending background jobs",
      inputSchema: {
        type: "object",
        properties: {
          queue: { type: "string", enum: ["default", "short", "long", "all"], default: "all" },
          site: { type: "string" },
        },
      },
    },
  ],

  async handleToolCall(name: string, args: any, ctx: ToolContext): Promise<ToolResult | null> {
    switch (name) {
      case "frappe_enqueue_job": {
        const enqueueArgs: any = {
          method: args.method,
          queue: args.queue || "default",
          timeout: args.timeout || 300,
          is_async: args.is_async !== false,
        };
        if (args.kwargs) enqueueArgs.kwargs = args.kwargs;
        if (args.at_front) enqueueArgs.at_front = true;
        if (args.job_name) enqueueArgs.job_name = args.job_name;
        if (args.deduplicate) enqueueArgs.deduplicate = true;

        return await ctx.runBenchCommand({
          command: `execute frappe.enqueue --kwargs '${JSON.stringify(enqueueArgs)}'`,
          site: args.site,
        });
      }

      case "frappe_get_job_status":
        return await ctx.runBenchCommand({
          command: `execute frappe.utils.background_jobs.get_info --args '${JSON.stringify([args.queue || "default"])}'`,
          site: args.site,
        });

      case "frappe_create_scheduled_task": {
        const { app_name, task_name, frequency, cron_expression, code, module_name = "tasks" } = args;
        const modulePath = getAppModulePath(ctx.frappePath, app_name);
        const tasksFile = path.join(modulePath, `${module_name}.py`);

        const taskCode = `\n\ndef ${task_name}():\n\t"""Scheduled task: ${task_name} (${frequency})"""\n\timport frappe\n${code.split("\n").map((l: string) => "\t" + l).join("\n")}\n`;

        if (await fs.pathExists(tasksFile)) {
          const existing = await fs.readFile(tasksFile, "utf8");
          await fs.writeFile(tasksFile, existing + taskCode);
        } else {
          await ensureAndWrite(tasksFile, `import frappe\n${taskCode}`);
        }

        // Also add to hooks.py
        const hooksPath = path.join(modulePath, "hooks.py");
        let hooksContent = "";
        try {
          hooksContent = await fs.readFile(hooksPath, "utf8");
        } catch {}

        const methodPath = `${app_name}.${module_name}.${task_name}`;
        if (frequency === "cron") {
          if (hooksContent.includes("scheduler_events")) {
            const insertPoint = hooksContent.indexOf("scheduler_events = {") + "scheduler_events = {".length;
            const entry = `\n\t"cron": {\n\t\t"${cron_expression}": [\n\t\t\t"${methodPath}",\n\t\t]\n\t},`;
            hooksContent = hooksContent.slice(0, insertPoint) + entry + hooksContent.slice(insertPoint);
          } else {
            hooksContent += `\n\nscheduler_events = {\n\t"cron": {\n\t\t"${cron_expression}": [\n\t\t\t"${methodPath}",\n\t\t]\n\t}\n}\n`;
          }
        } else {
          if (hooksContent.includes("scheduler_events")) {
            const insertPoint = hooksContent.indexOf("scheduler_events = {") + "scheduler_events = {".length;
            const entry = `\n\t"${frequency}": [\n\t\t"${methodPath}",\n\t],`;
            hooksContent = hooksContent.slice(0, insertPoint) + entry + hooksContent.slice(insertPoint);
          } else {
            hooksContent += `\n\nscheduler_events = {\n\t"${frequency}": [\n\t\t"${methodPath}",\n\t]\n}\n`;
          }
        }

        await fs.writeFile(hooksPath, hooksContent);

        return { content: [{ type: "text", text: `Scheduled task "${task_name}" created:\n  Method: ${tasksFile}\n  Hooks: ${hooksPath}\n  Frequency: ${frequency}${cron_expression ? ` (${cron_expression})` : ""}` }] };
      }

      case "frappe_scheduler_status": {
        const actionMap: Record<string, string> = {
          status: "scheduler status",
          enable: "scheduler enable",
          disable: "scheduler disable",
          resume: "scheduler resume",
          pause: "scheduler pause",
        };
        return await ctx.runBenchCommand({
          command: actionMap[args.action],
          site: args.site,
        });
      }

      case "frappe_purge_jobs":
        return await ctx.runBenchCommand({
          command: `purge-jobs --queue ${args.queue || "all"}`,
          site: args.site,
        });

      default:
        return null;
    }
  },
};
