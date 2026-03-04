import { execSync } from "child_process";
import { ToolResult } from "../types.js";

export function runBenchCommand(
  frappePath: string,
  args: { command: string; site?: string; cwd?: string }
): ToolResult {
  const { command, site, cwd = frappePath } = args;
  const fullCommand = site ? `bench --site ${site} ${command}` : `bench ${command}`;

  try {
    const result = execSync(fullCommand, {
      cwd,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
    });

    return {
      content: [{ type: "text", text: result }],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Command failed: ${error.message}\nStderr: ${error.stderr}`,
        },
      ],
    };
  }
}

export function runFrappeConsole(
  frappePath: string,
  pythonCode: string,
  site?: string
): string {
  const escapedCode = pythonCode.replace(/'/g, "'\\''");
  const siteFlag = site ? `--site ${site}` : "";
  const command = `bench ${siteFlag} execute "frappe.utils.safe_exec('${escapedCode}')"`;

  try {
    return execSync(command, {
      cwd: frappePath,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
    });
  } catch (error: any) {
    return `Error: ${error.message}`;
  }
}
