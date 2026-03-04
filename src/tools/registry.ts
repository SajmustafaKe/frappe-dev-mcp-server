import { ToolModule, ToolDefinition, ToolResult, ToolContext } from "../types.js";

export class ToolRegistry {
  private modules: ToolModule[] = [];

  register(module: ToolModule): void {
    this.modules.push(module);
  }

  getAllDefinitions(): ToolDefinition[] {
    return this.modules.flatMap((m) => m.definitions);
  }

  async dispatch(name: string, args: any, context: ToolContext): Promise<ToolResult> {
    for (const module of this.modules) {
      const result = await module.handleToolCall(name, args, context);
      if (result !== null) return result;
    }
    throw new Error(`Unknown tool: ${name}`);
  }
}
